# GuardPay - Crypto Payment Gateway

> Accept cryptocurrency payments with unique addresses, automated detection, and multi-chain support.

**Supported Testnets:** Ethereum Sepolia • BSC Testnet • Solana Devnet

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
# Install all dependencies (frontend + backend)
pnpm install
cd server && pnpm install && cd ..
```

### Step 2: Generate Wallet Seed

**Generate a BIP39 mnemonic for unique address generation:**

```bash
npx bip39-cli generate
```

You'll get a 12-word phrase like:
```
feed learn muffin usage chicken bike cigar injury loop gadget lounge struggle
```

**⚠️ IMPORTANT:** Save this phrase securely! You'll need it to access funds sent to generated addresses.

**Add to `server/.env`:**
```bash
MASTER_SEED="your twelve word mnemonic phrase here"
```

### Step 3: Start the Platform

```bash
# Run both frontend and backend
pnpm dev:all
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

---

## 💰 Get Testnet Funds

### Ethereum Sepolia (ETH)

**Faucets:**
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://sepoliafaucet.com

**Add to MetaMask:**
- Network: Sepolia
- RPC: https://eth-sepolia.g.alchemy.com/v2/demo
- Chain ID: 11155111
- Explorer: https://sepolia.etherscan.io

### BSC Testnet (BNB)

**Faucet:**
- https://testnet.bnbchain.org/faucet-smart

**Add to MetaMask:**
- Network: BSC Testnet
- RPC: https://data-seed-prebsc-1-s1.binance.org:8545
- Chain ID: 97
- Explorer: https://testnet.bscscan.com

### Solana Devnet (SOL)

**Web Faucet:**
- https://faucet.solana.com

**CLI (Recommended):**
```bash
solana airdrop 2 YOUR_ADDRESS --url devnet
```

**Phantom Wallet:**
Settings → Developer Settings → Enable Testnet Mode → Switch to Devnet

---

## 🎯 Test Your First Payment

### 1. Login
- Open http://localhost:5173
- Connect MetaMask or Phantom wallet
- Sign the authentication message

### 2. Create Payment Link
- Go to Dashboard → Payment Links
- Click "Create New Link"
- Fill in:
  - Title: "Test Payment"
  - Price: 1.00
  - Currency: USD
  - Crypto: ETH (or BNB/SOL)
- Click Create

### 3. Open Payment Link
- Copy the payment link URL
- Open in new tab or incognito window
- You'll see:
  - Unique payment address
  - QR code
  - Exact amount to send
  - 15-minute countdown timer

### 4. Send Payment
- Send exact testnet crypto to the displayed address
- Use MetaMask for ETH/BNB
- Use Phantom for SOL

### 5. Watch Auto-Confirmation
- Backend checks every 10 seconds
- Status updates: `new` → `pending` → `confirming` → `paid`
- ETH/BSC: ~30-60 seconds (3 confirmations)
- Solana: ~5-10 seconds

---

## 🏗️ What You Built

### Backend (Express + TypeScript)

**Core Services:**
- **Wallet Service**: HD wallet generates unique addresses per payment
- **Blockchain Service**: Monitors ETH, BSC, Solana for incoming payments
- **Price Service**: Real-time crypto price conversion via CoinGecko
- **Webhook Service**: Notifies merchants when payments complete

**API Endpoints:**
```
POST   /api/auth/nonce          # Get nonce for wallet signature
POST   /api/auth/verify         # Verify signature, get JWT token
GET    /api/merchant/profile    # Get merchant details
PUT    /api/merchant/settings   # Update receiving addresses
POST   /api/merchant/api-key    # Generate API key
GET    /api/merchant/stats      # Transaction statistics
GET    /api/links               # List payment links
POST   /api/links               # Create payment link
POST   /api/invoices            # Create invoice with unique address
GET    /api/invoices/:id        # Get invoice details
GET    /api/invoices/:id/status # Poll payment status
GET    /api/webhooks            # List webhooks
POST   /api/webhooks            # Create webhook
```

### Frontend (React + TypeScript)

**Pages:**
- **Login**: Wallet signature authentication
- **Dashboard**: Transaction history, statistics
- **Payment Links**: Create and manage links
- **Invoice/Checkout**: Public payment page with QR code
- **Settings**: Configure wallet addresses, API keys

**Wallet Integration:**
- MetaMask (EVM chains)
- Phantom (Solana)
- ConnectKit + Wagmi (EVM)
- Solana Wallet Adapter

---

## 📖 API Usage

### Authentication

```bash
# 1. Get nonce
curl -X POST http://localhost:3001/api/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x..."}'

# 2. Sign message with wallet, then verify
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "signature": "0x..."
  }'
```

### Create Payment Link

```bash
curl -X POST http://localhost:3001/api/links \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Premium Plan",
    "price": 99.99,
    "currency": "USD",
    "crypto": "ETH"
  }'
```

### Create Invoice

```bash
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "pl_xxx",
    "chain": "ETH"
  }'
```

Response includes unique payment address and exact crypto amount.

### Webhooks

```bash
# Create webhook
curl -X POST http://localhost:3001/api/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["payment.completed"]
  }'
```

**Webhook Payload:**
```json
{
  "event": "payment.completed",
  "data": {
    "invoice_id": "inv_xxx",
    "amount": 0.05,
    "crypto": "ETH",
    "tx_hash": "0x...",
    "confirmations": 3
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

Verify signature using HMAC-SHA256 with webhook secret.

---

## 🔧 Configuration

### Backend Environment (`server/.env`)

```bash
# Required
MASTER_SEED="your twelve word mnemonic"

# Optional - Customize RPC URLs
ETH_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
SOLANA_RPC_URL=https://api.devnet.solana.com

# Optional - Adjust monitoring
POLL_INTERVAL_MS=10000  # Check payments every 10 seconds
CONFIRMATION_BLOCKS=3    # Wait for 3 confirmations
```

### Frontend Environment (`.env`)

```bash
VITE_API_URL=http://localhost:3001
```

---

## 🐛 Troubleshooting

### Backend won't start

**"MASTER_SEED not set"**
- Generate seed: `npx bip39-cli generate`
- Add to `server/.env`

**"Cannot connect to RPC"**
- Check internet connection
- Use default RPC URLs (already in `.env`)
- For Alchemy, get free API key: https://www.alchemy.com

### Payment not detected

**Invoice stays "Waiting":**
1. Check backend logs for errors
2. Verify correct address (each invoice is unique)
3. Ensure correct amount sent
4. Wait 10-60 seconds (polling interval)
5. Check correct network:
   - ETH → Sepolia (not mainnet!)
   - BNB → BSC Testnet
   - SOL → Devnet

**Check backend logs:**
```bash
cd server && pnpm dev
# Watch for "💰 Payment detected" messages
```

### Wallet connection issues

**MetaMask not connecting:**
- Refresh page
- Clear browser cache
- Make sure on correct network

**Signature rejected:**
- Normal if you clicked "Cancel"
- Try connecting again

---

## 🔒 Security Notes

- 🔐 Never commit `.env` files or wallet seeds
- 🔑 Use strong JWT secrets in production
- 🌐 Enable HTTPS in production
- 🔐 Validate webhook signatures
- 💾 Use PostgreSQL/MySQL instead of SQLite for production
- 🚀 Deploy backend and frontend separately

---

## 📁 Project Structure

```
GuardPay/
├── server/                    # Backend API
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts   # SQLite setup
│   │   ├── services/
│   │   │   ├── wallet.service.ts      # HD wallet
│   │   │   ├── blockchain.service.ts  # Payment monitoring
│   │   │   ├── price.service.ts       # Price conversion
│   │   │   └── webhook.service.ts     # Notifications
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── merchant.routes.ts
│   │   │   ├── links.routes.ts
│   │   │   ├── invoice.routes.ts
│   │   │   └── webhook.routes.ts
│   │   └── middleware/
│   │       └── auth.middleware.ts
│   └── .env                  # Add MASTER_SEED here!
│
├── src/                      # Frontend
│   ├── lib/
│   │   └── api.ts           # HTTP client
│   ├── pages/
│   │   ├── Login.tsx        # Wallet auth
│   │   ├── Dashboard.tsx    # Merchant dashboard
│   │   └── Invoice.tsx      # Checkout page
│   └── components/          # UI components
│
└── package.json             # Run scripts
```

---

## 🚀 Deployment

### Backend

```bash
cd server
pnpm build
pnpm start
```

Deploy to: Railway, Render, DigitalOcean, AWS

### Frontend

```bash
pnpm build
```

Deploy `dist/` folder to: Vercel, Netlify, Cloudflare Pages

### Environment Variables

**Production Backend:**
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Use mainnet RPC URLs
- Use PostgreSQL database

**Production Frontend:**
- Update `VITE_API_URL` to your backend URL

---

## 💡 How It Works

### Payment Flow

1. **Merchant creates payment link** → Stored in database
2. **Customer opens link** → Backend generates unique address
3. **Customer sends crypto** → Transaction broadcasts to blockchain
4. **Backend detects payment** → Monitors address balance every 10s
5. **Payment confirmed** → Waits for confirmations, updates status
6. **Webhook triggered** → Merchant notified

### Unique Address Generation

**EVM (ETH/BSC):**
```
Master Seed → HD Node → m/44'/60'/0'/0/0 → Address 1
                      → m/44'/60'/0'/0/1 → Address 2
                      → m/44'/60'/0'/0/n → Address N
```

**Solana:**
```
Generate random keypair → Store in memory
```

---

## 📊 Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- SQLite (sql.js)
- ethers.js (EVM)
- @solana/web3.js
- JWT authentication

**Frontend:**
- React + TypeScript + Vite
- TailwindCSS + shadcn/ui
- Wagmi + ConnectKit
- Solana Wallet Adapter

---

## ✅ What's Next?

### For Testing:
1. ✅ Get testnet funds
2. ✅ Create payment links
3. ✅ Test payments on all 3 chains
4. ✅ Verify auto-detection works
5. ✅ Test webhooks

### For Production:
1. Switch to mainnet RPC URLs
2. Deploy backend to server
3. Deploy frontend to hosting
4. Set up PostgreSQL database
5. Configure domain and SSL
6. Test with small real payments first

---

## 🆘 Need Help?

**Check logs:**
- Backend: Watch terminal for payment detection
- Frontend: Check browser console

**Common issues:**
- Wrong network selected
- Incorrect amount sent
- Address reused (each invoice is unique)
- Testnet transaction delays

**Still stuck?**
- Check backend logs for detailed errors
- Verify all environment variables set
- Make sure both servers running
- Try restarting both servers

---

## 📝 License

MIT

---

**Built with ❤️ for the crypto community**

Ready to accept payments! 🎉
