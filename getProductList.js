require('dotenv').config();
const axios = require('axios');

// getProductList
const getProductList = () => {
    console.log("",process.env.ACCESS_TOKEN)
    axios({
        method: 'GET',
        url : `https://${process.env.ADMIN_ID}.cafe24api.com/api/v2/admin/products`,
        headers: {
            "Authorization": `Bearer ${process.env.ACCESS_TOKEN}`,
            "Content-Type" : `application/json`
          },
        params:{
            shop_no: 1,
            limit:5
        }
    }).then((response) => {
        console.log("response", response.data.products)
        console.log("response.length", response.data.products.length)
    }).catch((error)=> {
        console.log(error.response)
    })

}

getProductList();