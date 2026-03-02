import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, updateUserWallet } from '../utils/store';
import { connectWallet } from '../utils/wallet';
import { shortAddress } from '../utils/algorand';

export default function Login({ onLogin, onWalletConnect }) {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [walletAddr, setWalletAddr] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState('');

    const roles = [
        { id: 'sponsor', icon: '🏛️', label: 'Sponsor', desc: 'Fund projects, approve milestone payments, track spending' },
        { id: 'admin', icon: '🎓', label: 'Admin / Faculty', desc: 'Review milestones, approve/reject submissions, oversee grants' },
        { id: 'team', icon: '👨‍💻', label: 'Student Team', desc: 'Submit milestones, log expenses, receive funds' },
    ];

    const handleConnectWallet = async () => {
        setConnecting(true);
        try {
            const accounts = await connectWallet();
            if (accounts.length > 0) {
                setWalletAddr(accounts[0]);
                setError('');
            }
        } catch (err) {
            if (err?.data?.type !== 'CONNECT_MODAL_CLOSED') {
                setError('Wallet connection failed. Make sure Defly is set to TestNet.');
            }
        }
        setConnecting(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) { setError('Please enter your name'); return; }
        if (!role) { setError('Please select a role'); return; }

        const user = loginUser({ name: name.trim(), role, walletAddress: walletAddr });
        if (walletAddr) {
            updateUserWallet(walletAddr);
            if (onWalletConnect) onWalletConnect(walletAddr);
        }
        onLogin(user);
        navigate('/dashboard');
    };

    return (
        <div className="login-page">
            <div className="login-container fade-in">
                <div className="login-header">
                    <div className="login-logo">
                        <span className="logo-icon" style={{ width: 48, height: 48, fontSize: '1.4rem' }}>🔗</span>
                    </div>
                    <h1>Welcome to <span className="gradient-text">GrantChain</span></h1>
                    <p>Transparent Grant Tracking on Algorand Blockchain</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{
                            padding: '10px 16px', background: 'var(--danger-bg)', color: 'var(--danger)',
                            borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '0.88rem', fontWeight: 500,
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Your Name</label>
                        <input
                            type="text" className="form-control" value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            placeholder="Enter your full name" autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Select Your Role</label>
                        <div className="role-cards">
                            {roles.map((r) => (
                                <div key={r.id} className={`role-card ${role === r.id ? 'selected' : ''}`}
                                    onClick={() => { setRole(r.id); setError(''); }}>
                                    <div className="role-card-icon">{r.icon}</div>
                                    <div className="role-card-info">
                                        <h4>{r.label}</h4>
                                        <p>{r.desc}</p>
                                    </div>
                                    {role === r.id && <div className="role-check">✓</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Wallet Connection */}
                    <div className="form-group">
                        <label>Connect Defly Wallet (TestNet)</label>
                        {walletAddr ? (
                            <div style={{
                                padding: '12px 16px', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                                borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></span>
                                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.88rem' }}>Connected</span>
                                    <span className="txn-hash" style={{ fontSize: '0.82rem' }}>{shortAddress(walletAddr)}</span>
                                </div>
                                <button type="button" className="btn btn-sm" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}
                                    onClick={() => setWalletAddr('')}>Change</button>
                            </div>
                        ) : (
                            <button type="button" className="btn btn-secondary" style={{ width: '100%' }}
                                onClick={handleConnectWallet} disabled={connecting}>
                                {connecting ? '⏳ Connecting...' : '🔗 Connect Defly Wallet'}
                            </button>
                        )}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                            Required for on-chain transactions. Make sure Defly is set to TestNet.
                        </p>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }}>
                        🚀 Enter GrantChain
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <Link to="/public" style={{ color: 'var(--accent-hover)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
                        🌍 View Public Dashboard →
                    </Link>
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Powered by <strong>Algorand</strong> • TestNet • Real On-Chain Transactions
                </div>
            </div>
        </div>
    );
}
