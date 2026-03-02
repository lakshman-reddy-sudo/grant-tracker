const STORAGE_KEY = 'algorand_grant_tracker';
const AUTH_KEY = 'grantchain_auth';

// ============================================================
// AUTH SYSTEM
// ============================================================

/**
 * Get current logged-in user
 * @returns {{ name: string, role: string, walletAddress: string } | null}
 */
export function getCurrentUser() {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Login a user
 * @param {{ name: string, role: 'sponsor'|'admin'|'team', walletAddress?: string }}
 */
export function loginUser({ name, role, walletAddress = '' }) {
    const user = { name, role, walletAddress, loggedInAt: new Date().toISOString() };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
}

/**
 * Update wallet address for logged-in user
 */
export function updateUserWallet(walletAddress) {
    const user = getCurrentUser();
    if (user) {
        user.walletAddress = walletAddress;
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    }
}

/**
 * Logout
 */
export function logoutUser() {
    localStorage.removeItem(AUTH_KEY);
}

// ============================================================
// DATA STORE
// ============================================================

function getData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : { grants: [], nextId: 1 };
    } catch {
        return { grants: [], nextId: 1 };
    }
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getGrants() {
    return getData().grants;
}

export function getGrant(id) {
    return getData().grants.find((g) => g.id === Number(id)) || null;
}

/**
 * Create a new grant
 */
export function createGrant(grantData) {
    const data = getData();
    const grant = {
        id: data.nextId,
        ...grantData,
        createdAt: new Date().toISOString(),
        status: 'active',
        milestones: (grantData.milestones || []).map((m, i) => ({
            ...m,
            id: i + 1,
            status: 'pending',
            submittedAt: null,
            submittedBy: null,
            submissionNote: null,
            approvedAt: null,
            approvedBy: null,
            fundedAt: null,
            txnId: null,
            votes: [],            // DAO voting
            rejectedAt: null,
            rejectionNote: null,
        })),
        transactions: [],
        expenses: [],           // Team expense logs
    };
    data.grants.push(grant);
    data.nextId += 1;
    saveData(data);
    return grant;
}

export function updateGrant(id, updates) {
    const data = getData();
    const index = data.grants.findIndex((g) => g.id === Number(id));
    if (index === -1) return null;
    data.grants[index] = { ...data.grants[index], ...updates };
    saveData(data);
    return data.grants[index];
}

export function updateMilestone(grantId, milestoneId, updates) {
    const data = getData();
    const grant = data.grants.find((g) => g.id === Number(grantId));
    if (!grant) return null;
    const milestone = grant.milestones.find((m) => m.id === Number(milestoneId));
    if (!milestone) return null;
    Object.assign(milestone, updates);
    saveData(data);
    return milestone;
}

export function addTransaction(grantId, txn) {
    const data = getData();
    const grant = data.grants.find((g) => g.id === Number(grantId));
    if (!grant) return;
    grant.transactions.push({
        ...txn,
        timestamp: new Date().toISOString(),
    });
    saveData(data);
}

/**
 * Add expense log for a grant (Team role)
 */
export function addExpense(grantId, expense) {
    const data = getData();
    const grant = data.grants.find((g) => g.id === Number(grantId));
    if (!grant) return;
    if (!grant.expenses) grant.expenses = [];
    grant.expenses.push({
        ...expense,
        id: Date.now(),
        timestamp: new Date().toISOString(),
    });
    saveData(data);
}

/**
 * Add a DAO vote to a milestone
 */
export function addVote(grantId, milestoneId, vote) {
    const data = getData();
    const grant = data.grants.find((g) => g.id === Number(grantId));
    if (!grant) return null;
    const milestone = grant.milestones.find((m) => m.id === Number(milestoneId));
    if (!milestone) return null;
    if (!milestone.votes) milestone.votes = [];
    // Prevent double voting
    const existing = milestone.votes.find((v) => v.voter === vote.voter);
    if (existing) {
        existing.decision = vote.decision;
        existing.timestamp = new Date().toISOString();
    } else {
        milestone.votes.push({ ...vote, timestamp: new Date().toISOString() });
    }
    saveData(data);
    return milestone;
}

export function deleteGrant(id) {
    const data = getData();
    data.grants = data.grants.filter((g) => g.id !== Number(id));
    saveData(data);
}

/**
 * Calculate grant stats
 */
export function getGrantStats(grant) {
    const totalMilestones = grant.milestones.length;
    const funded = grant.milestones.filter((m) => m.status === 'funded').length;
    const approved = grant.milestones.filter((m) => m.status === 'approved').length;
    const submitted = grant.milestones.filter((m) => m.status === 'submitted').length;
    const rejected = grant.milestones.filter((m) => m.status === 'rejected').length;
    const totalFunding = parseFloat(grant.totalFunding) || 0;
    const releasedAmount = grant.milestones
        .filter((m) => m.status === 'funded')
        .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    const remainingAmount = totalFunding - releasedAmount;
    const progressPercent = totalMilestones > 0 ? Math.round((funded / totalMilestones) * 100) : 0;

    return {
        totalMilestones, funded, approved, submitted, rejected,
        pending: totalMilestones - funded - approved - submitted - rejected,
        totalFunding, releasedAmount, remainingAmount, progressPercent,
    };
}

/**
 * Seed demo data
 */
export function seedDemoData() {
    const data = getData();
    if (data.grants.length > 0) return;

    const demo = [
        {
            id: 1,
            name: 'Smart Campus IoT Network',
            description: 'Build an IoT sensor network across campus to monitor air quality, occupancy, and energy usage with a real-time dashboard.',
            teamName: 'Team Alpha',
            teamWallet: 'TEAMWALLET1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            sponsorName: 'Dr. Sharma (CSE Dept)',
            sponsorWallet: 'SPONSWALLET1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            adminName: 'Prof. Reddy',
            adminWallet: 'ADMINWALLET1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            escrowAddress: 'ESCROWADDR1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            totalFunding: '100',
            createdAt: '2026-02-15T10:30:00.000Z',
            status: 'active',
            milestones: [
                { id: 1, name: 'Hardware Prototype', description: 'Assemble and test 5 IoT sensor nodes with Raspberry Pi', amount: '30', percentage: 30, status: 'funded', submittedAt: '2026-02-20T00:00:00Z', submittedBy: 'Team Alpha', submissionNote: 'All 5 nodes assembled and tested successfully.', approvedAt: '2026-02-21T00:00:00Z', approvedBy: 'Prof. Reddy', fundedAt: '2026-02-22T00:00:00Z', txnId: null, votes: [{ voter: 'Prof. Reddy', decision: 'approve', timestamp: '2026-02-21T00:00:00Z' }, { voter: 'Dr. Sharma', decision: 'approve', timestamp: '2026-02-21T01:00:00Z' }], rejectedAt: null, rejectionNote: null },
                { id: 2, name: 'Data Pipeline & API', description: 'Build backend data pipeline, MQTT broker, and REST API', amount: '30', percentage: 30, status: 'submitted', submittedAt: '2026-02-28T00:00:00Z', submittedBy: 'Team Alpha', submissionNote: 'Pipeline built with Node.js + InfluxDB. API docs attached.', approvedAt: null, approvedBy: null, fundedAt: null, txnId: null, votes: [], rejectedAt: null, rejectionNote: null },
                { id: 3, name: 'Dashboard & Campus Deployment', description: 'Build React dashboard and deploy sensors across 3 campus buildings', amount: '40', percentage: 40, status: 'pending', submittedAt: null, submittedBy: null, submissionNote: null, approvedAt: null, approvedBy: null, fundedAt: null, txnId: null, votes: [], rejectedAt: null, rejectionNote: null },
            ],
            transactions: [
                { type: 'fund', amount: '100', note: 'Initial grant funding from CSE Department', from: 'SPONSWALLET1...', to: 'ESCROWADDR1...', timestamp: '2026-02-15T11:00:00Z', txnId: null },
                { type: 'release', amount: '30', note: 'MILESTONE: Hardware Prototype completed', from: 'ESCROWADDR1...', to: 'TEAMWALLET1...', timestamp: '2026-02-22T12:00:00Z', txnId: null },
            ],
            expenses: [
                { id: 1, description: 'Raspberry Pi 4 × 5 units', amount: '15', category: 'Hardware', timestamp: '2026-02-18T00:00:00Z', loggedBy: 'Team Alpha' },
                { id: 2, description: 'Temperature & humidity sensors × 10', amount: '5', category: 'Hardware', timestamp: '2026-02-19T00:00:00Z', loggedBy: 'Team Alpha' },
                { id: 3, description: 'Cloud hosting (3 months)', amount: '8', category: 'Services', timestamp: '2026-02-20T00:00:00Z', loggedBy: 'Team Alpha' },
            ],
        },
        {
            id: 2,
            name: 'AI Study Buddy Platform',
            description: 'An AI platform that matches students for study groups using ML, creates schedules, and facilitates note sharing.',
            teamName: 'Team Beta',
            teamWallet: 'TEAMWALLET2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            sponsorName: 'Innovation Cell',
            sponsorWallet: 'SPONSWALLET2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            adminName: 'Dr. Kumar',
            adminWallet: 'ADMINWALLET2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            escrowAddress: 'ESCROWADDR2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            totalFunding: '50',
            createdAt: '2026-02-20T14:00:00.000Z',
            status: 'active',
            milestones: [
                { id: 1, name: 'ML Matching Algorithm', description: 'Build and train the student matching model', amount: '20', percentage: 40, status: 'submitted', submittedAt: '2026-03-01T00:00:00Z', submittedBy: 'Team Beta', submissionNote: 'Model trained with 85% accuracy. Demo notebook ready.', approvedAt: null, approvedBy: null, fundedAt: null, txnId: null, votes: [{ voter: 'Dr. Kumar', decision: 'approve', timestamp: '2026-03-01T12:00:00Z' }], rejectedAt: null, rejectionNote: null },
                { id: 2, name: 'Frontend & User Testing', description: 'Build React Native app and conduct user testing with 50 students', amount: '15', percentage: 30, status: 'pending', submittedAt: null, submittedBy: null, submissionNote: null, approvedAt: null, approvedBy: null, fundedAt: null, txnId: null, votes: [], rejectedAt: null, rejectionNote: null },
                { id: 3, name: 'Launch & Iteration', description: 'Public launch, collect feedback, iterate on features', amount: '15', percentage: 30, status: 'pending', submittedAt: null, submittedBy: null, submissionNote: null, approvedAt: null, approvedBy: null, fundedAt: null, txnId: null, votes: [], rejectedAt: null, rejectionNote: null },
            ],
            transactions: [
                { type: 'fund', amount: '50', note: 'Innovation Cell seed grant', from: 'SPONSWALLET2...', to: 'ESCROWADDR2...', timestamp: '2026-02-20T15:00:00Z', txnId: null },
            ],
            expenses: [],
        },
    ];

    data.grants = demo;
    data.nextId = 3;
    saveData(data);
}
