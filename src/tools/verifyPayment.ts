/**
 * Verify Payment — polls the blockchain to confirm a payment arrived.
 *
 * Uses Zerion API for EVM/Solana and XRPL native API for XRP Ledger.
 * Polls every 10 seconds for up to 5 minutes.
 */

const ZERION_API_KEY = process.env.ZERION_API_KEY ?? "";
const ZERION_BASE = "https://api.zerion.io/v1";

const EXPLORER_TX: Record<string, (hash: string) => string> = {
  xrpl: (h) => `https://testnet.xrpl.org/transactions/${h}`,
  solana: (h) => `https://explorer.solana.com/tx/${h}?cluster=devnet`,
  base: (h) => `https://sepolia.basescan.org/tx/${h}`,
  sui: (h) => `https://suiexplorer.com/txblock/${h}?network=testnet`,
  ethereum: (h) => `https://sepolia.etherscan.io/tx/${h}`,
};

export interface VerifyRequest {
  address: string;
  amount: number;
  currency: string;
  chain: string;
  destinationTag?: number;
  since: string; // ISO timestamp
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface VerifyResult {
  confirmed: boolean;
  txHash?: string;
  explorerUrl?: string;
  receivedAmount?: number;
  from?: string;
  error?: string;
}

/**
 * Check XRPL for incoming payments to an address, filtered by destination tag.
 */
async function checkXrpl(
  address: string,
  amount: number,
  destinationTag: number | undefined,
  sinceMs: number,
): Promise<VerifyResult | null> {
  const server = process.env.XRPL_SERVER ?? "https://s.altnet.rippletest.net:51234";

  const res = await fetch(server, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "account_tx",
      params: [{
        account: address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 20,
        forward: false,
      }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const txs = data.result?.transactions ?? [];

  for (const entry of txs) {
    const tx = entry.tx ?? entry.tx_json;
    if (!tx || tx.TransactionType !== "Payment") continue;
    if (tx.Destination !== address) continue;

    // Check destination tag if specified
    if (destinationTag !== undefined && tx.DestinationTag !== destinationTag) continue;

    // Check amount (XRP is in drops)
    const drops = typeof tx.Amount === "string" ? Number(tx.Amount) : 0;
    const xrpAmount = drops / 1_000_000;

    // Allow 1% tolerance for fees
    if (xrpAmount >= amount * 0.99) {
      const hash = tx.hash ?? entry.hash;
      return {
        confirmed: true,
        txHash: hash,
        explorerUrl: EXPLORER_TX.xrpl(hash),
        receivedAmount: xrpAmount,
        from: tx.Account,
      };
    }
  }

  return null;
}

/**
 * Check Zerion for incoming transactions to an address (EVM/Solana).
 */
async function checkZerion(
  address: string,
  amount: number,
  chain: string,
  sinceMs: number,
): Promise<VerifyResult | null> {
  if (!ZERION_API_KEY) return null;

  const chainMap: Record<string, string> = {
    ethereum: "ethereum", base: "base", arbitrum: "arbitrum",
    solana: "solana", sui: "sui",
  };
  const chainFilter = chainMap[chain] ?? chain;

  const res = await fetch(
    `${ZERION_BASE}/wallets/${address}/transactions/?filter[chain_ids]=${chainFilter}&page[size]=10`,
    {
      headers: {
        accept: "application/json",
        authorization: `Basic ${btoa(ZERION_API_KEY + ":")}`,
      },
    },
  );

  if (!res.ok) return null;
  const data = await res.json();
  const items = data.data ?? [];

  for (const item of items) {
    const attrs = item.attributes;
    if (!attrs) continue;

    const txTime = new Date(attrs.mined_at ?? 0).getTime();
    if (txTime < sinceMs) continue;

    // Check transfers for incoming value
    const transfers = attrs.transfers ?? [];
    for (const transfer of transfers) {
      if (transfer.direction === "in" && transfer.value >= amount * 0.99) {
        const hash = attrs.hash ?? item.id;
        const explorerFn = EXPLORER_TX[chain];
        return {
          confirmed: true,
          txHash: hash,
          explorerUrl: explorerFn ? explorerFn(hash) : undefined,
          receivedAmount: transfer.value,
          from: attrs.sent_from,
        };
      }
    }
  }

  return null;
}

/**
 * Poll for payment confirmation. Checks every pollIntervalMs for up to timeoutMs.
 */
export async function verifyPayment(req: VerifyRequest): Promise<VerifyResult> {
  const timeoutMs = req.timeoutMs ?? 5 * 60 * 1000; // 5 minutes
  const pollIntervalMs = req.pollIntervalMs ?? 10_000; // 10 seconds
  const sinceMs = new Date(req.since).getTime();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let result: VerifyResult | null = null;

    try {
      if (req.chain === "xrpl") {
        result = await checkXrpl(req.address, req.amount, req.destinationTag, sinceMs);
      } else {
        result = await checkZerion(req.address, req.amount, req.chain, sinceMs);
      }
    } catch {
      // Ignore transient errors, keep polling
    }

    if (result?.confirmed) return result;

    // Wait before next poll
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return {
    confirmed: false,
    error: `Payment not detected within ${Math.round(timeoutMs / 60000)} minutes`,
  };
}
