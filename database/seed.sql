INSERT INTO roles (role_name, description)
VALUES
    ('Admin', 'Full access to all POS features and settings'),
    ('Manager', 'Can manage products, purchases, reports, and staff operations'),
    ('Cashier', 'Can process sales, payments, and customer returns')
ON CONFLICT (role_name) DO UPDATE SET
    description = EXCLUDED.description;

INSERT INTO store_settings (
    setting_id,
    store_name,
    address,
    phone,
    email,
    currency_code,
    tax_rate,
    receipt_footer,
    printer_enabled,
    printer_host,
    printer_port,
    printer_device_id,
    printer_use_ssl,
    printer_buffer
)
VALUES (
    1,
    'Grocery Store',
    '123 Market Street, Colombo',
    '+94 11 234 5678',
    'hello@grocerypos.local',
    'LKR',
    0,
    'Thank you for shopping with us.',
    FALSE,
    NULL,
    8008,
    'local_printer',
    FALSE,
    FALSE
)
ON CONFLICT (setting_id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    currency_code = EXCLUDED.currency_code,
    tax_rate = EXCLUDED.tax_rate,
    receipt_footer = EXCLUDED.receipt_footer,
    printer_enabled = EXCLUDED.printer_enabled,
    printer_host = EXCLUDED.printer_host,
    printer_port = EXCLUDED.printer_port,
    printer_device_id = EXCLUDED.printer_device_id,
    printer_use_ssl = EXCLUDED.printer_use_ssl,
    printer_buffer = EXCLUDED.printer_buffer;

INSERT INTO users (
    role_id,
    full_name,
    username,
    email,
    password_hash,
    phone,
    is_active
)
VALUES
    (
        (SELECT role_id FROM roles WHERE role_name = 'Admin'),
        'Admin User',
        'admin',
        'admin@grocerypos.local',
        '$2b$12$lasEQgf3ynZsWXWRSghkSuTuxGG5uMWQAFdzeSRYGjdMc00ZboXU6',
        '+94 77 100 0001',
        TRUE
    ),
    (
        (SELECT role_id FROM roles WHERE role_name = 'Manager'),
        'Manager User',
        'manager',
        'manager@grocerypos.local',
        '$2b$12$75kMfTdoSz7jyuCGGjn5Fen2jU9uVPjEIo60xjGL47eYI0k9XhFzq',
        '+94 77 100 0002',
        TRUE
    ),
    (
        (SELECT role_id FROM roles WHERE role_name = 'Cashier'),
        'Cashier User',
        'cashier',
        'cashier@grocerypos.local',
        '$2b$12$7BocnSlA81bz0QKvEj3Mie5FpYJktDbOYixIIpdzUq6Tzzd4T8YFa',
        '+94 77 100 0003',
        TRUE
    )
ON CONFLICT (username) DO UPDATE SET
    role_id = EXCLUDED.role_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    phone = EXCLUDED.phone,
    is_active = EXCLUDED.is_active;

-- Master data is intentionally omitted. Add categories, suppliers, products,
-- and customers through the app or insert your real data here.
