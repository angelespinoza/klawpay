/**
 * OWS wallet helpers.
 *
 * Reuses the clawrevert-agent wallet already in the local OWS vault.
 * No key duplication — calls the OWS CLI directly.
 */

const OWS_WALLET = process.env.OWS_WALLET ?? "clawrevert-agent";

export interface WalletInfo {
  name: string;
  addresses: Record<string, string>;
}

async function ows(args: string[]): Promise<string> {
  const proc = Bun.spawn(["ows", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`OWS error: ${stderr.trim() || stdout.trim()}`);
  return stdout.trim();
}

/** Get wallet addresses from the shared clawrevert-agent wallet. */
export async function getWalletInfo(): Promise<WalletInfo> {
  const raw = await ows(["wallet", "list"]);
  const addresses: Record<string, string> = {};

  for (const line of raw.split("\n")) {
    const match = line.match(/^\s+([\w:.]+)\s.*→\s+(\S+)/);
    if (match) {
      addresses[match[1]] = match[2];
    }
  }

  return { name: OWS_WALLET, addresses };
}

/** Sign a message using the shared wallet. */
export async function signMessage(
  chain: string,
  message: string,
): Promise<string> {
  return ows([
    "sign", "message",
    "--chain", chain,
    "--wallet", OWS_WALLET,
    "--message", message,
    "--json",
  ]);
}
