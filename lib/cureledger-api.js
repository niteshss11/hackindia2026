import { readCureLedger, writeCureLedger } from "./cureledger-store";

const collectionMap = {
  patients: "patients",
  doctors: "doctors",
  appointments: "appointments",
  records: "records",
  reports: "reports",
  consent: "permissions",
  permissions: "permissions",
  claims: "claims",
  audit: "audit",
};

export async function collectionHandler(req, res, collectionName) {
  const key = collectionMap[collectionName];
  if (!key) return res.status(404).json({ error: "Unknown collection" });

  const data = await readCureLedger();

  if (req.method === "GET") {
    return res.status(200).json(data[key] || []);
  }

  if (req.method === "POST") {
    const item = {
      id: req.body?.id || `${collectionName}-${Date.now()}`,
      ...req.body,
      createdAt: req.body?.createdAt || new Date().toISOString(),
    };
    data[key] = [item, ...(data[key] || [])];
    await writeCureLedger(data);
    return res.status(201).json(item);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}

export async function itemHandler(req, res, collectionName) {
  const key = collectionMap[collectionName];
  if (!key) return res.status(404).json({ error: "Unknown collection" });

  const { id } = req.query;
  const data = await readCureLedger();
  const items = data[key] || [];
  const index = items.findIndex((item) => item.id === id);

  if (req.method === "GET") {
    if (index === -1) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(items[index]);
  }

  if (req.method === "PATCH") {
    if (index === -1) return res.status(404).json({ error: "Not found" });
    items[index] = { ...items[index], ...req.body };
    await writeCureLedger(data);
    return res.status(200).json(items[index]);
  }

  if (req.method === "DELETE") {
    if (index === -1) return res.status(404).json({ error: "Not found" });
    const [removed] = items.splice(index, 1);
    await writeCureLedger(data);
    return res.status(200).json(removed);
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
