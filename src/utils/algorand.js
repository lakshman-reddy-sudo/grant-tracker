import algosdk from 'algosdk';

// Algorand TestNet Clients (public Algonode endpoints - no auth needed)
const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', '');

// Explorer base URLs for TestNet
export const EXPLORER_BASE = 'https://testnet.explorer.perawallet.app';
export const LORA_BASE = 'https://lora.algokit.io/testnet';

/**
 * Get AlgoExplorer URL for a transaction
 */
export function getExplorerTxnUrl(txnId) {
    return `${EXPLORER_BASE}/tx/${txnId}`;
}

/**
 * Get AlgoExplorer URL for an address
 */
export function getExplorerAddrUrl(address) {
    return `${EXPLORER_BASE}/address/${address}`;
}

/**
 * Check if an Algorand address is valid
 */
export function isValidAddress(address) {
    if (!address || typeof address !== 'string' || address.length !== 58) return false;
    try {
        algosdk.decodeAddress(address);
        return true;
    } catch {
        return false;
    }
}

/**
 * Create a multisig escrow address from 3 wallet addresses
 * @param {string[]} addresses - [sponsor, admin, team]
 * @param {number} threshold - signatures required (default 2)
 * @returns {{ address: string, params: object }}
 */
export function createMultisigAddress(addresses, threshold = 2) {
    const msigParams = {
        version: 1,
        threshold,
        addrs: addresses,
    };
    const multisigAddr = algosdk.multisigAddress(msigParams);
    // algosdk v3 returns an Address object — convert to string
    return { address: String(multisigAddr), params: msigParams };
}

/**
 * Get suggested transaction params from the network
 */
export async function getSuggestedParams() {
    return await algodClient.getTransactionParams().do();
}

/**
 * Create a payment transaction
 * @param {string} from - sender address
 * @param {string} to - receiver address
 * @param {number} amountInAlgo - amount in ALGO
 * @param {string} note - transaction note
 * @returns {algosdk.Transaction}
 */
export async function createPaymentTxn(from, to, amountInAlgo, note = '') {
    const suggestedParams = await getSuggestedParams();
    // algosdk v3: amount must be number or bigint in microalgos
    const microAlgos = Math.round(amountInAlgo * 1_000_000);
    return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from,
        to,
        amount: microAlgos,
        note: new TextEncoder().encode(note),
        suggestedParams,
    });
}

/**
 * Create a 0-ALGO self-transaction for logging data on-chain
 * @param {string} address - the sender/receiver (same)
 * @param {string} note - data to store on-chain
 * @returns {algosdk.Transaction}
 */
export async function createNoteTxn(address, note) {
    const suggestedParams = await getSuggestedParams();
    return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: address,
        to: address,
        amount: 0,
        note: new TextEncoder().encode(note),
        suggestedParams,
    });
}

/**
 * Submit a signed transaction to the network
 * @param {Uint8Array} signedTxn - the signed transaction bytes
 * @returns {Promise<string>} - the transaction ID
 */
export async function submitSignedTxn(signedTxn) {
    const response = await algodClient.sendRawTransaction(signedTxn).do();
    // algosdk v3: sendRawTransaction may return txid string directly or { txid }
    let txid;
    if (typeof response === 'string') {
        txid = response;
    } else if (response && response.txid) {
        txid = response.txid;
    } else if (response && response.txId) {
        txid = response.txId;
    } else {
        txid = String(response);
    }
    await algosdk.waitForConfirmation(algodClient, txid, 4);
    return txid;
}

/**
 * Get account balance in ALGO
 * @param {string} address
 * @returns {Promise<number>}
 */
export async function getBalance(address) {
    if (!isValidAddress(address)) {
        console.warn('getBalance: invalid address', address);
        return 0;
    }
    try {
        const accountInfo = await algodClient.accountInformation(address).do();
        // algosdk v3: amount may be bigint — convert to Number
        const microAlgos = Number(accountInfo.amount || 0);
        return microAlgos / 1_000_000;
    } catch (err) {
        console.error('getBalance error:', err.message || err);
        return 0;
    }
}

/**
 * Get transaction history for an address from the Indexer
 * @param {string} address
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getTransactionHistory(address, limit = 20) {
    try {
        const response = await indexerClient
            .searchForTransactions()
            .address(address)
            .limit(limit)
            .do();
        return (response.transactions || []).map((txn) => ({
            id: txn.id,
            sender: txn.sender,
            receiver: txn['payment-transaction']?.receiver || '',
            amount: txn['payment-transaction']?.amount
                ? algosdk.microalgosToAlgos(txn['payment-transaction'].amount)
                : 0,
            note: txn.note ? new TextDecoder().decode(new Uint8Array(Buffer.from(txn.note, 'base64'))) : '',
            roundTime: txn['round-time'],
            confirmedRound: txn['confirmed-round'],
        }));
    } catch {
        return [];
    }
}

/**
 * Format address for display
 */
export function shortAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format microAlgos to ALGO string
 */
export function formatAlgo(microAlgos) {
    return (microAlgos / 1_000_000).toFixed(4);
}

export { algodClient, indexerClient, algosdk };
