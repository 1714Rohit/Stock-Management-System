-- Use the existing database
USE multi_tenant_stock_mgmt;

-- Add users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shop_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Add purchase_price column to products for profit calculation
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Seed default admin user (password: admin123 bcrypt hash)
-- Hash generated for 'admin123' with bcrypt cost 10
INSERT INTO users (shop_id, email, password_hash, role)
VALUES (1, 'admin@shop.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON DUPLICATE KEY UPDATE email = VALUES(email);
