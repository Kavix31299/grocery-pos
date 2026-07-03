ALTER TABLE payments
DROP CONSTRAINT IF EXISTS chk_payments_method;

ALTER TABLE payments
ADD CONSTRAINT chk_payments_method
CHECK (payment_method IN ('Cash', 'Card', 'Bank Transfer', 'QR Payment', 'Split Payment'));
