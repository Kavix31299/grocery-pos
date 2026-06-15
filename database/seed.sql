INSERT INTO roles (role_name, description)
VALUES
    ('Admin', 'Full access to all POS features and settings'),
    ('Manager', 'Can manage products, purchases, reports, and staff operations'),
    ('Cashier', 'Can process sales, payments, and customer returns')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO store_settings (
    setting_id,
    store_name,
    address,
    phone,
    email,
    currency_code,
    tax_rate,
    receipt_footer
)
VALUES (
    1,
    'Grocery Store',
    NULL,
    NULL,
    NULL,
    'USD',
    0,
    'Thank you for shopping with us.'
)
ON CONFLICT (setting_id) DO NOTHING;
