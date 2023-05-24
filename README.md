# cafe24-api

### Jolse - Order
- jolse-running.js 실행, jolse-api.js
1. Retrieve a list of orders   
    1.1 get order
    - date_type = pay_date
    - embed = items,receivers,buyer,cancellation
    - order_status = N00,N10,N20,N21,N22,C00,C10,C34,C36,C47,C48,C49
    1.2 get cancel order
    - date_type = cancel_complete_date
    - embed = cancellation,items
    - order_status = N20,C40
2. Retrieve a count of orders
    - date_type = pay_date
    - embed = items,receivers,buyer,cancellation
    - order_status = N00,N10,N20,N21,N22,C00,C10,C34,C36,C47,C48,C49
3. getAccessToken - 액세스 토큰 발급
4. refresh AccessToken - 액세스 토큰 재발급
5. getProductList

### Jolse - Product
jolse-running-item.js 실행, jolse-item-api.js
1. Retrieve a list of products   
  1.1 product_no 수집
2. Retrieve a product resource 
  - 상품 상세 정보 수집 (상품 번호당 1개씩 조회)
  - embed = variants,benefits,discountprice,seo,inventories