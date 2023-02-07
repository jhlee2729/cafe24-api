const config = require('../config');
const env = require('./env').env;
const pool = require('./connection-pool').createPool(config[env].database);
const axios = require('axios');
const dateformat = require('dateformat');

const syncData = { 
    shop_no: '',
    access_token: ''
}

const contents = {
    start_date: '',
    end_date: '',
}

const insertData = {
    createOrder:[],
    createOrderDetails:[]
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

const closing = () => {
    pool.end();
}

const lastCreateTimeTo = () => {
    return new Promise((resolve,reject) => {

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

                    if ( rows.length >= 1 ) {
                        contents.start_date = rows[0].time_to;
                        contents.end_date = time;
                        console.log(`시작:${contents.start_date}, 끝: ${contents.end_date }`);
                        resolve();
                    } else {
                        contents.start_date = yesterday_time; // 하루전
                        contents.end_date = time;
                        console.log(`없는경우 시작:${contents.start_date}, 끝: ${contents.end_date }`);
                        resolve();

                    }
                }
        })
    })
}

const createOrder = () => {
    return new Promise((resolve,reject) => {
        // console.log(`${syncData.access_token}`,contents.start_date, contents.end_date);

        let offset = 0;
        let limit = 1000;

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
                    embed: 'items,receivers,buyer,return,cancellation,exchange',
                    order_status :'N00,N10,N20,N21,N22,C00,C10,C34,C36,C47,C48,C49,C40'
                  }
    
            }).then((response) => {

                if (response.data.orders.length > 0) {

                    insertData.createOrder = insertData.createOrder.concat(response.data.orders);

                    console.log("insertData.createOrder", insertData.createOrder[2]); 

                    if ( response.data.orders.length >= 1000) {
                        offset += limit;
                        getOrder();
                        
                    } else {
    
                        console.log("insert", insertData.createOrder.length)
                        resolve(true);
                    }

                } else {
                    resolve(true);
                }
    
            }).catch((err) => {
                console.log(err);
                resolve(false);
            });
        }
        getOrder();
    })
}

const createOrderDetails = () => {
    return new Promise((resolve,reject) => {
        console.log("실행")

        resolve();
    })
}

const connectionClose = (callback,bool) => {
    return new Promise((resolve,reject) => {

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

    await lastCreateTimeTo();
    const success1 = await createOrder();
    let success_details_1 = true;

    if ( insertData.createOrder.length != 0 ) {
        success_details_1 = await createOrderDetails();
    }

    if ( !success1 ) {
        await connectionClose(callback,bool);
        return;
    }

    await connectionClose(callback,bool);

    } catch (e) {
        console.log("에러3", e);
    }
}
  
module.exports = worker;