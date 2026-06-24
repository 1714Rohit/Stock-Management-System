/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-red-600 border-red-500',
    warning: 'bg-amber-600 border-amber-500',
  };
  const icons = { success: '✓', error: '✕', warning: '⚠' };

  return (
    <div
      className={`fixed top-5 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-white text-sm font-medium max-w-xs animate-in ${styles[type]}`}
      style={{ animation: 'slideIn 0.3s ease' }}
    >
      <span className="text-base font-bold">{icons[type]}</span>
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  );
};

export const useToast = () => {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type });
  const closeToast = () => setToast(null);
  const ToastComponent = toast ? <Toast message={toast.message} type={toast.type} onClose={closeToast} /> : null;
  return { showToast, ToastComponent };
};

export default Toast;
