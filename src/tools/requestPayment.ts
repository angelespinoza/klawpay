/**
 * Request Payment — generates payment instructions for a client.
 *
 * Returns the merchant wallet address, destination tag (XRPL),
 * formatted instructions, and a QR code data URL.
 * Does NOT execute any transaction.
 */

import QRCode from "qrcode";

const KLAWPAY_API = process.env.KLAWPAY_URL ?? "http://localhost:3001";

/** Chain → explorer base URL mapping */
const EXPLORER: Record<string, (addr: string) => string> = {
  xrpl: (addr) => `https://testnet.xrpl.org/accounts/${addr}`,
  solana: (addr) => `https://explorer.solana.com/address/${addr}?cluster=devnet`,
  base: (addr) => `https://sepolia.basescan.org/address/${addr}`,
  sui: (addr) => `https://suiexplorer.com/address/${addr}?network=testnet`,
  ethereum: (addr) => `https://sepolia.etherscan.io/address/${addr}`,
};

export interface PaymentRequest {
  amount: number;
  currency: string;
  chain: string;
  clientName: string;
  merchantId: string;
}

export interface PaymentInstructions {
  address: string;
  amount: number;
  currency: string;
  chain: string;
  destinationTag?: number;
  memo: string;
  qrDataUrl: string;
  explorerUrl: string;
  paymentId: string;
  createdAt: string;
}

/**
 * Generate a deterministic destination tag from client name + timestamp.
 * Used for XRPL to identify which payment belongs to which client.
 */
function generateDestinationTag(clientName: string, timestamp: number): number {
  let hash = 0;
  const str = `${clientName}:${timestamp}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  // XRPL destination tags are 32-bit unsigned integers
  return Math.abs(hash) % 4294967295;
}

/**
 * Look up merchant wallet addresses. Tries the KlawPay API first,
 * falls back to the shared clawrevert-agent wallet addresses.
 */
async function getMerchantAddress(merchantId: string, chain: string): Promise<string> {
  // Try merchant-specific wallet
  try {
    const res = await fetch(`${KLAWPAY_API}/api/merchants/${merchantId}`);
    if (res.ok) {
      const merchant = await res.json();
      // Match chain to wallet key
      const chainKey = chain === "ethereum" || chain === "base" || chain === "arbitrum" ? "evm" : chain;
      if (merchant.wallets?.[chainKey]) return merchant.wallets[chainKey];
    }
  } catch {
    // fall through
  }

  // Fall back to shared wallet
  try {
    const res = await fetch(`${KLAWPAY_API}/wallet`);
    if (res.ok) {
      const wallets = await res.json();
      // Map chain names to wallet keys
      for (const [key, addr] of Object.entries(wallets)) {
        if (chain === "solana" && key.startsWith("solana")) return addr as string;
        if (chain === "sui" && key.startsWith("sui")) return addr as string;
        if ((chain === "ethereum" || chain === "base" || chain === "arbitrum") && key.startsWith("eip155")) return addr as string;
      }
    }
  } catch {
    // fall through
  }

  // Last resort: try OWS CLI directly
  try {
    const proc = Bun.spawn(["ows", "wallet", "list"], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code === 0) {
      for (const line of stdout.split("\n")) {
        const match = line.match(/^\s+([\w:.\-]+)\s.*→\s+(\S+)/);
        if (!match) continue;
        const [, chainId, addr] = match;
        if (chain === "solana" && chainId.startsWith("solana")) return addr;
        if (chain === "sui" && chainId.startsWith("sui")) return addr;
        if ((chain === "ethereum" || chain === "base" || chain === "arbitrum") && chainId.startsWith("eip155")) return addr;
      }
    }
  } catch {
    // OWS not available
  }

  // XRPL: OWS doesn't have native XRPL support — use env or generate via xrpl.js at runtime
  if (chain === "xrpl") {
    const seed = process.env.XRPL_WALLET_SEED;
    if (seed) {
      // Derive address from seed at runtime using xrpl.js if available
      try {
        const { Wallet } = await import("xrpl");
        return Wallet.fromSeed(seed).address;
      } catch {
        // xrpl not installed in klawpay — use the known clawrevert testnet address
      }
    }
    // Fallback: use a well-known testnet faucet address for demo purposes
    // In production, XRPL_WALLET_ADDRESS should be set in .env
    const envAddr = process.env.XRPL_WALLET_ADDRESS;
    if (envAddr) return envAddr;
  }

  throw new Error(`No wallet address found for chain ${chain}. Set XRPL_WALLET_ADDRESS in .env for XRPL.`);
}

/**
 * Build a QR-scannable payment URI for each chain.
 */
function buildPaymentUri(chain: string, address: string, amount: number, currency: string, destTag?: number): string {
  switch (chain) {
    case "xrpl":
      // XRP Ledger payment URI
      return `https://xrpl.to/${address}?amount=${amount}&dt=${destTag ?? ""}`;
    case "solana":
      // Solana Pay URI
      return `solana:${address}?amount=${amount}&spl-token=&label=KlawPay`;
    case "ethereum":
    case "base":
    case "arbitrum":
      // EIP-681 payment URI
      const wei = BigInt(Math.round(amount * 1e18));
      return `ethereum:${address}?value=${wei}`;
    case "sui":
      return `sui:${address}?amount=${amount}`;
    default:
      return address;
  }
}

export async function requestPayment(req: PaymentRequest): Promise<PaymentInstructions> {
  const now = Date.now();
  const paymentId = crypto.randomUUID().slice(0, 12);
  const address = await getMerchantAddress(req.merchantId, req.chain);

  // Generate destination tag for XRPL
  const destinationTag = req.chain === "xrpl"
    ? generateDestinationTag(req.clientName, now)
    : undefined;

  // Build payment URI for QR
  const paymentUri = buildPaymentUri(req.chain, address, req.amount, req.currency, destinationTag);

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(paymentUri, {
    width: 256,
    margin: 2,
    color: { dark: "#c8cdd8", light: "#131720" },
  });

  // Build explorer link
  const explorerFn = EXPLORER[req.chain];
  const explorerUrl = explorerFn ? explorerFn(address) : "";

  // Build human-readable memo
  const memo = destinationTag
    ? `Send exactly ${req.amount} ${req.currency} to the address below with Destination Tag ${destinationTag}`
    : `Send exactly ${req.amount} ${req.currency} to the address below`;

  return {
    address,
    amount: req.amount,
    currency: req.currency,
    chain: req.chain,
    destinationTag,
    memo,
    qrDataUrl,
    explorerUrl,
    paymentId,
    createdAt: new Date(now).toISOString(),
  };
}
