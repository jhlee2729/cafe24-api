const env = require('./env').env;
const config = require('../config')[env];
const axios = require('axios');
const mysql = require('mysql');
const pool = mysql.createPool(config.database);
const btoa = require('btoa');
const qs = require('query-string');
const dateformat = require('dateformat');
let info = {
    tokens : [],
}

const execute = (sql,callback,data = {} )=>{

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


const getTokenInfo = () => {

    return new Promise((resolve,reject)=> {

        execute(`SELECT s.* , a.*
                    FROM app_jolse_sync s
                    JOIN app_jolse_admin a ON a.app_name = s.app_name`,(err,rows)=>{

            if(err) throw err;

            info.tokens = info.tokens.concat(rows);

            resolve();

        })
    });
}

const getNewTokenLoop = () => {

    return new Promise((resolve,reject) => {

        let loop = 0;

        const token_loop = () => {

            info.tokens.length === loop ? resolve() : generateToken(info.tokens[loop++],token_loop);

        }

        generateToken(info.tokens[loop++],token_loop);

    })
};

const generateToken = (info,callback) => {

    let client_id = info.client_id;
    let client_secret = info.client_secret;
    let authorization = 'Basic '+btoa(`${client_id}:${client_secret}`);
    let headers = {
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Authorization' : authorization
    };

    let data = {
        grant_type : 'refresh_token',
        refresh_token : info.refresh_token
    };

    axios({
        
        method: 'post',
        url : 'https://jolsejolse.cafe24api.com/api/v2/oauth/token',
        headers : headers,
        data  : qs.stringify(data)

    }).then((response)=>{

        let sync_id = info.id;
        let now = new Date();
        let second = now.getTime();                
        let access_token = response.data.access_token;
        let refresh_token = response.data.refresh_token;
        let expires_at = response.data.expires_at;
        let expires_at_time = dateformat(second + (expires_at * 1000),'yyyy-mm-dd HH:MM:ss');
        let refresh_token_expires_at = response.data.refresh_token_expires_at;
        let refresh_token_expires_at_time = dateformat(second + (refresh_token_expires_at * 1000),'yyyy-mm-dd HH:MM:ss');

        execute(`UPDATE app_jolse_sync 
                    SET access_token="${access_token}",
                    expires_at="${expires_at}",
                    expires_at_time="${expires_at_time}",
                    refresh_token="${refresh_token}",
                    refresh_token_expires_at="${refresh_token_expires_at}",
                    refresh_token_expires_at_time="${refresh_token_expires_at_time}"
                    WHERE id = ${sync_id}`,(err,rows)=>{

                        if (err) {
                            console.log(err);
                            callback();
                        }else{

                            callback();
                        }

                    })
        })
    .catch((err)=>{

        console.log(err);
        callback();

    });

}

const endFn = () => {

    return new Promise((resolve,reject)=> {

        console.log("종료");
        pool.end();
    })
}

const getNewAccessToken = async() => {

    try {
        await getTokenInfo();
        await getNewTokenLoop();
        await endFn();

    } catch (e) {
        console.log(e);
    }
}

getNewAccessToken();