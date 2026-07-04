import { readCureLedger, writeCureLedger } from "../../lib/cureledger-store";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const data = await readCureLedger();
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const current = await readCureLedger();
      const next = { ...current, ...(req.body || {}) };
      await writeCureLedger(next);
      return res.status(200).json(next);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
