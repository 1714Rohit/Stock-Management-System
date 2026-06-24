const mysql = require('mysql2');
const db = mysql.createConnection({ host: '127.0.0.1', user: 'root', password: 'root123', database: 'multi_tenant_stock_mgmt' });
db.query("UPDATE shops SET name='Patel Electronics'", function(e, r) {
  console.log(e || 'Updated rows: ' + r.affectedRows);
  db.end();
});
