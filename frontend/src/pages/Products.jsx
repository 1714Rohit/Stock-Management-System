import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const initialForm = { name: '', price: '', purchase_price: '', stock: '0', low_stock_threshold: '10' };

/* Reusable autocomplete search input */
const SearchWithSuggestions = ({ value, onChange, onClear, onSelect, placeholder, suggestions = [], inputClassName = '', wrapperClassName = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const filtered = value
    ? [...new Set(suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())))].slice(0, 8)
    : [];
  return (
    <div ref={ref} className={`relative ${wrapperClassName}`}>
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm pointer-events-none">🔍</span>
      <input
        type="text" autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className={`bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 ${inputClassName}`}
      />
      {value && (
        <button type="button" onClick={() => { onClear(); setOpen(false); }}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors">
          ✕
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {filtered.map((s, i) => (
            <li key={i} onMouseDown={() => { onSelect(s); setOpen(false); }}
              className="px-4 py-2.5 text-sm text-white hover:bg-indigo-600/40 cursor-pointer flex items-center gap-2 border-b border-gray-700/50 last:border-0">
              <span className="text-gray-400 text-xs">📦</span> {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Products = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellProduct, setSellProduct] = useState(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const { showToast, ToastComponent } = useToast();

  const { data: products = [], isLoading: loading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.getProducts();
      return res.json();
    }
  });

  const openAdd = () => { setEditProduct(null); setForm(initialForm); setModalOpen(true); };
  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, price: p.price, purchase_price: p.purchase_price || '', stock: p.stock, low_stock_threshold: p.low_stock_threshold });
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const res = editProduct
        ? await api.updateProduct(editProduct.id, payload)
        : await api.addProduct(payload);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      return data;
    },
    onSuccess: () => {
      showToast(editProduct ? 'Product updated!' : 'Product added!');
      setModalOpen(false);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboardData']);
    },
    onError: (err) => showToast(err.message || 'Error saving product', 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.deleteProduct(id);
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      showToast('Product deleted');
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboardData']);
    },
    onError: () => showToast('Error deleting', 'error')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      name: form.name,
      price: parseFloat(form.price),
      purchase_price: parseFloat(form.purchase_price) || 0,
      stock: editProduct ? undefined : parseInt(form.stock),
      low_stock_threshold: parseInt(form.low_stock_threshold),
    });
  };

  const handleDelete = (id, name) => {
    if (!confirm(`Delete "${name}"? All transactions will be lost.`)) return;
    deleteMutation.mutate(id);
  };

  const openSell = (p) => {
    setSellProduct(p);
    setSellQuantity(1);
    setSellModalOpen(true);
  };

  const sellMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.recordSale(payload);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record sale');
      return data;
    },
    onSuccess: () => {
      showToast(`Sale of ${sellQuantity} × ${sellProduct.name} recorded!`);
      setSellModalOpen(false);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['dashboardData']);
    },
    onError: (err) => showToast(err.message || 'Error recording sale', 'error')
  });

  const handleSellSubmit = (e) => {
    e.preventDefault();
    if (!sellProduct) return;
    sellMutation.mutate({
      product_id: sellProduct.id,
      quantity: parseInt(sellQuantity),
    });
  };

  const saving = mutation.isPending || sellMutation.isPending;

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const stockBadge = (p) => {
    if (p.stock === 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/50 text-red-300 border border-red-800/50">Out of Stock</span>;
    if (p.stock <= p.low_stock_threshold) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-900/50 text-amber-300 border border-amber-800/50">Low Stock</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-800/50">In Stock</span>;
  };

  return (
    /* Full height flex column — header fixed, list scrolls */
    <div className="flex flex-col h-full">
      {ToastComponent}

      {/* ── Fixed Header ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 md:px-6 md:pt-5 border-b border-gray-800/60 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Product Catalog</h2>
            <p className="text-xs text-gray-500">{products.length} products total</p>
          </div>
        </div>
        {/* Search + Add button on same row */}
        <div className="flex items-center gap-2">
          <SearchWithSuggestions
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            onSelect={(s) => setSearch(s)}
            placeholder="Search product name..."
            suggestions={products.map(p => p.name)}
            inputClassName="w-full"
            wrapperClassName="flex-1"
          />
          <button
            onClick={openAdd}
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap shadow-lg shadow-indigo-900/40 flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 pb-24 md:pb-6">

        {/* Mobile Cards View */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No products found</p>
          ) : filtered.map(p => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-white text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Sell: {fmt(p.price)} · Cost: {fmt(p.purchase_price)}</p>
                </div>
                {stockBadge(p)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center mt-3 border-t border-gray-800 pt-3">
                <div><p className="text-gray-500">Stock</p><p className="font-bold text-white">{p.stock}</p></div>
                <div><p className="text-gray-500">Sold</p><p className="font-bold text-indigo-300">{p.total_sold}</p></div>
                <div><p className="text-gray-500">Bought</p><p className="font-bold text-blue-300">{p.total_purchased}</p></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => openSell(p)} disabled={p.stock <= 0} className="flex-1 text-xs bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-900/30 py-1.5 rounded-lg transition-colors disabled:opacity-50">Sell</button>
                <button onClick={() => openEdit(p)} className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-white py-1.5 rounded-lg transition-colors">Edit</button>
                <button onClick={() => handleDelete(p.id, p.name)} className="flex-1 text-xs bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-900/30 py-1.5 rounded-lg transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table — sticky header, scrollable rows */}
        <div className="hidden md:flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden h-full">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  {['Product', 'Sell Price', 'Cost Price', 'Stock', 'Sold', 'Purchased', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-4 font-semibold bg-gray-900">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-500 text-sm">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-500 text-sm">No products found</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4 font-medium text-white">{p.name}</td>
                    <td className="px-5 py-4 text-emerald-400 font-semibold">{fmt(p.price)}</td>
                    <td className="px-5 py-4 text-blue-400">{fmt(p.purchase_price)}</td>
                    <td className={`px-5 py-4 font-bold ${p.stock === 0 ? 'text-red-400' : p.stock <= p.low_stock_threshold ? 'text-amber-400' : 'text-white'}`}>{p.stock}</td>
                    <td className="px-5 py-4 text-indigo-300">{p.total_sold}</td>
                    <td className="px-5 py-4 text-gray-400">{p.total_purchased}</td>
                    <td className="px-5 py-4">{stockBadge(p)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openSell(p)} disabled={p.stock <= 0} className="text-xs bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-900/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">Sell</button>
                        <button onClick={() => openEdit(p)} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors">Edit</button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="text-xs bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-900/30 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setModalOpen(false); setEditProduct(null); } }}
        >
          <div className="flex min-h-full items-start justify-center p-4 pt-10">
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl mb-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-white">{editProduct ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={() => { setModalOpen(false); setEditProduct(null); }} className="text-gray-500 hover:text-red-600 text-3xl mb-2 leading-none">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Product Name</label>
                  <input required className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Wireless Mouse" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Sell Price (₹)</label>
                    <input required type="number" min="0" step="0.01" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} placeholder="499.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Cost Price (₹)</label>
                    <input type="number" min="0" step="0.01" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.purchase_price} onChange={e => setForm(f => ({...f, purchase_price: e.target.value}))} placeholder="350.00" />
                  </div>
                </div>
                {!editProduct && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Initial Stock</label>
                    <input required type="number" min="0" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} placeholder="0" />
                    <p className="text-xs text-gray-600 mt-1">Initial stock will be logged as a purchase entry.</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Low Stock Warning At</label>
                  <input required type="number" min="0" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={form.low_stock_threshold} onChange={e => setForm(f => ({...f, low_stock_threshold: e.target.value}))} placeholder="10" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setModalOpen(false); setEditProduct(null); }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-900/40">
                    {saving ? 'Saving...' : 'Save Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Quick Sell Modal */}
      {sellModalOpen && sellProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setSellModalOpen(false); }}>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Quick Sell</h3>
                <button onClick={() => setSellModalOpen(false)} className="text-gray-500 hover:text-red-600 text-2xl leading-none">&times;</button>
              </div>
              <form onSubmit={handleSellSubmit} className="space-y-4">
                <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700">
                  <p className="text-sm font-medium text-white">{sellProduct.name}</p>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-400">Sell Price: <span className="text-emerald-400">{fmt(sellProduct.price)}</span></span>
                    <span className="text-gray-400">Stock: <span className={`font-bold ${sellProduct.stock === 0 ? 'text-red-400' : 'text-white'}`}>{sellProduct.stock}</span></span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Quantity to Sell</label>
                  <input
                    type="number" min="1" max={sellProduct.stock} required
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                    value={sellQuantity}
                    onChange={e => setSellQuantity(e.target.value)}
                  />
                </div>
                {sellQuantity > 0 && (
                  <div className="flex justify-between items-center bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-4 py-3">
                    <span className="text-sm text-gray-300">Total Bill</span>
                    <span className="text-xl font-bold text-emerald-400">
                      {fmt(parseFloat(sellProduct.price) * parseInt(sellQuantity))}
                    </span>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setSellModalOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-900/40">
                    {saving ? 'Processing...' : 'Complete Sale'}
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

export default Products;
