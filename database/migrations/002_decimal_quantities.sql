DROP VIEW IF EXISTS
    supplier_due_report,
    expense_report,
    profit_report,
    expiring_products_report,
    out_of_stock_report,
    low_stock_report,
    stock_available_report,
    cashier_sales_report,
    product_sales_report,
    monthly_sales_report,
    daily_sales_report,
    payment_method_report,
    expense_summary_report,
    purchase_summary_report,
    product_stock_report
CASCADE;

ALTER TABLE products
ALTER COLUMN current_stock TYPE NUMERIC(12, 3) USING current_stock::NUMERIC(12, 3),
ALTER COLUMN current_stock SET DEFAULT 0,
ALTER COLUMN reorder_level TYPE NUMERIC(12, 3) USING reorder_level::NUMERIC(12, 3),
ALTER COLUMN reorder_level SET DEFAULT 0;

ALTER TABLE sale_items
ALTER COLUMN quantity TYPE NUMERIC(12, 3) USING quantity::NUMERIC(12, 3);

ALTER TABLE purchase_items
ALTER COLUMN quantity TYPE NUMERIC(12, 3) USING quantity::NUMERIC(12, 3);

ALTER TABLE return_items
ALTER COLUMN quantity TYPE NUMERIC(12, 3) USING quantity::NUMERIC(12, 3);

ALTER TABLE stock_movements
ALTER COLUMN quantity_changed TYPE NUMERIC(12, 3) USING quantity_changed::NUMERIC(12, 3),
ALTER COLUMN previous_stock TYPE NUMERIC(12, 3) USING previous_stock::NUMERIC(12, 3),
ALTER COLUMN new_stock TYPE NUMERIC(12, 3) USING new_stock::NUMERIC(12, 3);

CREATE VIEW daily_sales_report AS
WITH sale_quantities AS (
    SELECT
        sale_id,
        SUM(quantity) AS items_sold
    FROM sale_items
    GROUP BY sale_id
),
sale_returns AS (
    SELECT
        sale_id,
        SUM(total_refund_amount) AS refund_amount
    FROM returns
    WHERE return_status = 'Completed'
    GROUP BY sale_id
)
SELECT
    s.sale_date::date AS report_date,
    COUNT(s.sale_id) AS invoice_count,
    COALESCE(SUM(sq.items_sold), 0) AS items_sold,
    COALESCE(SUM(s.subtotal_amount), 0) AS subtotal_amount,
    COALESCE(SUM(s.discount_amount), 0) AS discount_amount,
    COALESCE(SUM(s.tax_amount), 0) AS tax_amount,
    COALESCE(SUM(s.total_amount), 0) AS sales_amount,
    COALESCE(SUM(sr.refund_amount), 0) AS refund_amount,
    COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(sr.refund_amount), 0) AS net_sales_amount,
    COALESCE(SUM(s.paid_amount), 0) AS paid_amount,
    COALESCE(SUM(s.balance_amount), 0) AS balance_amount
FROM sales s
LEFT JOIN sale_quantities sq ON sq.sale_id = s.sale_id
LEFT JOIN sale_returns sr ON sr.sale_id = s.sale_id
WHERE s.sale_status = 'Completed'
GROUP BY s.sale_date::date;

CREATE VIEW monthly_sales_report AS
WITH sale_quantities AS (
    SELECT
        sale_id,
        SUM(quantity) AS items_sold
    FROM sale_items
    GROUP BY sale_id
),
sale_returns AS (
    SELECT
        sale_id,
        SUM(total_refund_amount) AS refund_amount
    FROM returns
    WHERE return_status = 'Completed'
    GROUP BY sale_id
)
SELECT
    DATE_TRUNC('month', s.sale_date)::date AS report_month,
    EXTRACT(YEAR FROM s.sale_date)::integer AS sales_year,
    EXTRACT(MONTH FROM s.sale_date)::integer AS sales_month,
    COUNT(s.sale_id) AS invoice_count,
    COALESCE(SUM(sq.items_sold), 0) AS items_sold,
    COALESCE(SUM(s.subtotal_amount), 0) AS subtotal_amount,
    COALESCE(SUM(s.discount_amount), 0) AS discount_amount,
    COALESCE(SUM(s.tax_amount), 0) AS tax_amount,
    COALESCE(SUM(s.total_amount), 0) AS sales_amount,
    COALESCE(SUM(sr.refund_amount), 0) AS refund_amount,
    COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(sr.refund_amount), 0) AS net_sales_amount,
    COALESCE(SUM(s.paid_amount), 0) AS paid_amount,
    COALESCE(SUM(s.balance_amount), 0) AS balance_amount
FROM sales s
LEFT JOIN sale_quantities sq ON sq.sale_id = s.sale_id
LEFT JOIN sale_returns sr ON sr.sale_id = s.sale_id
WHERE s.sale_status = 'Completed'
GROUP BY DATE_TRUNC('month', s.sale_date)::date, sales_year, sales_month;

CREATE VIEW product_sales_report AS
WITH completed_product_sales AS (
    SELECT
        si.product_id,
        SUM(si.quantity) AS quantity_sold,
        SUM(si.line_total) AS sales_amount,
        SUM(si.discount_amount) AS discount_amount,
        SUM(si.tax_amount) AS tax_amount,
        MAX(s.sale_date) AS last_sold_at
    FROM sale_items si
    JOIN sales s ON s.sale_id = si.sale_id
    WHERE s.sale_status = 'Completed'
    GROUP BY si.product_id
),
completed_product_returns AS (
    SELECT
        ri.product_id,
        SUM(ri.quantity) AS quantity_returned,
        SUM(ri.line_refund_amount) AS refund_amount
    FROM return_items ri
    JOIN returns r ON r.return_id = ri.return_id
    WHERE r.return_status = 'Completed'
    GROUP BY ri.product_id
)
SELECT
    p.product_id,
    p.product_name,
    p.barcode,
    p.sku,
    c.category_name,
    COALESCE(cps.quantity_sold, 0) AS quantity_sold,
    COALESCE(cpr.quantity_returned, 0) AS quantity_returned,
    COALESCE(cps.quantity_sold, 0) - COALESCE(cpr.quantity_returned, 0) AS net_quantity_sold,
    COALESCE(cps.sales_amount, 0) AS sales_amount,
    COALESCE(cps.discount_amount, 0) AS discount_amount,
    COALESCE(cps.tax_amount, 0) AS tax_amount,
    COALESCE(cpr.refund_amount, 0) AS refund_amount,
    COALESCE(cps.sales_amount, 0) - COALESCE(cpr.refund_amount, 0) AS net_sales_amount,
    (COALESCE(cps.quantity_sold, 0) - COALESCE(cpr.quantity_returned, 0)) * p.cost_price AS estimated_cost_amount,
    (COALESCE(cps.sales_amount, 0) - COALESCE(cpr.refund_amount, 0))
        - ((COALESCE(cps.quantity_sold, 0) - COALESCE(cpr.quantity_returned, 0)) * p.cost_price)
        AS estimated_profit_amount,
    cps.last_sold_at
FROM products p
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN completed_product_sales cps ON cps.product_id = p.product_id
LEFT JOIN completed_product_returns cpr ON cpr.product_id = p.product_id;

CREATE VIEW cashier_sales_report AS
WITH cashier_sale_quantities AS (
    SELECT
        s.sale_id,
        SUM(si.quantity) AS items_sold
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.sale_id
    WHERE s.sale_status = 'Completed'
    GROUP BY s.sale_id
),
cashier_sale_returns AS (
    SELECT
        sale_id,
        SUM(total_refund_amount) AS refund_amount
    FROM returns
    WHERE return_status = 'Completed'
    GROUP BY sale_id
)
SELECT
    u.user_id AS cashier_id,
    u.full_name AS cashier_name,
    u.username,
    COUNT(s.sale_id) AS invoice_count,
    COALESCE(SUM(csq.items_sold), 0) AS items_sold,
    COALESCE(SUM(s.total_amount), 0) AS sales_amount,
    COALESCE(SUM(csr.refund_amount), 0) AS refund_amount,
    COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(csr.refund_amount), 0) AS net_sales_amount,
    COALESCE(SUM(s.paid_amount), 0) AS paid_amount,
    COALESCE(SUM(s.balance_amount), 0) AS balance_amount,
    MIN(s.sale_date) AS first_sale_at,
    MAX(s.sale_date) AS last_sale_at
FROM sales s
JOIN users u ON u.user_id = s.cashier_id
LEFT JOIN cashier_sale_quantities csq ON csq.sale_id = s.sale_id
LEFT JOIN cashier_sale_returns csr ON csr.sale_id = s.sale_id
WHERE s.sale_status = 'Completed'
GROUP BY u.user_id, u.full_name, u.username;

CREATE VIEW stock_available_report AS
SELECT
    p.product_id,
    p.product_name,
    p.barcode,
    p.sku,
    c.category_name,
    sup.supplier_name,
    p.unit,
    p.current_stock,
    p.reorder_level,
    p.cost_price,
    p.selling_price,
    p.current_stock * p.cost_price AS stock_cost_value,
    p.current_stock * p.selling_price AS stock_sale_value,
    CASE
        WHEN p.current_stock = 0 THEN 'Out of Stock'
        WHEN p.current_stock <= p.reorder_level THEN 'Low Stock'
        ELSE 'In Stock'
    END AS stock_status
FROM products p
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN suppliers sup ON sup.supplier_id = p.supplier_id
WHERE p.is_active = TRUE;

CREATE VIEW low_stock_report AS
SELECT
    p.product_id,
    p.product_name,
    p.barcode,
    p.sku,
    c.category_name,
    sup.supplier_name,
    p.current_stock,
    p.reorder_level,
    p.reorder_level - p.current_stock AS shortage_quantity,
    p.cost_price,
    p.selling_price
FROM products p
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN suppliers sup ON sup.supplier_id = p.supplier_id
WHERE p.is_active = TRUE
  AND p.current_stock > 0
  AND p.current_stock <= p.reorder_level;

CREATE VIEW out_of_stock_report AS
SELECT
    p.product_id,
    p.product_name,
    p.barcode,
    p.sku,
    c.category_name,
    sup.supplier_name,
    p.current_stock,
    p.reorder_level,
    p.cost_price,
    p.selling_price
FROM products p
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN suppliers sup ON sup.supplier_id = p.supplier_id
WHERE p.is_active = TRUE
  AND p.current_stock = 0;

CREATE VIEW expiring_products_report AS
SELECT
    pi.purchase_item_id,
    pu.purchase_id,
    pu.purchase_number,
    p.product_id,
    p.product_name,
    p.barcode,
    p.sku,
    c.category_name,
    sup.supplier_name,
    pi.batch_number,
    pi.quantity AS purchased_quantity,
    p.current_stock,
    pi.manufactured_date,
    pi.expiry_date,
    pi.expiry_date - CURRENT_DATE AS days_to_expiry,
    CASE
        WHEN pi.expiry_date < CURRENT_DATE THEN 'Expired'
        WHEN pi.expiry_date = CURRENT_DATE THEN 'Expires Today'
        ELSE 'Expiring Soon'
    END AS expiry_status
FROM purchase_items pi
JOIN purchases pu ON pu.purchase_id = pi.purchase_id
JOIN products p ON p.product_id = pi.product_id
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN suppliers sup ON sup.supplier_id = pu.supplier_id
WHERE pu.purchase_status = 'Received'
  AND p.is_active = TRUE
  AND pi.expiry_date IS NOT NULL
  AND pi.expiry_date <= CURRENT_DATE + 30;

CREATE VIEW profit_report AS
WITH sales_daily AS (
    SELECT
        s.sale_date::date AS report_date,
        SUM(si.line_total) AS sales_amount,
        SUM(si.quantity * p.cost_price) AS cost_of_goods_sold
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.sale_id
    JOIN products p ON p.product_id = si.product_id
    WHERE s.sale_status = 'Completed'
    GROUP BY s.sale_date::date
),
returns_daily AS (
    SELECT
        r.return_date::date AS report_date,
        SUM(ri.line_refund_amount) AS refund_amount,
        SUM(ri.quantity * p.cost_price) AS returned_cost_amount
    FROM returns r
    JOIN return_items ri ON ri.return_id = r.return_id
    JOIN products p ON p.product_id = ri.product_id
    WHERE r.return_status = 'Completed'
    GROUP BY r.return_date::date
),
expenses_daily AS (
    SELECT
        expense_date AS report_date,
        SUM(amount) AS expense_amount
    FROM expenses
    GROUP BY expense_date
),
report_dates AS (
    SELECT report_date FROM sales_daily
    UNION
    SELECT report_date FROM returns_daily
    UNION
    SELECT report_date FROM expenses_daily
)
SELECT
    rd.report_date,
    COALESCE(sd.sales_amount, 0) AS sales_amount,
    COALESCE(rd2.refund_amount, 0) AS refund_amount,
    COALESCE(sd.cost_of_goods_sold, 0) AS cost_of_goods_sold,
    COALESCE(rd2.returned_cost_amount, 0) AS returned_cost_amount,
    COALESCE(ed.expense_amount, 0) AS expense_amount,
    COALESCE(sd.sales_amount, 0)
        - COALESCE(sd.cost_of_goods_sold, 0)
        - COALESCE(rd2.refund_amount, 0)
        + COALESCE(rd2.returned_cost_amount, 0)
        AS gross_profit_amount,
    COALESCE(sd.sales_amount, 0)
        - COALESCE(sd.cost_of_goods_sold, 0)
        - COALESCE(rd2.refund_amount, 0)
        + COALESCE(rd2.returned_cost_amount, 0)
        - COALESCE(ed.expense_amount, 0)
        AS net_profit_amount
FROM report_dates rd
LEFT JOIN sales_daily sd ON sd.report_date = rd.report_date
LEFT JOIN returns_daily rd2 ON rd2.report_date = rd.report_date
LEFT JOIN expenses_daily ed ON ed.report_date = rd.report_date;

CREATE VIEW expense_report AS
SELECT
    e.expense_date AS report_date,
    e.expense_category,
    e.recorded_by,
    u.full_name AS recorded_by_name,
    COUNT(e.expense_id) AS expense_count,
    COALESCE(SUM(e.amount), 0) AS total_expense_amount
FROM expenses e
JOIN users u ON u.user_id = e.recorded_by
GROUP BY e.expense_date, e.expense_category, e.recorded_by, u.full_name;

CREATE VIEW supplier_due_report AS
SELECT
    sup.supplier_id,
    sup.supplier_name,
    sup.contact_person,
    sup.phone,
    sup.email,
    COUNT(pu.purchase_id) AS purchase_count,
    COALESCE(SUM(pu.total_amount), 0) AS total_purchase_amount,
    COALESCE(SUM(pu.amount_paid), 0) AS amount_paid,
    COALESCE(SUM(pu.balance_amount), 0) AS due_amount,
    MIN(pu.purchase_date) AS oldest_due_purchase_at,
    MAX(pu.purchase_date) AS latest_purchase_at
FROM suppliers sup
JOIN purchases pu ON pu.supplier_id = sup.supplier_id
WHERE pu.purchase_status <> 'Cancelled'
  AND pu.balance_amount > 0
GROUP BY sup.supplier_id, sup.supplier_name, sup.contact_person, sup.phone, sup.email;
