const axios = require('axios');

const creatProduct = () => {

    let description = `<link rel="stylesheet" type="text/css" href="https://www.jjj-shop.com/css/style.css">

    <div id="jolseProduct">
    
        <!-- =============== Product Title =============== -->
    
        <h2>Dancing Whale MOISTURE Mask Pack 10ea</h2>
    
        <!-- =============== Product Main Image -->
        <img src="https://d1f6um9xlu8jl4.cloudfront.net/DANCING_WHALE/Dancing_Whale_BRILLIANT_Mask_Pack_10ea_T.jpg" class="product_img" alt="PRODUCT_NAME_WITHOUT_VOLUME" title="PRODUCT_NAME_WITHOUT_VOLUME">
    
        <!-- =============== Product Features =============== -->
    
        <h3>Features</h3>
    
        <ul class="jolse_product_list">
            <li>Formulated with patent ingredients ‘MultiEx BSASM’ &amp; Panthenol &amp; Allantoin Multi Essence. Nano-sized to increase penetration in the skin, skin-soothing &amp; nutrition moisturizing.</li>
            <li>The hydrating effect helps brighten up the complexion and soften skin.</li>
            <li>Fiber mask fits facial contours. Skin can absorb the essence and rapidly improve skin texture and conditions.</li>
    
    
            <!-- =============== Product Detail =============== -->
    
            <h3>Detail</h3>
            <img src="https://d1f6um9xlu8jl4.cloudfront.net/DANCING_WHALE/Dancing_Whale_BRILLIANT_Mask_Pack_10ea_D.jpg" class="product_img">
            <br>
            <!-- =============== Product How To Use =============== -->
    
            <h3>How To Use</h3>
    
            <ul class="jolse_product_list">
                <li>After washing, prepare skin with toner. Apply sheet mask evenly on your face. Remove the mask sheet after 10-20 minutes later and gently pat the remaining essence.</li>
            </ul>
    
            <!-- =============== Product Info =============== -->
    
            <h3>Product Info</h3>
    
            <ul class="jolse_product_list">
                <li>Brand : DANCING WHALE</li>
                <li>All Skin Type</li>
                <li>Volume : 10ea</li>
                <li>Made in Korea</li>
            </ul>
    
            <!-- =============== Product Ingredients =============== -->
    
            <h3>Ingredients</h3>
    
            <ul class="jolse_product_list">
                <li>none</li>
            </ul>
    
        </ul>
    </div>
    `

    let payload = {
        "shop_no": 2,
        "request": {
            "display": "F", //진열상태
            "selling": "F", //판매상태
            "add_category_no": [  //상품분류(필수값)
                {
                    "category_no": 441,
                    "recommend": "F",
                    "new": "F"
                },
                {
                    "category_no": 28,
                    "recommend": "F",
                    "new": "F"
                }
            ],
            "product_name": "TEST PRODUCT", //상품명
            "custom_product_code": "CX-26", //자체상품코드(단일상품-SKU)
            "product_condition": "N", //상품상태 (N:신상품)
            "summary_description": "/category/cosrx/379999/", // 상품요약설명
            "simple_description": "This is Product Description.", //상품 간략설명
            "description": `${description}`, // 상품상세설명
            "separated_mobile_description": 'F', //모바일 별도 등록 : 상품 상세설명 동일
            "product_tag": ['troublecareday0326', 'test'], // 상품검색어 배열 최대사이즈: [50] 배열로 받아야함
            "supply_price": "0", // 공급가(필수)
            "additional_price": "0", // 판매가 계산 - 추가금액
            "margin_rate": "10.00", // 판매가 계산 - 마진율
            "price": "35.00", //판매가 USD (KRW) 둘다 들어감 -> 나머지 국가는 자동 계산됨
            "has_option": "F", // F이면 options 키값이 업어야함
            // "options": [
            //     {
            //         "name": "Color",
            //         "value": [
            //             "Red",
            //             "Blue",
            //             "Green"
            //         ]
            //     },
            //     {
            //         "name": "Size",
            //         "value": [
            //             "X",
            //             "L",
            //             "M",
            //             "S"
            //         ]
            //     }
            // ],
            "clearance_category_code":"AIAAAD00", //해외통관코드
            "image_upload_type": "A", // 이미지 업로드 타입 - A대표이미지등록
            // "detail_image": "/web/product/big/201710/4322_shop1_441058.jpg", //상세이미지
            "brand_code": "B00000PU", // 브랜드 가져와야함
            "product_weight": "0.10", // 상품전체중량 (0.10)kg 
        }
    }

    return axios({
        method: 'POST',
        url: `https://jolsejolse.cafe24api.com/api/v2/admin/products`,
        headers: {
            "Authorization": `Bearer YHwspEfXUiuAnNl4fiC0lN`,
            "Content-Type": `application/json`
        },
        data: payload
    }).then((response) => {
        console.log("등록", response.data);
    }).catch((err) => {
        console.log("어디에러임", err.response);
    })

}

creatProduct();