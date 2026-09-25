-- Required reference data for a fresh production database.
-- Run after schema.sql and views.sql. Creates no staff accounts or demo data.
INSERT INTO roles (role_name, description)
VALUES
    ('Admin', 'Full access to all POS features and settings'),
    ('Manager', 'Can manage products, purchases, reports, and staff operations'),
    ('Cashier', 'Can process sales, payments, and customer returns')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO store_settings (setting_id, store_name, currency_code, receipt_footer)
VALUES (1, 'Grocery Store', 'LKR', 'Thank you for shopping with us.')
ON CONFLICT (setting_id) DO NOTHING;
