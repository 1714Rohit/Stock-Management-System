import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layout components
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Topbar from './components/Topbar';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Purchase from './pages/Purchase';
import StockAlert from './pages/StockAlert';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-sm animate-pulse">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// App Layout with sidebar + topbar
const AppLayout = ({ children }) => {
  const { shopName } = useAuth();
  const location = useLocation();
  return (
    <div className="h-screen bg-gray-950 flex overflow-hidden">
      <Sidebar shopName={shopName} />
      <div className="flex-1 md:ml-64 flex flex-col h-full overflow-hidden">
        <Topbar />
        {/* key={location.key} triggers re-mount → re-plays the CSS animation on every nav */}
        <main key={location.key} className="flex-1 overflow-hidden page-transition">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/products" element={
        <ProtectedRoute>
          <AppLayout><Products /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/sales" element={
        <ProtectedRoute>
          <AppLayout><Sales /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/purchase" element={
        <ProtectedRoute>
          <AppLayout><Purchase /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/stock-alert" element={
        <ProtectedRoute>
          <AppLayout><StockAlert /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
