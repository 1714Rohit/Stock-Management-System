const bcrypt = require('bcryptjs');

async function generateAndSeed() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log('Generated hash:', hash);

  // Now update the DB
  const mysql = require('mysql2/promise');
  require('dotenv').config();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // Run schema update
  await conn.query(`
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
  console.log('Users table created.');

  // Add purchase_price column if not exists
  try {
    await conn.query(`ALTER TABLE products ADD COLUMN purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00`);
    console.log('purchase_price column added to products.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('purchase_price column already exists, skipping.');
    } else throw e;
  }

  // Seed admin user
  await conn.query(
    `INSERT INTO users (shop_id, email, password_hash, role)
     VALUES (1, 'admin@shop.com', ?, 'admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [hash]
  );
  console.log('Admin user seeded with email: admin@shop.com, password: admin123');

  await conn.end();
  console.log('Done!');
}

generateAndSeed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
