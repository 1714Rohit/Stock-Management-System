import 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  BellDot,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',   Icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/products',    Icon: Package,          label: 'Products'    },
  { to: '/sales',       Icon: TrendingUp,       label: 'Sales'       },
  { to: '/purchase',    Icon: ShoppingCart,     label: 'Purchase'    },
  { to: '/stock-alert', Icon: BellDot,          label: 'Stock Alert' },
];

const Sidebar = ({ shopName }) => {
  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-gray-900 border-r border-gray-800 fixed left-0 top-0 z-30">
      {/* Logo / Shop Name */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg font-bold text-white">
            {shopName?.charAt(0)?.toUpperCase() || 'S'}
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Store</p>
            <p className="text-sm font-semibold text-white truncate max-w-[140px]">{shopName}</p>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-800">
        <p className="text-xs text-white text-center">Developed By Rohit Patil</p>
      </div>
    </aside>
  );
};

export default Sidebar;
