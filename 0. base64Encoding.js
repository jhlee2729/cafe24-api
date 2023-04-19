const btoa = require('btoa');
require('dotenv').config();

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;

const result = btoa(`${client_id}:${client_secret}`);

//base64 인코딩 
console.log(result);