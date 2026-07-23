import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { AGENTS } from "../config/agents.js";

/**
 * Wallet vault: one fresh EOA per pirate, keys stored ONLY on this machine,
 * outside the repo, chmod 600. This script prints public addresses only; the
 * private keys never touch stdout, the repo, git, or any deploy.
 *
 *   npm run wallets:gen     # generate missing wallets (idempotent, never overwrites)
 *   npm run wallets:show    # print public addresses only
 *
 * The vault path can be overridden with PIRATE_VAULT (default ~/.pirate-capital/keys.json).
 * Fund each address yourself. The executor reads keys from this file at runtime.
 */

export interface WalletEntry {
  id: string;
  address: `0x${string}`;
  privateKey: `0x${string}`;
  createdAt: string;
}

export function vaultPath(): string {
  return process.env.PIRATE_VAULT ?? path.join(os.homedir(), ".pirate-capital", "keys.json");
}

export function loadVault(): Record<string, WalletEntry> {
  const file = vaultPath();
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, WalletEntry>;
}

function saveVault(vault: Record<string, WalletEntry>): void {
  const file = vaultPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(vault, null, 2));
  fs.chmodSync(file, 0o600);
  fs.chmodSync(path.dirname(file), 0o700);
}

/** Returns the account for a pirate, or null if not yet generated. */
export function accountFor(id: string) {
  const vault = loadVault();
  const entry = vault[id];
  return entry ? privateKeyToAccount(entry.privateKey) : null;
}

function generate(): void {
  const vault = loadVault();
  let created = 0;
  for (const persona of AGENTS) {
    if (vault[persona.id]) continue;
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    vault[persona.id] = {
      id: persona.id,
      address: account.address,
      privateKey: pk,
      createdAt: new Date().toISOString(),
    };
    created++;
  }
  if (created > 0) saveVault(vault);

  console.log(`\nwallet vault: ${vaultPath()}`);
  console.log(created > 0 ? `generated ${created} new wallet(s). keys are on this machine only.\n` : `all wallets already exist. nothing generated.\n`);
  show(vault);
  console.log("\nfund each address with your $100. the private keys never leave this file.");
  console.log("back up this file somewhere safe and offline. if you lose it, the wallets are gone.\n");
}

function show(vault?: Record<string, WalletEntry>): void {
  const v = vault ?? loadVault();
  for (const persona of AGENTS) {
    const entry = v[persona.id];
    console.log(`  ${persona.name.padEnd(8)} ${entry ? entry.address : "(not generated)"}`);
  }
}

const mode = process.argv[2];
if (mode === "show") {
  console.log(`\nwallet vault: ${vaultPath()}\n`);
  show();
  console.log();
} else {
  generate();
}
