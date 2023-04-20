require('dotenv').config();
const axios = require('axios');
const config = require('../config');
const env = require('./env').env;
const pool = require('./connection-pool').createPool(config[env].database);

const execute = (sql, callback, data = {}) => {
    pool.getConnection((err, connection) => {

        if (err) throw err;

        connection.query(sql, data, (err, rows) => {
            connection.release();
            if (err) {
                throw err
            } else {
                callback(err, rows);
            }
        });
    });
}

const closing = () => {
    pool.end();
}

const insertData = {
    brandInfo: []
}

// getBrand
const callCollectionAPI = () => {
    return new Promise((resolve, reject) => {

        let offset = 0;
        let limit = 100;

        //brand 392개
        const getBrand = () => {

            axios({

                method: 'GET',
                url: `https://${process.env.ADMIN_ID}.cafe24api.com/api/v2/admin/brands`,
                headers: {
                    "Authorization": `Bearer ${process.env.ACCESS_TOKEN}`,
                    "Content-Type": `application/json`
                },
                params: {
                    shop_no: 2,
                    limit,
                    offset
                }

            }).then((response) => {

                let count = response.data.brands.length;

                insertData.brandInfo = insertData.brandInfo.concat(response.data.brands);

                if (count >= 100) {

                    offset += limit;
                    getBrand();

                } else {
                    // console.log("insertData.brandInfo", insertData.brandInfo.length)
                    resolve(true);
                }
            }).catch((error) => {
                console.log(error.response);
                resolve(false);
            })
        }

        getBrand();

    })
}

const insertDatabase = () => {
    return new Promise((resolve, reject) => {

        // console.log("insertData.brandInfo", insertData.brandInfo.length)

        insertData.brandInfo.map(i => {

            execute(`INSERT INTO app_jolse_brand_code 
                    (brand_code, brand_name, created_date)
                VALUES ("${i.brand_code}","${i.brand_name}", "${i.created_date}")
                `, (err, rows) => {
                // console.log("rows", rows)
                if (err) throw err;
            })
        });

    })
}

const connectionClose = (bool) => {
    return new Promise((resolve, reject) => {

        console.log(new Date() + ' 종료');
        console.log('=====================================================================');

        if (bool) {
            closing();
        }
    });
}

// getBrand();
const worker = async () => {

    insertData.brandInfo = [];

    try {
        const result = await callCollectionAPI();
        await insertDatabase();
        console.log("result", result)
        if (result) {
            await connectionClose(result);
            return;
        }

    } catch (e) {
        console.log(e);
    }
}

worker();