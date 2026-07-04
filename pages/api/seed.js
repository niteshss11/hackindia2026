import fs from "fs/promises";
import path from "path";
import { seedCureLedger } from "../../lib/cureledger-store";

export default async function handler(req, res) {
  if (!["POST", "GET"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const seedPath = path.join(process.cwd(), "data", "cureledger-seed.json");
  const seed = JSON.parse(await fs.readFile(seedPath, "utf8"));
  const state = await seedCureLedger(seed);
  return res.status(200).json({ ok: true, state });
}
