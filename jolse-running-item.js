'use strict';

const config = require('../config');
const env = require('./env.json').env;
const pool = require('./connection-pool').createPool(config[env].database);
const worker = require('./jolse-item-api');

const getJolseSync = () => {
    return new Promise((resolve,reject)=>{

        pool.getConnection((err,connection) => {
            if (err) throw err;

            connection.query(`SELECT * FROM app_jolse_sync WHERE is_item=1`,(err,rows) => {
                connection.release();
                pool.end();
                resolve(rows);
            });
        });
    });
}

const loopWorker = (store) => {
    return new Promise((resolve,reject) => {

        let count = store.length;
        let check = 0;

        const goway = () => {

            if ( check != count) {
                worker(store[check++], goway, check == count)
            }
        }
        goway();
    })
}

const init = async () => { 

    try {

        const store = await getJolseSync();
        await loopWorker(store);

    } catch (e) {
        console.log(e);
    }
}

init();