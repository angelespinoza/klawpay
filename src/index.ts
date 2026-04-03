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

app.get("/health", async (c) => {
  const status = await klawpay.status();
  return c.json(status);
});

app.get("/wallet", async (c) => {
  const addresses = await klawpay.walletAddresses();
  return c.json(addresses);
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

app.get("/audit", async (c) => {
  const limit = Number(c.req.query("limit") ?? 10);
  const log = await klawpay.audit(limit);
  return c.json(log);
});

app.post("/sign", async (c) => {
  const { chain, message } = await c.req.json();
  const sig = await klawpay.sign(chain, message);
  return c.json(JSON.parse(sig));
});

console.log(`🔌 klawpay plugin listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
