const config = require('../config');
const env = require('./env').env;
const pool = require('./connection-pool').createPool(config[env].database);
const axios = require('axios');

const data = {};
const syncData = {
    shop_no: '',
    access_token: ''
}

const insertData = {
    productNo: [],
    productList: []
}

const execute = (sql, callback, data = {}) => {

    pool.getConnection((err, connection) => {
        if (err) throw err;

        connection.query(sql, data, (err, rows) => {
            connection.release();
            if (err) {
                throw err;
            } else {
                callback(err, rows);
            }
        });
    });
}

let check = 0;
let product_no = 0;

const init_fn = () => {

    insertData.productNo = [];
    insertData.productList = [];

    check = 0;
    product_no = 0;

}

const getJolseSync = () => {
    return new Promise((resolve, reject) => {

        pool.getConnection((err, connection) => {
            if (err) throw err;

            connection.query(`SELECT * FROM app_jolse_sync WHERE is_item=1 `, (err, rows) => {
                connection.release();
                data.api_market_id = rows[0].api_market_id;
                syncData.access_token = rows[0].access_token;
                resolve();
            });
        });
    });
}

const closing = () => {
    pool.end();
}

const productNo = () => {
    return new Promise((resolve, reject) => {

        const getproductNo = () => {

            getJolseSync(); //axios 호출할 때마다 access_token 값 가져오기

            axios({
                method: 'GET',
                url: 'https://jolsejolse.cafe24api.com/api/v2/admin/products',
                headers: {
                    "Authorization": `Bearer ${syncData.access_token}`,
                    "Content-Type": `application/json`
                },
                params: {
                    shop_no: `${syncData.shop_no}`,
                    since_product_no: product_no,
                    limit: 100
                }

            }).then((response) => {

                if (response.data.products.length > 0) {

                    insertData.productNo = insertData.productNo.concat(response.data.products);
                    product_no = response.data.products[response.data.products.length - 1].product_no;

                    if (response.data.products.length >= 100) {
                        getproductNo();
                    } else {
                        resolve(true)
                    }

                } else {
                    resolve(true)
                }

            }).catch((err) => {
                console.log("에러1", err)
                closing();
                resolve(false)
            })
        }
        getproductNo();
    });
}

const callStartTimeSave = () => {
    return new Promise((resolve, reject) => {

        let callCount = insertData.productNo.length;
        let shop_no = syncData.shop_no;

        execute(`INSERT INTO app_jolse_api_call VALUES (NULL, ${shop_no}, NULL, NULL, ${callCount},0, 0)`, (err, rows) => {
            if (err) throw err;

            data.call_id = rows.insertId;

            // console.log("API call_id:",data.call_id)
            resolve();
        })
    })
}

const productInfo = () => {
    return new Promise((resolve, reject) => {

        const getproductInfo = () => {

            getJolseSync(); //axios 호출할 때마다 access_token 값 가져오기

            let product_no = insertData.productNo[check].product_no;

            axios({
                method: 'GET',
                url: `https://jolsejolse.cafe24api.com/api/v2/admin/products/${product_no}?`,
                headers: {
                    "Authorization": `Bearer ${syncData.access_token}`,
                    "Content-Type": `application/json`
                },
                params: {
                    embed: "variants,benefits,discountprice,seo,inventories",
                    shop_no: `${syncData.shop_no}`
                }

            }).then((response) => {

                // console.log("response API호출제한 확인 (call-limit)", response.headers)
                insertData.productList = insertData.productList.concat(response.data.product);

                check++;

                if (check != insertData.productNo.length) {

                    //API 호출 비동기 처리
                    setTimeout(() => {
                        getproductInfo();
                    }, 500)

                } else {
                    resolve(true);
                }
            }).catch((err) => {

                console.log("에러2", err);

                //API 호출시점에 마지막번째 상품 삭제했을 경우 처리
                if (product_no != insertData.productNo[insertData.productNo.length - 1].product_no) {
                    check++;
                    getproductInfo();

                } else {
                    closing();
                    resolve(false);
                }
            })
        }
        getproductInfo();
    })
}

const insertProduct = () => {
    return new Promise((resolve, reject) => {

        let loop = 0;

        const callAPI = () => {
            insertData.productList.length == loop ? resolve(true) : databaseInsert(insertData.productList[loop++], callAPI)
        }

        databaseInsert(insertData.productList[loop++], callAPI);
    })
}

const databaseInsert = (product, callback) => {

    let variants = product.variants;
    let count = 0;
    let call_id = data.call_id;
    let api_market_id = data.api_market_id;

    const check = () => {
        count++;
        count == 2 && callback();
    }

    execute(`INSERT INTO app_jolse_item
            (
                shop_no,
                product_no,
                product_name,
                variant_code,
                custom_variant_code,
                product_code,
                custom_product_code,
                price_excluding_tax,
                price,
                retail_price,
                supply_price,
                display,
                selling,
                quantity,
                display_soldout,
                use_inventory,
                important_inventory,
                inventory_control_type,
                safety_inventory,
                sold_out,
                has_option,
                option_type,
                summary_description,
                margin_rate,
                points_by_product,
                detail_image,
                brand_code,
                hscode,
                created_date,
                updated_date,
                clearance_category_eng,
                clearance_category_kor,
                clearance_category_code,
                meta_title,
                meta_author,
                meta_description,
                meta_keywords,
                meta_alt,
                search_engine_exposure,
                call_id,
                api_market_id
            )
            VALUES
            (
                "${product.shop_no || ''}",
                "${product.product_no || ''}",
                "${product.product_name || ''}",
                "${product.hasOwnProperty('variants') && product.variants[0].variant_code || ''}",
                "${product.hasOwnProperty('variants') && product.variants[0].custom_variant_code || ''}",
                "${product.product_code || ''}",
                "${product.custom_product_code || ''}",
                "${product.price_excluding_tax || 0}",
                "${product.price || 0}",
                "${product.retail_price || 0}",
                "${product.supply_price || 0}",
                "${product.display || ''}",
                "${product.selling || ''}",
                "${product.hasOwnProperty('variants') && product.variants[0].quantity || 0}",
                "${product.hasOwnProperty('variants') && product.variants[0].display_soldout || ''}",
                "${product.hasOwnProperty('variants') && product.variants[0].use_inventory || ''}",
                "${product.hasOwnProperty('variants') && product.variants[0].important_inventory || ''}",
                "${product.hasOwnProperty('variants') && product.variants[0].inventory_control_type || ''}",
                "${product.hasOwnProperty('variants') && product.variants[0].safety_inventory || 0}",
                "${product.sold_out || ''}",
                "${product.has_option || ''}",
                "${product.option_type || ''}",
                "${product.summary_description ? product.summary_description.replace(/"/g, '\\"') : ''}",
                "${product.margin_rate || 0}",
                "${product.points_by_product || ''}",
                "${product.detail_image || ''}",
                "${product.brand_code || ''}",
                "${product.hscode || ''}",
                "${product.created_date || ''}",
                "${product.updated_date || ''}",
                "${product.clearance_category_eng || ''}",
                "${product.clearance_category_kor || ''}",
                "${product.clearance_category_code || ''}",
                "${product.hasOwnProperty('seo') && product.seo.meta_title || ''}",
                "${product.hasOwnProperty('seo') && product.seo.meta_author || ''}",
                "${product.hasOwnProperty('seo') && product.seo.meta_description ? product.seo.meta_description.replace(/"/g, '\\"') : ''}",
                "${product.hasOwnProperty('seo') && product.seo.meta_keywords ? product.seo.meta_keywords.replace(/"/g, '\\"') : ''}",
                "${product.hasOwnProperty('seo') && product.seo.meta_alt ? product.seo.meta_alt.replace(/"/g, '\\"') : ''}",
                "${product.hasOwnProperty('seo') && product.seo.search_engine_exposure || ''}",
                "${call_id}",
                "${api_market_id}"
            ) 
            ON DUPLICATE KEY UPDATE
                shop_no = "${product.shop_no || ''}",
                product_no = "${product.product_no || ''}",
                product_name = "${product.product_name || ''}",
                variant_code = "${product.hasOwnProperty('variants') && product.variants[0].variant_code || ''}",
                custom_variant_code = "${product.hasOwnProperty('variants') && product.variants[0].custom_variant_code || ''}",
                product_code = "${product.product_code || ''}",
                custom_product_code = "${product.custom_product_code || ''}",
                price_excluding_tax =  "${product.price_excluding_tax || 0}",
                price = "${product.price || 0}",
                retail_price = "${product.retail_price || 0}",
                supply_price = "${product.supply_price || 0}",
                display = "${product.display || ''}",
                selling = "${product.selling || ''}",
                quantity = "${product.hasOwnProperty('variants') && product.variants[0].quantity || 0}",
                display_soldout = "${product.hasOwnProperty('variants') && product.variants[0].display_soldout || ''}",
                use_inventory = "${product.hasOwnProperty('variants') && product.variants[0].use_inventory || ''}",
                important_inventory = "${product.hasOwnProperty('variants') && product.variants[0].important_inventory || ''}",
                inventory_control_type = "${product.hasOwnProperty('variants') && product.variants[0].inventory_control_type || ''}",
                safety_inventory = "${product.hasOwnProperty('variants') && product.variants[0].safety_inventory || 0}",
                sold_out = "${product.sold_out || ''}",
                has_option = "${product.has_option || ''}",
                option_type = "${product.option_type || ''}",
                summary_description = "${product.summary_description ? product.summary_description.replace(/"/g, '\\"') : ''}",
                margin_rate = "${product.margin_rate || 0}",
                points_by_product = "${product.points_by_product || ''}",
                detail_image = "${product.detail_image || ''}",
                brand_code = "${product.brand_code || ''}",
                hscode = "${product.hscode || ''}",
                created_date = "${product.created_date || ''}",
                updated_date = "${product.updated_date || ''}",
                clearance_category_eng = "${product.clearance_category_eng || ''}",
                clearance_category_kor = "${product.clearance_category_kor || ''}",
                clearance_category_code = "${product.clearance_category_code || ''}",
                meta_title = "${product.hasOwnProperty('seo') && product.seo.meta_title || ''}",
                meta_author = "${product.hasOwnProperty('seo') && product.seo.meta_author || ''}",
                meta_description = "${product.hasOwnProperty('seo') && product.seo.meta_description.replace(/"/g, '\\"') || ''}",
                meta_keywords = "${product.hasOwnProperty('seo') && product.seo.meta_keywords.replace(/"/g, '\\"') || ''}",
                meta_alt =  "${product.hasOwnProperty('seo') && product.seo.meta_alt.replace(/"/g, '\\"') || ''}",
                search_engine_exposure =  "${product.hasOwnProperty('seo') && product.seo.search_engine_exposure || ''}",
                call_id ="${call_id}",
                api_market_id ="${api_market_id}"
            `,
        (err, rows) => {
            if (err) {
                console.log("DB에러1:", err)
                console.log("DB에러 정보:", variants)
                check();
            } else {
                check();
            }
        }, {})

    let loop = 0;

    const loopFn = () => {

        execute(`INSERT INTO app_jolse_item_variation
                (
                    shop_no,
                    product_no,
                    options_name,
                    options_value,
                    variant_code,
                    custom_variant_code,
                    custom_product_code,
                    display,
                    selling,
                    quantity,
                    display_soldout,
                    sold_out,
                    has_option,
                    additional_amount,
                    use_inventory,
                    important_inventory,
                    inventory_control_type,
                    safety_inventory,
                    call_id
                )
                VALUES
                (
                    "${variants[loop].shop_no}",
                    "${product.product_no}",
                    "${variants[loop].options[0].name}",
                    "${variants[loop].options[0].value}",
                    "${variants[loop].variant_code}",
                    "${variants[loop].custom_variant_code}",
                    "${product.custom_product_code}",
                    "${variants[loop].display}",
                    "${variants[loop].selling}",
                    "${variants[loop].quantity || 0}",
                    "${variants[loop].display_soldout}",
                    "${product.sold_out}",
                    "${product.has_option}",
                    "${variants[loop].additional_amount || 0}",
                    "${variants[loop].use_inventory}",
                    "${variants[loop].important_inventory}",
                    "${variants[loop].inventory_control_type}",
                    "${variants[loop].safety_inventory || 0}",
                    "${call_id}"
                )
                ON DUPLICATE KEY UPDATE
                    shop_no = "${variants[loop].shop_no}",
                    product_no = "${product.product_no}",
                    options_name = "${variants[loop].options[0].name}",
                    options_value = "${variants[loop].options[0].value}",
                    variant_code = "${variants[loop].variant_code}",
                    custom_variant_code = "${variants[loop].custom_variant_code}",
                    custom_product_code = "${product.custom_product_code}",
                    display = "${variants[loop].display}",
                    selling = "${variants[loop].selling}",
                    quantity = "${variants[loop].quantity || 0}",
                    display_soldout = "${variants[loop].display_soldout}",
                    sold_out = "${product.sold_out}",
                    has_option = "${product.has_option}",
                    additional_amount = "${variants[loop].additional_amount || 0}",
                    use_inventory = "${variants[loop].use_inventory}",
                    important_inventory = "${variants[loop].important_inventory}",
                    inventory_control_type = "${variants[loop].inventory_control_type}",
                    safety_inventory = "${variants[loop].safety_inventory || 0}",
                    call_id = "${call_id}"
                `,

            (err, rows) => {

                if (err) {
                    console.log("DB에러2:", err)
                    throw err;
                } else {

                    (variants.length == ++loop) ? check() : loopFn();
                }
            }, {})

    }

    if (product.has_option == 'T') {

        loopFn();

    } else {

        check();
    }

}

const callEndTimeSave = () => {
    return new Promise((resolve, reject) => {

        let callCount = insertData.productList.length;

        execute(`UPDATE app_jolse_api_call SET call_end_time=NULL ,end_count="${callCount}",is_end=1 WHERE call_id =${data.call_id}`, (err, rows) => {
            if (err) throw err;

            resolve();
        })
    })
}

const connectionClose = (callback, bool) => {
    return new Promise((resolve, reject) => {

        console.log(new Date() + ' 종료');
        console.log('=====================================================================');
        console.timeEnd();

        if (bool) {
            closing();
        }
        callback();
    });
}

const worker = async (sync, callback, bool) => {

    try {

        console.log('=====================================================================');
        console.log(new Date() + ' 시작');
        console.time();

        //초기화
        init_fn();

        syncData.shop_no = sync.shop_no;
        syncData.access_token = sync.access_token;

        const success1 = await productNo();
        if (!success1) {
            await connectionClose(callback, bool);
            return;
        }

        await callStartTimeSave();

        const success2 = await productInfo();
        if (!success2) {
            await connectionClose(callback, bool);
            return;
        }

        insertData.productList.length != 0 && await insertProduct();
        await callEndTimeSave();
        await connectionClose(callback, bool)

    } catch (e) {
        console.log("에러3", e);
    }
}

module.exports = worker;