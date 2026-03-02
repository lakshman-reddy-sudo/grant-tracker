import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGrant } from '../utils/store';
import { createMultisigAddress } from '../utils/algorand';

export default function CreateGrant({ user, walletAddress }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: '',
        description: '',
        teamName: '',
        teamWallet: '',
        sponsorName: user?.name || '',
        sponsorWallet: walletAddress || '',
        adminName: '',
        adminWallet: '',
        totalFunding: '',
    });
    const [milestones, setMilestones] = useState([
        { name: '', description: '', percentage: 30 },
        { name: '', description: '', percentage: 30 },
        { name: '', description: '', percentage: 40 },
    ]);
    const [toast, setToast] = useState(null);

    // Only sponsors can create grants
    if (user?.role !== 'sponsor') {
        return (
            <div className="page fade-in">
                <div className="empty-state">
                    <div className="empty-icon">🚫</div>
                    <h3>Access Restricted</h3>
                    <p>Only <strong>Sponsors</strong> can create new grants.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const addMilestone = () => setMilestones([...milestones, { name: '', description: '', percentage: 0 }]);

    const removeMilestone = (index) => setMilestones(milestones.filter((_, i) => i !== index));

    const updateMilestone = (index, field, value) => {
        const updated = [...milestones];
        updated[index] = { ...updated[index], [field]: value };
        setMilestones(updated);
    };

    const totalPercentage = milestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return showToast('error', 'Project name is required');
        if (!form.totalFunding || Number(form.totalFunding) <= 0) return showToast('error', 'Enter a valid funding amount');
        if (!form.teamName.trim()) return showToast('error', 'Team name is required');
        if (milestones.some(m => !m.name.trim())) return showToast('error', 'All milestones need a name');
        if (totalPercentage !== 100) return showToast('error', `Milestone percentages must total 100% (currently ${totalPercentage}%)`);

        // Generate escrow address
        let escrowAddress = '';
        let multisigParams = null;
        const addresses = [form.sponsorWallet, form.adminWallet, form.teamWallet].filter(a => a && a.length >= 58);

        if (addresses.length >= 2) {
            try {
                const msig = createMultisigAddress(addresses, 2);
                escrowAddress = msig.address;
                multisigParams = msig.params;
            } catch {
                escrowAddress = `ESCROW_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
            }
        } else {
            escrowAddress = `ESCROW_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        }

        const totalFunding = parseFloat(form.totalFunding);
        const formattedMilestones = milestones.map((m, i) => ({
            name: m.name || `Milestone ${i + 1}`,
            description: m.description,
            percentage: Number(m.percentage),
            amount: ((Number(m.percentage) / 100) * totalFunding).toFixed(2),
        }));

        const grant = createGrant({
            ...form,
            escrowAddress,
            multisigParams,
            milestones: formattedMilestones,
            transactions: [{
                type: 'fund',
                amount: String(totalFunding),
                note: `Initial grant funding by ${user.name}`,
                from: form.sponsorWallet ? form.sponsorWallet.slice(0, 12) + '...' : user.name,
                to: escrowAddress.slice(0, 12) + '...',
                txnId: null,
            }],
        });

        showToast('success', `Grant "${grant.name}" created! Redirecting...`);
        setTimeout(() => navigate(`/grant/${grant.id}`), 1500);
    };

    return (
        <div className="page fade-in">
            {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

            <div className="page-header">
                <h1>Create New Grant</h1>
                <p>Set up a milestone-based grant with multisig escrow on Algorand</p>
            </div>

            <form onSubmit={handleSubmit} style={{ maxWidth: '720px' }}>
                {/* Project Details */}
                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: 700 }}>📋 Project Details</h3>
                    <div className="form-group">
                        <label>Project Name *</label>
                        <input type="text" className="form-control" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Smart Campus IoT Network" />
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea className="form-control" name="description" value={form.description} onChange={handleChange} placeholder="Describe the project objectives, expected outcomes..." />
                    </div>
                    <div className="form-group">
                        <label>Total Funding (ALGO) *</label>
                        <input type="number" className="form-control" name="totalFunding" value={form.totalFunding} onChange={handleChange} placeholder="100" min="1" step="0.01" />
                    </div>
                </div>

                {/* Participants */}
                <div className="card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: 700 }}>👥 Participants</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>🏛️ Sponsor Name</label>
                            <input type="text" className="form-control" name="sponsorName" value={form.sponsorName} onChange={handleChange} placeholder="Your name" />
                        </div>
                        <div className="form-group">
                            <label>Sponsor Wallet</label>
                            <input type="text" className="form-control" name="sponsorWallet" value={form.sponsorWallet} onChange={handleChange} placeholder="Algorand address" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>🎓 Admin / Faculty Name</label>
                            <input type="text" className="form-control" name="adminName" value={form.adminName} onChange={handleChange} placeholder="e.g. Prof. Reddy" />
                        </div>
                        <div className="form-group">
                            <label>Admin Wallet</label>
                            <input type="text" className="form-control" name="adminWallet" value={form.adminWallet} onChange={handleChange} placeholder="Algorand address" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>👨‍💻 Team Name *</label>
                            <input type="text" className="form-control" name="teamName" value={form.teamName} onChange={handleChange} placeholder="e.g. Team Alpha" />
                        </div>
                        <div className="form-group">
                            <label>Team Wallet</label>
                            <input type="text" className="form-control" name="teamWallet" value={form.teamWallet} onChange={handleChange} placeholder="Algorand address" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                        </div>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '-4px' }}>
                        💡 A 2-of-3 multisig escrow will be created from the wallet addresses above.
                    </p>
                </div>

                {/* Milestones */}
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>🎯 Milestones</h3>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: totalPercentage === 100 ? 'var(--success)' : 'var(--warning)' }}>
                            {totalPercentage === 100 ? '✅' : '⚠️'} Total: {totalPercentage}%
                        </span>
                    </div>

                    {milestones.map((m, i) => (
                        <div key={i} style={{ padding: '16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)', marginBottom: '12px', border: '1px solid var(--border-glass)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Milestone {i + 1}</span>
                                {milestones.length > 1 && (
                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeMilestone(i)}>✕</button>
                                )}
                            </div>
                            <div className="form-group" style={{ marginBottom: '10px' }}>
                                <input type="text" className="form-control" value={m.name} onChange={(e) => updateMilestone(i, 'name', e.target.value)} placeholder="Milestone name *" />
                            </div>
                            <div className="form-group" style={{ marginBottom: '10px' }}>
                                <input type="text" className="form-control" value={m.description} onChange={(e) => updateMilestone(i, 'description', e.target.value)} placeholder="What will be delivered?" />
                            </div>
                            <div className="form-group" style={{ marginBottom: '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="number" className="form-control" value={m.percentage} onChange={(e) => updateMilestone(i, 'percentage', e.target.value)} min="0" max="100" style={{ maxWidth: '100px' }} />
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        % = {form.totalFunding ? ((Number(m.percentage) / 100) * Number(form.totalFunding)).toFixed(2) : '0.00'} ALGO
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    <button type="button" className="btn btn-secondary" onClick={addMilestone} style={{ width: '100%' }}>
                        ➕ Add Milestone
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={totalPercentage !== 100}>
                        🚀 Create Grant & Fund Escrow
                    </button>
                    <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/dashboard')}>Cancel</button>
                </div>
            </form>
        </div>
    );
}
