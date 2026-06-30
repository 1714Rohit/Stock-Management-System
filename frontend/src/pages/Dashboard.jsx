import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import { useToast } from '../components/Toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList,
} from 'recharts';

/* XAxis tick — horizontal name below bar, hidden on mobile */
const CustomXAxisTick = ({ x, y, payload }) => {
  const name = payload.value || '';
  const maxChars = 10;
  const display = name.length > maxChars ? name.substring(0, maxChars) + '…' : name;
  return (
    <g transform={`translate(${x},${y})`} className="hidden md:block">
      <text
        x={0} y={0} dy={16}
        textAnchor="middle"
        fill="#9ca3af"
        fontSize={11}
      >
        {display}
      </text>
    </g>
  );
};

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#818cf8','#4f46e5','#7c3aed'];

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

const Dashboard = () => {
  const { showToast, ToastComponent } = useToast();

  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const [statsRes, chartRes] = await Promise.all([
        api.getStats(),
        api.getTopSelling(),
      ]);
      const statsData = await statsRes.json();
      const chartRaw = await chartRes.json();
      return {
        stats: statsData,
        chartData: chartRaw.filter(p => p.total_sold > 0).slice(0, 6)
      };
    }
  });

  if (isError) {
    showToast('Failed to load dashboard data', 'error');
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 animate-pulse text-sm">Loading dashboard...</div>
    </div>
  );

  const { stats, chartData } = data || { stats: null, chartData: [] };

  const profitColor = (val) => parseFloat(val) >= 0 ? 'green' : 'red';

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 space-y-6">
      {ToastComponent}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Today's Sales" value={fmt(stats?.todaySales)} sub="Revenue today" color="indigo" icon="💰" />
        <StatCard label="Today Profit" value={fmt(stats?.todayProfit)} sub={parseFloat(stats?.todayProfit) >= 0 ? 'Profit' : 'Loss'} color={profitColor(stats?.todayProfit)} icon="📊" />
        <StatCard label="Monthly Sales" value={fmt(stats?.monthlySales)} sub="This month" color="indigo" icon="📈" />
        <StatCard label="Monthly Profit" value={fmt(stats?.monthlyProfit)} sub={parseFloat(stats?.monthlyProfit) >= 0 ? 'Profit' : 'Loss'} color={profitColor(stats?.monthlyProfit)} icon="📉" />
        <StatCard label="Low Stock Items" value={stats?.lowStockCount} sub="Need restocking" color="red" icon="⚠️" />
        <StatCard label="Total Products" value={stats?.totalProducts} sub="In catalog" color="blue" icon="📦" />
        <StatCard label="Top Product" value={stats?.topSellingProduct} sub={`${stats?.topSellingQty} units sold`} color="purple" icon="🏆" />
        <StatCard label="Yearly Sales" value={fmt(stats?.yearlySales)} sub={new Date().getFullYear()} color="yellow" icon="🗓️" />
      </div>

      {/* Bar Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-white mb-1">Sales Ranking</h2>
        <p className="text-xs text-gray-500 mb-5">Products ranked from highest to lowest sold quantity</p>
        {chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
            No sales recorded yet. Start making sales to see the chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 24, right: 10, left: 10, bottom: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="name"
                tick={<CustomXAxisTick />}
                interval={0}
                tickLine={false}
                axisLine={false}
                height={30}
              />
              <YAxis width={0} tick={false} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="total_sold" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                {/* Number above the bar */}
                <LabelList dataKey="total_sold" position="top" style={{ fill: '#e5e7eb', fontSize: 12, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top 5 Table */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">Top Selling Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="pb-3 font-semibold">No.</th>
                  <th className="pb-3 font-semibold">Product</th>
                  <th className="pb-3 font-semibold text-right">Units Sold</th>
                  <th className="pb-3 font-semibold text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {chartData.slice(0, 5).map((p, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 pr-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-white">{p.name}</td>
                    <td className="py-3 text-right text-indigo-300 font-semibold">{p.total_sold}</td>
                    <td className="py-3 text-right text-emerald-400 font-semibold">{fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
