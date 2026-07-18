CREATE OR REPLACE VIEW customer_credit_report AS
SELECT
    c.customer_id,
    c.customer_name,
    c.phone,
    c.email,
    COUNT(s.sale_id) AS credit_sale_count,
    COALESCE(SUM(s.total_amount), 0) AS total_credit_sales_amount,
    COALESCE(SUM(s.paid_amount), 0) AS amount_paid,
    COALESCE(SUM(s.balance_amount), 0) AS credit_balance,
    MIN(s.sale_date) AS oldest_credit_at,
    MAX(s.sale_date) AS latest_credit_at
FROM customers c
JOIN sales s ON s.customer_id = c.customer_id
WHERE s.sale_status = 'Completed'
  AND s.balance_amount > 0
GROUP BY c.customer_id, c.customer_name, c.phone, c.email;
