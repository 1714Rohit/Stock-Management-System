import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import StatCard from '../components/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/* Product search picker — replaces <select> */
const ProductSearchPicker = ({ products, selectedProduct, onSelect, onClear }) => {
  const [query, setQuery] = useState(selectedProduct ? selectedProduct.name : '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setQuery(selectedProduct ? selectedProduct.name : ''); }, [selectedProduct]);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : products;

  return (
    <div ref={ref} className="relative">
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-sm pointer-events-none">🔍</span>
      <input
        type="text" autoComplete="off"
        placeholder="Type to search product..."
        value={query}
        onChange={e => { setQuery(e.target.value); onClear(); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
      />
      {query && (
        <button type="button" onClick={() => { setQuery(''); onClear(); setOpen(false); }}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors">
          ✕
        </button>
      )}
      {open && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 text-center">No products found</li>
          ) : filtered.map(p => (
            <li key={p.id} onMouseDown={() => { onSelect(p); setOpen(false); }}
              className="px-4 py-3 text-sm hover:bg-emerald-600/20 cursor-pointer border-b border-gray-700/40 last:border-0 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{p.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.stock === 0 ? 'bg-red-900/50 text-red-300' :
                  p.stock <= p.low_stock_threshold ? 'bg-amber-900/50 text-amber-300' :
                  'bg-emerald-900/50 text-emerald-300'
                }`}>Stock: {p.stock}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Sell Price: {fmt(p.price)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CustomXAxisTick = ({ x, y, payload }) => {
  const maxChars = 10;
  const name = payload.value || '';
  const display = name.length > maxChars ? name.substring(0, maxChars) + '…' : name;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#9ca3af" fontSize={11}>
        {display}
      </text>
    </g>
  );
};

// Matches the dashboard chart hover card so sales details stay consistent.
const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="font-semibold text-white mb-1">{payload[0]?.payload?.name}</p>
        <p className="text-indigo-300">Sold: <span className="font-bold">{payload[0]?.value} units</span></p>
        <p className="text-emerald-300">Revenue: <span className="font-bold">{fmt(payload[0]?.payload?.revenue)}</span></p>
      </div>
    );
  }
  return null;
};

const Sales = () => {
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [topSelling, setTopSelling] = useState([]);
  const [tab, setTab] = useState('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '1' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastComponent } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, hRes, sRes, tRes] = await Promise.all([
        api.getProducts(),
        api.getSaleHistory(30),
        api.getStats(),
        api.getTopSelling(),
      ]);
      setProducts(await pRes.json());
      setHistory(await hRes.json());
      setStats(await sRes.json());
      const top = await tRes.json();
      setTopSelling(top.filter(p => p.total_sold > 0));
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const handleProductSelect = (p) => {
    setSelectedProduct(p);
    setForm(f => ({ ...f, product_id: p.id }));
  };

  const handleProductClear = () => {
    setSelectedProduct(null);
    setForm(f => ({ ...f, product_id: '' }));
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSaving(true);
    try {
      const res = await api.recordSale({ product_id: parseInt(form.product_id), quantity: parseInt(form.quantity) });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || 'Failed to record sale', 'error');
      showToast(`Sale of ${form.quantity} × ${selectedProduct.name} recorded!`);
      setModalOpen(false);
      setForm({ product_id: '', quantity: '1' });
      setSelectedProduct(null);
      load();
    } catch { showToast('Error recording sale', 'error'); }
    finally { setSaving(false); }
  };

  const COLORS = ['#6366f1','#8b5cf6','#a78bfa','#818cf8','#4f46e5'];

  return (
    <div className="flex flex-col h-full">
      {ToastComponent}

      {/* ── Fixed Header ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 md:px-6 md:pt-5 border-b border-gray-800/60 space-y-4">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Sales Overview</h2>
            <p className="text-xs text-gray-500">Track and manage all customer sales</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-emerald-900/40 flex items-center gap-1.5"
          >
            <span className="text-base">+</span> New Sale
          </button>
        </div>

      </div>

      

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 pb-24 md:pb-6 space-y-5">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {['today', 'monthly', 'yearly'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        {!loading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard
              label="Sales Revenue"
              value={tab === 'today' ? fmt(stats.todaySales) : tab === 'monthly' ? fmt(stats.monthlySales) : fmt(stats.yearlySales)}
              sub={tab === 'today' ? 'Today' : tab === 'monthly' ? 'This Month' : 'This Year'}
              color="indigo" icon="💰"
            />
            <StatCard
              label="Purchase Cost"
              value={tab === 'today' ? fmt(stats.todayPurchases) : tab === 'monthly' ? fmt(stats.monthlyPurchases) : fmt(stats.yearlyPurchases)}
              sub="Restocking cost"
              color="yellow" icon="🛒"
            />
            <StatCard
              label={parseFloat(tab === 'today' ? stats.todayProfit : tab === 'monthly' ? stats.monthlyProfit : stats.yearlyProfit) >= 0 ? 'Profit' : 'Loss'}
              value={tab === 'today' ? fmt(stats.todayProfit) : tab === 'monthly' ? fmt(stats.monthlyProfit) : fmt(stats.yearlyProfit)}
              sub="Revenue minus cost"
              color={parseFloat(tab === 'today' ? stats.todayProfit : tab === 'monthly' ? stats.monthlyProfit : stats.yearlyProfit) >= 0 ? 'green' : 'red'}
              icon="📊"
            />
          </div>
        )}

        {/* Best Selling Chart */}
        {topSelling.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Best Selling Products</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topSelling.slice(0, 8)} margin={{ top: 24, right: 10, left: 10, bottom: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="name" tick={<CustomXAxisTick />} interval={0} tickLine={false} axisLine={false} height={50} />
                <YAxis width={0} tick={false} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="total_sold" name="Units Sold" radius={[4, 4, 0, 0]}>
                  {topSelling.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  <LabelList dataKey="total_sold" position="top" style={{ fill: '#e5e7eb', fontSize: 12, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Sales History */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Recent Sales History</h3>
          </div>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No sales recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-gray-800">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3 font-semibold bg-gray-900">No.</th>
                    <th className="px-5 py-3 font-semibold bg-gray-900">Product</th>
                    <th className="px-5 py-3 font-semibold text-center bg-gray-900">Qty</th>
                    <th className="px-5 py-3 font-semibold text-right bg-gray-900">Amount</th>
                    <th className="px-5 py-3 font-semibold text-right bg-gray-900 hidden sm:table-cell">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {history.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3 text-gray-600 text-xs">{idx + 1}</td>
                      <td className="px-5 py-3 font-medium text-white">{s.product_name}</td>
                      <td className="px-5 py-3 text-center text-indigo-300 font-semibold">{s.quantity}</td>
                      <td className="px-5 py-3 text-right text-emerald-400 font-semibold">{fmt(s.total_price)}</td>
                      <td className="px-5 py-3 text-right text-gray-500 text-xs hidden sm:table-cell">
                        {new Date(s.sale_date).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Record Sale Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="flex min-h-full items-start justify-center p-4 pt-10">
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl mb-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-white">Record Customer Sale</h3>
                <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-red-600 text-3xl mb-2 leading-none">&times;</button>
              </div>
              <form onSubmit={handleSaleSubmit} className="space-y-4">
                {/* Product search picker */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Select Product</label>
                  <ProductSearchPicker
                    products={products.filter(p => p.stock > 0)}
                    selectedProduct={selectedProduct}
                    onSelect={handleProductSelect}
                    onClear={handleProductClear}
                  />
                  {selectedProduct && (
                    <div className="mt-2 bg-gray-800/60 rounded-xl p-3 text-sm space-y-1 border border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sell Price</span>
                        <span className="text-emerald-400 font-semibold">{fmt(selectedProduct.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Available Stock</span>
                        <span className="text-white font-semibold">{selectedProduct.stock} units</span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.stock || 1}
                    required
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {selectedProduct && (
                  <div className="flex justify-between items-center bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-4 py-3">
                    <span className="text-sm text-gray-300">Total Bill</span>
                    <span className="text-xl font-bold text-emerald-400">
                      {fmt(parseFloat(selectedProduct.price) * parseInt(form.quantity || 0))}
                    </span>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" disabled={saving || !selectedProduct} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-900/40">
                    {saving ? 'Recording...' : 'Complete Sale ₹'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
