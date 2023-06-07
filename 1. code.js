require('dotenv').config();

// code 발급
const getCodeURL = () => {

    const scope = 'mall.read_application,mall.write_application,mall.read_product,mall.write_product,mall.read_order'
    const url = `https://${process.env.ADMIN_ID}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=${scope}`
    return url;

}

console.log(getCodeURL());