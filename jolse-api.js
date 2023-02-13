const config = require('../config');
const env = require('./env').env;
const pool = require('./connection-pool').createPool(config[env].database);
const axios = require('axios');
const dateformat = require('dateformat');
const status = require('./jolse_config');
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
    createOrderCount:0,
    createOrder:[],
    createOrderDetails:[],
    updateOrderCount:0,
    updateOrder: [],
    updateOrderDetails: [],
    cancelOrderDetails: []
}

const execute = (sql,callback,data = {})=>{
    
    pool.getConnection((err,connection) => {
      if (err) throw err;
  
        connection.query(sql,data,(err,rows) => {
            connection.release();
            if ( err ) {
                throw err;
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

const lastCreateTimeTo = () => {
    return new Promise((resolve,reject) => {

        if ( status.process == 'manual' ) { //시작날짜, 마지막날짜 직접입력

            contents.start_date = status.start_date; 
            contents.end_date = status.end_date;
            console.log(`직접세팅한날짜- start_date: ${contents.start_date}, end_date:${contents.end_date}` );
            resolve();

        } else if ( status.process == 'auto' ) {

            execute(`SELECT time_to 
                FROM app_jolse_api_history 
                WHERE shop_no="${syncData.shop_no}" ORDER BY api_history_id DESC LIMIT 0,1`, 
                (err,rows) => {

                    if (err) {
                        throw err;

                    } else {

                        //날짜 형식 : 2021-11-08T09:00:00+09:00
                        let now = new Date();
                        let time = dateformat(now,`yyyy-mm-dd'T'HH:MM:ss+09:00`);
                        let yesterday = new Date(now).setDate(now.getDate() - 1);
                        let yesterday_time = dateformat(yesterday, `yyyy-mm-dd'T'HH:MM:ss+09:00`);

                        if ( rows.length >= 1 ) { //time_to 있는 경우
                            contents.start_date = rows[0].time_to;
                            contents.end_date = time;
                            console.log(`시작:${contents.start_date}, 끝: ${contents.end_date }`);
                            resolve();
                        } else {
                            contents.start_date = yesterday_time; // 하루전
                            contents.end_date = time;
                            // console.log(`없는경우 하루전부터-현시점까지, 시작:${contents.start_date}, 끝: ${contents.end_date }`);
                            resolve();
                        }
                    }
            })
        }
    })
}

const createOrder = () => {
    return new Promise((resolve,reject) => {
        console.log(`${syncData.access_token}`,contents.start_date, contents.end_date);

        let offset = 0; // 최대 15000
        let limit = 1000;

        // orderList - order, detail[items] 포함
        const getOrder = () => {
            axios({
                method : 'GET',
                url : `https://jolsejolse.cafe24api.com/api/v2/admin/orders?`,
                headers: {
                    "Authorization": `Bearer ${syncData.access_token}`,
                    "Content-Type" : `application/json`
                },
                params:{
                    shop_no: `${syncData.shop_no}`,
                    start_date: contents.start_date,
                    end_date: contents.end_date,
                    date_type:'pay_date',
                    offset:offset,
                    limit:limit,
                    embed: 'items,receivers,buyer,cancellation',
                    order_status :'N00,N10,N20,N21,N22,C00,C10,C34,C36,C47,C48,C49,C40'
                  }
    
            }).then((response) => {

                // console.log("=================RESPONSE LENGTH=====================", response.data.orders.length)
                
                if (response.data.orders.length > 0) {

                    insertData.createOrder = insertData.createOrder.concat(response.data.orders);
                    insertData.createOrderCount = insertData.createOrder.length;

                    // detail 저장
                    response.data.orders.forEach(element => {
                        element.items.forEach(i => {
                            i.order_id = element.order_id;
                            insertData.createOrderDetails = insertData.createOrderDetails.concat(i);
                        });
                    });

                    console.log("총 주문수량",insertData.createOrderCount); // 총 주문수량
                    console.log("총 상세수량", insertData.createOrderDetails.length); // 총 상세수량

                    if ( response.data.orders.length >= 1000) {
                        offset += limit;
                        getOrder();
                        
                    } else {
                        // console.log("insert", insertData.createOrder.length)
                        resolve(true);
                    }

                } else {
                    resolve(true);
                }
    
            }).catch((err) => {
                console.log("createOrder 에러", err);
                resolve(false);
            });
        }
        getOrder();
    })
}

const databaseOrderInsert = (order,callback) => {
      // order insert
    const tomodel_order = {
        shop_no: syncData.shop_no,
        currency: order.currency,
        order_id: order.order_id,
        market_id: order.market_id,
        market_order_no: order.market_order_no,
        // postman : market_order_info, axios: 키값 없음
        market_order_info: order.market_order_info,
        member_id: order.member_id,
        member_email: order.member_email,
        member_authentication: order.member_authentication,
        billing_name: order.billing_name,
        bank_code: order.bank_code,
        bank_code_name: order.bank_code_name,
        payment_method: order.payment_method.join(),
        payment_method_name: order.payment_method_name.join(),
        payment_gateway_name: order.payment_gateway_name,
        sub_payment_method_name: order.sub_payment_method_name,
        sub_payment_method_code: order.sub_payment_method_code,
        transaction_id: order.transaction_id,
        paid: order.paid,
        canceled: order.canceled,
        order_date: order.order_date,
        first_order: order.first_order,
        payment_date: order.payment_date,
        order_from_mobile: order.order_from_mobile,
        use_escrow: order.use_escrow,
        group_no_when_ordering: order.group_no_when_ordering,
        initial_order_price_amount: order.initial_order_amount.order_price_amount, 

        // initial_order_amount 객체
        initial_shipping_fee: order.initial_order_amount.shipping_fee,
        initial_points_spent_amount: order.initial_order_amount.points_spent_amount,
        initial_credits_spent_amount: order.initial_order_amount.credits_spent_amount,
        initial_coupon_discount_price: order.initial_order_amount.coupon_discount_price,
        initial_coupon_shipping_fee_amount: order.initial_order_amount.coupon_shipping_fee_amount,
        initial_membership_discount_amount: order.initial_order_amount.membership_discount_amount,
        initial_shipping_fee_discount_amount: order.initial_order_amount.shipping_fee_discount_amount,
        initial_set_product_discount_amount: order.initial_order_amount.set_product_discount_amount,
        initial_app_discount_amount: order.initial_order_amount.app_discount_amount,
        initial_point_incentive_amount: order.initial_order_amount.point_incentive_amount,
        initial_total_amount_due: order.initial_order_amount.total_amount_due,
        initial_payment_amount: order.initial_order_amount.payment_amount,
        initial_market_other_discount_amount: order.initial_order_amount.market_other_discount_amount,
        initial_tax: order.initial_order_amount.tax,

        // actual_order_amount 객체
        actual_order_price_amount: order.actual_order_amount.order_price_amount, 
        actual_shipping_fee: order.actual_order_amount.shipping_fee,
        actual_points_spent_amount: order.actual_order_amount.points_spent_amount,
        actual_credits_spent_amount: order.actual_order_amount.credits_spent_amount,
        actual_coupon_discount_price: order.actual_order_amount.coupon_discount_price,
        actual_coupon_shipping_fee_amount: order.actual_order_amount.coupon_shipping_fee_amount,
        actual_membership_discount_amount: order.actual_order_amount.membership_discount_amount,
        actual_shipping_fee_discount_amount: order.actual_order_amount.shipping_fee_discount_amount,
        actual_set_product_discount_amount: order.actual_order_amount.set_product_discount_amount,
        actual_app_discount_amount: order.actual_order_amount.app_discount_amount,
        actual_point_incentive_amount: order.actual_order_amount.point_incentive_amount,
        actual_total_amount_due: order.actual_order_amount.total_amount_due,
        actual_payment_amount: order.actual_order_amount.payment_amount,
        actual_market_other_discount_amount: order.actual_order_amount.market_other_discount_amount,
        actual_tax: order.actual_order_amount.tax,

        bank_account_no: order.bank_account_no,
        bank_account_owner_name: order.bank_account_owner_name,
        market_seller_id: order.market_seller_id,
        payment_amount: order.payment_amount,
        cancel_date: order.cancel_date,
        order_place_name: order.order_place_name,
        order_place_id: order.order_place_id,
        payment_confirmation: order.payment_confirmation,
        commission: order.commission,
        postpay: order.postpay,
        admin_additional_amount: order.admin_additional_amount,
        additional_shipping_fee: order.additional_shipping_fee,
        international_shipping_insurance: order.international_shipping_insurance,
        additional_handling_fee: order.additional_handling_fee,
        shipping_type: order.shipping_type,
        shipping_type_text: order.shipping_type_text,
        shipping_status: order.shipping_status,
        wished_delivery_date: order.wished_delivery_date,
        wished_delivery_time: order.wished_delivery_time,
        wished_carrier_id: order.wished_carrier_id,
        wished_carrier_name: order.wished_carrier_name,
        return_confirmed_date: order.return_confirmed_date,
        total_supply_price: order.total_supply_price,
        store_pickup: order.store_pickup,
        easypay_name: order.easypay_name,
        loan_status: order.loan_status,
        subscription: order.subscription,

        //receivers 배열
        // remove_emoji(order.receivers[0].name)?.replace(/"/g, '\\"')
        receivers_name: remove_emoji(order.receivers[0].name)?.replace(/"/g, '\\"'),
        receivers_name_furigana: remove_emoji(order.receivers[0].name_furigana)?.replace(/"/g, '\\"'),
        receivers_phone: order.receivers[0].phone,
        receivers_cellphone: order.receivers[0].cellphone,
        receivers_virtual_phone_no: order.receivers[0].virtual_phone_no,
        receivers_zipcode: order.receivers[0].zipcode,
        receivers_address1: remove_emoji(order.receivers[0].address1)?.replace(/"/g, '\\"'),
        receivers_address2: remove_emoji(order.receivers[0].address2)?.replace(/"/g, '\\"'),
        receivers_address_state: order.receivers[0].address_state,
        receivers_address_city: order.receivers[0].address_city,
        receivers_address_street: order.receivers[0].address_street,
        receivers_address_full: remove_emoji(order.receivers[0].address_full)?.replace(/"/g, '\\"'),
        receivers_name_en: order.receivers[0].name_en,
        receivers_city_en: order.receivers[0].city_en,
        receivers_state_en: order.receivers[0].state_en,
        receivers_street_en: order.receivers[0].street_en,
        receivers_country_code: order.receivers[0].country_code,
        receivers_country_name: order.receivers[0].country_name,
        receivers_country_name_en: order.receivers[0].country_name_en,
        receivers_shipping_message: order.receivers[0].shipping_message,
        receivers_clearance_information_type: order.receivers[0].clearance_information_type,
        receivers_clearance_information: order.receivers[0].clearance_information,
        receivers_wished_delivery_date: order.receivers[0].wished_delivery_date,
        receivers_wished_delivery_time: order.receivers[0].wished_delivery_time,
        receivers_shipping_code: order.receivers[0].shipping_code,

        // buyer 객체
        buyer_member_id: order.buyer.member_id,
        buyer_member_group_no: order.buyer.member_group_no,
        buyer_name: order.buyer.name,
        buyer_names_furigana: order.buyer.names_furigana,
        buyer_email: order.buyer.email,
        buyer_phone: order.buyer.phone,
        buyer_cellphone: order.buyer.cellphone,
        buyer_customer_notification: order.buyer.customer_notification,
        buyer_updated_date: order.buyer.updated_date,
        buyer_user_id: order.buyer.user_id,
        buyer_user_name: order.buyer.user_name,
        multiple_addresses: order.multiple_addresses,
        exchange_rate: order.exchange_rate,
        first_payment_method: order.first_payment_method,
        include_tax: order.include_tax
    }

    execute(`INSERT IGNORE INTO app_jolse_order SET ?`,
    (err,rows)=>{
        if ( err ) {
            error_hook(syncData.shop_no, err,(e,res) => {
                console.log("OrderInsert 에러", err)
                throw err;
            });
        } else {
            callback();
        }
    }, tomodel_order);
}

const insertOrder = () => {
    return new Promise((resolve,reject) => {

        let loop = 0;
        const callAPI = () => {
            insertData.createOrder.length == loop ? 
            resolve() :
            databaseOrderInsert(insertData.createOrder[loop++], callAPI);
        }
        databaseOrderInsert(insertData.createOrder[loop++], callAPI)

    })
}

const databaseOrderDetailsInsert = (details, callback) => {

    // console.log(`details: ${details.order_item_code}`)
    // console.log(`details: ${details.order_id}`)
    //order_details insert
    const tomodel_order_details = {
        shop_no: syncData.shop_no,
        order_id : details.order_id,
        item_no: details.item_no,
        order_item_code: details.order_item_code,
        variant_code: details.variant_code,
        product_no: details.product_no,
        product_code: details.product_code,
        internal_product_name: details.internal_product_name,
        custom_product_code: details.custom_product_code,
        custom_variant_code: details.custom_variant_code,
        eng_product_name: details.eng_product_name,
        option_id: details.option_id,
        option_value: details.option_value,
        additional_option_value: details.additional_option_value,
        product_name: details.product_name,
        product_price: details.product_price,
        option_price: details.option_price,
        additional_discount_price: details.additional_discount_price,
        coupon_discount_price: details.coupon_discount_price,
        app_item_discount_amount: details.app_item_discount_amount,
        
        // postman:actual_payment_amount, axios:payment_amount
        actual_payment_amount: details.payment_amount,
        quantity: details.quantity,
        product_tax_type: details.product_tax_type,
        // postman: tax_amount, axios:tax_rate
        tax_amount: details.tax_rate,
        supplier_product_name: details.supplier_product_name,
        supplier_transaction_type: details.supplier_transaction_type,
        supplier_id: details.supplier_id,
        supplier_name: details.supplier_name,
        tracking_no:details.tracking_no,
        shipping_code: details.shipping_code,

        claim_code: details.claim_code,
        claim_reason_type: details.claim_reason_type,
        claim_reason: details.claim_reason,
        refund_bank_name: details.refund_bank_name,
        refund_bank_account_no: details.refund_bank_account_no,
        refund_bank_account_holder: details.efund_bank_account_holder,

        post_express_flag: details.post_express_flag,
        order_status: details.order_status,
        request_undone: details.request_undone,
        order_status_additional_info: details.order_status_additional_info,
        claim_quantity: details.claim_quantity,
        status_code: details.status_code,
        status_text: details.status_text,
        open_market_status: details.open_market_status,
        bundled_shipping_type: details.bundled_shipping_type,
        shipping_company_id: details.shipping_company_id,
        shipping_company_name: details.shipping_company_name,
        shipping_company_code: details.shipping_company_code,
        product_bundle: details.product_bundle,
        product_bundle_no: details.product_bundle_no,
        product_bundle_name: details.product_bundle_name,

        product_bundle_type: details.product_bundle_type,
        was_product_bundle: details.was_product_bundle,
        original_bundle_item_no: details.original_bundle_item_no,
        individual_shipping_fee: details.individual_shipping_fee,
        shipping_fee_type: details.shipping_fee_type,
        shipping_fee_type_text: details.shipping_fee_type_text,
        shipping_payment_option: details.shipping_payment_option,
        payment_info_id: details.payment_info_id,
        original_item_no: details.original_item_no.join(),
        store_pickup: details.store_pickup,
        ordered_date: details.ordered_date,

        cancel_date: details.cancel_date,
        return_confirmed_date: details.return_confirmed_date,
        return_request_date: details.return_request_date,
        return_collected_date: details.return_collected_date,
        cancel_request_date: details.cancel_request_date,
        refund_date: details.refund_date,
        exchange_request_date: details.exchange_request_date,
        exchange_date: details.exchange_date,
        product_material: details.product_material,

        product_weight: details.product_weight,
        volume_size: details.volume_size,
        volume_size_weight: details.volume_size_weight,

        hs_code: details.hs_code,
        one_plus_n_event: details.one_plus_n_event,
        origin_place: details.origin_place,
        origin_place_no: details.origin_place_no,
        made_in_code: details.made_in_code,
        origin_place_value: details.origin_place_value,
        gift: details.gift,

        item_granting_gift: details.item_granting_gift,
        subscription: details.subscription,
        product_bundle_list: details.product_bundle_list,
        market_cancel_request: details.market_cancel_request,
        market_cancel_request_quantity: details.market_cancel_request_quantity,
        market_fail_reason: details.market_fail_reason,
        market_fail_reason_guide: details.market_fail_reason_guide,
        market_custom_variant_code: details.market_custom_variant_code,
        option_type: details.option_type,
        market_discount_amount: details.market_discount_amount,
        labels: details.labels,
        order_status_before_cs: details.order_status_before_cs
    }

    execute(`INSERT IGNORE INTO app_jolse_order_details SET ?`,
    (err,rows)=>{
        if ( err ) {
            error_hook(syncData.shop_no,err,(e,res) => {
                console.log("OrderDetailsInsert 에러", err)
                throw err;
            });
        } else {
            callback();
        }
    }, tomodel_order_details);

}

const databaseOrderUpsert = (order, callback) => {

      //order upsert
    //   execute(`INSERT INTO app_jolse_order
    //   (
    //         currency,
    //         order_id,
    //         market_id,
    //         market_order_no,
    //         market_order_info,
    //         member_id,
    //         member_email,
    //         member_authentication,
    //         billing_name,
    //         bank_code,
    //         bank_code_name,
    //         payment_method,
    //         payment_method_name,
    //         payment_gateway_name,
    //         sub_payment_method_name,
    //         sub_payment_method_code,
    //         transaction_id,
    //         paid,
    //         canceled,
    //         order_date,
    //         first_order,
    //         payment_date,
    //         order_from_mobile,
    //         use_escrow,
    //         group_no_when_ordering,
    //         initial_order_price_amount,
    //         initial_shipping_fee,
    //         initial_points_spent_amount,
    //         initial_credits_spent_amount,
    //         initial_coupon_discount_price,
    //         initial_coupon_shipping_fee_amount,
    //         initial_membership_discount_amount,
    //         initial_shipping_fee_discount_amount,
    //         initial_set_product_discount_amount,
    //         initial_app_discount_amount,
    //         initial_point_incentive_amount,
    //         initial_total_amount_due,
    //         initial_payment_amount,
    //         initial_market_other_discount_amount,
    //         initial_tax,
    //         actual_order_price_amount,
    //         actual_shipping_fee,
    //         actual_points_spent_amount,
    //         actual_credits_spent_amount,
    //         actual_coupon_discount_price,
    //         actual_coupon_shipping_fee_amount,
    //         actual_membership_discount_amount,
    //         actual_shipping_fee_discount_amount,
    //         actual_set_product_discount_amount,
    //         actual_app_discount_amount,
    //         actual_point_incentive_amount,
    //         actual_total_amount_due,
    //         actual_payment_amount,
    //         actual_market_other_discount_amount,
    //         actual_tax,
    //         bank_account_no,
    //         bank_account_owner_name,
    //         market_seller_id,
    //         payment_amount,
    //         cancel_date,
    //         order_place_name,
    //         order_place_id,
    //         payment_confirmation,
    //         commission,
    //         postpay,
    //         admin_additional_amount,
    //         additional_shipping_fee,
    //         international_shipping_insurance,
    //         additional_handling_fee,
    //         shipping_type,
    //         shipping_type_text,
    //         shipping_status,
    //         wished_delivery_date,
    //         wished_delivery_time,
    //         wished_carrier_id,
    //         wished_carrier_name,
    //         return_confirmed_date,
    //         total_supply_price,
    //         store_pickup,
    //         easypay_name,
    //         loan_status,
    //         subscription,
    //         receivers_name,
    //         receivers_name_furigana,
    //         receivers_phone,
    //         receivers_cellphone,
    //         receivers_virtual_phone_no,
    //         receivers_zipcode,
    //         receivers_address1,
    //         receivers_address2,
    //         receivers_address_state,
    //         receivers_address_city,
    //         receivers_address_street,
    //         receivers_address_full,
    //         receivers_name_en,
    //         receivers_city_en,
    //         receivers_state_en,
    //         receivers_street_en,
    //         receivers_country_code,
    //         receivers_country_name,
    //         receivers_country_name_en,
    //         receivers_shipping_message,
    //         receivers_clearance_information_type,
    //         receivers_clearance_information,
    //         receivers_wished_delivery_date,
    //         receivers_wished_delivery_time,
    //         receivers_shipping_code,
    //         buyer_member_id,
    //         buyer_member_group_no,
    //         buyer_name,
    //         buyer_names_furigana,
    //         buyer_email,
    //         buyer_phone,
    //         buyer_cellphone,
    //         buyer_customer_notification,
    //         buyer_updated_date,
    //         buyer_user_id,
    //         buyer_user_name,
    //         multiple_addresses,
    //         exchange_rate,
    //         first_payment_method,
    //         include_tax,
    //   )
    //   VALUES
    //   (
    //     "${syncData.shop_no}",
    //     "${order.currency}",
    //     "${order.order_id}",
    //     "${order.market_id}",
    //     "${order.market_order_no}",
    //     "${order.market_order_info}",
    //     "${order.member_id}",
    //     "${order.member_email}",
    //     "${order.member_authentication}",
    //     "${order.billing_name}",
    //     "${order.bank_code}",
    //     "${order.bank_code_name}",
    //     "${order.payment_method.join()}",
    //     "${order.payment_method_name.join()}",
    //     "${order.payment_gateway_name}",
    //     "${order.sub_payment_method_name}",
    //     "${order.sub_payment_method_code}",
    //     "${order.transaction_id}",
    //     "${order.paid}",
    //     "${order.canceled}",
    //     "${order.order_date}",
    //     "${order.first_order}",
    //     "${order.payment_date}",
    //     "${order.order_from_mobile}",
    //     "${order.use_escrow}",
    //     "${order.group_no_when_ordering}",
    //     "${order.initial_order_amount.order_price_amount,}" 
    //     "${order.initial_order_amount.shipping_fee}",
    //     "${order.initial_order_amount.points_spent_amount}",
    //     "${order.initial_order_amount.credits_spent_amount}",
    //     "${order.initial_order_amount.coupon_discount_price}",
    //     "${order.initial_order_amount.coupon_shipping_fee_amount}",
    //     "${order.initial_order_amount.membership_discount_amount}",
    //     "${order.initial_order_amount.shipping_fee_discount_amount}",
    //     "${order.initial_order_amount.set_product_discount_amount}",
    //     "${order.initial_order_amount.app_discount_amount}",
    //     "${order.initial_order_amount.point_incentive_amount}",
    //     "${order.initial_order_amount.total_amount_due}",
    //     "${order.initial_order_amount.payment_amount}",
    //     "${order.initial_order_amount.market_other_discount_amount}",
    //     "${order.initial_order_amount.tax}",
    //     "${order.actual_order_amount.order_price_amount,}" 
    //     "${order.actual_order_amount.shipping_fee}",
    //     "${order.actual_order_amount.points_spent_amount}",
    //     "${order.actual_order_amount.credits_spent_amount}",
    //     "${order.actual_order_amount.coupon_discount_price}",
    //     "${order.actual_order_amount.coupon_shipping_fee_amount}",
    //     "${order.actual_order_amount.membership_discount_amount}",
    //     "${order.actual_order_amount.shipping_fee_discount_amount}",
    //     "${order.actual_order_amount.set_product_discount_amount}",
    //     "${order.actual_order_amount.app_discount_amount}",
    //     "${order.actual_order_amount.point_incentive_amount}",
    //     "${order.actual_order_amount.total_amount_due}",
    //     "${order.actual_order_amount.payment_amount}",
    //     "${order.actual_order_amount.market_other_discount_amount}",
    //     "${order.actual_order_amount.tax}",
    //     "${order.bank_account_no}",
    //     "${order.bank_account_owner_name}",
    //     "${order.market_seller_id}",
    //     "${order.payment_amount}",
    //     "${order.cancel_date}",
    //     "${order.order_place_name}",
    //     "${order.order_place_id}",
    //     "${order.payment_confirmation}",
    //     "${order.commission}",
    //     "${order.postpay}",
    //     "${order.admin_additional_amount}",
    //     "${order.additional_shipping_fee}",
    //     "${order.international_shipping_insurance}",
    //     "${order.additional_handling_fee}",
    //     "${order.shipping_type}",
    //     "${order.shipping_type_text}",
    //     "${order.shipping_status}",
    //     "${order.wished_delivery_date}",
    //     "${order.wished_delivery_time}",
    //     "${order.wished_carrier_id}",
    //     "${order.wished_carrier_name}",
    //     "${order.return_confirmed_date}",
    //     "${order.total_supply_price}",
    //     "${order.store_pickup}",
    //     "${order.easypay_name}",
    //     "${order.loan_status}",
    //     "${order.subscription}",
    //     "${remove_emoji(order.receivers[0].name)?.replace(/"/g, '\\"')}",
    //     "${remove_emoji(order.receivers[0].name_furigana)?.replace(/"/g, '\\"')}",
    //     "${order.receivers[0].phone}",
    //     "${order.receivers[0].cellphone}",
    //     "${order.receivers[0].virtual_phone_no}",
    //     "${order.receivers[0].zipcode}",
    //     "${remove_emoji(order.receivers[0].address1)?.replace(/"/g, '\\"')}",
    //     "${remove_emoji(order.receivers[0].address2)?.replace(/"/g, '\\"')}",
    //     "${order.receivers[0].address_state}",
    //     "${order.receivers[0].address_city}",
    //     "${order.receivers[0].address_street}",
    //     "${remove_emoji(order.receivers[0].address_full)?.replace(/"/g, '\\"')}",
    //     "${order.receivers[0].name_en}",
    //     "${order.receivers[0].city_en}",
    //     "${order.receivers[0].state_en}",
    //     "${order.receivers[0].street_en}",
    //     "${order.receivers[0].country_code}",
    //     "${order.receivers[0].country_name}",
    //     "${order.receivers[0].country_name_en}",
    //     "${order.receivers[0].shipping_message}",
    //     "${order.receivers[0].clearance_information_type}",
    //     "${order.receivers[0].clearance_information}",
    //     "${order.receivers[0].wished_delivery_date}",
    //     "${order.receivers[0].wished_delivery_time}",
    //     "${order.receivers[0].shipping_code}",
    //     "${order.buyer.member_id}",
    //     "${order.buyer.member_group_no}",
    //     "${order.buyer.name}",
    //     "${order.buyer.names_furigana}",
    //     "${order.buyer.email}",
    //     "${order.buyer.phone}",
    //     "${order.buyer.cellphone}",
    //     "${order.buyer.customer_notification}",
    //     "${order.buyer.updated_date}",
    //     "${order.buyer.user_id}",
    //     "${order.buyer.user_name}",
    //     "${order.multiple_addresses}",
    //     "${order.exchange_rate}",
    //     "${order.first_payment_method}",
    //     "${order.include_tax}"
    //   ) ON DUPLICATE KEY UPDATE

    //     currency=
    //     order_id=
    //     market_id=
    //     market_order_no=
    //     market_order_info=
    //     member_id=
    //     member_email=
    //     member_authentication=
    //     billing_name=
    //     bank_code=
    //     bank_code_name=
    //     payment_method=
    //     payment_method_name=
    //     payment_gateway_name=
    //     sub_payment_method_name=
    //     sub_payment_method_code=
    //     transaction_id=
    //     paid=
    //     canceled=
    //     order_date=
    //     first_order=
    //     payment_date=
    //     order_from_mobile=
    //     use_escrow=
    //     group_no_when_ordering=
    //     initial_order_price_amount=
    //     initial_shipping_fee=
    //     initial_points_spent_amount=
    //     initial_credits_spent_amount=
    //     initial_coupon_discount_price=
    //     initial_coupon_shipping_fee_amount=
    //     initial_membership_discount_amount=
    //     initial_shipping_fee_discount_amount=
    //     initial_set_product_discount_amount=
    //     initial_app_discount_amount=
    //     initial_point_incentive_amount=
    //     initial_total_amount_due=
    //     initial_payment_amount=
    //     initial_market_other_discount_amount=
    //     initial_tax=
    //     actual_order_price_amount=
    //     actual_shipping_fee=
    //     actual_points_spent_amount=
    //     actual_credits_spent_amount=
    //     actual_coupon_discount_price=
    //     actual_coupon_shipping_fee_amount=
    //     actual_membership_discount_amount=
    //     actual_shipping_fee_discount_amount=
    //     actual_set_product_discount_amount=
    //     actual_app_discount_amount=
    //     actual_point_incentive_amount=
    //     actual_total_amount_due=
    //     actual_payment_amount=
    //     actual_market_other_discount_amount=
    //     actual_tax=
    //     bank_account_no=
    //     bank_account_owner_name=
    //     market_seller_id=
    //     payment_amount=
    //     cancel_date=
    //     order_place_name=
    //     order_place_id=
    //     payment_confirmation=
    //     commission=
    //     postpay=
    //     admin_additional_amount=
    //     additional_shipping_fee=
    //     international_shipping_insurance=
    //     additional_handling_fee=
    //     shipping_type=
    //     shipping_type_text=
    //     shipping_status=
    //     wished_delivery_date=
    //     wished_delivery_time=
    //     wished_carrier_id=
    //     wished_carrier_name=
    //     return_confirmed_date=
    //     total_supply_price=
    //     store_pickup=
    //     easypay_name=
    //     loan_status=
    //     subscription=
    //     receivers_name=
    //     receivers_name_furigana=
    //     receivers_phone=
    //     receivers_cellphone=
    //     receivers_virtual_phone_no=
    //     receivers_zipcode=
    //     receivers_address1=
    //     receivers_address2=
    //     receivers_address_state=
    //     receivers_address_city=
    //     receivers_address_street=
    //     receivers_address_full=
    //     receivers_name_en=
    //     receivers_city_en=
    //     receivers_state_en=
    //     receivers_street_en=
    //     receivers_country_code=
    //     receivers_country_name=
    //     receivers_country_name_en=
    //     receivers_shipping_message=
    //     receivers_clearance_information_type=
    //     receivers_clearance_information=
    //     receivers_wished_delivery_date=
    //     receivers_wished_delivery_time=
    //     receivers_shipping_code=
    //     buyer_member_id=
    //     buyer_member_group_no=
    //     buyer_name=
    //     buyer_names_furigana=
    //     buyer_email=
    //     buyer_phone=
    //     buyer_cellphone=
    //     buyer_customer_notification=
    //     buyer_updated_date=
    //     buyer_user_id=
    //     buyer_user_name=
    //     multiple_addresses=
    //     exchange_rate=
    //     first_payment_method=
    //     include_tax=
    //  "
    //   `,
  
    //   (err,rows)=>{
    //       if ( err ) {
    //           error_hook(syncData.shop_no,err,(e,res) => {
    //               console.log("OrderUpsert", err)
    //               throw err;
    //           });
    //       } else {
    //           callback();
    //       }
    //   },{});
}

const upsertOrder = () => {
    return new Promise((resolve,reject) => {

        let loop = 0;
        const callAPI = () => {

            insertData.updateOrder.length == loop ? 
                resolve() :
                databaseOrderUpsert(insertData.updateOrder[loop++],callAPI);
        }
        databaseOrderUpsert(insertData.updateOrder[loop++],callAPI);
    });
}

const insertOrderDetails = () => {
    return new Promise((resolve,reject) => {

        let loop = 0;
        // console.log("insertData.createOrderDetails", insertData.createOrderDetails[0])
        const callAPI = () => {
            insertData.createOrderDetails.length == loop ? 
            resolve() :
            databaseOrderDetailsInsert(insertData.createOrderDetails[loop++], callAPI);
        }
        databaseOrderDetailsInsert(insertData.createOrderDetails[loop++], callAPI)

    })
}

//취소완료날짜 기준
const updateOrder = () => {
    return new Promise((resolve,reject) => {

        let offset = 0; // 최대 15000
        let limit = 1000;

        // orderList - order, detail[items] 포함
        const getOrder = () => {

            axios({
                method : 'GET',
                url : `https://jolsejolse.cafe24api.com/api/v2/admin/orders?`,
                headers: {
                    "Authorization": `Bearer ${syncData.access_token}`,
                    "Content-Type" : `application/json`
                },
                params:{
                    shop_no: `${syncData.shop_no}`,
                    start_date: contents.start_date,
                    end_date: contents.end_date,
                    date_type:'cancel_complete_date',
                    offset:offset,
                    limit:limit,
                    embed: 'items,cancellation',
                    order_status :'N20,C40'
                  }
    
            }).then((response) => {

                console.log("=================취소완료날짜기준 주문수량====================", response.data.orders.length)
                if (response.data.orders.length > 0) {

                    insertData.updateOrder = insertData.updateOrder.concat(response.data.orders);
                    insertData.updateOrderCount = insertData.updateOrder.length;

                    //cancel - detail update
                    response.data.orders.forEach(element => {

                        //업데이트 상세
                        element.items.forEach(i => {
                            i.order_id = element.order_id;
                            insertData.updateOrderDetails = insertData.updateOrderDetails.concat(i);
                        });

                        //취소상세
                        element.cancellation.forEach(i => {
                            i.items.forEach(j => {

                                j.order_id = i.order_id;
                                j.refund_method = i.refund_method;
                                j.refund_reason = i.refund_reason;
                                j.order_price_amount = i.order_price_amount;
                                j.shipping_fee = i.shipping_fee;
                                j.return_ship_type = i.return_ship_type;
                                j.defer_commission = i.defer_commission;
                                j.partner_discount_amount = i.partner_discount_amount;
                                j.add_discount_amount = i.add_discount_amount;
                                j.member_grade_discount_amount = i.member_grade_discount_amount;
                                j.shipping_discount_amount = i.shipping_discount_amount;
                                j.coupon_discount_amount= i.coupon_discount_amount;
                                j.point_used = i.point_used;
                                j.credit_used = i.credit_used;
                                j.undone = i.undone;
                                j.undone_reason_type = i.undone_reason_type;
                                j.undone_reason = i.undone_reason;
                                insertData.cancelOrderDetails = insertData.cancelOrderDetails.concat(j);
                            })
                        });

                    });

                    console.log("총 업데이트 주문수량",insertData.updateOrderCount); // 총 업데이트 주문수량
                    console.log("총 업데이트수량", insertData.updateOrderDetails.length); // 총 업데이트 상세수량
                    console.log("총 취소상세수량", insertData.cancelOrderDetails.length); // 총 업데이트 상세수량

                    if ( response.data.orders.length >= 1000) {
                        offset += limit;
                        getOrder();
                        
                    } else {
                        // console.log("insert", insertData.createOrder.length)
                        resolve(true);
                    }

                } else {
                    resolve(true);
                }
    
            }).catch((err) => {
                console.log("updateOrder 에러", err);
                resolve(false);
            });
        }
        getOrder();
    })
}

const timeSave = () => {
    return new Promise((resolve,reject) => {

        execute(`INSERT INTO app_jolse_api_history (
                shop_no,
                time_to,
                create_count,
                update_count
                ) VALUES (
                    "${syncData.shop_no}",
                    "${contents.end_date}",
                    ${insertData.createOrder.length},
                    ${insertData.updateOrder.length}
                )`,
                (err,rows)=>{
                    if ( err ) {
                        error_hook(syncData.shop_no,err,(e,res) => {
                            console.log("timeSave", err)
                            throw err;
                        });
                    } else {
                        resolve();
                    }
                }, {});
    })
}

const connectionClose = (callback,bool) => {
    return new Promise((resolve,reject) => {

        console.log(syncData.shop_no, insertData.createOrder.length, insertData.createOrderDetails.length, insertData.updateOrder.length, insertData.updateOrderDetails.length);
        console.log(new Date() + ' 종료');
        console.log('=====================================================================');

        if ( bool ) {
            closing();
        }
        callback();
    });
}

const worker = async (sync,callback,bool) => { 

    try {
  
    console.log('=====================================================================');
    console.log(new Date() + ' 시작');
    console.time();

    //초기화
    syncData.shop_no = sync.shop_no;
    syncData.access_token = sync.access_token;

    insertData.createOrderCount = 0;
    insertData.createOrder = [];
    insertData.createOrderDetails = [];    
    insertData.updateOrderCount = 0;
    insertData.updateOrder = [];
    insertData.updateOrderDetails = [];
    insertData.cancelOrderDetails = [];

    await lastCreateTimeTo();
    const success1 = await createOrder();
    const success2 = await updateOrder();

    if ( !success1 ) {
        await connectionClose(callback,bool);
        return;
    }

    if ( !success2 ) {
        await connectionClose(callback,bool);
        return;
    }

    insertData.createOrder.length != 0 && await insertOrder();
    insertData.createOrderDetails.length != 0 && await insertOrderDetails();

    insertData.updateOrder.length != 0 && await upsertOrder();
    insertData.updateOrderDetails.length != 0 && await upsertOrderDetails();

    await timeSave();
    await connectionClose(callback,bool);

    } catch (e) {
        console.log("에러3", e);
    }
}
  
module.exports = worker;