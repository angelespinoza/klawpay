/**
 * KlawPay plugin — the main interface that other OpenClaw plugins consume.
 *
 * Composes the ClawRevert API client + OWS wallet into a single
 * high-level API for payment and refund workflows.
 */

import * as clawrevert from "./clawrevert";
import * as ows from "./ows";

export type Chain = "xrpl" | "sui" | "solana" | "base" | "ethereum" | "arbitrum" | "avalanche";

export interface KlawPayConfig {
  clawrevertUrl?: string;
  owsWallet?: string;
}

export class KlawPay {
  constructor(_config?: KlawPayConfig) {
    // Config is read from env by the underlying modules.
    // Constructor accepts it for documentation / future override.
  }

  /** Check that ClawRevert is reachable and the OWS wallet exists. */
  async status(): Promise<{
    api: boolean;
    wallet: { name: string; chains: string[] };
  }> {
    const [apiHealth, walletInfo] = await Promise.all([
      clawrevert.health().then(() => true).catch(() => false),
      ows.getWalletInfo(),
    ]);

    return {
      api: apiHealth,
      wallet: {
        name: walletInfo.name,
        chains: Object.keys(walletInfo.addresses),
      },
    };
  }

  /** Send a testnet payment via ClawRevert. Returns the real txHash + explorer link. */
  async pay(params: {
    to?: string;
    amount: number;
    currency: string;
    chain: Chain;
    clientName?: string;
  }): Promise<clawrevert.PaymentResult> {
    return clawrevert.pay({
      clientName: params.clientName ?? "klawpay",
      amount: params.amount,
      currency: params.currency,
      chain: params.chain,
    });
  }

  /** Request a refund. ClawRevert evaluates the policy and executes on-chain if approved. */
  async refund(params: {
    txHash: string;
    chain: Chain;
    walletAddress: string;
    amount: number;
    currency: string;
    reason: string;
    description?: string;
  }): Promise<clawrevert.RefundResult> {
    return clawrevert.refund(params);
  }

  /** Get the audit trail from ClawRevert. */
  async audit(limit = 10): Promise<clawrevert.AuditEntry[]> {
    const log = await clawrevert.getAuditLog();
    return log.slice(-limit);
  }

  /** Get wallet addresses from the shared OWS wallet. */
  async walletAddresses(): Promise<Record<string, string>> {
    const info = await ows.getWalletInfo();
    return info.addresses;
  }

  /** Sign an arbitrary message using the OWS wallet for a given chain. */
  async sign(chain: string, message: string): Promise<string> {
    return ows.signMessage(chain, message);
  }
}

export default KlawPay;
