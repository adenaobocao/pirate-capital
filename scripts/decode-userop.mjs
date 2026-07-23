import fs from "node:fs";
import { decodeFunctionData, parseAbi, slice } from "viem";

const hex = fs.readFileSync("/tmp/tx_8697c362.hex", "utf-8").trim();

// ERC-4337 v0.7 EntryPoint.handleOps
const entryAbi = parseAbi([
  "function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] ops, address beneficiary)",
]);

const { functionName, args } = decodeFunctionData({ abi: entryAbi, data: hex });
console.log("entrypoint call:", functionName);
const ops = args[0];
console.log("userOps:", ops.length);

// common smart-account execute signatures
const acctAbis = [
  parseAbi(["function execute(address target, uint256 value, bytes data)"]),
  parseAbi(["function executeUserOp(address target, uint256 value, bytes data)"]),
  parseAbi(["function execute(address target, uint256 value, bytes data, uint8 operation)"]),
  parseAbi(["function executeBatch(address[] target, uint256[] value, bytes[] data)"]),
  parseAbi(["function executeBatch((address target,uint256 value,bytes data)[] calls)"]),
];

for (let i = 0; i < ops.length; i++) {
  const cd = ops[i].callData;
  console.log(`\n--- userOp[${i}] sender=${ops[i].sender} ---`);
  console.log("callData selector:", slice(cd, 0, 4));
  let decoded = null;
  for (const abi of acctAbis) {
    try {
      decoded = decodeFunctionData({ abi, data: cd });
      break;
    } catch {}
  }
  if (!decoded) {
    console.log("  (account execute sig unknown; inner selector above)");
    continue;
  }
  console.log("  account fn:", decoded.functionName);
  // single execute
  if (decoded.functionName.startsWith("execute") && decoded.args.length >= 3 && typeof decoded.args[0] === "string") {
    const target = decoded.args[0];
    const inner = decoded.args[2];
    console.log("  -> SWAP TARGET:", target);
    console.log("  -> inner selector:", slice(inner, 0, 4));
    console.log("  -> inner len:", inner.length);
  } else {
    // batch
    const calls = decoded.args[0];
    console.log("  batch calls:", Array.isArray(calls) ? calls.length : "?");
    if (Array.isArray(calls)) {
      for (const c of calls) {
        const target = c.target ?? c[0];
        const data = c.data ?? c[2];
        console.log("     target:", target, "selector:", data ? slice(data, 0, 4) : "?");
      }
    }
  }
}
