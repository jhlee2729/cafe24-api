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

const remove_emoji = (text) => {
        
    return text.replace(/[\{\}\[\]\/?.,;:|\)*~`!^\-_+<>@\$&\\\=\(\'\"]|[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/gi, '');
}

console.log(remove_emoji('안녕하신가?'))

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

        const getOrder = () => {
            console.log(`offset:${offset}, limit:${limit}`)
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
                console.log("=================RESPONSE LENGTH=====================", response.data.orders.length)

                //특정 주문 데이터
                //20230202-0002735 = 15건중 4건 취소 총 11건
                //20230203-0003656 = 13건중 10건 취소(9건 전체환불, 1건 부분수량 취소), EH-3514 : 2개 -> 1개
                // 20230208-0001294
                // let a = response.data.orders.filter(i => {
                //     return i.order_id === "20230203-0003656";
                // })
          
                // console.log(`상세`, a[0].cancellation);
                // console.log(`상세`, a[0].cancellation[0]);
          
          
                // console.log(`a, 전체`, a[0].shipping_fee_detail[0])
                // console.log(a[0].shipping_fee_detail[0])
                //취소
                // console.log("C20230206-0009130",a[0].cancellation[0].items)
                // console.log("C20230206-0009127",a[0].cancellation[1].items)
                // console.log("cancel",a[0].cancellation[0].items)
                // console.log(a[0].cancellation[1])

                // console.log(a[0].items)// 상세
                
                if (response.data.orders.length > 0) {

                    insertData.createOrder = insertData.createOrder.concat(response.data.orders);
                    insertData.createOrderCount = insertData.createOrder.length;
                    console.log("총 주문 수량",insertData.createOrderCount)

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

    insertData.createOrderCount = 0;
    insertData.createOrder = [];
    insertData.createOrderDetails = [];    

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