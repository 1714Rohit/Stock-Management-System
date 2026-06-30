import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import StatCard from '../components/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const toInputDate = (d) => d.toISOString().split('T')[0];

/* Product search picker */
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

/* Custom bar label rendered INSIDE the bar (center, white text) */
const InsideBarLabel = (props) => {
  const { x, y, width, height, value } = props;
  if (!value || height < 20) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="#fff"
      fontSize={11}
      fontWeight={700}
    >
      {value}
    </text>
  );
};

/* Product name shown below bar, rotated to avoid overlap */
const CustomXAxisTick = ({ x, y, payload }) => {
  const name = payload.value || '';
  const maxChars = 8;
  const display = name.length > maxChars ? name.substring(0, maxChars) + '…' : name;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={12}
        textAnchor="end"
        fill="#9ca3af"
        fontSize={10}
        transform="rotate(-35)"
      >
        {display}
      </text>
    </g>
  );
};

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

/* Quick date filter presets */
const DATE_PRESETS = [
  { label: 'All', days: 0 },
  { label: 'Today', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
];

const Sales = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '1' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [returnQty, setReturnQty] = useState('1');

  // Sales history filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDays, setActiveDays] = useState(30); // default: show last 30 days

  const { showToast, ToastComponent } = useToast();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['salesData'],
    queryFn: async () => {
      const [pRes, hRes, sRes, tRes] = await Promise.all([
        api.getProducts(),
        api.getSaleHistory(365), // fetch more, we'll filter client-side
        api.getStats(),
        api.getTopSelling(),
      ]);
      return {
        products: await pRes.json(),
        history: await hRes.json(),
        stats: await sRes.json(),
        topSelling: (await tRes.json()).filter(p => p.total_sold > 0)
      };
    }
  });

  const { products = [], history = [], stats = null, topSelling = [] } = data || {};

  // Apply client-side filters
  const filteredHistory = history.filter(s => {
    const matchName = s.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchName) return false;
    if (activeDays === 0) return true; // "All"
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - activeDays);
    cutoff.setHours(0, 0, 0, 0);
    return new Date(s.sale_date) >= cutoff;
  });

  const handleProductSelect = (p) => {
    setSelectedProduct(p);
    setForm(f => ({ ...f, product_id: p.id }));
  };

  const handleProductClear = () => {
    setSelectedProduct(null);
    setForm(f => ({ ...f, product_id: '' }));
  };

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.recordSale(payload);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record sale');
      return data;
    },
    onSuccess: () => {
      showToast(`Sale of ${form.quantity} × ${selectedProduct.name} recorded!`);
      setModalOpen(false);
      setForm({ product_id: '', quantity: '1' });
      setSelectedProduct(null);
      queryClient.invalidateQueries(['salesData']);
      queryClient.invalidateQueries(['dashboardData']);
      queryClient.invalidateQueries(['products']);
    },
    onError: (err) => showToast(err.message || 'Error recording sale', 'error')
  });

  const returnMutation = useMutation({
    mutationFn: async ({ sale_id, return_quantity }) => {
      const res = await api.returnSale({ sale_id, return_quantity });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process return');
      return data;
    },
    onSuccess: () => {
      showToast(`Return of ${returnQty} item(s) processed! Stock restored.`);
      setReturnModal(null);
      setReturnQty('1');
      queryClient.invalidateQueries(['salesData']);
      queryClient.invalidateQueries(['dashboardData']);
      queryClient.invalidateQueries(['products']);
    },
    onError: (err) => showToast(err.message || 'Error processing return', 'error')
  });

  const handleReturnSubmit = (e) => {
    e.preventDefault();
    if (!returnModal) return;
    returnMutation.mutate({ sale_id: returnModal.sale_id, return_quantity: parseInt(returnQty) });
  };

  const handleSaleSubmit = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    mutation.mutate({ product_id: parseInt(form.product_id), quantity: parseInt(form.quantity) });
  };

  const saving = mutation.isPending;

  const COLORS = ['#6366f1','#8b5cf6','#a78bfa','#818cf8','#4f46e5','#7c3aed'];

  return (
    <div className="flex flex-col h-full">
      {ToastComponent}

      {/* ── Fixed Header ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 md:px-6 md:pt-5 border-b border-gray-800/60">
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

        {/* Best Selling Chart — labels inside bars, names rotated below */}
        {topSelling.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Best Selling Products</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topSelling.slice(0, 6)} margin={{ top: 8, right: 10, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={<CustomXAxisTick />}
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                  height={55}
                />
                <YAxis width={0} tick={false} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="total_sold" name="Units Sold" radius={[6, 6, 0, 0]}>
                  {topSelling.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  <LabelList content={<InsideBarLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sales History */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

          {/* Header + Filters */}
          <div className="px-4 py-3 border-b border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Sales History</h3>
              <span className="text-xs text-gray-500">{filteredHistory.length} entries</span>
            </div>

            {/* Search by product name */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm pointer-events-none">🔍</span>
              <input
                type="text"
                placeholder="Search product name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-8 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors">✕</button>
              )}
            </div>

            {/* Quick date filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {DATE_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setActiveDays(p.days)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${activeDays === p.days ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8 animate-pulse">Loading sales...</p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              {searchQuery ? `No sales found for "${searchQuery}"` : 'No sales in this period.'}
            </p>
          ) : (
            <>
              {/* Mobile — card list */}
              <div className="md:hidden divide-y divide-gray-800/60 max-h-[480px] overflow-y-auto">
                {filteredHistory.map((s, idx) => (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-gray-600 text-xs w-5 flex-shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{s.product_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{new Date(s.sale_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-emerald-400 font-bold text-sm">{fmt(s.total_price)}</p>
                      <p className="text-xs text-indigo-300">{s.quantity} unit{s.quantity > 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => { setReturnModal({ sale_id: s.id, product_name: s.product_name, max_qty: s.quantity }); setReturnQty('1'); }}
                      title="Process Return"
                      className="flex-shrink-0 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 p-1.5 rounded-lg transition-all text-lg"
                    >
                      ↩
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop — table, no horizontal scroll */}
              <div className="hidden md:block max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-gray-800">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 font-semibold bg-gray-900 w-8">#</th>
                      <th className="px-4 py-3 font-semibold bg-gray-900">Product</th>
                      <th className="px-4 py-3 font-semibold text-center bg-gray-900 w-16">Qty</th>
                      <th className="px-4 py-3 font-semibold text-right bg-gray-900">Amount</th>
                      <th className="px-4 py-3 font-semibold text-right bg-gray-900">Date</th>
                      <th className="px-2 py-3 bg-gray-900 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {filteredHistory.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-gray-800/30 transition-colors group">
                        <td className="px-4 py-3 text-gray-600 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-white max-w-[180px] truncate">{s.product_name}</td>
                        <td className="px-4 py-3 text-center text-indigo-300 font-semibold">{s.quantity}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{fmt(s.total_price)}</td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                          {new Date(s.sale_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => { setReturnModal({ sale_id: s.id, product_name: s.product_name, max_qty: s.quantity }); setReturnQty('1'); }}
                            className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 px-2 py-1 rounded-lg transition-all text-xs font-medium"
                          >
                            ↩ Return
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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

      {/* Return Items Modal */}
      {returnModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setReturnModal(null); }}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Process Return</h3>
                <button onClick={() => setReturnModal(null)} className="text-gray-500 hover:text-red-400 text-2xl leading-none">&times;</button>
              </div>
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-gray-300">Product: <span className="font-semibold text-white">{returnModal.product_name}</span></p>
                <p className="text-xs text-gray-400 mt-0.5">Original qty sold: <span className="font-bold text-amber-300">{returnModal.max_qty} units</span></p>
              </div>
              <form onSubmit={handleReturnSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">How many items are being returned?</label>
                  <input
                    type="number"
                    min="1"
                    max={returnModal.max_qty}
                    required
                    value={returnQty}
                    onChange={e => setReturnQty(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Max: {returnModal.max_qty} units. Stock will be restored and revenue adjusted.</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setReturnModal(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" disabled={returnMutation.isPending} className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg shadow-amber-900/40">
                    {returnMutation.isPending ? 'Processing...' : 'Confirm Return'}
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
