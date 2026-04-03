# KlawPay — OpenClaw Setup Guide

Install KlawPay into your OpenClaw storefront to accept crypto payments and process refunds across XRPL, Sui, Solana, and EVM chains.

## Prerequisites

- [Bun](https://bun.sh) runtime installed
- [OWS CLI](https://github.com/anthropics/ows) installed (`brew install ows` or `cargo install ows`)
- An OpenClaw instance running
- A ClawRevert backend (hosted or self-hosted)

## Step 1 — Install KlawPay

```bash
git clone https://github.com/angelespinoza/klawpay.git
cd klawpay
bun install
```

## Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Point to your ClawRevert instance (or use the hosted one)
CLAWREVERT_URL=https://clawrevert-production.up.railway.app

# OWS wallet name (must already exist in your local vault)
OWS_WALLET=clawrevert-agent

# KlawPay server port
PORT=3001
```

## Step 3 — Create or import OWS wallet

If you don't already have a wallet:

```bash
ows wallet create --name clawrevert-agent
```

If you have an existing mnemonic:

```bash
ows wallet import --name clawrevert-agent
```

Verify the wallet:

```bash
ows wallet list
```

You should see addresses for EVM, Solana, Sui, XRPL, and other chains.

## Step 4 — Start KlawPay

```bash
# Development (hot reload)
bun run dev

# Production
bun run start
```

KlawPay runs on port 3001 by default. Verify:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "api": true,
  "wallet": {
    "name": "clawrevert-agent",
    "chains": ["eip155:1", "solana:...", "sui:...", "..."]
  }
}
```

## Step 5 — Register skills in OpenClaw

Add the KlawPay skills to your OpenClaw agent configuration. The skills are Markdown files that teach the agent how to handle payments and refunds:

```yaml
# openclaw.config.yaml
plugins:
  - name: klawpay
    path: ./klawpay
    skills:
      - src/skills/payments.md
      - src/skills/refunds.md
```

Or if using the plugin auto-discovery, KlawPay's `package.json` declares its skills:

```json
{
  "openclaw": {
    "plugin": true,
    "skills": [
      "src/skills/payments.md",
      "src/skills/refunds.md"
    ]
  }
}
```

## Step 6 — Test the integration

### Test a payment via CLI

```bash
bun run src/cli.ts pay --amount 10 --currency XRP --chain xrpl --client "Test Store"
```

### Test a refund via CLI

```bash
bun run src/cli.ts refund \
  --txHash <TX_HASH_FROM_ABOVE> \
  --chain xrpl \
  --wallet <WALLET_ADDRESS> \
  --amount 10 \
  --currency XRP \
  --reason duplicate_charge
```

### Test the agent skills

Open your OpenClaw chat and try:

- English: "I want to pay 50 XRP"
- Spanish: "Quiero un reembolso de mi ultima compra"
- Portuguese: "Quero pagar 0.1 ETH na Base"

## API Reference

KlawPay exposes these endpoints on `http://localhost:3001`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API + wallet connectivity check |
| GET | `/wallet` | List OWS wallet addresses |
| POST | `/pay` | Send a payment via ClawRevert |
| POST | `/refund` | Request a refund via ClawRevert |
| GET | `/audit?limit=N` | Fetch last N audit entries |
| POST | `/sign` | Sign a message with OWS wallet |

### POST /pay

```json
{
  "amount": 50,
  "currency": "XRP",
  "chain": "xrpl",
  "clientName": "Alice"
}
```

### POST /refund

```json
{
  "txHash": "ABC123...",
  "chain": "xrpl",
  "walletAddress": "rXXXXXXXX",
  "amount": 50,
  "currency": "XRP",
  "reason": "duplicate_charge"
}
```

### POST /sign

```json
{
  "chain": "ethereum",
  "message": "Hello from KlawPay"
}
```

## Supported Chains

| Chain | Currency | Testnet | Explorer |
|-------|----------|---------|----------|
| XRPL | XRP | testnet | testnet.xrpl.org |
| Solana | SOL | devnet | explorer.solana.com |
| Base | ETH | sepolia | sepolia.basescan.org |
| Sui | SUI | testnet | suiexplorer.com |
| Ethereum | ETH | sepolia | sepolia.etherscan.io |

## Troubleshooting

**"API reachable: false"** — ClawRevert is not running or the URL in `.env` is wrong. Check `CLAWREVERT_URL`.

**"OWS error: wallet not found"** — The OWS wallet doesn't exist. Run `ows wallet create --name clawrevert-agent`.

**"Faucet rate limited"** — Testnet faucets have rate limits. Wait 1-2 minutes and try again.

**Port conflict** — If port 3001 is in use, change `PORT` in `.env`.
