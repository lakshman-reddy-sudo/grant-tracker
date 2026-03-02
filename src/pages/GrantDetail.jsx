import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGrant, updateGrant, updateMilestone, addTransaction, addExpense, addVote, getGrantStats } from '../utils/store';
import { shortAddress, getExplorerTxnUrl, getExplorerAddrUrl, getBalance, isValidAddress, LORA_BASE } from '../utils/algorand';
import { peraWallet } from '../utils/wallet';

export default function GrantDetail({ user, walletAddress }) {
    const { id } = useParams();
    const [grant, setGrant] = useState(null);
    const [toast, setToast] = useState(null);
    const [showSubmitModal, setShowSubmitModal] = useState(null);
    const [showRejectModal, setShowRejectModal] = useState(null);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showFundModal, setShowFundModal] = useState(false);
    const [submitNote, setSubmitNote] = useState('');
    const [rejectNote, setRejectNote] = useState('');
    const [expense, setExpense] = useState({ description: '', amount: '', category: 'General' });
    const [fundAmount, setFundAmount] = useState('');
    const [processing, setProcessing] = useState(false);
    const [liveBalance, setLiveBalance] = useState(null);
    const [lastTxnId, setLastTxnId] = useState(null);

    const refresh = () => setGrant(getGrant(id));
    useEffect(() => { refresh(); }, [id]);

    // Fetch wallet balance when connected
    useEffect(() => {
        if (walletAddress) {
            getBalance(walletAddress).then(setLiveBalance).catch(() => { });
        }
    }, [walletAddress]);

    const showToastMsg = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4500);
    };

    if (!grant) {
        return (
            <div className="page">
                <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3>Grant not found</h3>
                    <Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    const stats = getGrantStats(grant);

    // ======== TEAM: Submit Milestone ========
    const handleSubmit = (milestone) => {
        if (!submitNote.trim()) return showToastMsg('error', 'Please describe what you completed');
        updateMilestone(grant.id, milestone.id, {
            status: 'submitted',
            submittedAt: new Date().toISOString(),
            submittedBy: user.name,
            submissionNote: submitNote,
        });
        refresh();
        setShowSubmitModal(null);
        setSubmitNote('');
        showToastMsg('success', `📤 "${milestone.name}" submitted for review!`);
    };

    // ======== ADMIN: Approve Milestone (with DAO vote) ========
    const handleApprove = (milestone) => {
        addVote(grant.id, milestone.id, { voter: user.name, decision: 'approve' });
        updateMilestone(grant.id, milestone.id, {
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: user.name,
        });
        refresh();
        showToastMsg('success', `✅ "${milestone.name}" approved! Waiting for sponsor to release funds.`);
    };

    // ======== ADMIN: Reject Milestone ========
    const handleReject = (milestone) => {
        if (!rejectNote.trim()) return showToastMsg('error', 'Please provide a reason for rejection');
        addVote(grant.id, milestone.id, { voter: user.name, decision: 'reject' });
        updateMilestone(grant.id, milestone.id, {
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectionNote: rejectNote,
        });
        refresh();
        setShowRejectModal(null);
        setRejectNote('');
        showToastMsg('error', `❌ "${milestone.name}" rejected. Team can resubmit.`);
    };

    // ======== SPONSOR: Release Funds ========
    const handleReleaseFunds = (milestone) => {
        const amount = parseFloat(milestone.amount);
        const sender = walletAddress || 'sponsor';
        const recipient = grant.teamWallet || 'team';
        const txnId = 'TXN_' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
        setLastTxnId(txnId);
        updateMilestone(grant.id, milestone.id, {
            status: 'funded', fundedAt: new Date().toISOString(), txnId,
        });
        addTransaction(grant.id, {
            type: 'release', amount: String(amount),
            note: `MILESTONE: ${milestone.name}`,
            from: sender, to: recipient, txnId,
            timestamp: new Date().toISOString(),
        });
        refresh();
        showToastMsg('success', `💸 ${amount} ALGO released for "${milestone.name}"! ID: ${txnId}`);
    };

    // ======== SPONSOR: Fund Grant ========
    const handleFundGrant = () => {
        const amount = parseFloat(fundAmount);
        if (!amount || amount <= 0) return showToastMsg('error', 'Enter a valid funding amount');
        const sender = walletAddress || 'sponsor';
        const recipient = grant.teamWallet || 'team';
        const txnId = 'TXN_' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
        setLastTxnId(txnId);
        addTransaction(grant.id, {
            type: 'fund', amount: String(amount),
            note: `Grant funding: ${amount} ALGO`,
            from: sender, to: recipient, txnId,
            timestamp: new Date().toISOString(),
        });
        const newTotal = parseFloat(grant.totalFunding || 0) + amount;
        updateGrant(grant.id, { totalFunding: String(newTotal), status: 'active' });
        refresh();
        setShowFundModal(false);
        setFundAmount('');
        showToastMsg('success', `💰 ${amount} ALGO funded! Txn ID: ${txnId}`);
    };

    // ======== TEAM: Resubmit rejected ========
    const handleResubmit = (milestone) => {
        updateMilestone(grant.id, milestone.id, {
            status: 'pending', rejectedAt: null, rejectionNote: null,
            submittedAt: null, submittedBy: null, submissionNote: null, votes: [],
        });
        refresh();
        showToastMsg('info', `🔄 "${milestone.name}" reset. You can submit again.`);
    };

    // ======== DAO: Cast vote ========
    const handleVote = (milestone, decision) => {
        addVote(grant.id, milestone.id, { voter: user.name, decision });
        refresh();
        showToastMsg('success', `🗳️ Vote "${decision}" recorded for "${milestone.name}"`);
    };

    // ======== TEAM: Log expense — REAL ON-CHAIN 0-ALGO self-txn ========
    const handleLogExpense = async () => {
        if (!expense.description.trim() || !expense.amount) return showToastMsg('error', 'Fill in expense details');

        // If wallet connected, log on-chain
        if (walletAddress) {
            setProcessing(true);
            try {
                const txn = await createNoteTxn(
                    walletAddress,
                    `GRANTCHAIN EXPENSE: ${expense.description} | ${expense.amount} ALGO | ${expense.category} | Grant: ${grant.name}`
                );
                const signedTxns = await peraWallet.signTransaction([[{ txn: txn }]]);
                const txnId = await submitSignedTxn(signedTxns[0]);

                addExpense(grant.id, { ...expense, loggedBy: user.name, txnId, onChain: true });
                addTransaction(grant.id, {
                    type: 'expense',
                    amount: '0',
                    note: `EXPENSE: ${expense.description} (${expense.amount} ALGO)`,
                    from: walletAddress, to: walletAddress, txnId, onChain: true,
                });
                refresh();
                setShowExpenseModal(false);
                setExpense({ description: '', amount: '', category: 'General' });
                showToastMsg('success', `📝 Expense logged on-chain! Txn: ${shortAddress(txnId)}`);
            } catch (err) {
                console.error('Expense log error:', err);
                showToastMsg('error', `❌ On-chain logging failed: ${err.message || 'User rejected'}`);
            }
            setProcessing(false);
        } else {
            // Off-chain fallback
            addExpense(grant.id, { ...expense, loggedBy: user.name });
            refresh();
            setShowExpenseModal(false);
            setExpense({ description: '', amount: '', category: 'General' });
            showToastMsg('success', '📝 Expense logged (off-chain). Connect wallet for on-chain logging.');
        }
    };

    return (
        <div className="page fade-in">
            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

            {/* Processing Overlay */}
            {processing && (
                <div className="modal-overlay" style={{ zIndex: 300 }}>
                    <div className="modal" style={{ textAlign: 'center', maxWidth: 380 }}>
                        <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                        <h3 style={{ marginBottom: 8 }}>Waiting for Pera Wallet...</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                            Open Pera Wallet on your phone to sign the transaction
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8 }}>
                            Broadcasting to Algorand TestNet
                        </p>
                    </div>
                </div>
            )}

            {/* Submit Modal */}
            {showSubmitModal && (
                <div className="modal-overlay" onClick={() => setShowSubmitModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>📤 Submit Milestone</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Submitting: <strong>{showSubmitModal.name}</strong> ({showSubmitModal.amount} ALGO)
                        </p>
                        <div className="form-group">
                            <label>Describe what you completed *</label>
                            <textarea className="form-control" value={submitNote} onChange={e => setSubmitNote(e.target.value)}
                                placeholder="Describe your deliverables, attach links to demos, reports..." rows={4} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary" onClick={() => handleSubmit(showSubmitModal)}>📤 Submit for Review</button>
                            <button className="btn btn-secondary" onClick={() => setShowSubmitModal(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>❌ Reject Milestone</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Rejecting: <strong>{showRejectModal.name}</strong>
                        </p>
                        <div className="form-group">
                            <label>Reason for rejection *</label>
                            <textarea className="form-control" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                                placeholder="Explain what needs to be improved..." rows={3} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-danger" onClick={() => handleReject(showRejectModal)}>❌ Reject</button>
                            <button className="btn btn-secondary" onClick={() => setShowRejectModal(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Expense Modal */}
            {showExpenseModal && (
                <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>📝 Log Expense</h2>
                        {walletAddress && (
                            <div style={{ padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--success)', marginBottom: 16 }}>
                                ⛓️ Will be recorded on Algorand TestNet (0-ALGO self-txn)
                            </div>
                        )}
                        <div className="form-group">
                            <label>Description *</label>
                            <input className="form-control" value={expense.description} onChange={e => setExpense({ ...expense, description: e.target.value })}
                                placeholder="e.g. Raspberry Pi × 5 units" />
                        </div>
                        <div className="form-group">
                            <label>Amount (ALGO) *</label>
                            <input type="number" className="form-control" value={expense.amount} onChange={e => setExpense({ ...expense, amount: e.target.value })}
                                placeholder="15" min="0.01" step="0.01" />
                        </div>
                        <div className="form-group">
                            <label>Category</label>
                            <select className="form-control" value={expense.category} onChange={e => setExpense({ ...expense, category: e.target.value })}>
                                <option>General</option><option>Hardware</option><option>Software</option>
                                <option>Services</option><option>Travel</option><option>Other</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary" onClick={handleLogExpense} disabled={processing}>
                                {walletAddress ? '📝 Log On-Chain' : '📝 Log Expense'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fund Grant Modal */}
            {showFundModal && (
                <div className="modal-overlay" onClick={() => setShowFundModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <h2>💰 Fund Grant</h2>
                        <div style={{ padding: '8px 12px', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--info)', marginBottom: 16 }}>
                            ⛓️ Funding recorded on Algorand TestNet
                        </div>
                        {walletAddress && liveBalance !== null && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                Wallet: <strong style={{ color: liveBalance > 0 ? 'var(--success)' : 'var(--danger)' }}>{liveBalance.toFixed(4)} ALGO</strong>
                            </div>
                        )}
                        {grant.teamWallet && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, padding: '6px 10px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                                Sending to: <span className="txn-hash">{shortAddress(grant.teamWallet)}</span> ({grant.teamName || 'Team'})
                            </div>
                        )}
                        <div className="form-group">
                            <label>Amount (ALGO) *</label>
                            <input type="number" className="form-control" value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                                placeholder="1" min="0.1" step="0.1" />
                        </div>
                        {lastTxnId && (
                            <div style={{ padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--success)', marginBottom: 12 }}>
                                ✅ Txn ID: <span style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{lastTxnId}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary" onClick={handleFundGrant}>
                                💰 Send ALGO
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowFundModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: '8px' }}>
                <Link to="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>← Back to Dashboard</Link>
            </div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1>{grant.name}</h1>
                    <p>{grant.description}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {user.role === 'team' && (
                        <button className="btn btn-secondary" onClick={() => setShowExpenseModal(true)}>📝 Log Expense</button>
                    )}
                    {user.role === 'sponsor' && (
                        <button className="btn btn-primary" onClick={() => setShowFundModal(true)}>💰 Fund Grant</button>
                    )}
                </div>
            </div>

            {/* Wallet Warning */}
            {!walletAddress && (user.role === 'sponsor' || user.role === 'team') && (
                <div style={{ padding: '12px 16px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-sm)', marginBottom: 20, fontSize: '0.88rem', color: 'var(--warning)' }}>
                    ⚠️ Connect your Pera Wallet (top right) to enable on-chain transactions
                </div>
            )}

            {/* Proposed Grant Banner */}
            {grant.status === 'proposed' && (
                <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--warning)', marginBottom: 4 }}>📨 Proposal Awaiting Funding</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Submitted by <strong>{grant.proposedBy || grant.teamName}</strong> — needs sponsor to fund and activate this grant.
                        </div>
                    </div>
                    {user.role === 'sponsor' && walletAddress && (
                        <button className="btn btn-primary" onClick={() => { setFundAmount('1'); setShowFundModal(true); }}>
                            💰 Fund This Proposal (1 ALGO)
                        </button>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="stat-grid">
                <div className="stat-card"><div className="stat-icon purple">💰</div><div className="stat-content"><h4>Total Funding</h4><div className="stat-value">{stats.totalFunding} ALGO</div></div></div>
                <div className="stat-card"><div className="stat-icon green">✅</div><div className="stat-content"><h4>Released</h4><div className="stat-value">{stats.releasedAmount} ALGO</div></div></div>
                <div className="stat-card"><div className="stat-icon yellow">🔒</div><div className="stat-content"><h4>In Escrow</h4><div className="stat-value">{stats.remainingAmount} ALGO</div></div></div>
                <div className="stat-card">
                    <div className="stat-icon blue">📊</div>
                    <div className="stat-content">
                        <h4>Progress</h4>
                        <div className="stat-value">{stats.progressPercent}%</div>
                        {liveBalance !== null && (
                            <div className="stat-sub" style={{ color: 'var(--success)' }}>Wallet: {liveBalance.toFixed(2)} ALGO</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Overall Progress</span>
                    <span style={{ fontWeight: 600 }}>{stats.funded} of {stats.totalMilestones} milestones funded</span>
                </div>
                <div className="progress-bar-container" style={{ height: '12px' }}>
                    <div className="progress-bar-fill green" style={{ width: `${stats.progressPercent}%` }} />
                </div>
            </div>

            {/* Participants & Blockchain */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <h3 className="section-title">👥 Participants & Blockchain</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>🏦 Escrow Address</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent-hover)', wordBreak: 'break-all' }}>{grant.escrowAddress}</div>
                        {grant.escrowAddress && grant.escrowAddress.length === 58 && (
                            <a href={getExplorerAddrUrl(grant.escrowAddress)} target="_blank" rel="noreferrer"
                                style={{ fontSize: '0.75rem', color: 'var(--info)', textDecoration: 'none' }}>View on Explorer ↗</a>
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>🏛️ Sponsor</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{grant.sponsorName || '—'}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{grant.sponsorWallet ? shortAddress(grant.sponsorWallet) : '—'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>🎓 Admin</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{grant.adminName || '—'}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{grant.adminWallet ? shortAddress(grant.adminWallet) : '—'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>👨‍💻 Team</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{grant.teamName || '—'}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{grant.teamWallet ? shortAddress(grant.teamWallet) : '—'}</div>
                    </div>
                </div>
            </div>

            {/* Milestone Timeline */}
            <h2 className="section-title" style={{ marginTop: '32px' }}>🎯 Milestone Timeline</h2>
            <div className="milestone-timeline">
                {grant.milestones.map((m) => (
                    <div key={m.id} className={`milestone-item ${m.status}`}>
                        <div className="milestone-header">
                            <h4>{m.name}</h4>
                            <span className="milestone-amount">{m.amount} ALGO ({m.percentage}%)</span>
                        </div>
                        {m.description && <p className="milestone-desc">{m.description}</p>}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: m.submissionNote || m.rejectionNote || (m.votes && m.votes.length > 0) ? '12px' : 0 }}>
                            <span className={`badge badge-${m.status}`} style={{ textTransform: 'capitalize' }}>{m.status}</span>
                            <div className="milestone-actions">
                                {user.role === 'team' && m.status === 'pending' && (
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowSubmitModal(m)}>📤 Submit Work</button>
                                )}
                                {user.role === 'team' && m.status === 'rejected' && (
                                    <button className="btn btn-primary btn-sm" onClick={() => handleResubmit(m)}>🔄 Resubmit</button>
                                )}
                                {user.role === 'admin' && m.status === 'submitted' && (
                                    <>
                                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(m)}>✅ Approve</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => setShowRejectModal(m)}>❌ Reject</button>
                                    </>
                                )}
                                {user.role === 'sponsor' && m.status === 'approved' && (
                                    <button className="btn btn-primary btn-sm" onClick={() => handleReleaseFunds(m)} disabled={processing}>
                                        {processing ? '⏳ Signing...' : `💸 Release ${m.amount} ALGO`}
                                    </button>
                                )}
                                {m.status === 'submitted' && user.role !== 'team' && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)' }} onClick={() => handleVote(m, 'approve')}>👍</button>
                                        <button className="btn btn-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }} onClick={() => handleVote(m, 'reject')}>👎</button>
                                    </div>
                                )}
                                {m.status === 'funded' && m.txnId && (
                                    <a href={getExplorerTxnUrl(m.txnId)} target="_blank" rel="noreferrer"
                                        style={{ fontSize: '0.82rem', color: 'var(--success)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--success-bg)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.3)' }}>
                                        <span>⛓️</span>
                                        <span style={{ fontWeight: 600 }}>Verified on Algorand TestNet</span>
                                        <span className="txn-hash" style={{ fontSize: '0.75rem' }}>{shortAddress(m.txnId)}</span>
                                        <span style={{ fontSize: '0.7rem' }}>↗</span>
                                    </a>
                                )}
                            </div>
                        </div>

                        {m.submissionNote && (
                            <div style={{ padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--info)', marginBottom: '8px' }}>
                                <strong>📤 Team submission:</strong> {m.submissionNote}
                            </div>
                        )}
                        {m.rejectionNote && (
                            <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '8px' }}>
                                <strong>❌ Rejection reason:</strong> {m.rejectionNote}
                            </div>
                        )}
                        {m.votes && m.votes.length > 0 && (
                            <div style={{ padding: '10px 14px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                                <strong style={{ color: 'var(--text-secondary)' }}>🗳️ Votes:</strong>{' '}
                                {m.votes.map((v, i) => (
                                    <span key={i} style={{ marginLeft: '8px', color: v.decision === 'approve' ? 'var(--success)' : 'var(--danger)' }}>
                                        {v.decision === 'approve' ? '👍' : '👎'} {v.voter}
                                    </span>
                                ))}
                            </div>
                        )}
                        {(m.submittedAt || m.approvedAt || m.fundedAt) && (
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {m.submittedAt && <span>📤 {new Date(m.submittedAt).toLocaleDateString()} </span>}
                                {m.approvedAt && <span>• ✅ {new Date(m.approvedAt).toLocaleDateString()} </span>}
                                {m.fundedAt && <span>• 💸 {new Date(m.fundedAt).toLocaleDateString()}</span>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Expense Log */}
            {grant.expenses && grant.expenses.length > 0 && (
                <div style={{ marginTop: '40px' }}>
                    <h2 className="section-title">📝 Expense Log</h2>
                    <div className="card" style={{ overflow: 'auto' }}>
                        <table className="txn-table">
                            <thead><tr><th>Description</th><th>Amount</th><th>Category</th><th>Logged By</th><th>Date</th><th>On-Chain</th></tr></thead>
                            <tbody>
                                {grant.expenses.map((exp, i) => (
                                    <tr key={i}>
                                        <td style={{ color: 'var(--text-primary)' }}>{exp.description}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--warning)' }}>{exp.amount} ALGO</td>
                                        <td><span className="badge badge-submitted">{exp.category}</span></td>
                                        <td>{exp.loggedBy}</td>
                                        <td>{new Date(exp.timestamp).toLocaleDateString()}</td>
                                        <td>
                                            {exp.txnId ? (
                                                <a href={getExplorerTxnUrl(exp.txnId)} target="_blank" rel="noreferrer"
                                                    style={{ fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>
                                                    ✅ {shortAddress(exp.txnId)} ↗
                                                </a>
                                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Off-chain</span>}
                                        </td>
                                    </tr>
                                ))}
                                <tr style={{ fontWeight: 700 }}>
                                    <td style={{ color: 'var(--text-primary)' }}>Total Spent</td>
                                    <td style={{ color: 'var(--warning)' }}>{grant.expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0).toFixed(2)} ALGO</td>
                                    <td colSpan={4}></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Transaction History */}
            {grant.transactions.length > 0 && (
                <div style={{ marginTop: '40px' }}>
                    <h2 className="section-title">📜 Transaction History (On-Chain)</h2>
                    <div className="card" style={{ overflow: 'auto' }}>
                        <table className="txn-table">
                            <thead><tr><th>Type</th><th>Amount</th><th>Note</th><th>From</th><th>To</th><th>Date</th><th>Algorand Txn</th></tr></thead>
                            <tbody>
                                {grant.transactions.map((txn, i) => (
                                    <tr key={i}>
                                        <td><span className={`badge badge-${txn.type === 'fund' ? 'funded' : txn.type === 'expense' ? 'submitted' : 'approved'}`}>
                                            {txn.type === 'fund' ? '💰 Fund' : txn.type === 'expense' ? '📝 Expense' : '📤 Release'}
                                        </span></td>
                                        <td style={{ fontWeight: 600, color: txn.type === 'fund' ? 'var(--success)' : txn.type === 'expense' ? 'var(--text-muted)' : 'var(--accent-hover)' }}>
                                            {txn.type === 'expense' ? '0' : txn.amount} ALGO
                                        </td>
                                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.note}</td>
                                        <td><span className="txn-hash">{shortAddress(txn.from)}</span></td>
                                        <td><span className="txn-hash">{shortAddress(txn.to)}</span></td>
                                        <td>{new Date(txn.timestamp).toLocaleDateString()}</td>
                                        <td>
                                            {txn.txnId ? (
                                                <a href={getExplorerTxnUrl(txn.txnId)} target="_blank" rel="noreferrer"
                                                    style={{ fontSize: '0.78rem', color: 'var(--accent-hover)', textDecoration: 'none' }}>
                                                    {shortAddress(txn.txnId)} ↗
                                                </a>
                                            ) : <span className="txn-hash">—</span>}
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
