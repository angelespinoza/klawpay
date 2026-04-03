/**
 * KlawPay — OpenClaw Plugin Entry Point
 *
 * Registers payment and refund tools.
 * Payments use a two-step flow: requestPayment (show address + QR) → verifyPayment (confirm on-chain).
 * Skills are loaded from src/skills/ by the manifest.
 */

import * as clawrevert from "./clawrevert";
import { requestPayment } from "./tools/requestPayment";
import { verifyPayment } from "./tools/verifyPayment";

interface ToolParams {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (id: string, params: any) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

interface PluginApi {
  registerTool(tool: ToolParams, opts?: { optional?: boolean }): void;
}

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

export default {
  id: "klawpay",
  name: "KlawPay",
  description: "Accept crypto payments and process refunds across XRPL, Sui, Solana, and EVM chains",

  register(api: PluginApi) {
    // ── Tool: klawpay_pay ───────────────────────────
    api.registerTool({
      name: "klawpay_pay",
      description:
        "Generate payment instructions for a client. Returns the merchant wallet address, QR code, and destination tag (XRPL). " +
        "Then automatically polls the blockchain to confirm when payment arrives. " +
        "Two-step: first shows payment details, then confirms on-chain.",
      parameters: {
        type: "object",
        required: ["amount", "currency", "chain"],
        properties: {
          amount: { type: "number", description: "Amount to pay" },
          currency: { type: "string", description: "Token symbol (XRP, ETH, SOL, SUI, USDC)" },
          chain: {
            type: "string",
            enum: ["xrpl", "sui", "solana", "base", "ethereum", "arbitrum", "avalanche"],
            description: "Blockchain to use",
          },
          clientName: { type: "string", description: "Name of the payer" },
          merchantId: { type: "string", description: "Merchant ID (from registration)" },
        },
      },
      async execute(_id, params) {
        try {
          // Step 1: Generate payment instructions
          const instructions = await requestPayment({
            amount: params.amount,
            currency: params.currency,
            chain: params.chain,
            clientName: params.clientName ?? "client",
            merchantId: params.merchantId ?? "default",
          });

          const destTagLine = instructions.destinationTag
            ? `Destination Tag: ${instructions.destinationTag}\n`
            : "";

          const step1 = [
            `Payment request created (ID: ${instructions.paymentId})`,
            ``,
            `Send exactly ${instructions.amount} ${instructions.currency} to:`,
            `Address: ${instructions.address}`,
            destTagLine,
            `Chain: ${instructions.chain}`,
            `QR Code: ${instructions.qrDataUrl}`,
            `Explorer: ${instructions.explorerUrl}`,
            ``,
            `Waiting for payment confirmation...`,
          ].filter(Boolean).join("\n");

          // Step 2: Poll for confirmation (up to 5 minutes)
          const verification = await verifyPayment({
            address: instructions.address,
            amount: instructions.amount,
            currency: instructions.currency,
            chain: instructions.chain,
            destinationTag: instructions.destinationTag,
            since: instructions.createdAt,
          });

          if (verification.confirmed) {
            return text(
              step1 + "\n\n" +
              `Payment confirmed!\n` +
              `TX: ${verification.txHash}\n` +
              `From: ${verification.from ?? "unknown"}\n` +
              `Amount received: ${verification.receivedAmount} ${instructions.currency}\n` +
              `Explorer: ${verification.explorerUrl}`
            );
          } else {
            return text(
              step1 + "\n\n" +
              `Payment not yet detected. ${verification.error ?? ""}\n` +
              `The address remains valid — payment can still be sent.\n` +
              `Address: ${instructions.address}`
            );
          }
        } catch (err: any) {
          return text(`Payment request failed: ${err.message}`);
        }
      },
    });

    // ── Tool: klawpay_refund ────────────────────────
    api.registerTool({
      name: "klawpay_refund",
      description: "Request a crypto refund. Evaluates the refund against the merchant's policy (time window, amount cap, rate limits) and executes on-chain if approved.",
      parameters: {
        type: "object",
        required: ["txHash", "chain", "walletAddress", "amount", "currency", "reason"],
        properties: {
          txHash: { type: "string", description: "Original payment transaction hash" },
          chain: {
            type: "string",
            enum: ["xrpl", "sui", "solana", "base", "ethereum", "arbitrum", "avalanche"],
            description: "Blockchain of the original payment",
          },
          walletAddress: { type: "string", description: "Wallet address to refund to" },
          amount: { type: "number", description: "Refund amount" },
          currency: { type: "string", description: "Token symbol" },
          reason: {
            type: "string",
            enum: ["duplicate_charge", "wrong_amount", "service_not_delivered", "unauthorized_transaction", "merchant_error"],
            description: "Reason for the refund",
          },
          description: { type: "string", description: "Additional details about the refund" },
        },
      },
      async execute(_id, params) {
        try {
          const result = await clawrevert.refund({
            txHash: params.txHash,
            chain: params.chain,
            walletAddress: params.walletAddress,
            amount: params.amount,
            currency: params.currency,
            reason: params.reason,
            description: params.description,
          });

          if (result.status === "approved") {
            return text(
              `Refund approved!\n` +
              `Request ID: ${result.requestId}\n` +
              `TX: ${result.txHash ?? "pending"}\n` +
              `Amount: ${result.amount} ${result.currency}\n` +
              `Sent to: ${result.recipient}`
            );
          } else if (result.status === "denied") {
            return text(
              `Refund denied.\n` +
              `Request ID: ${result.requestId}\n` +
              `Reason: ${result.reason}`
            );
          } else {
            return text(
              `Refund approved but execution pending.\n` +
              `Request ID: ${result.requestId}\n` +
              `Error: ${result.error}\n` +
              `The refund will be retried.`
            );
          }
        } catch (err: any) {
          return text(`Refund request failed: ${err.message}`);
        }
      },
    });

    // ── Tool: klawpay_audit ─────────────────────────
    api.registerTool({
      name: "klawpay_audit",
      description: "Fetch the recent audit log of payments and refunds.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of entries to return (default: 10)" },
        },
      },
      async execute(_id, params) {
        try {
          const log = await clawrevert.getAuditLog();
          const entries = log.slice(-(params.limit ?? 10));
          if (entries.length === 0) return text("No audit entries found.");

          const lines = entries.map((e) => {
            const d = e.data as Record<string, any>;
            return `[${e.timestamp}] ${e.event} — ${d.amount ?? ""} ${d.currency ?? ""} ${d.chain ?? ""}`.trim();
          });
          return text(lines.join("\n"));
        } catch (err: any) {
          return text(`Audit log error: ${err.message}`);
        }
      },
    }, { optional: true });

    // ── Tool: klawpay_health ────────────────────────
    api.registerTool({
      name: "klawpay_health",
      description: "Check the health of the ClawRevert backend and KlawPay connectivity.",
      parameters: {
        type: "object",
        properties: {},
      },
      async execute() {
        try {
          const status = await clawrevert.health();
          return text(`ClawRevert API: ${status.status === "ok" ? "healthy" : "unhealthy"}`);
        } catch (err: any) {
          return text(`Health check failed: ${err.message}`);
        }
      },
    }, { optional: true });
  },
};
