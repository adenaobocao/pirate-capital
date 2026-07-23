import fs from "node:fs";
import { decodeFunctionData, parseAbi, slice, size } from "viem";

const hex = fs.readFileSync("/tmp/real_9d3aed9d.hex", "utf-8").trim();

// selector 0x4c067550 = execute(address,(bytes,bytes),bytes)
const abi = parseAbi(["function execute(address to, (bytes a, bytes b) payload, bytes extra)"]);
const { args } = decodeFunctionData({ abi, data: hex });
const [target, payload, extra] = args;

console.log("wrapper forwards to target:", target);
console.log("payload.a len:", size(payload.a), "selector:", size(payload.a) >= 4 ? slice(payload.a, 0, 4) : "-");
console.log("payload.b len:", size(payload.b), "selector:", size(payload.b) >= 4 ? slice(payload.b, 0, 4) : "-");
console.log("extra (the suspicious signed blob) len:", size(extra));
console.log("extra head:", size(extra) >= 4 ? slice(extra, 0, 4) : "-");
// a 65-byte ECDSA sig or a struct with sig+price+expiry would show here
console.log("extra full (first 260 hex chars):", extra.slice(0, 260));

// try to see if payload.a is a standard UniversalRouter execute(commands,inputs,deadline)
try {
  const ur = parseAbi(["function execute(bytes commands, bytes[] inputs, uint256 deadline)"]);
  const inner = decodeFunctionData({ abi: ur, data: payload.a });
  console.log("\npayload.a IS UniversalRouter.execute:");
  console.log("  commands bytes:", inner.args[0]);
  console.log("  inputs count:", inner.args[1].length);
  console.log("  deadline:", inner.args[2].toString());
} catch (e) {
  console.log("\npayload.a not standard UR.execute:", String(e).slice(0, 60));
}
