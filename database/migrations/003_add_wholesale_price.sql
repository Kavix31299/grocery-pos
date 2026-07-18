ALTER TABLE products
ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE products
SET wholesale_price = selling_price
WHERE wholesale_price = 0;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS chk_products_wholesale_price;

ALTER TABLE products
ADD CONSTRAINT chk_products_wholesale_price CHECK (wholesale_price >= 0);
