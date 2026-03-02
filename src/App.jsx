import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { connectWallet, disconnectWallet, reconnectWallet } from './utils/wallet';
import { shortAddress } from './utils/algorand';
import { getCurrentUser, logoutUser, updateUserWallet } from './utils/store';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CreateGrant from './pages/CreateGrant';
import GrantDetail from './pages/GrantDetail';
import Analytics from './pages/Analytics';
import PublicView from './pages/PublicView';

const ROLE_CONFIG = {
  sponsor: { icon: '🏛️', label: 'Sponsor', color: '#8b5cf6' },
  admin: { icon: '🎓', label: 'Admin', color: '#3b82f6' },
  team: { icon: '👨‍💻', label: 'Team', color: '#10b981' },
};

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function NavBar({ user, walletAddress, onConnect, onDisconnect, onLogout }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';
  const roleInfo = ROLE_CONFIG[user?.role] || {};

  if (!user) return null;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="logo-icon">🔗</div>
        GrantChain
      </Link>

      <ul className="navbar-nav">
        <li><Link to="/" className={isActive('/')}>Home</Link></li>
        <li><Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link></li>
        <li><Link to="/analytics" className={isActive('/analytics')}>📈 Analytics</Link></li>
        <li><Link to="/public" className={isActive('/public')}>🌍 Public</Link></li>
        {user.role === 'sponsor' && (
          <li><Link to="/create" className={isActive('/create')}>Create Grant</Link></li>
        )}
        {user.role === 'team' && (
          <li><Link to="/create" className={isActive('/create')}>📤 Submit Proposal</Link></li>
        )}
      </ul>

      <div className="navbar-actions">
        <div className="role-badge-nav" style={{ background: `${roleInfo.color}22`, border: `1px solid ${roleInfo.color}44` }}>
          <span>{roleInfo.icon}</span>
          <span style={{ color: roleInfo.color, fontWeight: 600 }}>{user.name}</span>
          <span className="badge" style={{ background: roleInfo.color, color: '#fff', fontSize: '0.7rem' }}>{roleInfo.label}</span>
        </div>

        {walletAddress ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="wallet-chip">
              <span className="dot"></span>
              {shortAddress(walletAddress)}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onDisconnect}>✕</button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onConnect}>
            🔗 Connect Wallet
          </button>
        )}

        <button className="btn btn-secondary btn-sm" onClick={onLogout} title="Logout">
          🚪 Logout
        </button>
      </div>
    </nav>
  );
}

function App() {
  const [user, setUser] = useState(getCurrentUser);
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    reconnectWallet((accounts) => {
      const addr = accounts.length > 0 ? accounts[0] : '';
      setWalletAddress(addr);
      if (addr) updateUserWallet(addr);
    });
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setWalletAddress('');
  };

  const handleConnect = async () => {
    try {
      const accounts = await connectWallet();
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        updateUserWallet(accounts[0]);
      }
    } catch (err) {
      console.log('Connection cancelled or failed');
    }
  };

  const handleDisconnect = async () => {
    try { await disconnectWallet(); } catch { }
    setWalletAddress('');
    updateUserWallet('');
  };

  return (
    <Router>
      <NavBar
        user={user}
        walletAddress={walletAddress}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onLogout={handleLogout}
      />
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} onWalletConnect={(addr) => { setWalletAddress(addr); }} />
        } />
        <Route path="/" element={
          user ? <Landing user={user} walletAddress={walletAddress} onConnect={handleConnect} />
            : <Navigate to="/login" replace />
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute user={user}>
            <Dashboard user={user} walletAddress={walletAddress} />
          </ProtectedRoute>
        } />
        <Route path="/create" element={
          <ProtectedRoute user={user}>
            <CreateGrant user={user} walletAddress={walletAddress} />
          </ProtectedRoute>
        } />
        <Route path="/grant/:id" element={
          <ProtectedRoute user={user}>
            <GrantDetail user={user} walletAddress={walletAddress} />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute user={user}>
            <Analytics user={user} />
          </ProtectedRoute>
        } />
        <Route path="/public" element={<PublicView />} />
      </Routes>
    </Router>
  );
}

export default App;
