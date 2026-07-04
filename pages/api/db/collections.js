import { readCureLedger } from "../../../lib/cureledger-store";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = await readCureLedger();
  return res.status(200).json({
    storage: data.storage,
    collections: {
      patients: data.patients || [],
      doctors: data.doctors || [],
      appointments: data.appointments || [],
      records: data.records || [],
      reports: data.reports || [],
      permissions: data.permissions || [],
      claims: data.claims || [],
      prescriptions: data.prescriptions || [],
      accessRequests: data.accessRequests || [],
      audit: data.audit || [],
      aiMemory: data.aiMemory || [],
      roleSessions: data.roleSessions || [],
      track4Trace: data.track4Trace || [],
      agentState: [data.agentState || {}],
    },
  });
}
