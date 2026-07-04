import { collectionHandler } from "../../lib/cureledger-api";
import { applyAgentAction } from "../../lib/cureledger-store";

export default async function handler(req, res) {
  if (req.method === "POST" && req.body?.analyze) {
    const message = req.body?.message || `Analyze report for ${req.body?.patientName || "selected patient"}`;
    const result = await applyAgentAction(
      {
        intent: "ANALYZE_REPORT",
        uiAction: "ANALYZE_REPORT",
        data: req.body,
        message: "Report analysis saved.",
      },
      message,
      req.body?.state || {}
    );
    return res.status(200).json(result);
  }

  return collectionHandler(req, res, "reports");
}
