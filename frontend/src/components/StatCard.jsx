// Simple animated stat card component

const StatCard = ({ label, value, sub, color = 'indigo', icon }) => {
  const colorMap = {
    indigo: 'border-indigo-500/30 bg-indigo-500/5',
    green:  'border-emerald-500/30 bg-emerald-500/5',
    blue:   'border-blue-500/30 bg-blue-500/5',
    yellow: 'border-amber-500/30 bg-amber-500/5',
    red:    'border-red-500/30 bg-red-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
  };
  const textMap = {
    indigo: 'text-indigo-400',
    green:  'text-emerald-400',
    blue:   'text-blue-400',
    yellow: 'text-amber-400',
    red:    'text-red-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`rounded-2xl border p-3 md:p-5 ${colorMap[color]}`}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          {/* Label — smaller on mobile, no wrap issues */}
          <p className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 leading-tight">
            {label}
          </p>
          {/* Value — scales down on mobile, wraps instead of truncating */}
          <p
            className={`font-bold ${textMap[color]} leading-tight break-words`}
            style={{ fontSize: 'clamp(0.85rem, 3.5vw, 1.5rem)' }}
          >
            {value}
          </p>
          {sub && (
            <p className="text-[10px] md:text-xs text-gray-500 mt-1 leading-tight">{sub}</p>
          )}
        </div>
        {icon && (
          <span className="text-lg md:text-2xl flex-shrink-0 opacity-75 mt-0.5">{icon}</span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
