/**
 * ClawRevert API client.
 *
 * All refund logic, policy evaluation, chain execution, and audit logging
 * live in the ClawRevert service. KlawPay calls it over HTTP — no code duplication.
 */

const BASE_URL = process.env.CLAWREVERT_URL ?? "https://clawrevert-production.up.railway.app";

export interface PaymentRequest {
  clientName: string;
  amount: number;
  currency: string;
  chain: string;
}

export interface PaymentResult {
  txHash: string;
  walletAddress: string;
  senderAddress: string;
  explorerUrl: string;
  network: string;
  clientName: string;
  amount: number;
  currency: string;
  chain: string;
  timestamp: string;
}

export interface RefundRequest {
  txHash: string;
  chain: string;
  walletAddress: string;
  amount: number;
  currency: string;
  reason: string;
  description?: string;
}

export interface RefundResult {
  requestId: string;
  status: "approved" | "denied" | "error";
  reason?: string;
  error?: string;
  txHash?: string;
  amount?: number;
  currency?: string;
  recipient?: string;
  chain?: string;
}

export interface AuditEntry {
  requestId: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const body = await res.json();

  if (!res.ok && !body.requestId) {
    throw new Error(body.error ?? `ClawRevert API error: ${res.status}`);
  }

  return body as T;
}

/** Send a demo payment on testnet via ClawRevert. */
export async function pay(req: PaymentRequest): Promise<PaymentResult> {
  return request<PaymentResult>("/api/demo/payment", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/** Request a refund via ClawRevert's policy engine + chain executors. */
export async function refund(req: RefundRequest): Promise<RefundResult> {
  return request<RefundResult>("/api/refund", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/** Fetch the audit log from ClawRevert. */
export async function getAuditLog(): Promise<AuditEntry[]> {
  return request<AuditEntry[]>("/api/audit");
}

/** Health check. */
export async function health(): Promise<{ status: string }> {
  return request<{ status: string }>("/api/health");
}
