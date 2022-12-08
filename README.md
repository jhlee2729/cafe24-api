# jolse-api

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