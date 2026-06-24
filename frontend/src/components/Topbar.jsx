import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/sales': 'Sales',
  '/purchase': 'Purchase',
  '/stock-alert': 'Stock Alerts',
};

const Topbar = () => {
  const { user, shopName, logout } = useAuth();
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Stock Manager';

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-800 bg-gray-950 sticky top-0 z-20">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-xs text-gray-400">{shopName}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white">
          {shopName?.email?.charAt(0)?.toUpperCase() || 'P'}
        </div>
        <button
          onClick={logout}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-950/40 border border-transparent hover:border-red-900/50"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Topbar;
