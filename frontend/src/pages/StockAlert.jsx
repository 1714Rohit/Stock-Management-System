import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const StockAlert = () => {
  const { showToast, ToastComponent } = useToast();

  const { data: alerts = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['stockAlerts'],
    queryFn: async () => {
      const res = await api.getStockAlerts();
      return res.json();
    }
  });

  const urgencyColor = (pct) => {
    if (pct === 0) return { bar: 'bg-red-600', text: 'text-red-400', badge: 'bg-red-900/50 text-red-300 border-red-800/50', label: 'OUT' };
    if (pct <= 30) return { bar: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-900/50 text-red-300 border-red-800/50', label: 'Critical' };
    if (pct <= 60) return { bar: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-900/50 text-amber-300 border-amber-800/50', label: 'Low' };
    return { bar: 'bg-yellow-400', text: 'text-yellow-400', badge: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50', label: 'Warning' };
  };

  return (
    <div className="flex flex-col h-full">
      {ToastComponent}

      {/* ── Fixed Header ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 md:px-6 md:pt-5 border-b border-gray-800/60 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Stock Alerts</h2>
            <p className="text-xs text-gray-500">Products that need to be restocked</p>
          </div>
          <button onClick={() => refetch()} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5">
            🔄 Refresh
          </button>
        </div>

        {/* Summary Banner */}
        {!loading && (
          <div className={`rounded-2xl p-3 border flex items-center gap-4 ${alerts.length === 0 ? 'bg-emerald-950/30 border-emerald-900/40' : 'bg-red-950/30 border-red-900/40'}`}>
            <span className="text-2xl">{alerts.length === 0 ? '✅' : '⚠️'}</span>
            <div>
              {alerts.length === 0 ? (
                <>
                  <p className="text-sm font-semibold text-emerald-300">All stock levels are good!</p>
                  <p className="text-xs text-gray-400 mt-0.5">No products require restocking at this time.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-300">{alerts.length} product{alerts.length > 1 ? 's' : ''} need restocking</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sorted by urgency — most critical first.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 pb-24 md:pb-6">
        {loading ? (
          <p className="text-gray-500 text-sm text-center py-12 animate-pulse">Checking stock levels...</p>
        ) : alerts.length === 0 ? null : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {alerts.map(p => {
                const style = urgencyColor(p.stock_pct);
                return (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-white text-sm">{p.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{fmt(p.price)} per unit</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>{style.label}</span>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Stock: <span className={`font-bold ${style.text}`}>{p.stock}</span></span>
                        <span>Min: <span className="text-white font-medium">{p.low_stock_threshold}</span></span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${style.bar}`} style={{ width: `${Math.min(p.stock_pct, 100)}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{p.stock_pct}% of minimum threshold</p>
                    </div>
                    <div className="flex justify-between text-xs border-t border-gray-800 pt-3">
                      <span className="text-gray-400">Deficit: <span className="text-red-400 font-bold">{p.deficit} units</span></span>
                      <span className="text-gray-400">Suggested Buy: <span className="text-blue-400 font-bold">{Math.max(p.deficit, p.low_stock_threshold)} units</span></span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 text-right">Est. cost: {fmt(Math.max(p.deficit, p.low_stock_threshold) * parseFloat(p.price) * 0.7)}</p>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table — sticky header */}
            <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-gray-800">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-5 py-4 font-semibold bg-gray-900">Product</th>
                      <th className="px-5 py-4 font-semibold text-center bg-gray-900">Current Stock</th>
                      <th className="px-5 py-4 font-semibold text-center bg-gray-900">Min Required</th>
                      <th className="px-5 py-4 font-semibold bg-gray-900">Stock Level</th>
                      <th className="px-5 py-4 font-semibold text-center bg-gray-900">Deficit</th>
                      <th className="px-5 py-4 font-semibold text-center bg-gray-900">Suggested Buy</th>
                      <th className="px-5 py-4 font-semibold text-center bg-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {alerts.map(p => {
                      const style = urgencyColor(p.stock_pct);
                      const suggestedQty = Math.max(p.deficit, p.low_stock_threshold);
                      return (
                        <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-white">{p.name}</p>
                            <p className="text-xs text-gray-500">{fmt(p.price)}/unit</p>
                          </td>
                          <td className={`px-5 py-4 text-center font-bold text-lg ${style.text}`}>{p.stock}</td>
                          <td className="px-5 py-4 text-center text-gray-400">{p.low_stock_threshold}</td>
                          <td className="px-5 py-4 w-40">
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <div className={`h-2 rounded-full ${style.bar}`} style={{ width: `${Math.min(p.stock_pct, 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{p.stock_pct}%</p>
                          </td>
                          <td className="px-5 py-4 text-center text-red-400 font-semibold">{p.deficit}</td>
                          <td className="px-5 py-4 text-center">
                            <span className="text-blue-400 font-bold">{suggestedQty} units</span>
                            <p className="text-xs text-gray-600">{fmt(suggestedQty * parseFloat(p.price) * 0.7)}</p>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${style.badge}`}>{style.label}</span>
                          </td>
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
    </div>
  );
};

export default StockAlert;
