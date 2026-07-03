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
    receipt_footer
)
VALUES (
    1,
    'Grocery Store',
    '123 Market Street, Colombo',
    '+94 11 234 5678',
    'hello@grocerypos.local',
    'LKR',
    0,
    'Thank you for shopping with us.'
)
ON CONFLICT (setting_id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    currency_code = EXCLUDED.currency_code,
    tax_rate = EXCLUDED.tax_rate,
    receipt_footer = EXCLUDED.receipt_footer;

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

INSERT INTO categories (category_name, description, is_active)
VALUES
    ('Produce', 'Fresh fruits and vegetables', TRUE),
    ('Dairy', 'Milk, yogurt, butter, and cheese', TRUE),
    ('Bakery', 'Bread, buns, cakes, and baked goods', TRUE),
    ('Pantry', 'Rice, flour, canned food, and dry goods', TRUE),
    ('Beverages', 'Juice, soft drinks, tea, and coffee', TRUE),
    ('Household', 'Cleaning and household essentials', TRUE)
ON CONFLICT (category_name) DO UPDATE SET
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO suppliers (
    supplier_name,
    contact_person,
    phone,
    email,
    address,
    is_active
)
VALUES
    (
        'Fresh Farm Distributors',
        'Nimal Perera',
        '+94 11 555 0101',
        'orders@freshfarm.local',
        '45 Farm Road, Colombo',
        TRUE
    ),
    (
        'Daily Dairy Co.',
        'Anoma Silva',
        '+94 11 555 0102',
        'sales@dailydairy.local',
        '18 Dairy Lane, Kandy',
        TRUE
    ),
    (
        'City Wholesale Foods',
        'Ruwan Fernando',
        '+94 11 555 0103',
        'support@citywholesale.local',
        '90 Warehouse Avenue, Colombo',
        TRUE
    ),
    (
        'Clean Home Supplies',
        'Maya Jayasinghe',
        '+94 11 555 0104',
        'orders@cleanhome.local',
        '12 Supply Street, Galle',
        TRUE
    )
ON CONFLICT (email) DO UPDATE SET
    supplier_name = EXCLUDED.supplier_name,
    contact_person = EXCLUDED.contact_person,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    is_active = EXCLUDED.is_active;

INSERT INTO products (
    category_id,
    supplier_id,
    product_name,
    barcode,
    sku,
    description,
    unit,
    cost_price,
    selling_price,
    current_stock,
    reorder_level,
    is_active
)
VALUES
    (
        (SELECT category_id FROM categories WHERE category_name = 'Produce'),
        (SELECT supplier_id FROM suppliers WHERE email = 'orders@freshfarm.local'),
        'Red Apples 1kg',
        '100000000001',
        'PRO-APL-001',
        'Fresh red apples packed by kilogram',
        'kg',
        980.00,
        1250.00,
        80,
        20,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Produce'),
        (SELECT supplier_id FROM suppliers WHERE email = 'orders@freshfarm.local'),
        'Carrots 500g',
        '100000000002',
        'PRO-CAR-500',
        'Fresh carrots packed in 500g bags',
        'pack',
        120.00,
        180.00,
        60,
        15,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Dairy'),
        (SELECT supplier_id FROM suppliers WHERE email = 'sales@dailydairy.local'),
        'Full Cream Milk 1L',
        '100000000003',
        'DAI-MILK-1L',
        'Pasteurized full cream milk',
        'bottle',
        390.00,
        520.00,
        120,
        30,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Dairy'),
        (SELECT supplier_id FROM suppliers WHERE email = 'sales@dailydairy.local'),
        'Cheddar Cheese 200g',
        '100000000004',
        'DAI-CHD-200',
        'Cheddar cheese block',
        'pack',
        720.00,
        950.00,
        45,
        12,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Bakery'),
        (SELECT supplier_id FROM suppliers WHERE email = 'support@citywholesale.local'),
        'White Bread Loaf',
        '100000000005',
        'BAK-BRD-WHT',
        'Fresh sliced white bread loaf',
        'loaf',
        130.00,
        180.00,
        35,
        10,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Pantry'),
        (SELECT supplier_id FROM suppliers WHERE email = 'support@citywholesale.local'),
        'Basmati Rice 5kg',
        '100000000006',
        'PAN-RICE-5KG',
        'Premium basmati rice bag',
        'bag',
        2100.00,
        2750.00,
        70,
        15,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Pantry'),
        (SELECT supplier_id FROM suppliers WHERE email = 'support@citywholesale.local'),
        'Canned Tuna 185g',
        '100000000007',
        'PAN-TUNA-185',
        'Canned tuna chunks in brine',
        'can',
        420.00,
        560.00,
        95,
        25,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Beverages'),
        (SELECT supplier_id FROM suppliers WHERE email = 'support@citywholesale.local'),
        'Orange Juice 1L',
        '100000000008',
        'BEV-OJ-1L',
        'Ready-to-drink orange juice',
        'carton',
        450.00,
        620.00,
        50,
        14,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Beverages'),
        (SELECT supplier_id FROM suppliers WHERE email = 'support@citywholesale.local'),
        'Black Tea 100 Bags',
        '100000000009',
        'BEV-TEA-100',
        'Black tea bags family pack',
        'box',
        650.00,
        850.00,
        40,
        10,
        TRUE
    ),
    (
        (SELECT category_id FROM categories WHERE category_name = 'Household'),
        (SELECT supplier_id FROM suppliers WHERE email = 'orders@cleanhome.local'),
        'Dishwashing Liquid 500ml',
        '100000000010',
        'HOU-DISH-500',
        'Lemon dishwashing liquid',
        'bottle',
        260.00,
        350.00,
        55,
        12,
        TRUE
    )
ON CONFLICT (barcode) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    supplier_id = EXCLUDED.supplier_id,
    product_name = EXCLUDED.product_name,
    sku = EXCLUDED.sku,
    description = EXCLUDED.description,
    unit = EXCLUDED.unit,
    cost_price = EXCLUDED.cost_price,
    selling_price = EXCLUDED.selling_price,
    current_stock = EXCLUDED.current_stock,
    reorder_level = EXCLUDED.reorder_level,
    is_active = EXCLUDED.is_active;

INSERT INTO customers (
    customer_name,
    phone,
    email,
    address,
    loyalty_points,
    is_active
)
VALUES
    (
        'Walk-in Customer',
        '+94 77 200 0001',
        'walkin@grocerypos.local',
        NULL,
        0,
        TRUE
    ),
    (
        'Ayesha Fernando',
        '+94 77 200 0002',
        'ayesha.fernando@example.com',
        '22 Lake Road, Colombo',
        120,
        TRUE
    ),
    (
        'Kamal Perera',
        '+94 77 200 0003',
        'kamal.perera@example.com',
        '14 Temple Lane, Kandy',
        80,
        TRUE
    ),
    (
        'Nadeesha Silva',
        '+94 77 200 0004',
        'nadeesha.silva@example.com',
        '9 Beach Road, Galle',
        45,
        TRUE
    )
ON CONFLICT (phone) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    loyalty_points = EXCLUDED.loyalty_points,
    is_active = EXCLUDED.is_active;
