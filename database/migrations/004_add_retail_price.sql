ALTER TABLE products
ADD COLUMN IF NOT EXISTS retail_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE products
SET retail_price = selling_price
WHERE retail_price = 0;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS chk_products_retail_price;

ALTER TABLE products
ADD CONSTRAINT chk_products_retail_price CHECK (retail_price >= 0);
