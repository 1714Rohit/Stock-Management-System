const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const verifyToken = require('./verifyToken');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'stockmgmt_secret_key_2024';

app.use(cors());
app.use(express.json());

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Username/Email and password required' });

  try {
    // Check both email and username
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid username/email or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { userId: user.id, shopId: user.shop_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Get shop name
    const [shopRows] = await db.query('SELECT name FROM shops WHERE id = ?', [user.shop_id]);

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role, shopId: user.shop_id },
      shopName: shopRows[0]?.name || 'My Shop'
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper to determine RP ID and Origin dynamically based on request
const getRpSettings = (req) => {
  // For cross-origin requests, the origin is sent by the frontend (e.g., https://stock.patelradio.com)
  const origin = req.headers.origin || (req.get('host').includes('localhost') ? `http://${req.get('host')}` : `https://${req.get('host')}`);
  
  let rpID = 'localhost';
  try {
    const originUrl = new URL(origin);
    rpID = originUrl.hostname;
  } catch (e) {
    rpID = origin.split('://')[1]?.split(':')[0] || 'localhost';
  }

  return { rpID, origin, rpName: 'Patel Electronics' };
};

// GET /api/auth/generate-authentication-options
app.get('/api/auth/generate-authentication-options', async (req, res) => {
  const { email } = req.query; // email or username
  if (!email) return res.status(400).json({ error: 'Email or username required' });

  try {
    const [userRows] = await db.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, email]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRows[0];

    const [passkeyRows] = await db.query('SELECT * FROM passkeys WHERE user_id = ?', [user.id]);
    if (passkeyRows.length === 0) return res.status(400).json({ error: 'No passkeys registered for this user' });

    const { rpID } = getRpSettings(req);
    
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeyRows.map(pk => ({
        id: pk.id,
        type: 'public-key',
        transports: pk.transports ? pk.transports.split(',') : ['internal'],
      })),
      userVerification: 'preferred',
    });

    await db.query('UPDATE users SET current_challenge = ? WHERE id = ?', [options.challenge, user.id]);
    res.json(options);
  } catch (err) {
    console.error('generate auth error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-authentication
app.post('/api/auth/verify-authentication', async (req, res) => {
  const { email, response } = req.body;
  try {
    const [userRows] = await db.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRows[0];

    const [passkeyRows] = await db.query('SELECT * FROM passkeys WHERE id = ?', [response.id]);
    if (passkeyRows.length === 0) return res.status(400).json({ error: 'Passkey not found' });
    const passkey = passkeyRows[0];

    const { rpID, origin } = getRpSettings(req);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.current_challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: passkey.id,
        credentialPublicKey: passkey.public_key,
        counter: passkey.counter,
        transports: passkey.transports ? passkey.transports.split(',') : ['internal']
      }
    });

    if (verification.verified) {
      await db.query('UPDATE passkeys SET counter = ? WHERE id = ?', [verification.authenticationInfo.newCounter, passkey.id]);
      await db.query('UPDATE users SET current_challenge = NULL WHERE id = ?', [user.id]);

      const token = jwt.sign(
        { userId: user.id, shopId: user.shop_id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      const [shopRows] = await db.query('SELECT name FROM shops WHERE id = ?', [user.shop_id]);

      return res.json({
        verified: true,
        token,
        user: { id: user.id, email: user.email, username: user.username, role: user.role, shopId: user.shop_id },
        shopName: shopRows[0]?.name || 'My Shop'
      });
    }
    res.status(400).json({ verified: false, error: 'Verification failed' });
  } catch (err) {
    console.error('verify auth error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PROTECTED ROUTES — all below require JWT ─────────────────────────────────
app.use('/api', verifyToken);

// Helper: get shopId from JWT
const getShopId = (req) => req.user.shopId;

// GET /api/auth/generate-registration-options
app.get('/api/auth/generate-registration-options', async (req, res) => {
  const userId = req.user.userId;
  try {
    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRows[0];

    const [passkeyRows] = await db.query('SELECT * FROM passkeys WHERE user_id = ?', [userId]);
    
    const { rpID, rpName } = getRpSettings(req);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Uint8Array.from(String(user.id), c => c.charCodeAt(0)),
      userName: user.username || user.email,
      attestationType: 'none',
      excludeCredentials: passkeyRows.map(pk => ({
        id: pk.id,
        type: 'public-key',
        transports: pk.transports ? pk.transports.split(',') : ['internal'],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    await db.query('UPDATE users SET current_challenge = ? WHERE id = ?', [options.challenge, user.id]);
    res.json(options);
  } catch (err) {
    console.error('generate registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-registration
app.post('/api/auth/verify-registration', async (req, res) => {
  const userId = req.user.userId;
  const { response } = req.body;
  
  try {
    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRows[0];

    const { rpID, origin } = getRpSettings(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.current_challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      
      await db.query(
        `INSERT INTO passkeys (id, user_id, public_key, counter, device_type, backed_up, transports)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          response.id, // The base64url string ID from the browser
          userId,
          Buffer.from(credentialPublicKey), // Convert Uint8Array to Buffer for MySQL BLOB
          counter,
          credentialDeviceType,
          credentialBackedUp,
          response.response.transports ? response.response.transports.join(',') : 'internal'
        ]
      );

      await db.query('UPDATE users SET current_challenge = NULL WHERE id = ?', [userId]);
      return res.json({ verified: true });
    }
    res.status(400).json({ verified: false, error: 'Registration failed' });
  } catch (err) {
    console.error('verify registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  const shopId = getShopId(req);
  try {
    // Today's sales revenue
    const [[todaySales]] = await db.query(
      `SELECT COALESCE(SUM(total_price),0) AS val FROM sales 
       WHERE shop_id=? AND DATE(sale_date)=CURDATE()`, [shopId]
    );
    // Monthly sales revenue
    const [[monthlySales]] = await db.query(
      `SELECT COALESCE(SUM(total_price),0) AS val FROM sales 
       WHERE shop_id=? AND MONTH(sale_date)=MONTH(CURDATE()) AND YEAR(sale_date)=YEAR(CURDATE())`, [shopId]
    );
    // Yearly sales revenue
    const [[yearlySales]] = await db.query(
      `SELECT COALESCE(SUM(total_price),0) AS val FROM sales 
       WHERE shop_id=? AND YEAR(sale_date)=YEAR(CURDATE())`, [shopId]
    );
    // Today's purchase cost (for display only)
    const [[todayPurchases]] = await db.query(
      `SELECT COALESCE(SUM(total_cost),0) AS val FROM purchases 
       WHERE shop_id=? AND DATE(purchase_date)=CURDATE()`, [shopId]
    );
    // Monthly purchase cost (for display only)
    const [[monthlyPurchases]] = await db.query(
      `SELECT COALESCE(SUM(total_cost),0) AS val FROM purchases 
       WHERE shop_id=? AND MONTH(purchase_date)=MONTH(CURDATE()) AND YEAR(purchase_date)=YEAR(CURDATE())`, [shopId]
    );
    // Yearly purchase cost (for display only)
    const [[yearlyPurchases]] = await db.query(
      `SELECT COALESCE(SUM(total_cost),0) AS val FROM purchases 
       WHERE shop_id=? AND YEAR(purchase_date)=YEAR(CURDATE())`, [shopId]
    );

    // ── PROFIT = (sell price - purchase cost price) × qty sold ──
    // Today's profit: for each sale today, profit = (product.price - product.purchase_price) * quantity
    const [[todayProfit]] = await db.query(
      `SELECT COALESCE(SUM((p.price - p.purchase_price) * s.quantity), 0) AS val
       FROM sales s
       JOIN products p ON s.product_id = p.id
       WHERE s.shop_id=? AND DATE(s.sale_date)=CURDATE()`, [shopId]
    );
    // Monthly profit
    const [[monthlyProfit]] = await db.query(
      `SELECT COALESCE(SUM((p.price - p.purchase_price) * s.quantity), 0) AS val
       FROM sales s
       JOIN products p ON s.product_id = p.id
       WHERE s.shop_id=? AND MONTH(s.sale_date)=MONTH(CURDATE()) AND YEAR(s.sale_date)=YEAR(CURDATE())`, [shopId]
    );
    // Yearly profit
    const [[yearlyProfit]] = await db.query(
      `SELECT COALESCE(SUM((p.price - p.purchase_price) * s.quantity), 0) AS val
       FROM sales s
       JOIN products p ON s.product_id = p.id
       WHERE s.shop_id=? AND YEAR(s.sale_date)=YEAR(CURDATE())`, [shopId]
    );

    // Low stock count
    const [[lowStock]] = await db.query(
      `SELECT COUNT(*) AS val FROM products WHERE shop_id=? AND stock<=low_stock_threshold`, [shopId]
    );
    // Total products
    const [[totalProducts]] = await db.query(
      `SELECT COUNT(*) AS val FROM products WHERE shop_id=?`, [shopId]
    );
    // Top selling product
    const [topSelling] = await db.query(
      `SELECT p.name, COALESCE(SUM(s.quantity),0) AS total_sold, COALESCE(SUM(s.total_price),0) AS revenue
       FROM sales s JOIN products p ON s.product_id=p.id
       WHERE s.shop_id=? GROUP BY s.product_id ORDER BY total_sold DESC LIMIT 1`, [shopId]
    );

    // Check if user has a passkey
    const [[passkeyCount]] = await db.query(
      `SELECT COUNT(*) AS val FROM passkeys WHERE user_id=?`, [req.user.userId]
    );

    res.json({
      todaySales: todaySales.val,
      monthlySales: monthlySales.val,
      yearlySales: yearlySales.val,
      todayPurchases: todayPurchases.val,
      monthlyPurchases: monthlyPurchases.val,
      yearlyPurchases: yearlyPurchases.val,
      // Profit = (sell price - purchase cost price) × qty sold
      todayProfit: todayProfit.val,
      monthlyProfit: monthlyProfit.val,
      yearlyProfit: yearlyProfit.val,
      lowStockCount: lowStock.val,
      totalProducts: totalProducts.val,
      topSellingProduct: topSelling[0]?.name || 'N/A',
      topSellingQty: topSelling[0]?.total_sold || 0,
      topSellingRevenue: topSelling[0]?.revenue || 0,
      hasPasskey: passkeyCount.val > 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/sales/top-selling  — all products ranked by qty sold (for chart)
app.get('/api/sales/top-selling', async (req, res) => {
  const shopId = getShopId(req);
  try {
    const [rows] = await db.query(
      `SELECT p.name, COALESCE(SUM(s.quantity),0) AS total_sold, COALESCE(SUM(s.total_price),0) AS revenue
       FROM products p
       LEFT JOIN sales s ON s.product_id=p.id AND s.shop_id=?
       WHERE p.shop_id=?
       GROUP BY p.id, p.name
       ORDER BY total_sold DESC`, [shopId, shopId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/sales/history
app.get('/api/sales/history', async (req, res) => {
  const shopId = getShopId(req);
  const limit = parseInt(req.query.limit || '50');
  try {
    const [rows] = await db.query(
      `SELECT s.id, p.name AS product_name, s.quantity, s.total_price, s.sale_date
       FROM sales s JOIN products p ON s.product_id=p.id
       WHERE s.shop_id=? ORDER BY s.sale_date DESC LIMIT ?`, [shopId, limit]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/purchases/history
app.get('/api/purchases/history', async (req, res) => {
  const shopId = getShopId(req);
  const limit = parseInt(req.query.limit || '50');
  try {
    const [rows] = await db.query(
      `SELECT pu.id, p.name AS product_name, pu.quantity, pu.total_cost, pu.purchase_date
       FROM purchases pu JOIN products p ON pu.product_id=p.id
       WHERE pu.shop_id=? ORDER BY pu.purchase_date DESC LIMIT ?`, [shopId, limit]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/stock/alerts
app.get('/api/stock/alerts', async (req, res) => {
  const shopId = getShopId(req);
  try {
    const [rows] = await db.query(
      `SELECT id, name, price, stock, low_stock_threshold,
              (low_stock_threshold - stock) AS deficit,
              ROUND((stock / low_stock_threshold) * 100) AS stock_pct
       FROM products
       WHERE shop_id=? AND stock<=low_stock_threshold
       ORDER BY stock_pct ASC`, [shopId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

// GET /api/products
app.get('/api/products', async (req, res) => {
  const shopId = getShopId(req);
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.price, p.purchase_price, p.stock, p.low_stock_threshold,
              COALESCE((SELECT SUM(s.quantity) FROM sales s WHERE s.product_id=p.id),0) AS total_sold,
              COALESCE((SELECT SUM(pu.quantity) FROM purchases pu WHERE pu.product_id=p.id),0) AS total_purchased,
              p.created_at
       FROM products p WHERE p.shop_id=? ORDER BY p.name ASC`, [shopId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/products
app.post('/api/products', async (req, res) => {
  const shopId = getShopId(req);
  const { name, price, purchase_price, stock, low_stock_threshold } = req.body;
  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ error: 'Name, price, and stock are required' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO products (shop_id, name, price, purchase_price, stock, low_stock_threshold) VALUES (?,?,?,?,?,?)`,
      [shopId, name, price, purchase_price || 0, stock, low_stock_threshold || 10]
    );
    const productId = result.insertId;
    if (parseInt(stock) > 0) {
      const costPerUnit = parseFloat(purchase_price) || 0;
      await conn.query(
        `INSERT INTO purchases (shop_id, product_id, quantity, total_cost) VALUES (?,?,?,?)`,
        [shopId, productId, stock, costPerUnit * parseInt(stock)]
      );
    }
    await conn.commit();
    res.status(201).json({ message: 'Product created', productId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Transaction failed' });
  } finally {
    conn.release();
  }
});

// PUT /api/products/:id
app.put('/api/products/:id', async (req, res) => {
  const shopId = getShopId(req);
  const { id } = req.params;
  const { name, price, purchase_price, low_stock_threshold } = req.body;
  try {
    const [result] = await db.query(
      `UPDATE products SET name=?, price=?, purchase_price=?, low_stock_threshold=? WHERE id=? AND shop_id=?`,
      [name, price, purchase_price || 0, low_stock_threshold, id, shopId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/products/:id
app.delete('/api/products/:id', async (req, res) => {
  const shopId = getShopId(req);
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `DELETE FROM products WHERE id=? AND shop_id=?`, [id, shopId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── SALES ────────────────────────────────────────────────────────────────────

// POST /api/sales
app.post('/api/sales', async (req, res) => {
  const shopId = getShopId(req);
  const { product_id, quantity } = req.body;
  if (!product_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Product ID and positive quantity required' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[product]] = await conn.query(
      `SELECT price, stock FROM products WHERE id=? AND shop_id=?`, [product_id, shopId]
    );
    if (!product) throw new Error('Product not found');
    if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const totalPrice = product.price * quantity;
    await conn.query(
      `INSERT INTO sales (shop_id, product_id, quantity, total_price) VALUES (?,?,?,?)`,
      [shopId, product_id, quantity, totalPrice]
    );
    await conn.query(`UPDATE products SET stock=stock-? WHERE id=?`, [quantity, product_id]);
    await conn.commit();
    res.json({ message: 'Sale recorded', totalPrice });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message || 'Transaction failed' });
  } finally {
    conn.release();
  }
});

// ─── PURCHASES ────────────────────────────────────────────────────────────────

// POST /api/purchases
app.post('/api/purchases', async (req, res) => {
  const shopId = getShopId(req);
  const { product_id, quantity, unit_cost } = req.body;
  if (!product_id || !quantity || quantity <= 0 || !unit_cost || unit_cost <= 0) {
    return res.status(400).json({ error: 'Product ID, quantity, and unit cost required' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[product]] = await conn.query(
      `SELECT id FROM products WHERE id=? AND shop_id=?`, [product_id, shopId]
    );
    if (!product) throw new Error('Product not found');

    const totalCost = unit_cost * quantity;
    await conn.query(
      `INSERT INTO purchases (shop_id, product_id, quantity, total_cost) VALUES (?,?,?,?)`,
      [shopId, product_id, quantity, totalCost]
    );
    await conn.query(
      `UPDATE products SET stock=stock+?, purchase_price=? WHERE id=?`,
      [quantity, unit_cost, product_id]
    );
    await conn.commit();
    res.json({ message: 'Purchase recorded', totalCost });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message || 'Transaction failed' });
  } finally {
    conn.release();
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
