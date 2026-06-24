/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [shopName, setShopName] = useState('My Shop');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedShop = localStorage.getItem('shopName');
    if (token && savedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(JSON.parse(savedUser));
      setShopName(savedShop || 'My Shop');
    }
    setLoading(false);
  }, []);

  const login = (token, userData, shopNameVal) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('shopName', shopNameVal);
    setUser(userData);
    setShopName(shopNameVal);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('shopName');
    setUser(null);
    setShopName('My Shop');
  };

  return (
    <AuthContext.Provider value={{ user, shopName, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
