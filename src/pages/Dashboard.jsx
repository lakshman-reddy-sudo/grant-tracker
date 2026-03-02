import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGrants, getGrantStats } from '../utils/store';
import { shortAddress, getExplorerTxnUrl } from '../utils/algorand';

export default function Dashboard({ user, walletAddress }) {
    const [grants, setGrants] = useState([]);

    useEffect(() => {
        setGrants(getGrants());
    }, []);

    // Role-based filtering
    const filteredGrants = grants; // Show all grants to all roles for transparency

    const allStats = filteredGrants.reduce(
        (acc, g) => {
            const s = getGrantStats(g);
            acc.totalFunding += s.totalFunding;
            acc.released += s.releasedAmount;
            acc.remaining += s.remainingAmount;
            acc.totalGrants += 1;
            acc.totalMilestones += s.totalMilestones;
            acc.fundedMilestones += s.funded;
            acc.pendingApprovals += s.submitted;
            acc.rejectedCount += s.rejected;
            return acc;
        },
        { totalFunding: 0, released: 0, remaining: 0, totalGrants: 0, totalMilestones: 0, fundedMilestones: 0, pendingApprovals: 0, rejectedCount: 0 }
    );

    // Role-specific action items
    const getActionItems = () => {
        const items = [];
        filteredGrants.forEach(g => {
            g.milestones.forEach(m => {
                if (user.role === 'admin' && m.status === 'submitted') {
                    items.push({ grant: g, milestone: m, action: 'Review & Approve', icon: '📋' });
                }
                if (user.role === 'sponsor' && m.status === 'approved') {
                    items.push({ grant: g, milestone: m, action: 'Release Funds', icon: '💸' });
                }
                if (user.role === 'team' && m.status === 'pending') {
                    items.push({ grant: g, milestone: m, action: 'Submit Work', icon: '📤' });
                }
                if (user.role === 'team' && m.status === 'rejected') {
                    items.push({ grant: g, milestone: m, action: 'Resubmit', icon: '🔄' });
                }
            });
        });
        return items;
    };

    const actionItems = getActionItems();

    return (
        <div className="page fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1>{user.role === 'sponsor' ? 'Sponsor Dashboard' : user.role === 'admin' ? 'Admin Dashboard' : 'Team Dashboard'}</h1>
                    <p>
                        {user.role === 'sponsor' && 'Manage sponsored grants and approve fund releases'}
                        {user.role === 'admin' && 'Review milestone submissions and oversee all grants'}
                        {user.role === 'team' && 'Track your milestones, submit work, and log expenses'}
                    </p>
                </div>
                {user.role === 'sponsor' && (
                    <Link to="/create" className="btn btn-primary">➕ New Grant</Link>
                )}
                {user.role === 'team' && (
                    <Link to="/create" className="btn btn-primary">📤 Submit Proposal</Link>
                )}
            </div>

            {/* Stats */}
            <div className="stat-grid">
                <div className="stat-card">
                    <div className="stat-icon purple">💰</div>
                    <div className="stat-content">
                        <h4>Total Funding</h4>
                        <div className="stat-value">{allStats.totalFunding} ALGO</div>
                        <div className="stat-sub">{allStats.totalGrants} active grants</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green">✅</div>
                    <div className="stat-content">
                        <h4>Released</h4>
                        <div className="stat-value">{allStats.released} ALGO</div>
                        <div className="stat-sub">{allStats.fundedMilestones} milestones funded</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon yellow">🔒</div>
                    <div className="stat-content">
                        <h4>In Escrow</h4>
                        <div className="stat-value">{allStats.remaining} ALGO</div>
                        <div className="stat-sub">Locked in multisig</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue">📋</div>
                    <div className="stat-content">
                        <h4>{user.role === 'admin' ? 'Pending Reviews' : user.role === 'sponsor' ? 'Awaiting Release' : 'Your Tasks'}</h4>
                        <div className="stat-value">{actionItems.length}</div>
                        <div className="stat-sub">Action items</div>
                    </div>
                </div>
            </div>

            {/* Action Items */}
            {actionItems.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <h2 className="section-title">⚡ Your Action Items</h2>
                    <div className="action-items-grid">
                        {actionItems.slice(0, 6).map((item, i) => (
                            <Link key={i} to={`/grant/${item.grant.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div className="card action-item-card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>{item.action}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {item.milestone.name} • {item.grant.name}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--accent-hover)', marginTop: '2px' }}>
                                                {item.milestone.amount} ALGO
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Grant Cards */}
            <h2 className="section-title">Active Projects</h2>
            {filteredGrants.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <h3>No grants yet</h3>
                    <p>{user.role === 'sponsor' ? 'Create your first grant to get started' : 'No grants available yet'}</p>
                    {user.role === 'sponsor' && <Link to="/create" className="btn btn-primary">➕ Create Grant</Link>}
                </div>
            ) : (
                <div className="grants-grid">
                    {filteredGrants.map((grant) => {
                        const stats = getGrantStats(grant);
                        return (
                            <Link key={grant.id} to={`/grant/${grant.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div className="card grant-card card-glow">
                                    <div className="grant-card-header">
                                        <h3>{grant.name}</h3>
                                        <span className="grant-amount">{stats.totalFunding} ALGO</span>
                                    </div>
                                    <p className="grant-card-desc">{grant.description}</p>
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                        {grant.teamName && <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>👨‍💻 {grant.teamName}</span>}
                                        {grant.sponsorName && <span className="badge badge-funded" style={{ fontSize: '0.7rem' }}>🏛️ {grant.sponsorName}</span>}
                                    </div>
                                    <div className="grant-card-progress">
                                        <div className="progress-label">
                                            <span>Progress</span>
                                            <span>{stats.progressPercent}%</span>
                                        </div>
                                        <div className="progress-bar-container">
                                            <div className="progress-bar-fill green" style={{ width: `${stats.progressPercent}%` }} />
                                        </div>
                                    </div>
                                    <div className="grant-card-footer">
                                        <span>🏦 {shortAddress(grant.escrowAddress)}</span>
                                        <span>{stats.funded}/{stats.totalMilestones} funded</span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Recent Transactions */}
            {filteredGrants.some((g) => g.transactions.length > 0) && (
                <div style={{ marginTop: '40px' }}>
                    <h2 className="section-title">📜 Recent Transactions</h2>
                    <div className="card" style={{ overflow: 'auto' }}>
                        <table className="txn-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Project</th>
                                    <th>Amount</th>
                                    <th>Note</th>
                                    <th>Date</th>
                                    <th>Txn ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGrants
                                    .flatMap((g) => g.transactions.map((t) => ({ ...t, grantName: g.name })))
                                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                    .slice(0, 10)
                                    .map((txn, i) => (
                                        <tr key={i}>
                                            <td>
                                                <span className={`badge badge-${txn.type === 'fund' ? 'funded' : 'approved'}`}>
                                                    {txn.type === 'fund' ? '💰 Fund' : '📤 Release'}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{txn.grantName}</td>
                                            <td style={{ fontWeight: 600, color: txn.type === 'fund' ? 'var(--success)' : 'var(--accent-hover)' }}>
                                                {txn.amount} ALGO
                                            </td>
                                            <td>{txn.note}</td>
                                            <td>{new Date(txn.timestamp).toLocaleDateString()}</td>
                                            <td>
                                                {txn.txnId ? (
                                                    <a href={getExplorerTxnUrl(txn.txnId)} target="_blank" rel="noreferrer"
                                                        style={{ fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--success-bg)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.3)' }}>
                                                        ⛓️ <span style={{ fontWeight: 600 }}>Verified</span> <span className="txn-hash">{shortAddress(txn.txnId)}</span> ↗
                                                    </a>
                                                ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Off-chain</span>}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
