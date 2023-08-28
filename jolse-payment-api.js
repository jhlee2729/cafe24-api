const config = require('../config');
const env = require('./env').env;
const pool = require('./connection-pool').createPool(config[env].database);
const axios = require('axios');
const dateformat = require('dateformat');
const status = config[env].jolse_api.payment_order;
const error_hook = require('./slackhook');

const syncData = {
    shop_no: '',
    access_token: ''
}

const contents = {
    start_date: '',
    end_date: '',
}

const insertData = {
    paymentOrderCount: 0,
    paymentOrder: [],
}

const execute = (sql, callback, data = {}) => {

    pool.getConnection((err, connection) => {
        if (err) throw err;

        connection.query(sql, data, (err, rows) => {
            connection.release();

            if (err) {
                error_hook(syncData.shop_no + '-jolse-payment-api', err, (e, res) => {
                    console.log("execute", err);
                    throw err;
                })
            } else {
                callback(err, rows);
            }
        });
    });
}

const remove_emoji = (text) => {

    return text.replace(/[\{\}\[\]\/?.,;:|\)*~`!^\-_+<>@\$&\\\=\(\'\"]|[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/gi, '');
}

const closing = () => {
    pool.end();
}

const lastApiHistory = () => {
    return new Promise((resolve, reject) => {

        if (status.process == 'manual') { //시작날짜, 마지막날짜 직접입력

            contents.start_date = status.start_date;
            contents.end_date = status.end_date;
            console.log(`직접세팅한날짜 - start_date: ${contents.start_date}, end_date:${contents.end_date}`);
            resolve();

        } else if (status.process == 'auto') {

            execute(`SELECT * 
                FROM app_jolse_payment_history 
                WHERE shop_no="${syncData.shop_no}"
                ORDER BY payment_history_id DESC LIMIT 0,1`,
                (err, rows) => {

                if (err) {
                    throw err;

                } else {

                    //날짜 형식 : 2023-08-01T09:00:00+09:00
                    let now = new Date();
                    let time = dateformat(now, `yyyy-mm-dd'T'HH:MM:ss+09:00`);
                    let yesterday = new Date(now).setDate(now.getDate() - 1);
                    let yesterday_time = dateformat(yesterday, `yyyy-mm-dd'T'HH:MM:ss+09:00`);

                    if (rows.length >= 1) { // history 있는 경우

                        contents.start_date = rows[0].end_date;
                        contents.start_date = new Date(contents.start_date);
                        contents.start_date = new Date(contents.start_date).setMinutes(contents.start_date.getMinutes() - 1); // 1분전
                        contents.start_date = dateformat(contents.start_date, `yyyy-mm-dd'T'HH:MM:ss+09:00`)
                        contents.end_date = time;
                        console.log(`시작(time_to - 1분): ${contents.start_date}, 끝: ${contents.end_date}`);
                        resolve();

                    } else {
                        contents.start_date = yesterday_time; // 하루전
                        contents.end_date = time;
                        resolve();
                    }
                }
            })
        }
    })
}

// # 1 결제일 pay_date 기준(환불완료일) - paymentOrder
const paymentOrder = () => {
    return new Promise((resolve, reject) => {

        let offset = 0; // 최대 15000
        let limit = 1000;

        const getOrder = () => {

            axios({
                method: 'GET',
                url: `https://jolsejolse.cafe24api.com/api/v2/admin/orders?`,
                headers: {
                    "Authorization": `Bearer ${syncData.access_token}`,
                    "Content-Type": `application/json`
                },
                params: {
                    shop_no: `${syncData.shop_no}`,
                    start_date: contents.start_date,
                    end_date: contents.end_date,
                    date_type: 'pay_date',
                    offset: offset,
                    limit: limit,
                    order_status :'N00,N10,N20,N21,N22,C00,C10,C34,C36,C47,C48,C49,C40,N40,N50,R40,E40'
                }

            }).then((response) => {

                if (response.data.orders.length > 0) {

                    insertData.paymentOrder = insertData.paymentOrder.concat(response.data.orders);
                    insertData.paymentOrderCount = insertData.paymentOrder.length;

                    if (response.data.orders.length >= 500) {
                        offset += limit;
                        getOrder();

                    } else {
                        resolve(true);
                    }

                } else {
                    resolve(true);
                }

            }).catch((err) => {
                error_hook(syncData.shop_no + '-jolse-payment-api', err, (e, res) => {
                    console.log("paymentOrder 에러", err);
                    resolve(false);
                });
            });
        }
        getOrder();

    })
}

// #2 insertOrder
const insertOrder = () => {
    return new Promise((resolve, reject) => {

        let loop = 0;
        const callAPI = () => {
            insertData.paymentOrder.length == loop ?
                resolve() :
                databaseOrderInsert(insertData.paymentOrder[loop++], callAPI);
        }
        databaseOrderInsert(insertData.paymentOrder[loop++], callAPI)

    })
}

// #3 app_jolse_payment_order DB 저장
const databaseOrderInsert = (order, callback) => {

    // order insert
    const tomodel_order = {
        shop_no: order.shop_no,
        order_id: order.order_id,
        order_date: order.order_date,
        payment_date: order.payment_date,
        initial_payment_amount: order.initial_order_amount.payment_amount,
        actual_payment_amount: order.actual_order_amount.payment_amount
    }

    execute(`INSERT IGNORE INTO app_jolse_payment_order SET ?`,
        (err, rows) => {
            if (err) {
                error_hook(syncData.shop_no + '-jolse-payment-api', err, (e, res) => {
                    console.log("OrderInsert 에러", err)
                    throw err;
                });
            } else {
                callback();
            }
        }, tomodel_order);
}

const timeSave = () => {
    return new Promise((resolve, reject) => {

        execute(`INSERT INTO app_jolse_payment_history (
                shop_no,
                start_date,
                end_date,
                payment_count
                ) VALUES (
                    "${syncData.shop_no}",
                    "${contents.start_date}",
                    "${contents.end_date}",
                    ${insertData.paymentOrder.length}
                )`,
            (err, rows) => {
                if (err) {
                    error_hook(syncData.shop_no + '-jolse-payment-api', err, (e, res) => {
                        console.log("timeSave", err)
                        throw err;
                    });
                } else {
                    resolve();
                }
            }, {});
    })
}

const connectionClose = (callback, bool) => {
    return new Promise((resolve, reject) => {

        console.log(`paymentOrder: ${insertData.paymentOrder.length}`);
        console.log(new Date() + ' 종료');
        console.log('=====================================================================');

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

        syncData.shop_no = sync.shop_no;
        syncData.access_token = sync.access_token;

        //초기화
        insertData.paymentOrderCount = 0;
        insertData.paymentOrder = [];

        await lastApiHistory();
        const success = await paymentOrder();

        if (!success) {
            await connectionClose(callback, bool);
            return;
        }

        insertData.paymentOrder.length != 0 && await insertOrder();

        await timeSave();
        await connectionClose(callback, bool);

    } catch (e) {
        console.log("에러3", e);
    }
}

module.exports = worker;