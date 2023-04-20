const axios = require('axios');
require('dotenv').config();
const imageToBase64 = require('image-to-base64');

let imageData;

const imageEncoding = () => {
    
    return new Promise((resolve, reject) => {
        imageToBase64(`${process.env.CLOUD_FRONT}${process.env.IMAGE_URI}`+'.jpg')
            .then(response => {
                imageData = response;
                resolve(imageData);
            })
            .catch(error => {
                console.log(error);
            })
    })
}

// const uploadImage = () => {

//     return new Promise((resolve, reject) => {

//         //63791
//         let payload = {
//             "request": [
//                 {
//                     "image": imageData
//                 }
//             ]
//         }

//         axios({
//             method: 'POST',
//             url: `https://${process.env.ADMIN_ID}.cafe24api.com/api/v2/admin/products/images`,
//             headers: {
//                 "Authorization": `Bearer ${process.env.ACCESS_TOKEN}`,
//                 "Content-Type": `application/json`
//             },
//             data: payload
//         }).then((response) => {
//             console.log("업로드", response.data);
//         }).catch((err) => {
//             console.log("어디에러임", err.response);
//         })

//     })
// }

const addImage = () => {

    return new Promise((resolve, reject) => {

        //63791
        let payload = {
            "shop_no": 2,
            "request": {
                "image_upload_type": "A",
                "detail_image": `data:image/jpg;base64, ${imageData}`,
                "list_image": `data:image/jpg;base64, ${imageData}`,
                "tiny_image": `data:image/jpg;base64, ${imageData}`,
                "small_image": `data:image/jpg;base64, ${imageData}`
            }
        }

        axios({
            method: 'POST',
            url: `https://${process.env.ADMIN_ID}.cafe24api.com/api/v2/admin/products/${process.env.PRODUCT_NO}/images`,
            headers: {
                "Authorization": `Bearer ${process.env.ACCESS_TOKEN}`,
                "Content-Type": `application/json`
            },
            data: payload
        }).then((response) => {
            console.log("업로드", response.data);
        }).catch((err) => {
            console.log("어디에러임", err.response);
        })
    })
}

const promise = async () => {
    try {
        await imageEncoding();
        // await uploadImage();
        await addImage();
    } catch (e) {
        console.log(e)
    }
}

promise();