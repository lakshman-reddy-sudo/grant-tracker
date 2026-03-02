import { DeflyWalletConnect } from '@blockshake/defly-connect';

const deflyWallet = new DeflyWalletConnect({
    chainId: 416002, // TestNet
});

/**
 * Connect Defly Wallet (optional — for address display only)
 * @returns {Promise<string[]>} connected accounts
 */
export async function connectWallet() {
    try {
        const accounts = await deflyWallet.connect();
        return accounts;
    } catch (error) {
        if (error?.data?.type !== 'CONNECT_MODAL_CLOSED') {
            console.error('Wallet connection error:', error);
        }
        throw error;
    }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet() {
    await deflyWallet.disconnect();
}

/**
 * Reconnect on page reload
 * @param {function} onConnect - callback with accounts
 */
export function reconnectWallet(onConnect) {
    deflyWallet
        .reconnectSession()
        .then((accounts) => {
            if (accounts.length > 0) {
                onConnect(accounts);
            }
        })
        .catch(() => {
            // No previous session
        });

    deflyWallet.connector?.on('disconnect', () => {
        onConnect([]);
    });
}

export { deflyWallet };
