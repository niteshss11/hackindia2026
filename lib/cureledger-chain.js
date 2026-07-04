import { ethers } from "ethers";

const auditContractAbi = [
  "function logAudit(string _action, string _detail) public",
];

const hardhatAdminPrivateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function contractAddress() {
  const value =
    process.env.HEALTH_CARE_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_HEALTH_CARE ||
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "";
  if (!value || /DEPLOYED|PASTE|YOUR/i.test(value)) return "";
  return value.trim();
}

export async function commitAuditProof(entry) {
  const address = contractAddress();
  if (!address) {
    return {
      chainStatus: "chain-error",
      blockchainError: "Contract address is not configured.",
    };
  }

  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
    const privateKey = process.env.LOCAL_CHAIN_PRIVATE_KEY || hardhatAdminPrivateKey;
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(address, auditContractAbi, wallet);
    const detail = [entry.details, entry.actor && `actor=${entry.actor}`, entry.target && `target=${entry.target}`]
      .filter(Boolean)
      .join(" | ");
    const tx = await contract.logAudit(entry.action || "AuditLogged", detail);
    await tx.wait();
    return {
      txHash: tx.hash,
      chainStatus: "confirmed",
      blockchainError: "",
    };
  } catch (error) {
    return {
      chainStatus: "chain-error",
      blockchainError: error?.reason || error?.message || "Blockchain commit failed.",
    };
  }
}
