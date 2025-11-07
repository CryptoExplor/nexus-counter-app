// Buffer polyfill for browser compatibility
import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.global = window.global || window;
window.process = window.process || { env: {} };

// Farcaster SDK
import { sdk } from '@farcaster/miniapp-sdk';

// Wagmi Core imports
import {
  createConfig,
  connect,
  disconnect,
  getAccount,
  watchAccount,
  writeContract,
  readContract,
  waitForTransactionReceipt,
  switchChain,
  getChainId,
  getBalance,
  watchContractEvent,
  http
} from '@wagmi/core';

// Farcaster connector
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

// Reown AppKit imports
import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// Format utilities
import { formatEther } from 'viem';

// Configuration
const PROJECT_ID = 'ad03e2d8544cdf786495f370a5fc2e33';
const MINIAPP_URL = 'https://farcaster.xyz/miniapps/Nf8kjDxT6YXs/nexus-counter';
const NEXUS_CHAIN_ID_DEC = 3940;
const NEXUS_RPC_URL = 'https://nexus-testnet.g.alchemy.com/v2/d5bxPxUVzMKqbZ2CA4EZi';
const EXPLORER_URL = 'https://testnet3.explorer.nexus.xyz';
const NATIVE_CURRENCY = { name: 'NEX', symbol: 'NEX', decimals: 18 };

// Define Nexus Testnet chain
const nexusTestnet = {
    id: NEXUS_CHAIN_ID_DEC,
    name: 'Nexus Testnet',
    network: 'nexus-testnet',
    nativeCurrency: NATIVE_CURRENCY,
    rpcUrls: {
        default: { http: [NEXUS_RPC_URL] },
        public: { http: [NEXUS_RPC_URL] },
    },
    blockExplorers: {
        default: { name: 'Nexus Explorer', url: EXPLORER_URL },
    },
};

// DOM Elements
const ui = {
    counterValue: document.getElementById('counter-value'),
    connectBtn: document.getElementById('connect-btn'),
    incDecGroup: document.getElementById('inc-dec-group'),
    incrementBtn: document.getElementById('increment-btn'),
    decrementBtn: document.getElementById('decrement-btn'),
    castBtn: document.getElementById('cast-btn'),
    twitterBtn: document.getElementById('twitter-btn'),
    shareButtons: document.getElementById('share-buttons'),
    userMeta: document.getElementById('user-meta'),
    walletBalance: document.getElementById('wallet-balance'),
    badgeTierContainer: document.getElementById('badge-tier-container'),
    badgeTier: document.getElementById('badge-tier'),
    badgeSkeleton: document.getElementById('badge-skeleton'),
    messageContainer: document.getElementById('message-container'),
    messageText: document.getElementById('message-text'),
    txDetails: document.getElementById('tx-details'),
    txLink: document.getElementById('tx-link'),
    copyBtn: document.getElementById('copy-btn'),
    statusMeta: document.getElementById('status-meta'),
    adminControls: document.getElementById('admin-controls'),
    resetBtn: document.getElementById('reset-btn'),
    leaderboardContainer: document.getElementById('leaderboard-container'),
    leaderboardList: document.getElementById('leaderboard-list'),
    leaderboardSkeleton: document.getElementById('leaderboard-skeleton'),
    userRank: document.getElementById('user-rank'),
    cooldownTimer: document.getElementById('cooldown-timer'),
    externalBanner: document.getElementById('externalBanner'),
    externalBannerText: document.getElementById('externalBannerText'),
    txHistoryContainer: document.getElementById('tx-history-container'),
    txHistoryList: document.getElementById('tx-history-list'),
    txProgress: document.getElementById('tx-progress'),
    confettiContainer: document.getElementById('confetti-container'),
};

// State variables
let CONTRACT_ADDRESS;
let CONTRACT_ABI;
let userAddress = null;
let isConnecting = false;
let messageTimeoutId = null;
let autoRefreshInterval = null;
let contractFee = 0n;
let cooldownIntervalId = null;
let cooldownDisplayIntervalId = null;
let cooldownEndTime = null;
let wagmiConfig = null;
let modal = null;
let isFarcasterEnvironment = false;
let lastActionType = null;
let lastCounterValue = 0;
let eventUnwatchFns = [];
let isRefreshing = false;
let previousBadgeTier = 0;

// Transaction history (stored in localStorage)
const TX_HISTORY_KEY = 'nexus_counter_tx_history';
const MAX_TX_HISTORY = 5;

// Safe localStorage wrapper
const safeLocalStorage = {
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
      return false;
    }
  },
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
      return null;
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('Failed to remove from localStorage:', e);
      return false;
    }
  }
};

// Transaction history functions
function getTxHistory() {
    if (!userAddress) return [];
    const key = `${TX_HISTORY_KEY}_${userAddress.toLowerCase()}`;
    const stored = safeLocalStorage.getItem(key);
    try {
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveTxHistory(history) {
    if (!userAddress) return;
    const key = `${TX_HISTORY_KEY}_${userAddress.toLowerCase()}`;
    safeLocalStorage.setItem(key, JSON.stringify(history.slice(0, MAX_TX_HISTORY)));
}

function addToTxHistory(type, hash) {
    const history = getTxHistory();
    history.unshift({
        type,
        hash,
        timestamp: Date.now()
    });
    saveTxHistory(history);
    displayTxHistory();
}

function displayTxHistory() {
    const history = getTxHistory();
    
    if (history.length === 0) {
        ui.txHistoryList.innerHTML = '<p class="text-sm text-gray-500 text-center">No transactions yet</p>';
        ui.txHistoryContainer.classList.add('hidden');
        return;
    }

    ui.txHistoryList.innerHTML = history.map((tx, idx) => {
        const timeAgo = formatTimeAgo(tx.timestamp);
        const emoji = tx.type === 'increment' ? '📈' : '📉';
        const action = tx.type === 'increment' ? 'Incremented' : 'Decremented';
        
        return `
            <div class="flex justify-between items-center text-sm p-3 rounded-md app-subtle-box hover:bg-[#252525] transition-colors">
                <div class="flex items-center gap-2">
                    <span>${emoji}</span>
                    <span class="font-medium">${action}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">${timeAgo}</span>
                    <a href="${EXPLORER_URL}/tx/${tx.hash}" target="_blank" rel="noopener noreferrer" 
                       class="text-xs text-indigo-400 hover:underline font-mono">
                        ${formatHash(tx.hash)}
                    </a>
                </div>
            </div>
        `;
    }).join('');
    
    ui.txHistoryContainer.classList.remove('hidden');
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// Confetti animation
function triggerConfetti() {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        confetti.style.animationDelay = (Math.random() * 0.5) + 's';
        
        ui.confettiContainer.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 4000);
    }
}

// Badge milestone celebration
function celebrateBadgeMilestone(newTier) {
    if (newTier > previousBadgeTier && newTier > 0) {
        // Trigger confetti
        triggerConfetti();
        
        // Animate badge
        ui.badgeTierContainer.classList.add('badge-earned');
        setTimeout(() => {
            ui.badgeTierContainer.classList.remove('badge-earned');
        }, 600);
        
        // Show celebration message
        const tierNames = {
            1: 'Bronze Badge',
            2: 'Silver Badge',
            3: 'Gold Badge',
            4: 'Platinum Badge',
            5: 'Diamond Badge',
            6: 'Master Badge',
            7: 'Legendary Badge'
        };
        
        displayMessage(`🎉 Congratulations! You earned the ${tierNames[newTier]}!`, 'success');
    }
    previousBadgeTier = newTier;
}

// Show/hide transaction progress bar
function showTxProgress() {
    ui.txProgress.classList.remove('hidden');
}

function hideTxProgress() {
    ui.txProgress.classList.add('hidden');
}

// Improved Farcaster detection
async function isFarcasterEmbed() {
  return Promise.race([
    (async () => {
      const isIframe = window.self !== window.top;
      const hasSDK = typeof sdk !== 'undefined';
      
      if (!isIframe || !hasSDK) return false;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      const isSdkReady = sdk.context !== undefined && sdk.context !== null;
      
      const checks = {
        isIframe,
        hasSDK,
        isSdkReady,
        hasValidContext: hasSDK && sdk.context?.user?.fid !== undefined
      };

      console.log('Farcaster Detection Checks:', checks);
      
      return isIframe && hasSDK && isSdkReady;
    })(),
    new Promise(resolve => setTimeout(() => resolve(false), 500))
  ]);
}

// Load contract configuration
async function loadContractConfig() {
    try {
        let response = await fetch('./contract.json').catch(() => null);
        if (!response || !response.ok) {
            response = await fetch('/contract.json').catch(() => null);
        }
        if (!response || !response.ok) {
            throw new Error('Contract configuration file not found');
        }
        
        const data = await response.json();
        CONTRACT_ADDRESS = data.address;
        CONTRACT_ABI = data.abi;
        console.log('✅ Contract loaded successfully:', CONTRACT_ADDRESS);
        return true;
    } catch (error) {
        console.error("❌ Could not load contract.json:", error);
        displayMessage("Error: Could not load contract configuration.", 'error');
        ui.connectBtn.disabled = true;
        return false;
    }
}

// Utility functions
function formatAddress(addr) {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Not Connected";
}

function formatHash(hash) {
    return hash ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : "";
}

function setStatus(text, colorClass) {
    ui.statusMeta.textContent = text;
    ui.statusMeta.className = ui.statusMeta.className.split(' ').filter(c => !c.startsWith('text-')).join(' ');
    ui.statusMeta.classList.add(colorClass);
}

function setActionButtonsEnabled(enabled) {
    const shouldEnable = enabled && !!userAddress;
    ui.incrementBtn.disabled = !shouldEnable;
    ui.decrementBtn.disabled = !shouldEnable;
    
    if (shouldEnable) {
        ui.incDecGroup.classList.remove('hidden');
        ui.incDecGroup.classList.add('flex');
        ui.shareButtons.classList.remove('hidden');
        ui.shareButtons.classList.add('flex');
    } else {
        ui.incDecGroup.classList.add('hidden');
        ui.incDecGroup.classList.remove('flex');
        ui.shareButtons.classList.add('hidden');
        ui.shareButtons.classList.remove('flex');
    }
}

// Wallet balance update
async function updateWalletBalance() {
    if (!userAddress || !wagmiConfig) {
        ui.walletBalance.classList.add('hidden');
        return;
    }
    
    try {
        const balance = await getBalance(wagmiConfig, {
            address: userAddress,
            chainId: NEXUS_CHAIN_ID_DEC,
        });
        
        const formattedBalance = parseFloat(formatEther(balance.value)).toFixed(4);
        ui.walletBalance.textContent = `💰 ${formattedBalance} NEX`;
        ui.walletBalance.classList.remove('hidden');
    } catch (e) {
        console.error('Failed to fetch balance:', e);
        ui.walletBalance.classList.add('hidden');
    }
}

// Smarter wallet connection button
function updateConnectButton(state) {
    ui.connectBtn.disabled = false;
    ui.connectBtn.onclick = null;
    ui.connectBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'bg-white', 'hover:bg-gray-200', 'bg-gray-700', 'text-white', 'text-black', 'hover:bg-gray-600');

    switch (state) {
        case 'CONNECTED':
            ui.connectBtn.textContent = '✓ Wallet Connected';
            ui.connectBtn.disabled = false;
            ui.connectBtn.classList.add('bg-gray-700', 'hover:bg-gray-600', 'text-white', 'cursor-pointer');
            ui.connectBtn.onclick = async () => {
                if (modal) {
                    modal.open();
                }
            };
            break;
        case 'WRONG_NETWORK':
            ui.connectBtn.textContent = 'Switch to Nexus Testnet';
            ui.connectBtn.onclick = switchToNexus;
            ui.connectBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'text-white');
            break;
        case 'LOADING':
            ui.connectBtn.textContent = 'Connecting...';
            ui.connectBtn.disabled = true;
            ui.connectBtn.classList.add('bg-gray-700', 'text-white');
            break;
        case 'DISCONNECTED':
        default:
            ui.connectBtn.textContent = 'Connect Wallet';
            ui.connectBtn.classList.add('bg-white', 'hover:bg-gray-200', 'text-black');
            ui.connectBtn.onclick = async () => {
                if (modal) {
                    const account = getAccount(wagmiConfig);
                    if (account.isConnected && account.address) {
                        await tryAutoReconnect();
                    } else {
                        modal.open();
                    }
                }
            };
            break;
    }
}

function displayMessage(message, type = 'info', hash = null, isPending = false) {
    let baseClasses = 'p-3 rounded-xl text-center transition-all duration-300';
    let duration = 5000;
    if (messageTimeoutId) clearTimeout(messageTimeoutId);
    ui.txDetails.classList.add('hidden');
    
    switch (type) {
        case 'error': 
            baseClasses += ' bg-red-900 text-red-300 border border-red-700'; 
            duration = 8000; 
            break;
        case 'success': 
            baseClasses += ' bg-green-900 text-green-300 border border-green-700'; 
            break;
        default: 
            baseClasses += ' bg-blue-900 text-blue-300 border border-blue-700'; 
            break;
    }
    
    ui.messageContainer.className = baseClasses;
    ui.messageText.textContent = message;
    ui.messageContainer.classList.remove('hidden');
    
    if (hash) {
        ui.txLink.href = `${EXPLORER_URL}/tx/${hash}`;
        ui.txLink.textContent = formatHash(hash);
        ui.txDetails.classList.remove('hidden');
        ui.copyBtn.setAttribute('data-hash', hash);
        
        // Show/hide pending indicator
        const pendingIndicator = ui.txDetails.querySelector('.tx-pending-indicator');
        if (pendingIndicator) {
            pendingIndicator.style.display = isPending ? 'inline-block' : 'none';
        }
    }
    
    if (!isPending) {
        messageTimeoutId = setTimeout(() => {
            ui.messageContainer.classList.add('hidden');
        }, duration);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
            .then(() => displayMessage('Transaction hash copied!', 'success'))
            .catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        const success = document.execCommand('copy');
        displayMessage(success ? 'Transaction hash copied!' : 'Failed to copy hash.', success ? 'success' : 'error');
    } catch (err) {
        displayMessage('Failed to copy hash.', 'error');
    }
    document.body.removeChild(tempInput);
}

function addSpinner(buttonElement, originalText) {
    buttonElement.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>${originalText}...`;
}

// Counter animation function
function animateCounter(from, to) {
    const duration = 500;
    const start = Date.now();
    const diff = to - from;
    
    if (diff === 0) return;
    
    const animate = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        const current = Math.floor(from + (diff * easedProgress));
        
        ui.counterValue.textContent = current.toString();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            ui.counterValue.textContent = to.toString();
        }
    };
    
    requestAnimationFrame(animate);
}

// Auto-refresh functions with race condition protection
function startAutoRefresh() {
    if (autoRefreshInterval) return;
    autoRefreshInterval = setInterval(async () => {
        if (userAddress && !isRefreshing) {
            isRefreshing = true;
            try {
                await Promise.all([
                    updateWalletBalance(),
                    updateAdminUI()
                ]);
            } catch (error) {
                console.error('Auto-refresh error:', error);
            } finally {
                isRefreshing = false;
            }
        }
    }, 10000); // Reduced to 10 seconds since we have event listening
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Cooldown timer functions
async function refreshCooldownTimer() {
    if (!userAddress || !CONTRACT_ADDRESS) {
        ui.cooldownTimer.textContent = "";
        return;
    }
    try {
        const stats = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getUserStats',
            args: [userAddress],
            chainId: NEXUS_CHAIN_ID_DEC,
        });
        const lastActionSec = Number(stats[2]);
        cooldownEndTime = (lastActionSec + 3600) * 1000;
        updateCooldownDisplay();
    } catch (e) {
        console.error("Error fetching cooldown:", e);
        ui.cooldownTimer.textContent = "";
        cooldownEndTime = null;
    }
}

function updateCooldownDisplay() {
    if (!cooldownEndTime) return;

    const now = Date.now();
    if (now >= cooldownEndTime) {
        ui.cooldownTimer.textContent = "✅ Ready!";
        return;
    }
    const remainingMs = cooldownEndTime - now;
    const remainingSec = Math.floor(remainingMs / 1000);
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    ui.cooldownTimer.textContent = `⏰ ${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
}

function startCooldownAutoRefresh() {
    stopCooldownAutoRefresh();
    cooldownIntervalId = setInterval(refreshCooldownTimer, 30000); // Check every 30s
    refreshCooldownTimer();
    cooldownDisplayIntervalId = setInterval(updateCooldownDisplay, 1000);
}

function stopCooldownAutoRefresh() {
    if (cooldownIntervalId) {
        clearInterval(cooldownIntervalId);
        cooldownIntervalId = null;
    }
    if (cooldownDisplayIntervalId) {
        clearInterval(cooldownDisplayIntervalId);
        cooldownDisplayIntervalId = null;
    }
}

// Admin UI update
async function updateAdminUI() {
    if (!userAddress || !CONTRACT_ADDRESS) {
        ui.adminControls.classList.add('hidden');
        return;
    }
    try {
        const ownerAddress = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'owner',
            chainId: NEXUS_CHAIN_ID_DEC,
        });
        
        const isOwner = userAddress.toLowerCase() === ownerAddress.toLowerCase();
        
        if (isOwner) {
            ui.adminControls.classList.remove('hidden');
        } else {
            ui.adminControls.classList.add('hidden');
        }
    } catch (e) {
        console.error("Failed to check owner status:", e);
        ui.adminControls.classList.add('hidden');
    }
}

// Leaderboard with skeleton loader
async function fetchLeaderboard() {
    try {
        // Show skeleton while loading
        ui.leaderboardSkeleton.classList.remove('hidden');
        ui.leaderboardContainer.classList.add('hidden');
        
        const [addresses, counts] = await Promise.all([
            readContract(wagmiConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTopAddresses',
                chainId: NEXUS_CHAIN_ID_DEC,
            }),
            readContract(wagmiConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTopCounts',
                chainId: NEXUS_CHAIN_ID_DEC,
            })
        ]);

        ui.leaderboardList.innerHTML = "";
        
        if(addresses.length === 0) {
            ui.leaderboardList.innerHTML = `<p class="text-sm text-gray-500 text-center">No entries yet.</p>`;
        } else {
            for (let i = 0; i < addresses.length; i++) {
                const isCurrentUser = userAddress && addresses[i].toLowerCase() === userAddress.toLowerCase();
                const rowClass = isCurrentUser 
                    ? 'bg-indigo-900 ring-2 ring-indigo-500'
                    : i % 2 === 0 ? 'app-subtle-box' : 'bg-[#1a1a1a]';
                
                ui.leaderboardList.innerHTML += `<div class="flex justify-between items-center text-sm p-3 rounded-md transition-colors duration-200 ${rowClass}">
                    <span class="font-mono text-sm">${i + 1}. ${formatAddress(addresses[i])}</span>
                    <span class="font-bold text-lg">${counts[i].toString()}</span>
                </div>`;
            }
        }
        
        // Hide skeleton, show content
        ui.leaderboardSkeleton.classList.add('hidden');
        ui.leaderboardContainer.classList.remove('hidden');

    } catch (e) {
        console.error("Leaderboard error:", e);
        ui.leaderboardSkeleton.classList.add('hidden');
        ui.leaderboardContainer.classList.add('hidden');
    }
}

// Badge update with skeleton loader
async function updateBadge() {
    if (!userAddress || !CONTRACT_ADDRESS) {
        ui.badgeSkeleton.classList.add('hidden');
        ui.badgeTierContainer.classList.add('hidden');
        return;
    }
    
    try {
        // Show skeleton while loading
        ui.badgeSkeleton.classList.remove('hidden');
        ui.badgeTierContainer.classList.add('hidden');
        
        const stats = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getUserStats',
            args: [userAddress],
            chainId: NEXUS_CHAIN_ID_DEC,
        });

        const tierValue = Number(stats[3]);
        
        let tierText = "No Badge";
        if (tierValue === 7) tierText = "⭐ Legendary Badge (1000+ Actions)";
        else if (tierValue === 6) tierText = "👑 Master Badge (500+ Actions)";
        else if (tierValue === 5) tierText = "💎 Diamond Badge (250+ Actions)";
        else if (tierValue === 4) tierText = "💿 Platinum Badge (100+ Actions)";
        else if (tierValue === 3) tierText = "📀 Gold Badge (50+ Actions)";
        else if (tierValue === 2) tierText = "⚪ Silver Badge (25+ Actions)";
        else if (tierValue === 1) tierText = "🟤 Bronze Badge (10+ Actions)";
        
        ui.badgeTier.textContent = tierText;
        
        // Hide skeleton, show badge
        ui.badgeSkeleton.classList.add('hidden');
        
        if (tierValue > 0) {
            ui.badgeTierContainer.classList.remove('hidden');
            celebrateBadgeMilestone(tierValue);
        } else {
            ui.badgeTierContainer.classList.add('hidden');
        }

    } catch (e) {
        console.error("Failed to fetch badge tier:", e);
        ui.badgeSkeleton.classList.add('hidden');
        ui.badgeTierContainer.classList.add('hidden');
    }
}

// Switch network
async function switchToNexus() {
    if (isConnecting) return;
    isConnecting = true;
    updateConnectButton('LOADING');
    try {
        await switchChain(wagmiConfig, { chainId: NEXUS_CHAIN_ID_DEC });
        
        const currentAccount = getAccount(wagmiConfig);
        if (currentAccount.isConnected && currentAccount.address) {
            userAddress = currentAccount.address;
            ui.userMeta.textContent = formatAddress(userAddress);
            setStatus('Nexus Testnet', 'text-green-500');
            updateConnectButton('CONNECTED');
            setActionButtonsEnabled(true);
            
            await updateCount(true);
            await updateBadge();
            await updateAdminUI();
            await updateWalletBalance();
            fetchLeaderboard();
            displayTxHistory();
            startAutoRefresh();
            startCooldownAutoRefresh();
            setupEventListeners();
        }
    } catch (error) {
        const msg = error.message?.includes('rejected') 
            ? "Network switch rejected by user." 
            : "Failed to switch networks.";
        displayMessage(msg, 'error');
        updateConnectButton('WRONG_NETWORK');
    } finally { 
        isConnecting = false; 
    }
}

// Update counter with animation
async function updateCount(triggerAnimation = false) {
    ui.counterValue.classList.add("counter-loading");
    try {
        const value = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'count',
            chainId: NEXUS_CHAIN_ID_DEC,
        });
        
        const newValue = Number(value);
        
        if (triggerAnimation && lastCounterValue !== newValue) {
            animateCounter(lastCounterValue, newValue);
            ui.counterValue.classList.add("counter-updated");
            setTimeout(() => ui.counterValue.classList.remove("counter-updated"), 600);
        } else {
            ui.counterValue.textContent = newValue.toString();
        }
        
        lastCounterValue = newValue;
    } catch (e) {
        ui.counterValue.textContent = "Error";
        console.error("Read count error:", e);
        if (triggerAnimation) displayMessage("Failed to read counter value.", 'error');
    } finally {
        ui.counterValue.classList.remove("counter-loading");
    }
}

// EVENT LISTENING - Listen to contract events in real-time
function setupEventListeners() {
    if (!wagmiConfig || !CONTRACT_ADDRESS) return;
    
    console.log('🎧 Setting up event listeners...');
    
    // Clean up any existing listeners
    cleanupEventListeners();
    
    try {
        // Listen for CounterChanged events
        const counterChangedUnwatch = watchContractEvent(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            eventName: 'CounterChanged',
            chainId: NEXUS_CHAIN_ID_DEC,
            onLogs: async (logs) => {
                console.log('📊 CounterChanged event detected:', logs);
                
                for (const log of logs) {
                    try {
                        // Safely extract args with fallback
                        if (!log.args) {
                            console.warn('Event log missing args:', log);
                            continue;
                        }
                        
                        const { user, delta, newCount } = log.args;
                        
                        // Validate args exist
                        if (!newCount) {
                            console.warn('Event missing newCount:', log.args);
                            continue;
                        }
                        
                        console.log(`User ${user} changed counter by ${delta} to ${newCount}`);
                        
                        // Update counter with animation
                        const newValue = Number(newCount);
                        if (!isNaN(newValue)) {
                            animateCounter(lastCounterValue, newValue);
                            ui.counterValue.classList.add("counter-updated");
                            setTimeout(() => ui.counterValue.classList.remove("counter-updated"), 600);
                            lastCounterValue = newValue;
                            
                            // Update leaderboard
                            await fetchLeaderboard();
                        }
                    } catch (error) {
                        console.error('Error processing CounterChanged event:', error, log);
                    }
                }
            },
            onError: (error) => {
                console.error('Error watching CounterChanged events:', error);
            }
        });
        
        eventUnwatchFns.push(counterChangedUnwatch);
        
        // Listen for BadgeAssigned events
        const badgeAssignedUnwatch = watchContractEvent(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            eventName: 'BadgeAssigned',
            chainId: NEXUS_CHAIN_ID_DEC,
            onLogs: async (logs) => {
                console.log('🏆 BadgeAssigned event detected:', logs);
                
                for (const log of logs) {
                    try {
                        if (!log.args) {
                            console.warn('BadgeAssigned event missing args:', log);
                            continue;
                        }
                        
                        const { user, tokenId, tier } = log.args;
                        
                        // Only update if it's for the current user
                        if (userAddress && user && user.toLowerCase() === userAddress.toLowerCase()) {
                            console.log(`Badge assigned to you! Token: ${tokenId}, Tier: ${tier}`);
                            await updateBadge();
                        }
                    } catch (error) {
                        console.error('Error processing BadgeAssigned event:', error, log);
                    }
                }
            },
            onError: (error) => {
                console.error('Error watching BadgeAssigned events:', error);
            }
        });
        
        eventUnwatchFns.push(badgeAssignedUnwatch);
        
        // Listen for CounterReset events (admin only)
        const counterResetUnwatch = watchContractEvent(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            eventName: 'CounterReset',
            chainId: NEXUS_CHAIN_ID_DEC,
            onLogs: async (logs) => {
                console.log('🔄 CounterReset event detected:', logs);
                
                for (const log of logs) {
                    try {
                        if (!log.args) {
                            console.warn('CounterReset event missing args:', log);
                            continue;
                        }
                        
                        const { newValue } = log.args;
                        
                        if (newValue === undefined) {
                            console.warn('CounterReset event missing newValue:', log.args);
                            continue;
                        }
                        
                        console.log(`Counter reset to ${newValue}`);
                        
                        // Update counter
                        const resetValue = Number(newValue);
                        if (!isNaN(resetValue)) {
                            animateCounter(lastCounterValue, resetValue);
                            ui.counterValue.classList.add("counter-updated");
                            setTimeout(() => ui.counterValue.classList.remove("counter-updated"), 600);
                            lastCounterValue = resetValue;
                            
                            displayMessage(`Counter was reset to ${resetValue}`, 'info');
                            await fetchLeaderboard();
                        }
                    } catch (error) {
                        console.error('Error processing CounterReset event:', error, log);
                    }
                }
            },
            onError: (error) => {
                console.error('Error watching CounterReset events:', error);
            }
        });
        
        eventUnwatchFns.push(counterResetUnwatch);
        
        console.log('✅ Event listeners set up successfully');
        
    } catch (error) {
        console.error('Failed to setup event listeners:', error);
    }
}

function cleanupEventListeners() {
    console.log('🧹 Cleaning up event listeners...');
    eventUnwatchFns.forEach(unwatch => {
        try {
            unwatch();
        } catch (e) {
            console.error('Error unwatching event:', e);
        }
    });
    eventUnwatchFns = [];
}

// Send transaction with progress indicator
async function sendTransaction(methodName, buttonElement, originalText) {
    if (!userAddress || buttonElement.disabled) return;
    setActionButtonsEnabled(false);
    addSpinner(buttonElement, originalText);
    setStatus('Awaiting Signature...', 'text-yellow-500');
    ui.messageContainer.classList.add('hidden');
    
    lastActionType = methodName;
    let hash;

    try {
        const { hash: writeHash } = await writeContract(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: methodName,
            value: contractFee,
            chainId: NEXUS_CHAIN_ID_DEC,
        });
        hash = writeHash;

        buttonElement.textContent = 'Waiting for Tx...';
        setStatus('Transaction sent, waiting for mining...', 'text-orange-500');
        
        // Show progress bar and pending message
        showTxProgress();
        displayMessage('Transaction pending...', 'info', hash, true);
        
        const receipt = await waitForTransactionReceipt(wagmiConfig, { 
            hash, 
            chainId: NEXUS_CHAIN_ID_DEC 
        });
        
        // Hide progress bar
        hideTxProgress();
        
        if (receipt.status === 'success') {
            displayMessage('Transaction successful!', 'success', hash, false);
            setStatus('Nexus Testnet', 'text-green-500');
            
            // Add to transaction history
            addToTxHistory(methodName, hash);
            
            // Events will handle updates automatically, but we can trigger badge check
            await updateBadge();
            await updateWalletBalance();
            await refreshCooldownTimer();
        } else {
            displayMessage('Transaction failed (Status: Reverted).', 'error', hash, false);
        }
    } catch (e) {
        console.error("Transaction Error:", e);
        hideTxProgress();
        
        let displayReason = 'Transaction failed.';
        
        if (e.message?.includes('User rejected')) {
            displayReason = 'Transaction rejected by wallet.';
        } else if (e.message?.includes('Action locked: wait')) {
            displayReason = "Action blocked: Please wait 1 hour between actions.";
        } else if (e.message?.includes('already zero')) {
            displayReason = "Decrement failed: Counter is already zero.";
        } else {
            displayReason = e.message?.split('\n')[0]?.trim() || 'Transaction failed unexpectedly.';
        }

        displayMessage(displayReason, 'error', hash, false);
        if (userAddress) setStatus('Nexus Testnet', 'text-green-500');
    } finally {
        setActionButtonsEnabled(true);
        buttonElement.textContent = originalText;
    }
}

// Cast to Farcaster
async function castToFarcaster() {
    if (!lastActionType) {
        displayMessage('No recent action to cast about!', 'warning');
        return;
    }
    
    const action = lastActionType === 'increment' ? 'incremented' : 'decremented';
    const counterValue = ui.counterValue.textContent;
    const text = `I just ${action} the Nexus Counter to ${counterValue}! 🎯\n\nJoin me:`;
    const embedUrl = MINIAPP_URL;
    
    if (isFarcasterEnvironment && sdk?.actions?.composeCast) {
        try {
            setStatus('Opening cast composer... 📝', 'text-blue-500');
            
            const result = await sdk.actions.composeCast({
                text: text,
                embeds: [embedUrl]
            });
            
            if (result?.cast) {
                displayMessage(`✅ Cast posted! Hash: ${result.cast.hash.slice(0, 10)}...`, 'success');
                console.log('Cast hash:', result.cast.hash);
                setStatus('Nexus Testnet', 'text-green-500');
            } else {
                displayMessage('Cast cancelled', 'info');
                setStatus('Nexus Testnet', 'text-green-500');
            }
        } catch (e) {
            console.error('Cast failed:', e);
            displayMessage('Failed to create cast. Please try again.', 'error');
            setStatus('Nexus Testnet', 'text-green-500');
        }
    } else {
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`;
        const popup = window.open(warpcastUrl, '_blank', 'width=600,height=700');
        
        if (popup) {
            displayMessage('Opening Warpcast composer...', 'success');
            setTimeout(() => {
                setStatus('Nexus Testnet', 'text-green-500');
            }, 2000);
        } else {
            displayMessage('Please allow popups to share on Warpcast', 'warning');
            setStatus('Nexus Testnet', 'text-green-500');
        }
    }
}

// Share to Twitter/X
function shareToTwitter() {
    if (!lastActionType) {
        displayMessage('No recent action to tweet about!', 'warning');
        return;
    }
    
    const action = lastActionType === 'increment' ? 'incremented' : 'decremented';
    const counterValue = ui.counterValue.textContent;
    const text = `I just ${action} the Nexus Counter to ${counterValue}! 🎯\n\nTry it yourself: https://nexus-counter.vercel.app\n\n#NexusNetwork #DeFi`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    
    const popup = window.open(url, '_blank', 'width=600,height=700');
    
    if (popup) {
        displayMessage('Opening Twitter composer...', 'success');
    } else {
        displayMessage('Please allow popups to share on Twitter', 'warning');
    }
}

// Initialize SDK
(async () => {
  try {
    await sdk.actions.ready({ disableNativeGestures: true });
    console.log('Farcaster SDK initialized successfully');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await sdk.actions.addMiniApp();
  } catch (e) {
    console.log('Farcaster SDK not available or failed to initialize:', e);
  }
})();


// Auto-reconnect on page load
async function tryAutoReconnect() {
    const currentAccount = getAccount(wagmiConfig);
    if (currentAccount.isConnected && currentAccount.address) {
        const currentChainId = getChainId(wagmiConfig);
        if (currentChainId !== NEXUS_CHAIN_ID_DEC) {
            setStatus('Wrong Network', 'text-red-500');
            updateConnectButton('WRONG_NETWORK');
            ui.userMeta.textContent = formatAddress(currentAccount.address);
            return false;
        }
        
        userAddress = currentAccount.address;
        ui.userMeta.textContent = formatAddress(userAddress);
        setStatus('Nexus Testnet', 'text-green-500');
        updateConnectButton('CONNECTED');
        setActionButtonsEnabled(true);
        
        try {
            contractFee = await readContract(wagmiConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'fee',
                chainId: NEXUS_CHAIN_ID_DEC,
            });
            
            // Get initial counter value before any animations
            const initialValue = await readContract(wagmiConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'count',
                chainId: NEXUS_CHAIN_ID_DEC,
            });
            lastCounterValue = Number(initialValue);
            ui.counterValue.textContent = lastCounterValue.toString();
            
            // Get initial badge tier for milestone tracking
            const stats = await readContract(wagmiConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getUserStats',
                args: [userAddress],
                chainId: NEXUS_CHAIN_ID_DEC,
            });
            previousBadgeTier = Number(stats[3]);
            
            await updateBadge();
            await updateAdminUI();
            await updateWalletBalance();
            fetchLeaderboard();
            displayTxHistory();
            startAutoRefresh();
            startCooldownAutoRefresh();
            setupEventListeners(); // Setup event listeners
            console.log('Auto-reconnected:', userAddress);
            return true;
        } catch (e) {
            console.error('Failed to fetch contract data:', e);
            return false;
        }
    }
    return false;
}

// Initialize Wagmi and AppKit
(async () => {
    try {
        const configLoaded = await loadContractConfig();
        
        if (!configLoaded || !CONTRACT_ADDRESS) {
            setStatus('Config Load Failed', 'text-red-500');
            updateConnectButton('DISCONNECTED');
            ui.connectBtn.disabled = true;
            return;
        }

        // Detect environment
        isFarcasterEnvironment = await isFarcasterEmbed();
        
        console.log('=== ENVIRONMENT DETECTION ===');
        console.log('Detected as Farcaster:', isFarcasterEnvironment);
        console.log('Window location:', window.location.href);
        console.log('Contract Address:', CONTRACT_ADDRESS);
        console.log('============================');
        
        // Set banner based on environment
        if (isFarcasterEnvironment) {
            ui.externalBanner.href = 'https://nexus-counter.vercel.app/';
            ui.externalBannerText.textContent = 'Open in Browser';
            ui.externalBanner.classList.remove('hidden');
        } else {
            ui.externalBanner.href = MINIAPP_URL;
            ui.externalBannerText.textContent = 'Open in Farcaster';
            ui.externalBanner.classList.remove('hidden');
        }

        // Create Wagmi adapter
        const wagmiAdapter = new WagmiAdapter({
            networks: [nexusTestnet],
            projectId: PROJECT_ID,
            ssr: false
        });

        wagmiConfig = wagmiAdapter.wagmiConfig;

        // Try Farcaster auto-connect if in Farcaster environment
        let connected = false;
        if (isFarcasterEnvironment) {
            try {
                const farcasterConnector = wagmiConfig.connectors.find(c => c.id === 'farcasterMiniApp');
                if (farcasterConnector) {
                    const conn = await connect(wagmiConfig, { connector: farcasterConnector });
                    userAddress = conn.accounts[0];
                    ui.userMeta.textContent = formatAddress(userAddress);
                    setStatus('Nexus Testnet', 'text-green-500');
                    updateConnectButton('CONNECTED');
                    setActionButtonsEnabled(true);
                    connected = true;
                    console.log('Connected via Farcaster:', userAddress);
                }
            } catch (e) {
                console.log('Farcaster connection failed:', e);
            }
        }

        // Create AppKit modal
        modal = createAppKit({
            adapters: [wagmiAdapter],
            networks: [nexusTestnet],
            projectId: PROJECT_ID,
            metadata: {
                name: 'Nexus Counter',
                description: 'A simple dApp on the Nexus network.',
                url: 'https://nexus-counter.vercel.app/',
                icons: [`https://nexus-counter.vercel.app/icon.png`]
            },
            features: {
                analytics: true,
                connectMethodsOrder: ["wallet"],
            },
            allWallets: 'SHOW',
            themeMode: 'dark',
            themeVariables: {
                '--w3m-accent': '#667eea',
                '--w3m-border-radius-master': '8px'
            }
        });

        // Try auto-reconnect first
        if (!connected) {
            connected = await tryAutoReconnect();
        }

        // If not connected, fetch contract fee and show initial data
        if (connected) {
            try {
                contractFee = await readContract(wagmiConfig, {
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'fee',
                    chainId: NEXUS_CHAIN_ID_DEC,
                });
            } catch (e) {
                console.error('Failed to fetch contract fee:', e);
            }
        } else {
            setStatus('Ready to connect', 'text-gray-500');
            updateConnectButton('DISCONNECTED');
            await updateCount(false);
            
            // Show skeleton then fetch leaderboard
            ui.leaderboardSkeleton.classList.remove('hidden');
            fetchLeaderboard();
        }

        // Watch account changes
        watchAccount(wagmiConfig, {
            onChange(account) {
                if (account.address && account.isConnected) {
                    console.log('Account changed to:', account.address);
                    userAddress = account.address;
                    ui.userMeta.textContent = formatAddress(userAddress);
                    
                    const currentChainId = getChainId(wagmiConfig);
                    if (currentChainId !== NEXUS_CHAIN_ID_DEC) {
                        setStatus('Wrong Network', 'text-red-500');
                        updateConnectButton('WRONG_NETWORK');
                        setActionButtonsEnabled(false);
                        stopAutoRefresh();
                        stopCooldownAutoRefresh();
                        cleanupEventListeners();
                        ui.walletBalance.classList.add('hidden');
                        ui.txHistoryContainer.classList.add('hidden');
                    } else {
                        setStatus('Nexus Testnet', 'text-green-500');
                        updateConnectButton('CONNECTED');
                        setActionButtonsEnabled(true);
                        
                        readContract(wagmiConfig, {
                            address: CONTRACT_ADDRESS,
                            abi: CONTRACT_ABI,
                            functionName: 'fee',
                            chainId: NEXUS_CHAIN_ID_DEC,
                        }).then(fee => {
                            contractFee = fee;
                        }).catch(console.error);
                        
                        // Get initial value before starting updates
                        readContract(wagmiConfig, {
                            address: CONTRACT_ADDRESS,
                            abi: CONTRACT_ABI,
                            functionName: 'count',
                            chainId: NEXUS_CHAIN_ID_DEC,
                        }).then(value => {
                            lastCounterValue = Number(value);
                            ui.counterValue.textContent = lastCounterValue.toString();
                        }).catch(console.error);
                        
                        // Get initial badge tier
                        readContract(wagmiConfig, {
                            address: CONTRACT_ADDRESS,
                            abi: CONTRACT_ABI,
                            functionName: 'getUserStats',
                            args: [userAddress],
                            chainId: NEXUS_CHAIN_ID_DEC,
                        }).then(stats => {
                            previousBadgeTier = Number(stats[3]);
                        }).catch(console.error);
                        
                        updateBadge();
                        updateAdminUI();
                        updateWalletBalance();
                        fetchLeaderboard();
                        displayTxHistory();
                        startAutoRefresh();
                        startCooldownAutoRefresh();
                        setupEventListeners(); // Setup event listeners
                    }
                } else if (!account.isConnected && userAddress) {
                    console.log('Wallet disconnected');
                    userAddress = null;
                    ui.userMeta.textContent = 'Not Connected';
                    setStatus('Disconnected', 'text-gray-500');
                    updateConnectButton('DISCONNECTED');
                    setActionButtonsEnabled(false);
                    stopAutoRefresh();
                    stopCooldownAutoRefresh();
                    cleanupEventListeners();
                    ui.cooldownTimer.textContent = '';
                    ui.badgeTierContainer.classList.add('hidden');
                    ui.badgeSkeleton.classList.add('hidden');
                    ui.walletBalance.classList.add('hidden');
                    ui.txHistoryContainer.classList.add('hidden');
                    previousBadgeTier = 0;
                }
            }
        });

    } catch (error) {
        console.error('Initialization error:', error);
        displayMessage('Failed to initialize. Please refresh the page.', 'error');
        setStatus('Initialization Failed', 'text-red-500');
    }
})();

// Event Listeners
ui.incrementBtn.onclick = () => sendTransaction('increment', ui.incrementBtn, 'Increment');
ui.decrementBtn.onclick = () => sendTransaction('decrement', ui.decrementBtn, 'Decrement');
ui.castBtn.onclick = castToFarcaster;
ui.twitterBtn.onclick = shareToTwitter;
ui.copyBtn.onclick = () => copyToClipboard(ui.copyBtn.getAttribute('data-hash'));

// Admin Reset Button
ui.resetBtn.onclick = async () => {
    if (!userAddress) {
        displayMessage("Please connect your wallet first.", "error");
        return;
    }
    
    console.log('🔧 Reset button clicked');
    
    const newValueStr = window.prompt("Enter new counter value (must be a non-negative whole number):");
    
    console.log('📝 User entered:', newValueStr);
    
    if (newValueStr === null) {
        console.log('❌ Reset cancelled by user');
        return;
    }
    
    const trimmedValue = newValueStr.trim();
    const newValue = Number(trimmedValue);
    
    console.log('🔍 Validating:', { trimmedValue, newValue, isNaN: isNaN(newValue), isInteger: Number.isInteger(newValue) });
    
    if (isNaN(newValue) || !Number.isInteger(newValue) || newValue < 0) {
        displayMessage("Invalid input. Please enter a non-negative whole number.", "error");
        console.log('❌ Validation failed');
        return;
    }
    
    console.log('✅ Validation passed, proceeding with reset to:', newValue);
    
    let hash;
    const originalBtnText = ui.resetBtn.textContent;
    
    try {
        ui.resetBtn.disabled = true;
        ui.resetBtn.innerHTML = '<svg class="animate-spin inline-block w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Resetting...';
        
        showTxProgress();
        displayMessage("Sending reset transaction...", "info", null, true);
        
        console.log('📤 Sending reset transaction with:', {
            value: newValue,
            address: CONTRACT_ADDRESS,
            chainId: NEXUS_CHAIN_ID_DEC,
            userAddress
        });
        
        const result = await writeContract(wagmiConfig, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'resetCounter',
            args: [BigInt(newValue)],
            chainId: NEXUS_CHAIN_ID_DEC,
        });
        
        hash = result;
        
        console.log('✅ Transaction sent:', hash);
        displayMessage("Waiting for confirmation...", "info", hash, true);
        
        const receipt = await waitForTransactionReceipt(wagmiConfig, { 
            hash, 
            chainId: NEXUS_CHAIN_ID_DEC,
            timeout: 60000
        });
        
        hideTxProgress();
        console.log('📦 Transaction receipt:', receipt);
        
        if (receipt.status === 'success') {
            displayMessage(`✅ Counter reset to ${newValue} successfully!`, "success", hash, false);
            // Event listener will handle the counter update
            console.log('🎉 Reset completed successfully');
        } else {
            displayMessage('Transaction failed (Status: Reverted).', 'error', hash, false);
            console.log('❌ Transaction reverted');
        }
    } catch (e) {
        console.error('❌ Reset error:', e);
        hideTxProgress();
        
        let displayReason = 'Reset failed.';
        
        if (e.message?.includes('User rejected') || e.message?.includes('user rejected')) {
            displayReason = 'Reset cancelled by user.';
        } else if (e.message?.includes('OwnableUnauthorizedAccount') || e.message?.includes('Ownable')) {
            displayReason = 'Reset failed: Only the contract owner can reset the counter.';
        } else if (e.shortMessage) {
            displayReason = `Reset failed: ${e.shortMessage}`;
        } else if (e.message) {
            const msg = e.message.split('\n')[0].trim();
            displayReason = `Reset failed: ${msg}`;
        }
        
        displayMessage(displayReason, "error", hash, false);
    } finally {
        ui.resetBtn.disabled = false;
        ui.resetBtn.textContent = originalBtnText;
        console.log('🔄 Reset button restored');
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    cleanupEventListeners();
    stopAutoRefresh();
    stopCooldownAutoRefresh();
});
