import { applyAgentCommand, readCureLedger } from "../../../lib/cureledger-store";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const state = await readCureLedger();
      return res.status(200).json(state);
    }

    if (req.method === "POST") {
      const { message, appState } = req.body || {};
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const result = await applyAgentCommand(message, appState);
      return res.status(200).json(result);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
