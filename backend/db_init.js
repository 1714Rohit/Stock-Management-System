const db = require('./db');
const bcrypt = require('bcryptjs');

async function init() {
  console.log('Starting database initialization...');
  
  // 1. Create shops table
  await db.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Shops table created/verified.');

  // 2. Create products table
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shop_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      purchase_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      stock INT NOT NULL DEFAULT 0,
      low_stock_threshold INT NOT NULL DEFAULT 10,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    )
  `);
  console.log('Products table created/verified.');

  // 3. Create sales table
  await db.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shop_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      total_price DECIMAL(10, 2) NOT NULL,
      sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);
  console.log('Sales table created/verified.');

  // 4. Create purchases table
  await db.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shop_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      total_cost DECIMAL(10, 2) NOT NULL,
      purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);
  console.log('Purchases table created/verified.');

  // 5. Create users table
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shop_id INT NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'staff') NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    )
  `);
  console.log('Users table created/verified.');

  // 6. Seed default Shop Alpha (id: 1)
  await db.query(`
    INSERT INTO shops (id, name) 
    VALUES (1, 'Shop Alpha')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);
  console.log('Default Shop seeded/verified.');

  // 7. Seed default admin user
  const hash = await bcrypt.hash('admin123', 10);
  await db.query(`
    INSERT INTO users (shop_id, email, password_hash, role)
    VALUES (1, 'admin@shop.com', ?, 'admin')
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
  `, [hash]);
  console.log('Admin user seeded (admin@shop.com / admin123).');

  console.log('Database initialization completed successfully!');
  process.exit(0);
}

init().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
