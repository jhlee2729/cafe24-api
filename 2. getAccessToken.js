require('dotenv').config();
const btoa = require('btoa');
const axios = require('axios');

// Access token 발급
const getAccessToken = () => {

    const client_id = process.env.CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET;
    const authorization = 'Basic '+btoa(`${client_id}:${client_secret}`);
    const headers = {
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Authorization' : authorization
    };

    const data = {
        grant_type: 'authorization_code',
        code: process.env.CODE,
        redirect_uri: process.env.REDIRECT_URI
    }

    axios({
        method: 'POST',
        url : `https://${process.env.ADMIN_ID}.cafe24api.com/api/v2/oauth/token`,
        headers: headers,
        data: data
    }).then((response) => {
        console.log("response", response.data)
    }).catch((error)=> {
        console.log(error)
    })

}

getAccessToken();