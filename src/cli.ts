/**
 * KlawPay CLI — quick command-line access to pay/refund/audit.
 *
 * Usage:
 *   bun run src/cli.ts status
 *   bun run src/cli.ts pay --amount 10 --currency XRP --chain xrpl
 *   bun run src/cli.ts refund --txHash ABC --chain xrpl --wallet rXXX --amount 10 --currency XRP --reason duplicate_charge
 *   bun run src/cli.ts audit
 *   bun run src/cli.ts wallet
 */

import { KlawPay } from "./plugin";

const klawpay = new KlawPay();
const [cmd, ...rest] = process.argv.slice(2);

function flag(name: string): string {
  const idx = rest.indexOf(`--${name}`);
  return idx >= 0 && rest[idx + 1] ? rest[idx + 1] : "";
}

async function main() {
  switch (cmd) {
    case "status": {
      const s = await klawpay.status();
      console.log("API reachable:", s.api);
      console.log("Wallet:", s.wallet.name);
      console.log("Chains:", s.wallet.chains.join(", "));
      break;
    }

    case "pay": {
      const result = await klawpay.pay({
        amount: Number(flag("amount")),
        currency: flag("currency"),
        chain: flag("chain") as any,
        clientName: flag("client") || "klawpay-cli",
      });
      console.log("TX:", result.txHash);
      console.log("To:", result.walletAddress);
      console.log("Explorer:", result.explorerUrl);
      break;
    }

    case "refund": {
      const result = await klawpay.refund({
        txHash: flag("txHash"),
        chain: flag("chain") as any,
        walletAddress: flag("wallet"),
        amount: Number(flag("amount")),
        currency: flag("currency"),
        reason: flag("reason"),
      });
      console.log("Status:", result.status);
      if (result.reason) console.log("Reason:", result.reason);
      if (result.txHash) console.log("TX:", result.txHash);
      break;
    }

    case "audit": {
      const log = await klawpay.audit(Number(flag("limit")) || 10);
      for (const entry of log) {
        console.log(`[${entry.timestamp}] ${entry.event}`, JSON.stringify(entry.data));
      }
      break;
    }

    case "wallet": {
      const addrs = await klawpay.walletAddresses();
      for (const [chain, addr] of Object.entries(addrs)) {
        console.log(`${chain} → ${addr}`);
      }
      break;
    }

    default:
      console.log("Usage: klawpay <status|pay|refund|audit|wallet>");
      console.log("");
      console.log("  status                          Check API + wallet connectivity");
      console.log("  pay --amount N --currency C --chain CH");
      console.log("  refund --txHash H --chain CH --wallet W --amount N --currency C --reason R");
      console.log("  audit [--limit N]               Last N audit entries");
      console.log("  wallet                          Show OWS wallet addresses");
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
