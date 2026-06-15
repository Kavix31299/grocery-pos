CREATE TABLE roles (
    role_id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_roles_allowed_names
        CHECK (role_name IN ('Admin', 'Manager', 'Cashier'))
);

CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles (role_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE categories (
    category_id BIGSERIAL PRIMARY KEY,
    category_name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
    supplier_id BIGSERIAL PRIMARY KEY,
    supplier_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(150),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_suppliers_email UNIQUE (email)
);

CREATE TABLE customers (
    customer_id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(150),
    address TEXT,
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customers_phone UNIQUE (phone),
    CONSTRAINT uq_customers_email UNIQUE (email),
    CONSTRAINT chk_customers_loyalty_points CHECK (loyalty_points >= 0)
);

CREATE TABLE products (
    product_id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL,
    supplier_id BIGINT,
    product_name VARCHAR(180) NOT NULL,
    barcode VARCHAR(100) NOT NULL UNIQUE,
    sku VARCHAR(100) UNIQUE,
    description TEXT,
    unit VARCHAR(40) NOT NULL DEFAULT 'pcs',
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories (category_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_products_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (supplier_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_products_cost_price CHECK (cost_price >= 0),
    CONSTRAINT chk_products_selling_price CHECK (selling_price >= 0),
    CONSTRAINT chk_products_current_stock CHECK (current_stock >= 0),
    CONSTRAINT chk_products_reorder_level CHECK (reorder_level >= 0)
);

CREATE TABLE sales (
    sale_id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(80) NOT NULL UNIQUE,
    customer_id BIGINT,
    cashier_id BIGINT NOT NULL,
    sale_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    balance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Unpaid',
    sale_status VARCHAR(20) NOT NULL DEFAULT 'Completed',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_customer
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_sales_cashier
        FOREIGN KEY (cashier_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_sales_subtotal_amount CHECK (subtotal_amount >= 0),
    CONSTRAINT chk_sales_discount_amount CHECK (discount_amount >= 0),
    CONSTRAINT chk_sales_tax_amount CHECK (tax_amount >= 0),
    CONSTRAINT chk_sales_total_amount CHECK (total_amount >= 0),
    CONSTRAINT chk_sales_paid_amount CHECK (paid_amount >= 0),
    CONSTRAINT chk_sales_balance_amount CHECK (balance_amount >= 0),
    CONSTRAINT chk_sales_payment_status
        CHECK (payment_status IN ('Unpaid', 'Partial', 'Paid', 'Refunded')),
    CONSTRAINT chk_sales_sale_status
        CHECK (sale_status IN ('Draft', 'Completed', 'Cancelled', 'Returned'))
);

CREATE TABLE sale_items (
    sale_item_id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sale_items_sale
        FOREIGN KEY (sale_id) REFERENCES sales (sale_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_product
        FOREIGN KEY (product_id) REFERENCES products (product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_sale_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_sale_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_sale_items_discount_amount CHECK (discount_amount >= 0),
    CONSTRAINT chk_sale_items_tax_amount CHECK (tax_amount >= 0),
    CONSTRAINT chk_sale_items_line_total CHECK (line_total >= 0)
);

CREATE TABLE purchases (
    purchase_id BIGSERIAL PRIMARY KEY,
    purchase_number VARCHAR(80) NOT NULL UNIQUE,
    supplier_id BIGINT NOT NULL,
    received_by BIGINT NOT NULL,
    purchase_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    balance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    purchase_status VARCHAR(20) NOT NULL DEFAULT 'Received',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchases_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_purchases_received_by
        FOREIGN KEY (received_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_purchases_subtotal_amount CHECK (subtotal_amount >= 0),
    CONSTRAINT chk_purchases_discount_amount CHECK (discount_amount >= 0),
    CONSTRAINT chk_purchases_tax_amount CHECK (tax_amount >= 0),
    CONSTRAINT chk_purchases_total_amount CHECK (total_amount >= 0),
    CONSTRAINT chk_purchases_amount_paid CHECK (amount_paid >= 0),
    CONSTRAINT chk_purchases_balance_amount CHECK (balance_amount >= 0),
    CONSTRAINT chk_purchases_purchase_status
        CHECK (purchase_status IN ('Ordered', 'Received', 'Cancelled'))
);

CREATE TABLE purchase_items (
    purchase_item_id BIGSERIAL PRIMARY KEY,
    purchase_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    batch_number VARCHAR(100),
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL,
    manufactured_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchase_items_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchases (purchase_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_purchase_items_product
        FOREIGN KEY (product_id) REFERENCES products (product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_purchase_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_purchase_items_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_purchase_items_line_total CHECK (line_total >= 0),
    CONSTRAINT chk_purchase_items_expiry_after_manufactured
        CHECK (expiry_date IS NULL OR manufactured_date IS NULL OR expiry_date >= manufactured_date)
);

CREATE TABLE payments (
    payment_id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    received_by BIGINT NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Completed',
    transaction_reference VARCHAR(120),
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_sale
        FOREIGN KEY (sale_id) REFERENCES sales (sale_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_payments_received_by
        FOREIGN KEY (received_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_payments_method
        CHECK (payment_method IN ('Cash', 'Card', 'Bank Transfer', 'Mobile Wallet', 'Other')),
    CONSTRAINT chk_payments_amount CHECK (amount > 0),
    CONSTRAINT chk_payments_status
        CHECK (payment_status IN ('Pending', 'Completed', 'Failed', 'Refunded'))
);

CREATE TABLE returns (
    return_id BIGSERIAL PRIMARY KEY,
    return_number VARCHAR(80) NOT NULL UNIQUE,
    sale_id BIGINT NOT NULL,
    customer_id BIGINT,
    processed_by BIGINT NOT NULL,
    return_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    total_refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    return_status VARCHAR(20) NOT NULL DEFAULT 'Completed',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_returns_sale
        FOREIGN KEY (sale_id) REFERENCES sales (sale_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_returns_customer
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_returns_processed_by
        FOREIGN KEY (processed_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_returns_total_refund_amount CHECK (total_refund_amount >= 0),
    CONSTRAINT chk_returns_status
        CHECK (return_status IN ('Pending', 'Completed', 'Rejected'))
);

CREATE TABLE return_items (
    return_item_id BIGSERIAL PRIMARY KEY,
    return_id BIGINT NOT NULL,
    sale_item_id BIGINT,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_refund_amount NUMERIC(12, 2) NOT NULL,
    line_refund_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_return_items_return
        FOREIGN KEY (return_id) REFERENCES returns (return_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_return_items_sale_item
        FOREIGN KEY (sale_item_id) REFERENCES sale_items (sale_item_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_return_items_product
        FOREIGN KEY (product_id) REFERENCES products (product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_return_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_return_items_unit_refund_amount CHECK (unit_refund_amount >= 0),
    CONSTRAINT chk_return_items_line_refund_amount CHECK (line_refund_amount >= 0)
);

CREATE TABLE expenses (
    expense_id BIGSERIAL PRIMARY KEY,
    expense_category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expenses_recorded_by
        FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_expenses_amount CHECK (amount > 0)
);

CREATE TABLE stock_movements (
    stock_movement_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    movement_type VARCHAR(30) NOT NULL,
    quantity_changed INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_type VARCHAR(30),
    reference_id BIGINT,
    notes TEXT,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_movements_product
        FOREIGN KEY (product_id) REFERENCES products (product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_stock_movements_created_by
        FOREIGN KEY (created_by) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_stock_movements_type
        CHECK (movement_type IN ('Sale', 'Purchase', 'Return', 'Adjustment', 'Opening Stock')),
    CONSTRAINT chk_stock_movements_quantity_changed CHECK (quantity_changed <> 0),
    CONSTRAINT chk_stock_movements_previous_stock CHECK (previous_stock >= 0),
    CONSTRAINT chk_stock_movements_new_stock CHECK (new_stock >= 0),
    CONSTRAINT chk_stock_movements_reference_type
        CHECK (
            reference_type IS NULL
            OR reference_type IN ('Sale', 'Purchase', 'Return', 'Adjustment', 'Opening Stock')
        )
);

CREATE TABLE store_settings (
    setting_id SMALLINT PRIMARY KEY DEFAULT 1,
    store_name VARCHAR(180) NOT NULL,
    address TEXT,
    phone VARCHAR(30),
    email VARCHAR(150),
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    receipt_footer TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_store_settings_single_row CHECK (setting_id = 1),
    CONSTRAINT chk_store_settings_tax_rate CHECK (tax_rate >= 0)
);

CREATE TABLE activity_logs (
    activity_log_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(120) NOT NULL,
    entity_name VARCHAR(120),
    entity_id BIGINT,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_logs_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_users_role_id ON users (role_id);
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_supplier_id ON products (supplier_id);
CREATE INDEX idx_sales_customer_id ON sales (customer_id);
CREATE INDEX idx_sales_cashier_id ON sales (cashier_id);
CREATE INDEX idx_sales_sale_date ON sales (sale_date);
CREATE INDEX idx_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items (product_id);
CREATE INDEX idx_purchases_supplier_id ON purchases (supplier_id);
CREATE INDEX idx_purchases_purchase_date ON purchases (purchase_date);
CREATE INDEX idx_purchase_items_purchase_id ON purchase_items (purchase_id);
CREATE INDEX idx_purchase_items_product_id ON purchase_items (product_id);
CREATE INDEX idx_purchase_items_expiry_date ON purchase_items (expiry_date);
CREATE INDEX idx_payments_sale_id ON payments (sale_id);
CREATE INDEX idx_returns_sale_id ON returns (sale_id);
CREATE INDEX idx_return_items_return_id ON return_items (return_id);
CREATE INDEX idx_return_items_product_id ON return_items (product_id);
CREATE INDEX idx_expenses_expense_date ON expenses (expense_date);
CREATE INDEX idx_stock_movements_product_id ON stock_movements (product_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs (user_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sale_items_updated_at
BEFORE UPDATE ON sale_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_purchases_updated_at
BEFORE UPDATE ON purchases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_purchase_items_updated_at
BEFORE UPDATE ON purchase_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_returns_updated_at
BEFORE UPDATE ON returns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_return_items_updated_at
BEFORE UPDATE ON return_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stock_movements_updated_at
BEFORE UPDATE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_store_settings_updated_at
BEFORE UPDATE ON store_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_activity_logs_updated_at
BEFORE UPDATE ON activity_logs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
