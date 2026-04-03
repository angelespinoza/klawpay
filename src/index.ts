/**
 * KlawPay server — thin proxy + plugin API on top of ClawRevert.
 *
 * Runs on port 3001 (separate from ClawRevert's 3000).
 * Delegates all refund/payment logic to the live ClawRevert API.
 */

import { Hono } from "hono";
import { KlawPay } from "./plugin";

const port = Number(process.env.PORT ?? 3001);
const klawpay = new KlawPay();

const app = new Hono();

// ── Static: dashboard ───────────────────────────────

const dashboardHtml = await Bun.file(new URL("../dashboard/index.html", import.meta.url)).text();
const dashboardJs = await Bun.file(new URL("../dashboard/dashboard.jsx", import.meta.url)).text();

app.get("/dashboard", (c) => c.html(dashboardHtml));
app.get("/dashboard/dashboard.js", (c) => {
  return new Response(dashboardJs, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
});

// ── Core proxy endpoints ────────────────────────────

app.get("/health", async (c) => {
  try {
    const status = await klawpay.status();
    return c.json(status);
  } catch {
    // OWS may not be available on Railway — just check API
    const apiOk = await fetch(process.env.CLAWREVERT_URL ?? "https://clawrevert-production.up.railway.app" + "/api/health")
      .then((r) => r.ok).catch(() => false);
    return c.json({ api: apiOk, wallet: { name: "unavailable (no ows)", chains: [] } });
  }
});

app.get("/wallet", async (c) => {
  try {
    const addresses = await klawpay.walletAddresses();
    return c.json(addresses);
  } catch {
    return c.json({ error: "OWS not available on this host" }, 503);
  }
});

app.post("/pay", async (c) => {
  const body = await c.req.json();
  const result = await klawpay.pay(body);
  return c.json(result);
});

app.post("/refund", async (c) => {
  const body = await c.req.json();
  const result = await klawpay.refund(body);
  return c.json(result);
});

app.get("/api/audit", async (c) => {
  const limit = Number(c.req.query("limit") ?? 20);
  const log = await klawpay.audit(limit);
  return c.json(log);
});

app.get("/audit", async (c) => {
  const limit = Number(c.req.query("limit") ?? 10);
  const log = await klawpay.audit(limit);
  return c.json(log);
});

app.post("/sign", async (c) => {
  try {
    const { chain, message } = await c.req.json();
    const sig = await klawpay.sign(chain, message);
    return c.json(JSON.parse(sig));
  } catch {
    return c.json({ error: "OWS not available on this host" }, 503);
  }
});

// ── Merchant registration ───────────────────────────

interface MerchantConfig {
  merchantId: string;
  businessName: string;
  whatsapp: string;
  chains: string[];
  policy: {
    autoWindow: string;
    autoUnder: number;
    maxRefunds: number;
  };
  wallets: Record<string, string>;
  createdAt: string;
}

const merchants = new Map<string, MerchantConfig>();

app.post("/api/merchants/register", async (c) => {
  const body = await c.req.json();
  const { businessName, whatsapp, chains, policy } = body;

  if (!businessName) {
    return c.json({ error: "businessName is required" }, 400);
  }

  const merchantId = crypto.randomUUID().slice(0, 8);
  const walletName = `klawpay-${merchantId}`;

  // Create wallet via OWS CLI (only works when OWS is installed locally)
  let wallets: Record<string, string> = {};
  try {
    const proc = Bun.spawn(["ows", "wallet", "create", "--name", walletName], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;

    if (code !== 0) {
      throw new Error(stderr.trim() || stdout.trim());
    }

    // Parse wallet addresses from output
    for (const line of stdout.split("\n")) {
      const match = line.match(/^\s+([\w:.\-]+)\s.*→\s+(\S+)/);
      if (match) {
        const chainId = match[1];
        const addr = match[2];
        if (chainId.startsWith("eip155")) wallets["evm"] = addr;
        else if (chainId.startsWith("solana")) wallets["solana"] = addr;
        else if (chainId.startsWith("sui")) wallets["sui"] = addr;
        else wallets[chainId] = addr;
      }
    }
  } catch {
    // OWS not available (e.g. on Railway) — register without wallet creation
    // Merchant can create wallets locally and link later
    wallets = { note: "OWS not available on this host. Run locally to create wallets." };
  }

  const merchant: MerchantConfig = {
    merchantId,
    businessName,
    whatsapp: whatsapp ?? "",
    chains: chains ?? ["xrpl"],
    policy: {
      autoWindow: policy?.autoWindow ?? "72h",
      autoUnder: policy?.autoUnder ?? 50,
      maxRefunds: policy?.maxRefunds ?? 3,
    },
    wallets,
    createdAt: new Date().toISOString(),
  };

  merchants.set(merchantId, merchant);

  return c.json(merchant);
});

app.get("/api/merchants/:id", (c) => {
  const id = c.req.param("id");
  const merchant = merchants.get(id);
  if (!merchant) return c.json({ error: "Merchant not found" }, 404);
  return c.json(merchant);
});

// ── Start ───────────────────────────────────────────

console.log(`🔌 klawpay listening on http://localhost:${port}`);
console.log(`📊 dashboard at http://localhost:${port}/dashboard`);

export default {
  port,
  fetch: app.fetch,
};
