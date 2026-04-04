/**
 * Request Payment — generates payment instructions for a client.
 *
 * Returns the merchant wallet address, destination tag (XRPL),
 * formatted instructions, and a QR code data URL.
 * Does NOT execute any transaction.
 */

import QRCode from "qrcode";

/** Chain → explorer base URL mapping */
const EXPLORER: Record<string, (addr: string) => string> = {
  xrpl: (addr) => `https://testnet.xrpl.org/accounts/${addr}`,
  solana: (addr) => `https://explorer.solana.com/address/${addr}?cluster=devnet`,
  base: (addr) => `https://sepolia.basescan.org/address/${addr}`,
  sui: (addr) => `https://suiexplorer.com/address/${addr}?network=testnet`,
  ethereum: (addr) => `https://sepolia.etherscan.io/address/${addr}`,
  arbitrum: (addr) => `https://sepolia.arbiscan.io/address/${addr}`,
};

/** Wallet addresses from plugin config */
export interface WalletConfig {
  xrplWalletAddress?: string;
  solanaWalletAddress?: string;
  evmWalletAddress?: string;
  suiWalletAddress?: string;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  chain: string;
  clientName: string;
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
  return Math.abs(hash) % 4294967295;
}

/**
 * Resolve wallet address for a chain from the plugin config.
 */
function getAddress(wallets: WalletConfig, chain: string): string {
  switch (chain) {
    case "xrpl":
      if (wallets.xrplWalletAddress) return wallets.xrplWalletAddress;
      break;
    case "solana":
      if (wallets.solanaWalletAddress) return wallets.solanaWalletAddress;
      break;
    case "sui":
      if (wallets.suiWalletAddress) return wallets.suiWalletAddress;
      break;
    case "ethereum":
    case "base":
    case "arbitrum":
    case "avalanche":
      if (wallets.evmWalletAddress) return wallets.evmWalletAddress;
      break;
  }
  throw new Error(
    `No wallet address configured for ${chain}. ` +
    `Set ${chain === "xrpl" ? "xrplWalletAddress" : chain === "solana" ? "solanaWalletAddress" : chain === "sui" ? "suiWalletAddress" : "evmWalletAddress"} in the KlawPay plugin config.`
  );
}

/**
 * Build a QR-scannable payment URI for each chain.
 */
function buildPaymentUri(chain: string, address: string, amount: number, currency: string, destTag?: number): string {
  switch (chain) {
    case "xrpl":
      return `https://xrpl.to/${address}?amount=${amount}&dt=${destTag ?? ""}`;
    case "solana":
      return `solana:${address}?amount=${amount}&spl-token=&label=KlawPay`;
    case "ethereum":
    case "base":
    case "arbitrum": {
      const wei = BigInt(Math.round(amount * 1e18));
      return `ethereum:${address}?value=${wei}`;
    }
    case "sui":
      return `sui:${address}?amount=${amount}`;
    default:
      return address;
  }
}

export async function requestPayment(
  req: PaymentRequest,
  wallets: WalletConfig,
): Promise<PaymentInstructions> {
  const now = Date.now();
  const paymentId = crypto.randomUUID().slice(0, 12);
  const address = getAddress(wallets, req.chain);

  const destinationTag = req.chain === "xrpl"
    ? generateDestinationTag(req.clientName, now)
    : undefined;

  const paymentUri = buildPaymentUri(req.chain, address, req.amount, req.currency, destinationTag);

  const qrDataUrl = await QRCode.toDataURL(paymentUri, {
    width: 256,
    margin: 2,
    color: { dark: "#c8cdd8", light: "#131720" },
  });

  const explorerFn = EXPLORER[req.chain];
  const explorerUrl = explorerFn ? explorerFn(address) : "";

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
