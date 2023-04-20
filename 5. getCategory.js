require('dotenv').config();
const axios = require('axios');

// getCategory
const getCategory = () => {
    axios({
        method: 'GET',
        url : `https://${process.env.ADMIN_ID}.cafe24api.com/api/v2/admin/categories`,
        headers: {
            "Authorization": `Bearer ${process.env.ACCESS_TOKEN}`,
            "Content-Type" : `application/json`
          },
        params:{
            shop_no: 2,
            offset:790,
            limit:100
        }
    }).then((response) => {
        console.log("response", response.data)

        response.data.categories.map(i => { 
            console.log(i.full_category_name)
            // console.log(i.full_category_no)
        })

        response.data.categories.map(i => { 
            console.log(i.full_category_no)
        })
        console.log("response", response.data.categories.length)
    }).catch((error)=> {
        console.log(error.response)
    })

}

getCategory();