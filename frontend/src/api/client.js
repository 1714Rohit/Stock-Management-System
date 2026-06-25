const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('token');

const request = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.ok && options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
    window.dispatchEvent(new Event('inventory_changed'));
  }

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }

  return res;
};

export const api = {
  // Auth
  login: (email, password) =>
    fetch(`${API_BASE.replace('/api', '')}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  // Stats
  getStats: () => request('/stats'),
  getTopSelling: () => request('/sales/top-selling'),

  // Sales
  getSaleHistory: (limit = 50) => request(`/sales/history?limit=${limit}`),
  recordSale: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) }),

  // Purchases
  getPurchaseHistory: (limit = 50) => request(`/purchases/history?limit=${limit}`),
  recordPurchase: (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),

  // Products
  getProducts: () => request('/products'),
  addProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  // Stock Alerts
  getStockAlerts: () => request('/stock/alerts'),
};
