import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const toInputDate = (d) => d.toISOString().split('T')[0];

/* ── Reusable autocomplete search input ─────────────────────────── */
const SearchWithSuggestions = ({
  value, onChange, onClear, placeholder,
  suggestions = [], onSelect, className = ''
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = value
    ? [...new Set(suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())))].slice(0, 8)
    : [];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm pointer-events-none">🔍</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-8 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onClear(); setOpen(false); }}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors"
        >
          ✕
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {filtered.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => { onSelect(s); setOpen(false); }}
              className="px-4 py-2.5 text-sm text-white hover:bg-indigo-600/40 cursor-pointer flex items-center gap-2 border-b border-gray-700/50 last:border-0"
            >
              <span className="text-gray-400 text-xs">📦</span> {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Product picker: search → dropdown list ─────────────────────── */
const ProductSearchPicker = ({ products, selectedProduct, onSelect, onClear }) => {
  const [query, setQuery] = useState(selectedProduct ? selectedProduct.name : '');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(selectedProduct ? selectedProduct.name : '');
  }, [selectedProduct]);

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
        type="text"
        placeholder="Type to search product..."
        value={query}
        autoComplete="off"
        onChange={e => { setQuery(e.target.value); onClear(); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
      />
      {query && (
        <button
          type="button"
          onClick={() => { setQuery(''); onClear(); setOpen(false); }}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors"
        >
          ✕
        </button>
      )}
      {open && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 text-center">No products found</li>
          ) : filtered.map(p => (
            <li
              key={p.id}
              onMouseDown={() => { onSelect(p); setOpen(false); }}
              className="px-4 py-3 text-sm hover:bg-blue-600/30 cursor-pointer border-b border-gray-700/40 last:border-0 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{p.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.stock === 0 ? 'bg-red-900/50 text-red-300' : p.stock <= p.low_stock_threshold ? 'bg-amber-900/50 text-amber-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                  Stock: {p.stock}
                </span>
              </div>
              <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                <span>Cost: {fmt(p.purchase_price)}</span>
                <span>Sell: {fmt(p.price)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Main Purchase page ─────────────────────────────────────────── */
const Purchase = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '10', unit_cost: '' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const pressTimer = useRef(null);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fromDate, setFromDate] = useState(toInputDate(firstOfMonth));
  const [toDate, setToDate] = useState(toInputDate(today));

  const { showToast, ToastComponent } = useToast();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['purchasesData'],
    queryFn: async () => {
      const [pRes, hRes] = await Promise.all([api.getProducts(), api.getPurchaseHistory(365)]);
      return {
        products: await pRes.json(),
        history: await hRes.json(),
      };
    }
  });

  const { products = [], history = [] } = data || {};

  const handleProductSelect = (p) => {
    setSelectedProduct(p);
    setForm(f => ({
      ...f,
      product_id: p.id,
      unit_cost: (parseFloat(p.purchase_price) || '').toString()
    }));
  };

  const handleProductClear = () => {
    setSelectedProduct(null);
    setForm(f => ({ ...f, product_id: '', unit_cost: '' }));
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      const res = await api.deletePurchases(ids);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete purchases');
      return data;
    },
    onSuccess: () => {
      showToast(`${selectedIds.length} purchase(s) deleted and stock updated!`);
      setIsSelectionMode(false);
      setSelectedIds([]);
      queryClient.invalidateQueries(['purchasesData']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboardData']);
    },
    onError: (err) => showToast(err.message || 'Error deleting purchases', 'error')
  });

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} purchase entry(s)? This will also decrease the stock accordingly.`)) return;
    deleteMutation.mutate(selectedIds);
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handlePressStart = (id) => {
    pressTimer.current = setTimeout(() => {
      if (!isSelectionMode) {
        if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback if supported
        setIsSelectionMode(true);
        setSelectedIds([id]);
      }
    }, 800); // 800ms long press
  };

  const handlePressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.recordPurchase(payload);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record purchase');
      return data;
    },
    onSuccess: () => {
      showToast(`Purchase of ${form.quantity} × ${selectedProduct.name} recorded!`);
      setModalOpen(false);
      setForm({ product_id: '', quantity: '10', unit_cost: '' });
      setSelectedProduct(null);
      queryClient.invalidateQueries(['purchasesData']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['salesData']);
      queryClient.invalidateQueries(['dashboardData']);
    },
    onError: (err) => showToast(err.message || 'Error recording purchase', 'error')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedProduct) return showToast('Please select a product', 'error');
    mutation.mutate({
      product_id: selectedProduct.id,
      quantity: parseInt(form.quantity),
      unit_cost: parseFloat(form.unit_cost),
    });
  };

  const saving = mutation.isPending;

  // Filter by search + date range
  const filteredHistory = history.filter(h => {
    const matchName = h.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    const date = new Date(h.purchase_date);
    const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
    const to = toDate ? new Date(toDate + 'T23:59:59') : null;
    return matchName && (from ? date >= from : true) && (to ? date <= to : true);
  });

  const totalFilteredCost = filteredHistory.reduce((s, h) => s + parseFloat(h.total_cost), 0);
  const totalFilteredQty = filteredHistory.reduce((s, h) => s + parseInt(h.quantity), 0);

  // Unique product names for history search suggestions
  const productNameSuggestions = [...new Set(history.map(h => h.product_name))];

  const clearDates = () => { setFromDate(''); setToDate(''); };

  return (
    <div className="flex flex-col h-full">
      {ToastComponent}

      {/* ── Fixed Header ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 md:px-6 md:pt-5 border-b border-gray-800/60 space-y-3">

        {/* Row 1: Title + Button */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Purchase / Restock</h2>
            <p className="text-xs text-gray-500">Log stock arrivals and update inventory</p>
          </div>
          {isSelectionMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
                className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.length === 0 || deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-red-900/40"
              >
                {deleteMutation.isPending ? 'Deleting...' : `Delete (${selectedIds.length})`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setModalOpen(true)}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-blue-900/40 flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span>
              <span className="hidden sm:inline">Log Purchase</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>

        {/* Row 2: Search bar (full width on mobile) */}
        <SearchWithSuggestions
          value={searchTerm}
          onChange={setSearchTerm}
          onClear={() => setSearchTerm('')}
          onSelect={(s) => setSearchTerm(s)}
          placeholder="Search product..."
          suggestions={productNameSuggestions}
          className="w-full"
        />

        {/* Row 3: Date filter — desktop inline, mobile toggleable */}
        <div>
          {/* Mobile toggle button */}
          <button
            onClick={() => setShowDateFilter(v => !v)}
            className={`sm:hidden w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${showDateFilter ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-gray-800/60 border-gray-700 text-gray-400'}`}
          >
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {fromDate || toDate
                ? `${fromDate ? new Date(fromDate).toLocaleDateString('en-IN') : '∞'} → ${toDate ? new Date(toDate).toLocaleDateString('en-IN') : '∞'}`
                : 'Filter by date'}
            </span>
            <span className="text-xs">{showDateFilter ? '▲' : '▼'}</span>
          </button>

          {/* Mobile expanded panel */}
          {showDateFilter && (
            <div className="sm:hidden mt-2 bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-8 flex-shrink-0">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-8 flex-shrink-0">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              {(fromDate || toDate) && (
                <button onClick={clearDates}
                  className="w-full text-xs py-1.5 rounded-lg bg-gray-700 hover:bg-red-900/40 text-gray-300 hover:text-red-300 border border-gray-600 transition-colors">
                  ✕ Clear dates
                </button>
              )}
            </div>
          )}

          {/* Desktop inline date filter */}
          <div className="hidden sm:flex items-center gap-3 mt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 whitespace-nowrap">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 whitespace-nowrap">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            {(fromDate || toDate) && (
              <button onClick={clearDates}
                className="text-xs px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-red-900/40 text-gray-300 hover:text-red-300 border border-gray-600 transition-colors">
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Summary strip */}
        {!loading && filteredHistory.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <span><span className="text-white font-semibold">{filteredHistory.length}</span> entries</span>
            <span className="text-gray-700">|</span>
            <span>Qty: <span className="text-indigo-300 font-semibold">{totalFilteredQty}</span></span>
            <span className="text-gray-700">|</span>
            <span>Cost: <span className="text-blue-400 font-semibold">{fmt(totalFilteredCost)}</span></span>
          </div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-h-0 px-4 py-4 md:px-6 pb-24 md:pb-6">
        {loading ? (
          <p className="text-gray-500 text-sm text-center py-12">Loading...</p>
        ) : filteredHistory.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-12">
            {searchTerm || fromDate || toDate ? 'No purchases match your filters.' : 'No purchases recorded yet.'}
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden overflow-y-auto space-y-3 relative select-none">
              {filteredHistory.map(h => {
                const isSelected = selectedIds.includes(h.id);
                return (
                  <div
                    key={h.id}
                    onMouseDown={() => handlePressStart(h.id)}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={() => handlePressStart(h.id)}
                    onTouchEnd={handlePressEnd}
                    onClick={() => { if (isSelectionMode) toggleSelection(h.id); }}
                    className={`bg-gray-900 border rounded-2xl p-3 transition-colors ${
                      isSelectionMode ? 'cursor-pointer' : ''
                    } ${isSelected ? 'border-red-500 bg-red-950/20' : 'border-gray-800'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-3">
                        {isSelectionMode && (
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-600'}`}>
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                        )}
                        <p className="font-semibold text-white text-sm">{h.product_name}</p>
                      </div>
                      <span className="text-blue-400 font-bold text-sm">{fmt(h.total_cost)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1 pl-8">
                      <span>Qty: <span className="text-white font-medium">{h.quantity}</span></span>
                      <span>Unit: <span className="text-white font-medium">{fmt(h.total_cost / h.quantity)}</span></span>
                      <span>{new Date(h.purchase_date).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table — sticky header */}
            <div className="hidden md:flex flex-col flex-1 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden min-h-0 select-none">
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-gray-800 shadow-sm">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      {isSelectionMode && <th className="px-5 py-4 bg-gray-900 w-12"></th>}
                      <th className="px-5 py-4 font-semibold bg-gray-900">No.</th>
                      <th className="px-5 py-4 font-semibold bg-gray-900">Product</th>
                      <th className="px-5 py-4 font-semibold text-center bg-gray-900">Qty</th>
                      <th className="px-5 py-4 font-semibold text-right bg-gray-900">Unit Cost</th>
                      <th className="px-5 py-4 font-semibold text-right bg-gray-900">Total Cost</th>
                      <th className="px-5 py-4 font-semibold text-right bg-gray-900">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {filteredHistory.map((h, idx) => {
                      const isSelected = selectedIds.includes(h.id);
                      return (
                        <tr 
                          key={h.id} 
                          onMouseDown={() => handlePressStart(h.id)}
                          onMouseUp={handlePressEnd}
                          onMouseLeave={handlePressEnd}
                          onClick={() => { if (isSelectionMode) toggleSelection(h.id); }}
                          className={`transition-colors ${isSelectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-red-950/20' : 'hover:bg-gray-800/30'}`}
                        >
                          {isSelectionMode && (
                            <td className="px-5 py-3">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-600'}`}>
                                {isSelected && <span className="text-white text-xs">✓</span>}
                              </div>
                            </td>
                          )}
                          <td className="px-5 py-3 text-gray-600 text-sm">{idx + 1}</td>
                          <td className="px-5 py-3 font-medium text-white">{h.product_name}</td>
                          <td className="px-5 py-3 text-center text-indigo-300 font-semibold">{h.quantity}</td>
                          <td className="px-5 py-3 text-right text-gray-400">{fmt(h.total_cost / h.quantity)}</td>
                          <td className="px-5 py-3 text-right text-blue-400 font-semibold">{fmt(h.total_cost)}</td>
                          <td className="px-5 py-3 text-right text-gray-500 text-sm">{new Date(h.purchase_date).toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="flex min-h-full items-start justify-center p-4 pt-10">
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl mb-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-white">Log Purchase / Restock</h3>
                <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-red-600 text-3xl mb-2 leading-none">×</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Product search picker — replaces <select> */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Select Product</label>
                  <ProductSearchPicker
                    products={products}
                    selectedProduct={selectedProduct}
                    onSelect={handleProductSelect}
                    onClear={handleProductClear}
                  />
                  {selectedProduct && (
                    <div className="mt-2 flex items-center gap-3 bg-blue-950/30 border border-blue-900/30 rounded-xl px-3 py-2 text-xs">
                      <span className="text-gray-400">Current stock:</span>
                      <span className={`font-bold ${selectedProduct.stock === 0 ? 'text-red-400' : selectedProduct.stock <= selectedProduct.low_stock_threshold ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {selectedProduct.stock} units
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Quantity Received</label>
                    <input
                      type="number" min="1" required
                      value={form.quantity}
                      onChange={e => setForm(f => ({...f, quantity: e.target.value}))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Unit Cost (₹)</label>
                    <input
                      type="number" min="0.01" step="0.01" required
                      value={form.unit_cost}
                      onChange={e => setForm(f => ({...f, unit_cost: e.target.value}))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="350.00"
                    />
                  </div>
                </div>

                {form.quantity && form.unit_cost && (
                  <div className="flex justify-between items-center bg-blue-950/30 border border-blue-900/40 rounded-xl px-4 py-3">
                    <span className="text-sm text-gray-300">Total Cost</span>
                    <span className="text-xl font-bold text-blue-400">
                      {fmt(parseFloat(form.unit_cost || 0) * parseInt(form.quantity || 0))}
                    </span>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModalOpen(false)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || !selectedProduct}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-900/40">
                    {saving ? 'Saving...' : 'Log Purchase'}
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

export default Purchase;
