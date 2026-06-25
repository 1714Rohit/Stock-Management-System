import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  BellDot,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',   Icon: LayoutDashboard, label: 'Home'     },
  { to: '/products',    Icon: Package,          label: 'Products' },
  { to: '/sales',       Icon: TrendingUp,       label: 'Sales'    },
  { to: '/purchase',    Icon: ShoppingCart,     label: 'Purchase' },
  { to: '/stock-alert', Icon: BellDot,          label: 'Alerts'   },
];

const NAV_H = 75; // total SVG height
const VW = 300;   // SVG viewBox internal width
const BASE_Y = 25; // The top edge of the flat part of the nav bar

// Builds the nav bar SVG path with a smooth convex "mountain" bump at the active tab.
const buildPath = (activeIdx) => {
  const tabW = VW / navItems.length;
  const cx = tabW * activeIdx + tabW / 2; // center x of active tab
  const spread = 45;  // half-width of the mountain
  const peakY = 0;    // peak of the mountain

  // Smooth mountain curve using cubic bezier
  return [
    `M 0 ${BASE_Y}`,
    `L ${cx - spread} ${BASE_Y}`,
    `C ${cx - spread * 0.5} ${BASE_Y}, ${cx - spread * 0.4} ${peakY}, ${cx} ${peakY}`,
    `C ${cx + spread * 0.4} ${peakY}, ${cx + spread * 0.5} ${BASE_Y}, ${cx + spread} ${BASE_Y}`,
    `L ${VW} ${BASE_Y}`,
    `L ${VW} ${NAV_H}`,
    `L 0 ${NAV_H}`,
    `Z`,
  ].join(' ');
};

const MobileNav = () => {
  const location = useLocation();
  const activeIdx = Math.max(0, navItems.findIndex(n => n.to === location.pathname));
  const path = buildPath(activeIdx);
  const ActiveIcon = navItems[activeIdx].Icon;
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.getStockAlerts();
        if (res.ok) {
          const data = await res.json();
          const currentTotal = data.length || 0;
          
          if (location.pathname === '/stock-alert') {
            localStorage.setItem('lastSeenAlertCount', currentTotal);
            setAlertCount(0);
          } else {
            const lastSeen = parseInt(localStorage.getItem('lastSeenAlertCount') || '0', 10);
            if (currentTotal > lastSeen) {
              setAlertCount(currentTotal - lastSeen);
            } else {
              if (currentTotal < lastSeen) {
                localStorage.setItem('lastSeenAlertCount', currentTotal);
              }
              setAlertCount(0);
            }
          }
        }
      } catch (e) {}
    };
    fetchAlerts();
    window.addEventListener('inventory_changed', fetchAlerts);
    return () => window.removeEventListener('inventory_changed', fetchAlerts);
  }, [location.pathname]);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ height: `${NAV_H}px`, overflow: 'visible' }}
    >
      {/* SVG: dark bar with smooth mountain bump */}
      <svg
        viewBox={`0 0 ${VW} ${NAV_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        style={{
          filter: 'drop-shadow(0 -5px 15px rgba(0,0,0,0.4))',
          transition: 'd 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <path
          d={path}
          fill="#111827"
          style={{ transition: 'd 0.35s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>

      <div className="flex justify-around items-center h-full max-w-md mx-auto relative px-2">
        
        {/* The smoothly sliding active bubble + label */}
        <div
          className="absolute flex flex-col items-center pointer-events-none z-10"
          style={{
            width: `${100 / navItems.length}%`,
            left: `${(100 / navItems.length) * activeIdx}%`,
            top: '0px',
            transition: 'left 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* White circle bubble */}
          <span
            className="flex items-center justify-center rounded-full bg-white shadow-lg border-4 border-gray-900 relative"
            style={{
              width: '54px',
              height: '54px',
              marginTop: '-5px',
              color: '#4f46e5', // indigo for icon
            }}
          >
            <ActiveIcon size={24} strokeWidth={2} />
            {navItems[activeIdx].to === '/stock-alert' && alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm">
                {alertCount}
              </span>
            )}
          </span>
          <span className="text-xs font-bold text-white mt-1 drop-shadow-md tracking-wide">
            {navItems[activeIdx].label}
          </span>
        </div>

        {/* Clickable Tab Buttons */}
        {navItems.map(({ to, Icon, label }, idx) => {
          const isActive = activeIdx === idx;
          return (
            <NavLink
              key={to}
              to={to}
              className="flex-1 relative h-full flex flex-col items-center justify-end pb-3 z-0"
            >
              {/* Inactive style (hidden when active so the sliding bubble replaces it) */}
              <span
                className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${isActive ? 'opacity-0' : 'opacity-100'}`}
                style={{ transform: 'translateY(8px)' }}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={1.6} className="text-gray-300" />
                  {to === '/stock-alert' && alertCount > 0 && (
                    <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full shadow-sm">
                      {alertCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-gray-400 tracking-wider uppercase">{label}</span>
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
