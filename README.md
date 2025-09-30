# Nexus Testnet Counter App

A simple decentralized application (dApp) that interacts with a counter smart contract on the Nexus Testnet. This app is also available as a Farcaster Mini App.

## Live Demo

🌐 **[https://nexus-counter.vercel.app](https://nexus-counter.vercel.app)**

## Overview

This project demonstrates a comprehensive integration between a web application and the Nexus blockchain. It features an enhanced smart contract with a global counter that can be incremented or decremented, showcasing advanced blockchain interactions including:

- Smart contract deployment with fee mechanism
- Multi-wallet connection (Browser Extensions, Farcaster, WalletConnect)
- Transaction signing with cooldown enforcement
- Real-time leaderboard tracking
- Badge/tier system for user engagement
- Event listening and state updates
- Admin controls for contract owner
- Farcaster Mini App integration

## Key Features

### 🎯 Core Functionality
- **Increment/Decrement Counter**: Modify the global counter with transaction fees
- **Real-time Updates**: Auto-refresh counter value every 5 seconds
- **Transaction History**: View transaction details on Nexus Explorer

### 🏆 Gamification
- **Top 20 Leaderboard**: Track the most active users
- **Badge System**: Earn badges based on activity:
  - 🟤 Bronze Badge (10+ actions)
  - ⚪ Silver Badge (25+ actions)
  - 📀 Gold Badge (50+ actions)
  - 💿 Platinum Badge (100+ actions)
  - 💎 Diamond Badge (250+ actions)
  - 👑 Master Badge (500+ actions)
  - ⭐ Legendary Badge (1000+ actions)

### 🔒 Security Features
- **Cooldown Mechanism**: 1-hour cooldown between actions per user
- **Fee System**: Small NEX fee required for each transaction
- **Admin Controls**: Owner-only counter reset functionality

### 🔗 Multi-Wallet Support
- Browser extension wallets (MetaMask, Rabby, etc.)
- Farcaster wallet (for Farcaster users)
- WalletConnect (QR code modal for mobile wallets)

## Prerequisites

- A compatible wallet (MetaMask, Rabby, or other browser extension)
- NEX tokens for gas fees and transaction fees
- Modern web browser
- (Optional) Farcaster account for Mini App features

## Getting Testnet NEX

To interact with the Nexus Testnet (chainID: **3940**), you'll need testnet NEX tokens for gas fees. These can be obtained from:

🚰 **[Nexus Testnet Faucet](https://hub.nexus.xyz/)**

## Smart Contract Details

The enhanced Counter smart contract implements:

- **Public counter variable** with getter function
- **Increment function** that adds 1 to the counter (payable with fee)
- **Decrement function** that subtracts 1 from the counter (payable with fee)
- **Cooldown enforcement** (1 hour between actions per user)
- **User statistics tracking** (increments, decrements, last action, tier)
- **Leaderboard system** (top 20 users by total actions)
- **Badge/tier calculation** based on activity
- **Fee management** (owner can set transaction fee)
- **Admin reset function** (owner only)
- **Event emissions** for all state changes

### Deployed Contract

**Contract Address**: `0x6DDc7dd77CbeeA3445b70CB04E0244BBa245e011`

**Network**: Nexus Testnet (Chain ID: 3940)

**Explorer**: [https://testnet3.explorer.nexus.xyz](https://testnet3.explorer.nexus.xyz)

The contract source code can be found in `contract.sol` in this repository.

## Installation & Setup

### Option 1: Use the Live Demo (Recommended)

Simply visit **[https://nexus-counter.vercel.app](https://nexus-counter.vercel.app)** and connect your wallet.

### Option 2: Run Locally

1. **Clone the repository:**

```bash
git clone https://github.com/CryptoExplor/nexus-counter-app.git
cd nexus-counter-app
```

2. **Serve the HTML file:**

You can use any static file server. For example:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js http-server
npx http-server

# Using PHP
php -S localhost:8000
```

3. **Open in browser:**

Navigate to `http://localhost:8000/index.html`

4. **Configure contract (if needed):**

The app loads contract configuration from `contract.json`. Update this file if you deploy your own contract:

```json
{
  "address": "0xYourContractAddress",
  "abi": [...]
}
```

## Using the dApp

### 1. Connect Your Wallet

**For Browser Users:**
- Ensure you have MetaMask, Rabby, or another compatible wallet extension installed
- Click "Connect Wallet"
- Approve the connection request
- If prompted, switch to Nexus Testnet (Chain ID: 3940)

**For Farcaster Users:**
- Open the Mini App within Farcaster
- Connection is automatic

**For Mobile Users:**
- Click "Connect Wallet"
- Select WalletConnect
- Scan the QR code with your mobile wallet

### 2. Interact with the Counter

**View Current Count:**
- The current counter value is displayed prominently
- Auto-refreshes every 5 seconds when connected

**Increment Counter:**
- Click the "Increment" button (green)
- Confirm the transaction in your wallet (includes gas + fee)
- Wait for confirmation (~5-10 seconds)
- See the updated count and your new badge tier

**Decrement Counter:**
- Click the "Decrement" button (red)
- Confirm the transaction in your wallet (includes gas + fee)
- Wait for confirmation (~5-10 seconds)
- Counter cannot go below zero

### 3. View Leaderboard

- Top 20 users are displayed by total actions
- Your rank is highlighted if you're in the top 20
- Updates automatically after each transaction

### 4. Admin Functions (Owner Only)

If you're the contract owner:
- Admin controls will appear automatically
- Use "Reset Counter" to set the counter to any value
- Useful for testing or special events

## Technology Stack

### Frontend

- **HTML5** with semantic markup
- **Tailwind CSS** (CDN) for responsive styling
- **Vanilla JavaScript** (ES6 modules)
- **Wagmi Core** for blockchain interactions
- **Viem** for Ethereum utilities
- **Farcaster Mini App SDK** for Farcaster integration
- **Google Fonts** (Inter & Roboto Mono)

### Blockchain

- **Network**: Nexus Testnet (Chain ID: 3940)
- **RPC URL**: Alchemy-powered Nexus RPC
- **Smart Contract Language**: Solidity ^0.8.0
- **Contract Interaction**: Wagmi Core + Viem
- **Wallet Connectors**:
  - Injected (browser extensions)
  - Farcaster Mini App Connector
  - WalletConnect v2

### Deployment

- **Hosting**: Vercel
- **Custom Domain**: nexus-counter.vercel.app

## Network Configuration

Add Nexus Testnet to your wallet manually if needed:

- **Network Name**: Nexus Testnet
- **Chain ID**: 3940 (decimal) or 0xF64 (hex)
- **RPC URL**: `https://nexus-testnet.g.alchemy.com/v2/d5bxPxUVzMKqbZ2CA4EZi`
- **Currency Symbol**: NEX
- **Block Explorer**: `https://testnet3.explorer.nexus.xyz`

## Common Issues & Solutions

### Transaction Failures

**Insufficient funds:**
- Ensure you have enough NEX for gas fees + transaction fee
- Get more NEX from the faucet

**Cooldown error:**
- Wait 1 hour between actions (cooldown enforced by contract)
- Check your last action time in the transaction history

**Counter at zero:**
- Cannot decrement below zero
- Try incrementing instead

**Wrong network:**
- Verify you're connected to Nexus Testnet (Chain ID: 3940)
- Click "Switch to Nexus Testnet" if prompted

### Wallet Connection Issues

**Wallet not detected:**
- Install MetaMask or Rabby browser extension
- Refresh the page after installation
- Try WalletConnect as an alternative

**Connection rejected:**
- Try connecting again
- Ensure your wallet is unlocked
- Check wallet popup/notification

**Network switch failed:**
- Manually add Nexus Testnet to your wallet (see Network Configuration)
- Try switching from your wallet's network selector

**Persistent issues:**
- Clear browser cache and cookies
- Try incognito/private browsing mode
- Try a different browser or wallet

## Project Structure

```
nexus-counter-app/
├── index.html              # Main application file
├── contract.json          # Contract ABI and address
├── contract.sol           # Smart contract source
├── vercel.json           # Vercel deployment config
├── .well-known/          # Farcaster manifest
│   └── farcaster.json
├── favicon.ico           # Favicon
├── icon.png             # App icon
├── splash.png           # Splash screen
├── image.png            # OG image for sharing
├── bottom.png           # Footer image
├── README.md            # This file
└── LICENSE              # MIT License
```

## Development

### Local Development

1. **Make changes** to `index.html` or `contract.json`
2. **Test locally** using a static file server
3. **Test with testnet** - ensure MetaMask is connected to Nexus Testnet (3940)
4. **Deploy** via git push to main (auto-deploys to Vercel)

### Smart Contract Development

To deploy your own version of the contract:

1. Install Hardhat or Foundry
2. Update `contract.sol` with your modifications
3. Deploy to Nexus Testnet (Chain ID: 3940)
4. Update `contract.json` with new address and ABI
5. Test thoroughly on testnet before announcing

### Farcaster Mini App Configuration

The app includes Farcaster Mini App metadata in `index.html`:

- Manifest in `.well-known/farcaster.json`
- Meta tags for frame/mini app detection
- Automatic connection for Farcaster users
- Custom splash screen and icons

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Considerations

- Never share your private keys
- Always verify contract addresses before interacting
- Start with small amounts when testing
- Report any security issues privately to the maintainers

## Roadmap

- [ ] Multi-language support
- [ ] Dark/light theme toggle
- [ ] Historical counter chart
- [ ] User profile pages
- [ ] NFT badges for milestones
- [ ] Mobile app (React Native)

## Support

- **Issues**: [GitHub Issues](https://github.com/CryptoExplor/nexus-counter-app/issues)
- **Twitter**: [@kumar14700](https://x.com/kumar14700)
- **Farcaster**: [dare1.eth](https://farcaster.xyz/dare1.eth)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Nexus Team for the testnet infrastructure
- Farcaster for the Mini App SDK
- Wagmi/Viem teams for excellent Web3 libraries
- Open source community for inspiration

---

**Built with ❤️ for the Nexus and Farcaster communities**
