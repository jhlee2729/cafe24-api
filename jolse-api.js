const config = require('../config');
const env = require('./env').env;
const pool = require('./connection-pool').createPool(config[env].database);
const axios = require('axios');

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
    await connectionClose(callback,bool);

    } catch (e) {
        console.log("에러3", e);
    }
}
  
module.exports = worker;