import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { commitAuditProof } from "./cureledger-chain";
import { getMongoDb, getMongoStatus } from "./mongodb";

const dbPath = path.join(process.cwd(), "data", "cureledger-db.json");
const collectionNames = [
  "patients",
  "doctors",
  "appointments",
  "records",
  "reports",
  "claims",
  "permissions",
  "prescriptions",
  "accessRequests",
  "audit",
  "aiMemory",
  "roleSessions",
];
const safetyDisclaimer =
  "This AI summary is for assistance only and not a medical diagnosis. Please consult a certified doctor.";

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const titleCase = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const slug = (value) =>
  String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const localAuditHash = (value = "") =>
  `0x${crypto
    .createHash("sha256")
    .update(`${value}:${Date.now()}:${Math.random()}`)
    .digest("hex")}`;

export async function readCureLedger() {
  try {
    const db = await getMongoDb();
    const meta = (await db.collection("appState").findOne({ id: "singleton" })) || {};
    const collections = {};
    for (const name of collectionNames) {
      collections[name] = await db.collection(name).find({}).sort({ createdAt: -1 }).toArray();
      collections[name] = collections[name].map(({ _id, ...item }) => item);
    }
    return normalizeData({
      version: 3,
      ...meta.data,
      ...collections,
      storage: {
        mode: "mongodb",
        ...(await getMongoStatus()),
      },
    });
  } catch (_) {
    const raw = await fs.readFile(dbPath, "utf8");
    const data = JSON.parse(raw);
    return normalizeData({
      ...data,
      storage: {
        mode: "json-fallback",
        ...(await getMongoStatus()),
      },
    });
  }
}

export async function writeCureLedger(data) {
  const normalized = normalizeData(data);
  await fs.writeFile(dbPath, `${JSON.stringify(normalized, null, 2)}\n`);

  try {
    const db = await getMongoDb();
    for (const name of collectionNames) {
      await db.collection(name).deleteMany({});
      if (normalized[name]?.length) {
        await db.collection(name).insertMany(normalized[name]);
      }
    }
    await db.collection("appState").updateOne(
      { id: "singleton" },
      {
        $set: {
          id: "singleton",
          data: {
            version: normalized.version || 3,
            agentState: normalized.agentState,
            appState: normalized.appState,
            aiSummary: normalized.aiSummary,
            suggestedActions: normalized.suggestedActions,
            lastFocus: normalized.lastFocus,
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (_) {}

  return normalized;
}

export async function seedCureLedger(seedData) {
  const normalized = normalizeData(seedData);
  await writeCureLedger(normalized);
  return normalized;
}

function normalizeData(data) {
  data.patients ||= [];
  data.doctors ||= [];
  data.appointments ||= [];
  data.records ||= [];
  data.reports ||= [];
  data.claims ||= [];
  data.permissions ||= [];
  data.prescriptions ||= [];
  data.accessRequests ||= [];
  data.audit ||= data.ledger || [];
  data.aiMemory ||= [];
  data.roleSessions ||= [];
  data.track4Trace ||= [
    { label: "AI intent detected", status: "waiting" },
    { label: "Dynamic UI rendered", status: "waiting" },
    { label: "Backend API called", status: "waiting" },
    { label: "Database updated", status: "waiting" },
    { label: "Live UI updated", status: "waiting" },
    { label: "Blockchain audit created", status: "waiting" },
    { label: "Memory used", status: "waiting" },
    { label: "Data persisted after refresh", status: "waiting" },
  ];
  data.ledger = data.audit;
  data.timeline ||= data.audit;
  data.agentState ||= {};
  data.appState ||= {};
  data.suggestedActions ||= [];
  data.patients.forEach((patient) => {
    patient.severity ||= patient.status === "Critical" || patient.risk === "High" ? "critical" : "stable";
    patient.records ||= data.records.filter((record) => record.patientId === patient.id).map((record) => record.id);
    patient.consent ||= data.permissions
      .filter((permission) => permission.patientId === patient.id && permission.status !== "revoked")
      .map((permission) => ({
        doctorId: permission.doctorId,
        doctor: permission.doctor,
        recordId: permission.recordId,
        access: permission.access,
        expiry: permission.expiry,
        status: permission.status || "active",
      }));
  });
  return data;
}

function syncState(data, patch = {}) {
  data.agentState = {
    currentRole: "Patient",
    connectedWallet: "",
    selectedPatientId: data.patients[0]?.id || "",
    selectedDoctorId: data.doctors[0]?.id || "",
    selectedRecordId: data.records[0]?.id || "",
    selectedClaimId: data.claims[0]?.id || "",
    activePanel: "SHOW_PATIENTS",
    lastIntent: "INIT",
    lastEntity: "",
    memory: [],
    ...data.agentState,
    ...patch,
  };
  data.appState = {
    currentRole: data.agentState.currentRole,
    connectedWallet: data.agentState.connectedWallet,
    selectedPatientId: data.agentState.selectedPatientId,
    selectedDoctorId: data.agentState.selectedDoctorId,
    selectedReportId: data.agentState.selectedRecordId,
    selectedClaimId: data.agentState.selectedClaimId,
    currentSection: data.agentState.activePanel,
    recentCommand: data.agentState.lastIntent,
    ...data.appState,
    currentRole: data.agentState.currentRole,
    connectedWallet: data.agentState.connectedWallet,
    selectedPatientId: data.agentState.selectedPatientId,
    selectedDoctorId: data.agentState.selectedDoctorId,
    selectedReportId: data.agentState.selectedRecordId,
    selectedClaimId: data.agentState.selectedClaimId,
    currentSection: data.agentState.activePanel,
  };
}

function setTrack4Trace(data, intent, uiAction, audit, usedMemory = false) {
  data.track4Trace = [
    { label: "AI intent detected", status: "complete", detail: intent },
    { label: "Dynamic UI rendered", status: "complete", detail: uiAction },
    { label: "Backend API called", status: "complete", detail: "/api/agent" },
    { label: "Database updated", status: "complete", detail: data.storage?.mode || "persistent store" },
    { label: "Live UI updated", status: "complete", detail: "SSE /api/events" },
    {
      label: "Blockchain audit created",
      status: "complete",
      detail: audit?.chainStatus === "confirmed" ? audit.txHash : "local immutable audit hash",
    },
    {
      label: "Memory used",
      status: usedMemory ? "complete" : "ready",
      detail: usedMemory ? "pronoun/context resolved" : "state saved",
    },
    { label: "Data persisted after refresh", status: "complete", detail: "MongoDB or JSON fallback" },
  ];
}

function findPatient(data, value) {
  const text = String(value || "").toLowerCase();
  return (
    data.patients.find((patient) => patient.id === value) ||
    data.patients.find((patient) => patient.name.toLowerCase().includes(text)) ||
    data.patients.find((patient) => text.includes(patient.name.toLowerCase())) ||
    data.patients.find((patient) => text.includes(patient.name.split(" ")[0].toLowerCase())) ||
    data.patients.find((patient) => patient.id === data.agentState?.selectedPatientId) ||
    data.patients[0]
  );
}

function findDoctor(data, value) {
  const text = String(value || "").toLowerCase();
  return (
    data.doctors.find((doctor) => doctor.id === value) ||
    data.doctors.find((doctor) => doctor.name.toLowerCase().includes(text)) ||
    data.doctors.find((doctor) => text.includes(doctor.name.toLowerCase())) ||
    data.doctors.find((doctor) => text.includes(doctor.name.replace(/^Dr\s+/i, "").toLowerCase())) ||
    data.doctors.find((doctor) => doctor.id === data.agentState?.selectedDoctorId) ||
    data.doctors[0]
  );
}

function findClaim(data, value) {
  const text = String(value || "").toLowerCase();
  return (
    data.claims.find((claim) => claim.id === value) ||
    data.claims.find((claim) => text.includes(claim.id.toLowerCase())) ||
    data.claims.find((claim) => claim.id === data.agentState?.selectedClaimId) ||
    data.claims[0]
  );
}

function selectedRecord(data, patient, text = "") {
  const lower = String(text).toLowerCase();
  return (
    data.records.find((record) => record.id === data.agentState?.selectedRecordId) ||
    data.records.find((record) => record.patientId === patient.id && lower.includes(record.type.toLowerCase())) ||
    data.records.find((record) => record.patientId === patient.id) ||
    data.records[0]
  );
}

function addAudit(data, action, actor, target, details, chainStatus = "pending-chain") {
  const audit = {
    id: `aud-${Date.now()}`,
    action,
    actor,
    target,
    details,
    txHash: chainStatus === "pending-chain" ? "" : localAuditHash(`${action}:${target}:${details}`),
    chainStatus,
    fallbackMessage:
      chainStatus === "local-proof"
        ? "Blockchain unavailable, local immutable audit hash created for demo."
        : "",
    createdAt: nowIso(),
  };
  data.audit.unshift(audit);
  data.ledger = data.audit;
  data.timeline = data.audit;
  return audit;
}

const onChainAuditActions = new Set([
  "PatientRegistered",
  "DoctorRegistered",
  "AppointmentBooked",
  "RecordUploaded",
  "ReportAnalyzed",
  "AccessGranted",
  "AccessRevoked",
  "AccessRequested",
  "EmergencyAccessRequested",
  "ClaimCreated",
  "ClaimApproved",
  "ClaimRejected",
  "PrescriptionAdded",
  "DiagnosisAdded",
  "PatientUpdated",
  "PatientDeleted",
]);

async function commitAuditIfNeeded(audit) {
  if (!audit || !onChainAuditActions.has(audit.action)) return audit;
  const result = await commitAuditProof(audit);
  audit.txHash = result.txHash || audit.txHash || localAuditHash(`${audit.action}:${audit.target}:${audit.details}`);
  audit.chainStatus = result.chainStatus || audit.chainStatus;
  if (result.blockchainError) {
    audit.blockchainError = result.blockchainError;
    audit.chainStatus = "local-proof";
    audit.fallbackMessage = "Blockchain unavailable, local immutable audit hash created for demo.";
  }
  return audit;
}

function severityFromText(text, fallback = "stable") {
  const lower = String(text || "").toLowerCase();
  if (/critical|severe|high|emergency/.test(lower)) return "critical";
  if (/moderate|medium|watch/.test(lower)) return "moderate";
  if (/stable|normal|low|fine/.test(lower)) return "stable";
  return fallback;
}

function riskFromSeverity(severity) {
  if (severity === "critical") return "High";
  if (severity === "moderate") return "Moderate";
  return "Normal";
}

function extractPatientName(text) {
  const match =
    text.match(/(?:add|create|register)\s+patient\s+([a-z ]+?)(?:\s+with|\s+age|\s+condition|$)/i) ||
    text.match(/(?:for|select|open|show|update|delete|remove)\s+patient\s+([a-z ]+)/i) ||
    text.match(/(?:for|select|open|show|update|delete|remove)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  return match ? titleCase(match[1]) : "";
}

function extractDoctorName(text) {
  const match =
    text.match(/(?:add|register)\s+doctor\s+(dr\.?\s*)?([a-z ]+?)(?:\s+cardiologist|\s+dermatologist|\s+neurologist|\s+physician|\s+specialist|$)/i) ||
    text.match(/(dr\.?\s+[a-z]+)/i);
  if (!match) return "";
  const name = titleCase((match[1] || "Dr ") + (match[2] || ""));
  return name.startsWith("Dr") ? name.replace("Dr.", "Dr") : `Dr ${name}`;
}

function extractSpecialization(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("cardiologist")) return "Cardiologist";
  if (lower.includes("dermatologist")) return "Dermatologist";
  if (lower.includes("neurologist")) return "Neurologist";
  if (lower.includes("physician")) return "General Physician";
  if (lower.includes("orthopedic")) return "Orthopedic";
  return "General Physician";
}

function localGeneralAnswer(text) {
  const lower = String(text || "").toLowerCase();
  if (/diabetes|sugar|glucose|insulin/.test(lower)) {
    return `Diabetes is a condition where the body has trouble controlling blood sugar. It can happen when the body does not make enough insulin or cannot use insulin well. Common care includes regular monitoring, food planning, exercise, medicine when prescribed, and doctor follow-up. ${safetyDisclaimer}`;
  }
  if (/blockchain|ledger|transaction|tx|smart contract/.test(lower)) {
    return "Blockchain is a shared, tamper-resistant ledger. In CureLedger, MongoDB stores the actual healthcare data, while blockchain stores proof that key actions happened, such as record uploads, consent changes, and claim decisions.";
  }
  if (/insurance|claim|approval|reject/.test(lower)) {
    return "Insurance approval usually checks whether the patient, treatment, documents, consent, and policy rules match. CureLedger helps by building a claim proof packet with records, AI summary, consent proof, and blockchain audit history.";
  }
  if (/consent|permission|access/.test(lower)) {
    return "Consent means the patient controls who can access their medical records and for how long. CureLedger records grant/revoke actions in MongoDB and can commit proof of those actions to blockchain.";
  }
  if (/cureledger|this app|platform/.test(lower)) {
    return "CureLedger AI is a healthcare operating system with patient, doctor, admin, and insurance portals. The AI can answer questions, update MongoDB data, change the UI, and create blockchain audit proof for important actions.";
  }
  return "I can answer general healthcare, insurance, blockchain, and CureLedger questions, and I can also perform app actions like adding patients, uploading records, granting access, and approving claims. For medical decisions, always confirm with a certified professional.";
}

export function fallbackIntent(message, state = {}) {
  const text = String(message || "");
  const lower = text.toLowerCase();
  const wantsNavigation = /(change|switch|open|go|navigate|move|show|take me)\b/.test(lower);
  const data = {};
  let intent = "GENERIC_ANSWER";
  let uiAction = "SHOW_DASHBOARD";

  data.patientName = extractPatientName(text);
  data.doctor = extractDoctorName(text);
  data.amount = Number(text.match(/amount\s+(\d+)|₹\s*(\d+)|rs\.?\s*(\d+)/i)?.slice(1).find(Boolean) || 0);

  if (/confirm.*delete|delete.*confirm/.test(lower)) {
    intent = "DELETE_PATIENT_CONFIRM";
    uiAction = "DELETE_CONFIRMATION";
  } else if (/show.*critical|critical.*patients|high.?risk/.test(lower)) {
    intent = "SHOW_CRITICAL_PATIENTS";
    uiAction = "FILTER_CRITICAL_PATIENTS";
  } else if (wantsNavigation && /doctor/.test(lower)) {
    intent = "SWITCH_ROLE";
    uiAction = "SWITCH_ROLE";
    data.role = "Doctor";
  } else if (wantsNavigation && /patient/.test(lower)) {
    intent = "SWITCH_ROLE";
    uiAction = "SWITCH_ROLE";
    data.role = "Patient";
  } else if (wantsNavigation && /insurance|claim/.test(lower)) {
    intent = "SWITCH_ROLE";
    uiAction = "SWITCH_ROLE";
    data.role = "Insurance";
  } else if (wantsNavigation && /hospital/.test(lower)) {
    intent = "SWITCH_ROLE";
    uiAction = "SWITCH_ROLE";
    data.role = "Hospital";
  } else if (wantsNavigation && /admin/.test(lower)) {
    intent = "SWITCH_ROLE";
    uiAction = "SWITCH_ROLE";
    data.role = "Admin";
  } else if (wantsNavigation && /database|mongodb|data stored|stored data/.test(lower)) {
    intent = "READ_DASHBOARD";
    uiAction = "OPEN_DATABASE_VIEWER";
  } else if (wantsNavigation && /blockchain|ledger|transaction|audit/.test(lower)) {
    intent = "SHOW_AUDIT";
    uiAction = "SHOW_AUDIT";
  } else if (/(add|create|register)\s+patient/.test(lower)) {
    intent = "ADD_PATIENT";
    uiAction = "ADD_PATIENT";
    data.condition = text.match(/\bwith\s+([a-z ]+?)(?:\s+age|\s+severity|$)/i)?.[1]?.trim() || "General Care";
    data.age = Number(text.match(/\bage\s+(\d+)/i)?.[1] || 36);
    data.severity = severityFromText(text, "moderate");
  } else if (/(add|register)\s+doctor|(?:add|register)\s+dr\.?|new\s+.*doctor|put\s+dr\.?\s+.*doctor/.test(lower)) {
    intent = "ADD_DOCTOR";
    uiAction = "ADD_DOCTOR";
    data.specialization = extractSpecialization(text);
  } else if (/emergency.*access|break.?glass|critical access/.test(lower)) {
    intent = "TOGGLE_EMERGENCY";
    uiAction = "SHOW_AUDIT";
  } else if (/request.*access|ask.*access/.test(lower)) {
    intent = "REQUEST_ACCESS";
    uiAction = "SHOW_CONSENT";
  } else if (/book|schedule.*appointment|appointment/.test(lower)) {
    intent = "BOOK_APPOINTMENT";
    uiAction = "BOOK_APPOINTMENT";
  } else if (/show.*all.*patients|show patients|list patients/.test(lower)) {
    intent = "READ_DASHBOARD";
    uiAction = "SHOW_PATIENTS";
  } else if (/show doctors|list doctors/.test(lower)) {
    intent = "READ_DASHBOARD";
    uiAction = "SHOW_DOCTORS";
  } else if (/show claims|list claims/.test(lower)) {
    intent = "READ_DASHBOARD";
    uiAction = "SHOW_CLAIMS";
  } else if (/select|focus|open.*patient/.test(lower)) {
    intent = "SELECT_PATIENT";
    uiAction = "SELECT_PATIENT";
  } else if (/share|grant|give.*access/.test(lower)) {
    intent = "GRANT_ACCESS";
    uiAction = "GRANT_ACCESS";
    data.days = text.match(/(\d+)\s+days?/i)?.[1] || "7";
  } else if (/revoke|remove.*access|stop access/.test(lower)) {
    intent = "REVOKE_ACCESS";
    uiAction = "REVOKE_ACCESS";
  } else if (/\b(report|record|history|file|document)\b/.test(lower) && !/(upload|add|create|new)/.test(lower)) {
    intent = "SUMMARIZE_HISTORY";
    uiAction = "OPEN_RECORDS_PANEL";
  } else if (/analy[sz]e.*report|report.*analy[sz]e/.test(lower)) {
    intent = "ANALYZE_REPORT";
    uiAction = "ANALYZE_REPORT";
  } else if (/upload|add.*report|blood report|mri report|prescription|discharge/.test(lower)) {
    intent = "UPLOAD_RECORD";
    uiAction = "UPLOAD_RECORD";
  } else if (/approve.*claim/.test(lower)) {
    intent = "APPROVE_CLAIM";
    uiAction = "APPROVE_CLAIM";
  } else if (/reject.*claim/.test(lower)) {
    intent = "REJECT_CLAIM";
    uiAction = "REJECT_CLAIM";
  } else if (/create.*claim|insurance claim|reimbursement|claim packet/.test(lower)) {
    intent = "CREATE_CLAIM";
    uiAction = "SHOW_CLAIMS";
  } else if (
    (/audit|blockchain|\bledger\b/.test(lower.replace(/cureledger/g, "product")) &&
      !/^(what|why|how|tell me|explain|define|describe)\b/.test(lower)) ||
    /show blockchain|open blockchain|go.*blockchain/.test(lower)
  ) {
    intent = "SHOW_AUDIT";
    uiAction = "SHOW_AUDIT";
  } else if (/consent|permission/.test(lower)) {
    intent = "SHOW_CONSENT";
    uiAction = "SHOW_CONSENT";
  } else if (/summarize|summary|health history/.test(lower)) {
    intent = "SUMMARIZE_HISTORY";
    uiAction = "OPEN_SUMMARY_CARD";
  } else if (/explain.*(report|record|blood|mri|scan|prescription|claim)|(?:report|record|blood|mri|scan|prescription|claim).*explain/.test(lower)) {
    intent = "EXPLAIN_REPORT";
    uiAction = "OPEN_REPORT_EXPLANATION";
  } else if (/prescribe|medicine|medication/.test(lower)) {
    intent = "ADD_PRESCRIPTION";
    uiAction = "OPEN_PRESCRIPTION_PANEL";
    data.note = text;
  } else if (/diagnosis|note|observation/.test(lower)) {
    intent = "ADD_DIAGNOSIS";
    uiAction = "UPLOAD_RECORD";
    data.note = text;
  } else if (/make|mark|set|change|update/.test(lower)) {
    intent = "UPDATE_PATIENT";
    uiAction = "SELECT_PATIENT";
    data.severity = severityFromText(text);
  } else if (/delete|remove.*patient/.test(lower)) {
    intent = "DELETE_PATIENT_REQUEST";
    uiAction = "DELETE_CONFIRMATION";
  } else if (/what|why|how|tell me|can you/.test(lower)) {
    intent = "GENERIC_ANSWER";
    uiAction = "OPEN_SUMMARY_CARD";
    data.answer = localGeneralAnswer(text);
  }

  return {
    intent,
    message: "Parsed by CureLedger local agent.",
    uiAction,
    data,
  };
}

function buildSummary(data, patient) {
  const records = data.records.filter((record) => record.patientId === patient.id);
  const consentCount = patient.consent?.filter((item) => item.status === "active").length || 0;
  return `${patient.name} has ${patient.condition} with ${patient.severity} severity. Records: ${records.length}. Active consents: ${consentCount}. Latest report: ${patient.lastReport || "none"}. ${safetyDisclaimer}`;
}

export async function applyAgentAction(action, rawMessage = "", incomingState = {}) {
  const data = await readCureLedger();
  const text = String(rawMessage || "");
  const lower = text.toLowerCase();
  const intent = String(action?.intent || "GENERIC_ANSWER").toUpperCase();
  const uiAction = action?.uiAction || "SHOW_DASHBOARD";
  const actionData = action?.data || {};
  const usedMemory = /\b(him|her|them|that patient|the patient|the claim)\b/i.test(text);
  const patient = findPatient(
    data,
    actionData.patientId ||
      actionData.patientName ||
      (usedMemory ? data.agentState?.selectedPatientId : "") ||
      text
  );
  const doctor = findDoctor(data, actionData.doctorId || actionData.doctor || text);
  let selectedClaim = findClaim(data, actionData.claimId || text);
  let message = action.message || "CureLedger AI updated the workspace.";
  let audit = null;

  syncState(data, {
    ...incomingState,
    lastIntent: intent,
    activePanel: uiAction,
    lastEntity: actionData.patientName || actionData.doctor || patient?.name || "",
    memory: [...(data.agentState?.memory || []), `${intent}: ${text}`].slice(-8),
  });
  data.aiMemory.unshift({
    id: `mem-${Date.now()}`,
    intent,
    message: text,
    selectedPatientId: patient?.id || "",
    selectedClaimId: selectedClaim?.id || "",
    usedContext: usedMemory,
    createdAt: nowIso(),
  });
  data.aiMemory = data.aiMemory.slice(0, 40);

  if (intent === "ADD_PATIENT") {
    const name = actionData.patientName || extractPatientName(text) || "New Patient";
    const severity = actionData.severity || severityFromText(text, "moderate");
    const newPatient = {
      id: `pat-${slug(name)}-${Date.now().toString().slice(-4)}`,
      name,
      age: Number(actionData.age || text.match(/\bage\s+(\d+)/i)?.[1] || 36),
      condition: titleCase(actionData.condition || "General Care"),
      severity,
      risk: riskFromSeverity(severity),
      status: severity === "critical" ? "Critical" : severity === "stable" ? "Stable" : "Active",
      wallet: actionData.wallet || "demo-wallet",
      assignedDoctor: doctor?.name || "Unassigned",
      records: [],
      consent: [],
      lastReport: "Not uploaded",
      ownershipScore: 70,
      createdAt: nowIso(),
    };
    data.patients.unshift(newPatient);
    syncState(data, { selectedPatientId: newPatient.id, lastEntity: newPatient.name, activePanel: "ADD_PATIENT" });
    audit = addAudit(data, "PatientRegistered", data.agentState.currentRole, newPatient.name, `${newPatient.name} added with ${newPatient.condition}`);
    message = `${newPatient.name} was added and is now visible in the patient table.`;
  } else if (intent === "ADD_DOCTOR") {
    const doctorName = actionData.doctor || extractDoctorName(text) || "Dr New";
    const newDoctor = {
      id: `doc-${slug(doctorName)}-${Date.now().toString().slice(-4)}`,
      name: doctorName,
      specialization: actionData.specialization || extractSpecialization(text),
      wallet: actionData.wallet || "demo-wallet",
      patients: [],
      accessRequests: [],
      status: "Approved",
      createdAt: nowIso(),
    };
    data.doctors.unshift(newDoctor);
    syncState(data, { selectedDoctorId: newDoctor.id, lastEntity: newDoctor.name, activePanel: "ADD_DOCTOR" });
    audit = addAudit(data, "DoctorRegistered", data.agentState.currentRole, newDoctor.name, `${newDoctor.name} registered`);
    message = `${newDoctor.name} was added to the doctor table.`;
  } else if (intent === "SELECT_PATIENT") {
    syncState(data, { selectedPatientId: patient.id, lastEntity: patient.name, activePanel: "SELECT_PATIENT" });
    audit = addAudit(data, "PatientSelected", "AI Agent", patient.name, `${patient.name} selected`, "ui-only");
    message = `Selected ${patient.name}. The detail card now shows this patient.`;
  } else if (intent === "SHOW_CRITICAL_PATIENTS") {
    syncState(data, { activePanel: "FILTER_CRITICAL_PATIENTS", lastEntity: "critical patients" });
    const critical = data.patients.filter((item) => item.severity === "critical");
    audit = addAudit(data, "CriticalFilterViewed", "AI Agent", "Patients", `${critical.length} critical patient(s) shown`);
    message = critical.length
      ? `Showing only critical patients: ${critical.map((item) => item.name).join(", ")}.`
      : "No critical patients are currently present.";
  } else if (intent === "UPDATE_PATIENT") {
    const severity = actionData.severity || severityFromText(text, patient.severity);
    patient.severity = severity;
    patient.risk = riskFromSeverity(severity);
    patient.status = severity === "critical" ? "Critical" : severity === "stable" ? "Stable" : "Active";
    syncState(data, { selectedPatientId: patient.id, activePanel: "SELECT_PATIENT", lastEntity: patient.name });
    audit = addAudit(data, "PatientUpdated", "AI Agent", patient.name, `${patient.name} severity changed to ${severity}`);
    message = `${patient.name} updated to ${severity} severity.`;
  } else if (intent === "DELETE_PATIENT_REQUEST") {
    data.agentState.pendingDeletePatientId = patient.id;
    syncState(data, { selectedPatientId: patient.id, activePanel: "DELETE_CONFIRMATION", lastEntity: patient.name });
    audit = addAudit(data, "DeletePatientRequested", "AI Agent", patient.name, `Delete confirmation requested for ${patient.name}`, "ui-only");
    message = `Please confirm before deleting ${patient.name}. No data was removed yet.`;
  } else if (intent === "DELETE_PATIENT_CONFIRM" || intent === "DELETE_PATIENT") {
    const pendingPatient =
      data.patients.find((item) => item.id === data.agentState?.pendingDeletePatientId) || patient;
    data.patients = data.patients.filter((item) => item.id !== pendingPatient.id);
    data.records = data.records.filter((item) => item.patientId !== pendingPatient.id);
    data.reports = data.reports.filter((item) => item.patientId !== pendingPatient.id);
    data.claims = data.claims.filter((item) => item.patientId !== pendingPatient.id);
    data.permissions = data.permissions.filter((item) => item.patientId !== pendingPatient.id);
    data.appointments = data.appointments.filter((item) => item.patientId !== pendingPatient.id);
    syncState(data, { selectedPatientId: data.patients[0]?.id || "", activePanel: "SHOW_PATIENTS", pendingDeletePatientId: "" });
    audit = addAudit(data, "PatientDeleted", "AI Agent", pendingPatient.name, `${pendingPatient.name} removed after confirmation`);
    message = `${pendingPatient.name} and related demo data were removed.`;
  } else if (intent === "UPLOAD_RECORD") {
    const type = lower.includes("mri")
      ? "MRI Scan"
      : lower.includes("prescription")
      ? "Prescription"
      : lower.includes("discharge")
      ? "Discharge Summary"
      : "Blood Report";
    const record = {
      id: `rec-${slug(patient.name)}-${slug(type)}-${Date.now().toString().slice(-5)}`,
      patientId: patient.id,
      patientName: patient.name,
      title: type,
      name: type,
      type,
      summary: actionData.summary || `${type} uploaded for ${patient.name}. AI extracted a simple summary.`,
      explanation: `${type} is now attached to ${patient.name}. ${safetyDisclaimer}`,
      hash: localAuditHash(`${type}:${patient.id}`),
      uploadedBy: data.agentState.currentRole,
      verifiedBy: data.agentState.currentRole,
      sharedWith: [],
      risk: patient.risk,
      createdAt: nowIso(),
      date: today(),
    };
    data.records.unshift(record);
    data.reports.unshift({
      id: `rpt-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      recordId: record.id,
      fileName: `${record.title}.pdf`,
      summary: record.summary,
      abnormalValues: record.risk === "High" ? ["High-risk flags require doctor review"] : [],
      riskLevel: patient.severity,
      recommendation: "Review with the assigned doctor.",
      specialist: doctor?.specialization || "General Physician",
      provider: "local-agent",
      createdAt: nowIso(),
    });
    patient.records.push(record.id);
    patient.lastReport = type;
    syncState(data, { selectedPatientId: patient.id, selectedRecordId: record.id, activePanel: "UPLOAD_RECORD" });
    audit = addAudit(data, "RecordUploaded", data.agentState.currentRole, record.title, `${record.title} uploaded for ${patient.name}`);
    message = `${record.title} uploaded for ${patient.name}, analyzed, and added to the records table.`;
  } else if (intent === "GRANT_ACCESS") {
    const record = selectedRecord(data, patient, text);
    const days = actionData.days || text.match(/(\d+)\s+days?/i)?.[1] || "7";
    if (!record.sharedWith.includes(doctor.id)) record.sharedWith.push(doctor.id);
    const consent = {
      doctorId: doctor.id,
      doctor: doctor.name,
      recordId: record.id,
      access: record.title,
      expiry: `${days} days`,
      status: "active",
    };
    patient.consent = patient.consent.filter((item) => !(item.doctorId === doctor.id && item.recordId === record.id));
    patient.consent.push(consent);
    data.permissions.unshift({ id: `perm-${Date.now()}`, patientId: patient.id, ...consent });
    syncState(data, { selectedPatientId: patient.id, selectedDoctorId: doctor.id, selectedRecordId: record.id, activePanel: "GRANT_ACCESS" });
    audit = addAudit(data, "AccessGranted", patient.name, doctor.name, `${record.title} shared for ${days} days`);
    message = `${record.title} access granted to ${doctor.name} for ${days} days.`;
  } else if (intent === "REQUEST_ACCESS") {
    const request = {
      id: `req-${Date.now()}`,
      doctor: doctor.name,
      doctorId: doctor.id,
      patientId: patient.id,
      reason: actionData.reason || `Access requested for ${patient.name}`,
      status: "pending",
      createdAt: nowIso(),
    };
    data.accessRequests.unshift(request);
    syncState(data, { selectedPatientId: patient.id, selectedDoctorId: doctor.id, activePanel: "SHOW_CONSENT" });
    audit = addAudit(data, "AccessRequested", doctor.name, patient.name, request.reason);
    message = `${doctor.name} requested access to ${patient.name}'s records.`;
  } else if (intent === "REVOKE_ACCESS") {
    const record = selectedRecord(data, patient, text);
    record.sharedWith = record.sharedWith.filter((id) => id !== doctor.id);
    patient.consent = patient.consent.filter((item) => item.doctorId !== doctor.id);
    data.permissions = data.permissions.filter((item) => !(item.patientId === patient.id && item.doctorId === doctor.id));
    syncState(data, { selectedPatientId: patient.id, selectedDoctorId: doctor.id, activePanel: "REVOKE_ACCESS" });
    audit = addAudit(data, "AccessRevoked", patient.name, doctor.name, `${doctor.name} access revoked`);
    message = `${doctor.name}'s access was revoked from ${patient.name}.`;
  } else if (intent === "CREATE_CLAIM") {
    const amount = Number(actionData.amount || text.match(/amount\s+(\d+)|₹\s*(\d+)|rs\.?\s*(\d+)/i)?.slice(1).find(Boolean) || 50000);
    const claim = {
      id: `CLM-${Math.floor(1000 + Math.random() * 8999)}`,
      patientId: patient.id,
      patientName: patient.name,
      amount,
      reason: actionData.reason || `${patient.condition} claim packet`,
      status: "pending",
      progress: 30,
      packet: `${patient.lastReport}, Patient Profile, Consent Proof`,
      aiSummary: `AI prepared a claim packet for ${patient.name} worth ${amount}.`,
      createdAt: nowIso(),
    };
    data.claims.unshift(claim);
    syncState(data, { selectedPatientId: patient.id, selectedClaimId: claim.id, activePanel: "SHOW_CLAIMS" });
    audit = addAudit(data, "ClaimCreated", data.agentState.currentRole, claim.id, `${claim.id} created for ${patient.name}`);
    message = `Created pending insurance claim ${claim.id} for ${patient.name}.`;
  } else if (intent === "BOOK_APPOINTMENT") {
    const appointment = {
      id: `apt-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      date: actionData.date || today(),
      time: actionData.time || "10:00",
      reason: actionData.reason || patient.condition || "Consultation",
      status: "booked",
      createdAt: nowIso(),
    };
    data.appointments.unshift(appointment);
    syncState(data, { selectedPatientId: patient.id, selectedDoctorId: doctor.id, activePanel: "BOOK_APPOINTMENT" });
    audit = addAudit(data, "AppointmentBooked", data.agentState.currentRole, appointment.id, `${patient.name} booked with ${doctor.name}`);
    message = `Appointment booked for ${patient.name} with ${doctor.name}.`;
  } else if (intent === "ANALYZE_REPORT") {
    const record = selectedRecord(data, patient, text);
    const report = {
      id: `rpt-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      recordId: record.id,
      fileName: actionData.fileName || `${record.title}.pdf`,
      summary: actionData.summary || `${record.title} reviewed for ${patient.name}.`,
      abnormalValues: actionData.abnormalValues || (patient.severity === "critical" ? ["Critical risk marker"] : []),
      riskLevel: actionData.riskLevel || patient.severity,
      recommendation: actionData.recommendation || "Share with doctor and continue monitoring.",
      specialist: actionData.specialist || doctor?.specialization || "General Physician",
      provider: actionData.provider || "local-agent",
      createdAt: nowIso(),
    };
    data.reports.unshift(report);
    syncState(data, { selectedPatientId: patient.id, selectedRecordId: record.id, activePanel: "ANALYZE_REPORT" });
    audit = addAudit(data, "ReportAnalyzed", "AI Agent", record.title, `Report analyzed for ${patient.name}`);
    message = `${record.title} analysis saved for ${patient.name}.`;
  } else if (intent === "APPROVE_CLAIM" || intent === "REJECT_CLAIM") {
    selectedClaim.status = intent === "APPROVE_CLAIM" ? "approved" : "rejected";
    selectedClaim.progress = 100;
    selectedClaim.aiSummary =
      selectedClaim.status === "approved"
        ? "AI found sufficient demo evidence for approval."
        : "AI found missing or inconsistent demo evidence.";
    syncState(data, { selectedClaimId: selectedClaim.id, activePanel: intent });
    audit = addAudit(data, intent === "APPROVE_CLAIM" ? "ClaimApproved" : "ClaimRejected", data.agentState.currentRole, selectedClaim.id, `${selectedClaim.id} ${selectedClaim.status}`);
    message = `${selectedClaim.id} status changed to ${selectedClaim.status}.`;
  } else if (intent === "SWITCH_ROLE") {
    const role = actionData.role || "Patient";
    syncState(data, { currentRole: role, activePanel: "SWITCH_ROLE", lastEntity: role });
    audit = addAudit(data, "RoleSwitched", "AI Agent", role, `Dashboard switched to ${role}`, "ui-only");
    message = `Switched to ${role} dashboard.`;
  } else if (intent === "TOGGLE_EMERGENCY") {
    data.appState.emergencyMode = !data.appState.emergencyMode;
    syncState(data, { selectedPatientId: patient.id, activePanel: "SHOW_AUDIT" });
    audit = addAudit(data, "EmergencyAccessRequested", doctor.name, patient.name, `Emergency access ${data.appState.emergencyMode ? "enabled" : "disabled"} for ${patient.name}`);
    message = `Emergency access workflow ${data.appState.emergencyMode ? "enabled" : "disabled"} for ${patient.name}.`;
  } else if (intent === "SHOW_AUDIT" || intent === "SHOW_CONSENT" || intent === "READ_DASHBOARD") {
    syncState(data, { activePanel: uiAction });
    audit = addAudit(data, `${intent}Viewed`, "AI Agent", uiAction, `Opened ${uiAction}`, "ui-only");
    message = `Opened ${uiAction.replace(/_/g, " ").toLowerCase()}.`;
  } else if (intent === "SUMMARIZE_HISTORY") {
    data.aiSummary = buildSummary(data, patient);
    syncState(data, { selectedPatientId: patient.id, activePanel: uiAction || "OPEN_SUMMARY_CARD" });
    audit = addAudit(data, "HealthSummaryGenerated", "AI Agent", patient.name, "Generated AI health summary", "ui-only");
    message = data.aiSummary;
  } else if (intent === "EXPLAIN_REPORT") {
    const record = selectedRecord(data, patient, text);
    syncState(data, { selectedPatientId: patient.id, selectedRecordId: record.id, activePanel: "OPEN_REPORT_EXPLANATION" });
    audit = addAudit(data, "ReportExplained", "AI Agent", record.title, "Explained report in simple language", "ui-only");
    message = `${record.explanation} ${safetyDisclaimer}`;
  } else if (intent === "ADD_PRESCRIPTION" || intent === "ADD_DIAGNOSIS") {
    const note = actionData.note || text;
    const type = intent === "ADD_PRESCRIPTION" ? "Prescription" : "Diagnosis Note";
    data.prescriptions.unshift({ id: `${type}-${Date.now()}`, patientId: patient.id, doctor: doctor.name, note, date: today() });
    const record = {
      id: `rec-${slug(type)}-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      title: type,
      name: type,
      type,
      summary: note,
      explanation: `${type} added by ${doctor.name}.`,
      hash: localAuditHash(`${type}:${patient.id}:${note}`),
      uploadedBy: doctor.name,
      verifiedBy: doctor.name,
      sharedWith: [],
      risk: patient.risk,
      createdAt: nowIso(),
      date: today(),
    };
    data.records.unshift(record);
    patient.records.push(record.id);
    patient.lastReport = type;
    syncState(data, { selectedPatientId: patient.id, selectedRecordId: record.id, activePanel: "OPEN_PRESCRIPTION_PANEL" });
    audit = addAudit(data, intent === "ADD_PRESCRIPTION" ? "PrescriptionAdded" : "DiagnosisAdded", doctor.name, patient.name, note);
    message = `${type} added for ${patient.name}.`;
  } else {
    const answer =
      actionData.answer ||
      action.message ||
      "I can update patients, doctors, records, consent, claims, audit logs, and dashboard role from your chat.";
    data.aiSummary = answer;
    syncState(data, { activePanel: "OPEN_SUMMARY_CARD" });
    audit = addAudit(data, "AIAnswered", "AI Agent", "Question", answer, "ui-only");
    message = answer;
  }

  data.aiSummary ||= buildSummary(data, findPatient(data, data.agentState.selectedPatientId));
  await commitAuditIfNeeded(audit);
  setTrack4Trace(data, intent, uiAction, audit, usedMemory);
  await writeCureLedger(data);
  return {
    intent,
    message,
    uiAction,
    data: actionData,
    updatedState: data.agentState,
    state: data,
    audit,
  };
}

export async function applyAgentCommand(message, state = {}) {
  return applyAgentAction(fallbackIntent(message, state), message, state);
}
