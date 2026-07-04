import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  FaAmbulance,
  FaBrain,
  FaDatabase,
  FaFileMedicalAlt,
  FaHospital,
  FaLock,
  FaPaperPlane,
  FaPlus,
  FaShieldAlt,
  FaUserInjured,
  FaUserMd,
  FaWallet,
} from "react-icons/fa";
import { MdAdminPanelSettings, MdOutlineAutoGraph } from "react-icons/md";
import { BsActivity, BsClipboard2PulseFill, BsStars } from "react-icons/bs";

const auditContractAbi = ["function logAudit(string _action, string _detail) public"];

const navItems = [
  { key: "patient", label: "Patient Portal", icon: <FaUserInjured /> },
  { key: "doctor", label: "Doctor Portal", icon: <FaUserMd /> },
  { key: "admin", label: "Admin Hospital", icon: <MdAdminPanelSettings /> },
  { key: "insurance", label: "Insurance", icon: <MdOutlineAutoGraph /> },
  { key: "ai", label: "AI Command", icon: <FaBrain /> },
  { key: "database", label: "Database Viewer", icon: <FaDatabase /> },
  { key: "blockchain", label: "Blockchain Ledger", icon: <FaShieldAlt /> },
];

const commandChips = [
  "Add patient Nitesh age 24 with dengue severity critical",
  "Register Dr Meera as dermatologist",
  "Book appointment for Raj with Dr Kumar",
  "Show critical patients",
  "Upload Raj blood report",
  "Analyze Raj blood report",
  "Grant Dr Kumar access for 7 days",
  "Move him to critical",
  "Delete Raj",
  "Create insurance claim for Raj amount 50000",
  "Approve the claim",
  "Show blockchain audit",
  "What is CureLedger AI?",
];

const emptyState = {
  agentState: { currentRole: "Patient", activePanel: "SHOW_PATIENTS" },
  appState: {},
  patients: [],
  doctors: [],
  appointments: [],
  records: [],
  reports: [],
  permissions: [],
  claims: [],
  prescriptions: [],
  accessRequests: [],
  audit: [],
  aiMemory: [],
  roleSessions: [],
  track4Trace: [],
  suggestedActions: [],
  storage: { connected: false, mode: "loading" },
};

const severityClass = {
  stable: "risk-normal",
  moderate: "risk-moderate",
  critical: "risk-high",
};

const shortWallet = (wallet) =>
  wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Not connected";

const patientName = (state, patientId) =>
  state.patients.find((patient) => patient.id === patientId)?.name || "Patient";

const doctorName = (state, doctorId) =>
  state.doctors.find((doctor) => doctor.id === doctorId)?.name || "Doctor";

export default function CureLedgerAgent() {
  const [state, setState] = useState(emptyState);
  const [screen, setScreen] = useState("patient");
  const [message, setMessage] = useState("");
  const [thinking, setThinking] = useState(false);
  const [wallet, setWallet] = useState("");
  const [chain, setChain] = useState("");
  const [status, setStatus] = useState("");
  const [dbViewer, setDbViewer] = useState(null);
  const [activeCollection, setActiveCollection] = useState("patients");
  const [manualPatient, setManualPatient] = useState({
    name: "",
    age: "",
    condition: "",
    severity: "moderate",
  });
  const [manualDoctor, setManualDoctor] = useState({
    name: "",
    specialization: "",
  });
  const [manualRecord, setManualRecord] = useState({
    patient: "Raj",
    title: "Blood Report",
  });
  const [chat, setChat] = useState([
    {
      role: "agent",
      text: "CureLedger AI is online. Ask general questions or control patients, doctors, records, consent, claims, and blockchain audit.",
    },
  ]);

  const agentState = state.agentState || emptyState.agentState;
  const audit = state.audit || [];
  const selectedPatient =
    state.patients.find((patient) => patient.id === agentState.selectedPatientId) ||
    state.patients[0];
  const selectedClaim =
    state.claims.find((claim) => claim.id === agentState.selectedClaimId) ||
    state.claims[0];
  const criticalPatients = state.patients.filter((patient) => patient.severity === "critical");
  const activePermissions = state.permissions.filter((item) => item.status === "active");

  const stats = useMemo(
    () => [
      { label: "Patients", value: state.patients.length, icon: <FaUserInjured /> },
      { label: "Doctors", value: state.doctors.length, icon: <FaUserMd /> },
      { label: "Reports", value: state.reports.length || state.records.length, icon: <FaFileMedicalAlt /> },
      { label: "Claims", value: state.claims.length, icon: <MdOutlineAutoGraph /> },
      { label: "Audit Events", value: audit.length, icon: <FaShieldAlt /> },
    ],
    [state, audit.length]
  );

  useEffect(() => {
    refreshState();
    refreshDatabaseViewer();
    const events = new EventSource("/api/cureledger/events");
    events.onmessage = (event) => setState(JSON.parse(event.data));
    return () => events.close();
  }, []);

  const refreshState = async () => {
    const data = await fetch("/api/state").then((response) => response.json());
    setState(data);
  };

  const refreshDatabaseViewer = async () => {
    const data = await fetch("/api/db/collections").then((response) => response.json());
    setDbViewer(data);
  };

  const runDemoSeed = async () => {
    const result = await fetch("/api/seed", { method: "POST" }).then((response) => response.json());
    setState(result.state);
    await refreshDatabaseViewer();
    setStatus("Demo data seeded and persisted.");
  };

  const runDemoReset = async () => {
    const result = await fetch("/api/reset", { method: "POST" }).then((response) => response.json());
    setState(result.state);
    await refreshDatabaseViewer();
    setStatus("Demo reset complete.");
  };

  const connectWallet = async () => {
    setStatus("");
    if (!window.ethereum) {
      setStatus("MetaMask is required for real blockchain mode.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      setWallet(accounts[0]);
      setChain(chainId);
      setStatus("Wallet connected.");
    } catch (error) {
      setStatus(error.message || "Wallet connection failed.");
    }
  };

  const commitAuditToChain = async (entry) => {
    const contractAddress =
      process.env.NEXT_PUBLIC_HEALTH_CARE || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!window.ethereum) {
      setStatus("MetaMask is required for blockchain transactions.");
      return null;
    }
    if (!contractAddress || /DEPLOYED|PASTE|YOUR/i.test(contractAddress)) {
      setStatus("Deploy the contract and set NEXT_PUBLIC_HEALTH_CARE first.");
      return null;
    }

    try {
      setStatus("Sending real blockchain transaction...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, auditContractAbi, signer);
      const tx = await contract.logAudit(entry.action || "AuditLogged", entry.details || "");

      await fetch(`/api/audit/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: tx.hash, chainStatus: "pending" }),
      });
      await tx.wait();
      await fetch(`/api/audit/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: tx.hash, chainStatus: "confirmed" }),
      });
      setStatus(`Blockchain confirmed: ${tx.hash}`);
      await refreshState();
      await refreshDatabaseViewer();
      return tx.hash;
    } catch (error) {
      setStatus(error.message || "Blockchain transaction failed.");
      return null;
    }
  };

  const fundLocalWallet = async () => {
    setStatus("");
    if (!wallet) {
      setStatus("Connect MetaMask first, then fund the wallet.");
      return;
    }

    try {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "hardhat_setBalance",
          params: [wallet, "0x56BC75E2D63100000"],
        }),
      });
      if (!response.ok) throw new Error("Hardhat RPC did not respond.");
      setStatus("Local wallet funded with test ETH.");
    } catch (error) {
      setStatus(error.message || "Could not fund local wallet. Make sure Hardhat node is running.");
    }
  };

  const routeFromResult = (result) => {
    const uiAction = result?.uiAction;
    if (result?.intent === "SWITCH_ROLE") {
      const role = String(result?.data?.role || result?.updatedState?.currentRole || "").toLowerCase();
      if (role.includes("doctor")) return "doctor";
      if (role.includes("insurance")) return "insurance";
      if (role.includes("admin") || role.includes("hospital")) return "admin";
      if (role.includes("patient")) return "patient";
    }
    if (uiAction === "OPEN_DATABASE_VIEWER") return "database";
    if (["ADD_PATIENT", "FILTER_CRITICAL_PATIENTS", "SELECT_PATIENT", "SHOW_PATIENTS", "DELETE_CONFIRMATION"].includes(uiAction)) return "patient";
    if (["ADD_DOCTOR", "SHOW_DOCTORS", "OPEN_DOCTOR_DASHBOARD", "BOOK_APPOINTMENT"].includes(uiAction)) return "doctor";
    if (["UPLOAD_RECORD", "ANALYZE_REPORT", "OPEN_RECORDS_PANEL", "OPEN_REPORT_EXPLANATION", "OPEN_PRESCRIPTION_PANEL", "OPEN_SUMMARY_CARD"].includes(uiAction)) return "patient";
    if (["GRANT_ACCESS", "REVOKE_ACCESS", "SHOW_CONSENT"].includes(uiAction)) return "patient";
    if (["SHOW_CLAIMS", "APPROVE_CLAIM", "REJECT_CLAIM"].includes(uiAction)) return "insurance";
    if (uiAction === "SHOW_AUDIT") return "blockchain";
    return screen;
  };

  const sendMessage = async (text = message) => {
    if (!text.trim()) return;
    setThinking(true);
    setMessage("");
    setChat((items) => [...items, { role: "user", text }]);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, state: agentState }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Agent failed");
      setState(result.state);
      setScreen(routeFromResult(result));
      setChat((items) => [
        ...items,
        {
          role: "agent",
          text: result.message,
          intent: `${result.aiProvider || "agent"} | ${result.intent} -> ${result.uiAction}`,
        },
      ]);
      await refreshDatabaseViewer();
      if (result.audit) {
        setStatus(
          result.audit.chainStatus === "confirmed"
            ? `MongoDB/UI updated. Blockchain confirmed: ${result.audit.txHash}`
            : result.audit.chainStatus === "chain-error"
            ? `MongoDB/UI updated. Blockchain needs attention: ${result.audit.blockchainError || "commit failed"}`
            : "MongoDB/UI updated."
        );
      }
    } catch (error) {
      setChat((items) => [...items, { role: "agent", text: error.message }]);
    } finally {
      setThinking(false);
    }
  };

  const submitManualPatient = async (event) => {
    event.preventDefault();
    await sendMessage(
      `Add patient ${manualPatient.name} age ${manualPatient.age || 35} with ${manualPatient.condition || "general care"} severity ${manualPatient.severity}`
    );
    setManualPatient({ name: "", age: "", condition: "", severity: "moderate" });
  };

  const submitManualDoctor = async (event) => {
    event.preventDefault();
    await sendMessage(
      `Register ${manualDoctor.name} as ${manualDoctor.specialization || "general physician"} doctor`
    );
    setManualDoctor({ name: "", specialization: "" });
  };

  const submitManualRecord = async (event) => {
    event.preventDefault();
    await sendMessage(`Upload ${manualRecord.patient} ${manualRecord.title}`);
  };

  const renderPatientPortal = () => (
    <div className="portal-grid">
      <section className="portal-card focus-card">
        <div className="portal-heading">
          <FaUserInjured />
          <h2>Patient Portal</h2>
        </div>
        <h3>{selectedPatient?.name || "No patient selected"}</h3>
        <p>{selectedPatient?.condition}</p>
        <div className="pill-row">
          <span className={`risk-pill ${severityClass[selectedPatient?.severity]}`}>{selectedPatient?.severity}</span>
          <span>{selectedPatient?.records?.length || 0} records</span>
          <span>{selectedPatient?.ownershipScore || 0}% ownership</span>
        </div>
        <div className="quick-actions">
          <button onClick={() => sendMessage("Upload my blood report")}>Upload Report</button>
          <button onClick={() => sendMessage("Grant Dr Kumar access for 7 days")}>Grant Access</button>
          <button onClick={() => sendMessage("Revoke Dr Kumar access")}>Revoke Access</button>
          <button onClick={() => sendMessage("Create insurance claim for Raj amount 50000")}>Create Claim</button>
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-heading">
          <FaAmbulance />
          <h2>Critical Patients</h2>
        </div>
        {criticalPatients.map((patient) => (
          <div className="entity-row" key={patient.id}>
            <strong>{patient.name}</strong>
            <span>{patient.condition}</span>
            <small>{patient.lastReport}</small>
          </div>
        ))}
      </section>

      <section className="portal-card wide">
        <div className="portal-heading">
          <FaFileMedicalAlt />
          <h2>Medical Records</h2>
        </div>
        <DataTable
          columns={["Title", "Patient", "Summary", "Hash"]}
          rows={state.records.map((record) => [
            record.title,
            record.patientName,
            record.summary,
            record.hash,
          ])}
        />
      </section>

      <section className="portal-card wide">
        <div className="portal-heading">
          <FaLock />
          <h2>Consent Timeline</h2>
        </div>
        <DataTable
          columns={["Doctor", "Patient", "Access", "Expiry", "Status"]}
          rows={state.permissions.map((item) => [
            item.doctor,
            patientName(state, item.patientId),
            item.access,
            item.expiry,
            item.status,
          ])}
        />
      </section>
    </div>
  );

  const renderDoctorPortal = () => (
    <div className="portal-grid">
      <section className="portal-card wide">
        <div className="portal-heading">
          <FaUserMd />
          <h2>Doctor Portal</h2>
        </div>
        <DataTable
          columns={["Doctor", "Specialization", "Patients", "Status"]}
          rows={state.doctors.map((doctor) => [
            doctor.name,
            doctor.specialization,
            doctor.patients?.length || 0,
            doctor.status || "Approved",
          ])}
        />
      </section>
      <section className="portal-card">
        <h2>Doctor Worklist</h2>
        {state.accessRequests.map((request) => (
          <div className="entity-row" key={request.id}>
            <strong>{patientName(state, request.patientId)}</strong>
            <span>{request.reason}</span>
            <small>{request.status}</small>
          </div>
        ))}
      </section>
      <section className="portal-card">
        <h2>Doctor Actions</h2>
        <div className="quick-actions vertical">
          <button onClick={() => sendMessage("Show critical patients assigned to me")}>Show Critical Patients</button>
          <button onClick={() => sendMessage("Add prescription note for Raj")}>Add Prescription</button>
          <button onClick={() => sendMessage("Request access to Raj records")}>Request Access</button>
          <button onClick={() => sendMessage("Emergency access for Raj")}>Emergency Access</button>
        </div>
      </section>
    </div>
  );

  const renderAdminPortal = () => (
    <div className="portal-grid">
      <section className="portal-card">
        <div className="portal-heading">
          <FaPlus />
          <h2>Add Patient</h2>
        </div>
        <form className="entity-form" onSubmit={submitManualPatient}>
          <input placeholder="Patient name" value={manualPatient.name} onChange={(e) => setManualPatient({ ...manualPatient, name: e.target.value })} required />
          <input placeholder="Age" value={manualPatient.age} onChange={(e) => setManualPatient({ ...manualPatient, age: e.target.value })} />
          <input placeholder="Condition" value={manualPatient.condition} onChange={(e) => setManualPatient({ ...manualPatient, condition: e.target.value })} />
          <select value={manualPatient.severity} onChange={(e) => setManualPatient({ ...manualPatient, severity: e.target.value })}>
            <option value="stable">Stable</option>
            <option value="moderate">Moderate</option>
            <option value="critical">Critical</option>
          </select>
          <button type="submit">Add Patient</button>
        </form>
      </section>

      <section className="portal-card">
        <div className="portal-heading">
          <FaPlus />
          <h2>Add Doctor</h2>
        </div>
        <form className="entity-form" onSubmit={submitManualDoctor}>
          <input placeholder="Dr Name" value={manualDoctor.name} onChange={(e) => setManualDoctor({ ...manualDoctor, name: e.target.value })} required />
          <input placeholder="Specialization" value={manualDoctor.specialization} onChange={(e) => setManualDoctor({ ...manualDoctor, specialization: e.target.value })} />
          <button type="submit">Add Doctor</button>
        </form>
      </section>

      <section className="portal-card">
        <div className="portal-heading">
          <FaFileMedicalAlt />
          <h2>Upload Record</h2>
        </div>
        <form className="entity-form" onSubmit={submitManualRecord}>
          <input placeholder="Patient name" value={manualRecord.patient} onChange={(e) => setManualRecord({ ...manualRecord, patient: e.target.value })} />
          <input placeholder="Record title" value={manualRecord.title} onChange={(e) => setManualRecord({ ...manualRecord, title: e.target.value })} />
          <button type="submit">Upload Record</button>
        </form>
      </section>

      <section className="portal-card wide">
        <h2>All Patients</h2>
        <DataTable
          columns={["Name", "Age", "Condition", "Severity", "Doctor"]}
          rows={state.patients.map((patient) => [
            patient.name,
            patient.age,
            patient.condition,
            patient.severity,
            patient.assignedDoctor,
          ])}
        />
      </section>
    </div>
  );

  const renderInsurancePortal = () => (
    <div className="portal-grid">
      <section className="portal-card focus-card">
        <div className="portal-heading">
          <MdOutlineAutoGraph />
          <h2>Insurance Portal</h2>
        </div>
        <h3>{selectedClaim?.id || "No claim"}</h3>
        <p>{selectedClaim?.patientName} - INR {selectedClaim?.amount}</p>
        <b className={`claim-badge ${selectedClaim?.status}`}>{selectedClaim?.status}</b>
        <div className="quick-actions">
          <button onClick={() => sendMessage("Approve the claim")}>Approve Claim</button>
          <button onClick={() => sendMessage("Reject the claim")}>Reject Claim</button>
        </div>
      </section>
      <section className="portal-card wide">
        <h2>Claim Proof Packet</h2>
        <DataTable
          columns={["Claim", "Patient", "Amount", "Status", "AI Summary"]}
          rows={state.claims.map((claim) => [
            claim.id,
            claim.patientName,
            `INR ${claim.amount}`,
            claim.status,
            claim.aiSummary,
          ])}
        />
      </section>
    </div>
  );

  const renderAiCenter = () => (
    <div className="portal-grid">
      <section className="portal-card wide">
        <div className="portal-heading">
          <BsClipboard2PulseFill />
          <h2>AI Command Center</h2>
        </div>
        <p className="muted-text">{state.aiSummary}</p>
        <div className="memory-grid">
          <span>Role: {agentState.currentRole}</span>
          <span>Screen: {screen}</span>
          <span>Intent: {agentState.lastIntent}</span>
          <span>Patient: {selectedPatient?.name}</span>
          <span>Claim: {selectedClaim?.id}</span>
          <span>Storage: {state.storage?.mode}</span>
        </div>
      </section>
    </div>
  );

  const renderDatabaseViewer = () => {
    const collections = dbViewer?.collections || {};
    const rows = collections[activeCollection] || [];
    const columns = rows[0] ? Object.keys(rows[0]).slice(0, 6) : ["empty"];
    return (
      <div className="portal-grid">
        <section className="portal-card wide">
          <div className="portal-heading">
            <FaDatabase />
            <h2>MongoDB Data Viewer</h2>
          </div>
          <div className="status-row">
            <span className={dbViewer?.storage?.connected ? "ok" : "warn"}>
              {dbViewer?.storage?.connected ? "MongoDB Connected" : "MongoDB Not Connected"}
            </span>
            <button onClick={refreshDatabaseViewer}>Refresh</button>
          </div>
          <div className="collection-tabs">
            {Object.keys(collections).map((name) => (
              <button
                className={activeCollection === name ? "active" : ""}
                key={name}
                onClick={() => setActiveCollection(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <DataTable columns={columns} rows={rows.map((row) => columns.map((key) => formatCell(row[key])))} />
          <pre className="state-inspector">{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
        </section>
      </div>
    );
  };

  const renderBlockchainLedger = () => (
    <div className="portal-grid">
      <section className="portal-card wide">
        <div className="portal-heading">
          <FaShieldAlt />
          <h2>Real Blockchain Ledger</h2>
        </div>
        <div className="status-grid">
          <span>Contract: {process.env.NEXT_PUBLIC_HEALTH_CARE || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "not set"}</span>
          <span>Wallet: {shortWallet(wallet)}</span>
          <span>Chain: {chain || "not connected"}</span>
          <span>Status: {status || "ready"}</span>
        </div>
        <button className="primary-action" onClick={connectWallet}>
          <FaWallet /> Connect Wallet
        </button>
        <button className="primary-action secondary" onClick={fundLocalWallet}>
          Fund Local Wallet
        </button>
        <div className="ledger-list">
          {audit.map((entry) => (
            <div className="ledger-item" key={entry.id}>
              <div>
                <strong>{entry.action}</strong>
                <span>{entry.details}</span>
                <small>{entry.actor} to {entry.target}</small>
              </div>
              <div>
                <code>{entry.txHash}</code>
                <b className={entry.chainStatus === "confirmed" ? "ok-text" : "warn-text"}>
                  {entry.chainStatus}
                </b>
                {entry.blockchainError && <small>{entry.blockchainError}</small>}
                {["pending-chain", "chain-error"].includes(entry.chainStatus) && (
                  <button onClick={() => commitAuditToChain(entry)}>
                    Commit to Blockchain
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderActionDeck = () => {
    const activePanel = agentState.activePanel;
    const latestAudit = audit[0];
    const latestReport = state.reports?.[0];
    return (
      <section className="action-deck">
        <Track4DemoTraceCard trace={state.track4Trace} provider={state.aiProvider} />
        {["ADD_PATIENT", "SHOW_PATIENTS"].includes(activePanel) && (
          <PatientFormCard patient={selectedPatient} onSave={(patient) => sendMessage(`Update ${patient.name} age ${patient.age} ${patient.condition} severity ${patient.severity}`)} />
        )}
        {selectedPatient && <PatientSummaryCard patient={selectedPatient} />}
        {activePanel === "SELECT_PATIENT" && selectedPatient && (
          <PatientEditCard patient={selectedPatient} onCritical={() => sendMessage("Move him to critical")} />
        )}
        {activePanel === "FILTER_CRITICAL_PATIENTS" && <CriticalPatientsTable patients={criticalPatients} />}
        {activePanel === "ADD_DOCTOR" && <DoctorFormCard doctor={state.doctors[0]} onSave={(doctor) => sendMessage(`Register ${doctor.name} as ${doctor.specialization}`)} />}
        {activePanel === "BOOK_APPOINTMENT" && <AppointmentSchedulerCard appointments={state.appointments || []} onBook={() => sendMessage(`Book appointment for ${selectedPatient?.name || "Raj"} with ${doctorName(state, agentState.selectedDoctorId)}`)} />}
        {["UPLOAD_RECORD", "ANALYZE_REPORT", "OPEN_REPORT_EXPLANATION"].includes(activePanel) && (
          <ReportUploadAnalysisCard report={latestReport} onAnalyze={() => sendMessage(`Analyze ${selectedPatient?.name || "Raj"} blood report`)} />
        )}
        {["GRANT_ACCESS", "REVOKE_ACCESS", "SHOW_CONSENT"].includes(activePanel) && (
          <DoctorAccessPanel permissions={activePermissions} onGrant={() => sendMessage("Grant Dr Kumar access for 7 days")} onRevoke={() => sendMessage("Revoke Dr Kumar access")} />
        )}
        {["SHOW_CLAIMS", "APPROVE_CLAIM", "REJECT_CLAIM"].includes(activePanel) && (
          <InsuranceClaimCard claim={selectedClaim} onApprove={() => sendMessage("Approve the claim")} onReject={() => sendMessage("Reject the claim")} />
        )}
        {latestAudit && <BlockchainProofCard audit={latestAudit} />}
        {activePanel === "DELETE_CONFIRMATION" && selectedPatient && (
          <DeleteConfirmationCard patient={selectedPatient} onConfirm={() => sendMessage("Confirm delete")} />
        )}
        <DashboardFilterCard onCritical={() => sendMessage("Show critical patients")} onAudit={() => sendMessage("Show audit logs")} />
        <AuditTimelineCard audit={audit.slice(0, 4)} />
        <RoleSwitcherCard role={agentState.currentRole} onSwitch={(role) => sendMessage(`Switch to ${role} dashboard`)} />
      </section>
    );
  };

  const renderScreen = () => {
    if (screen === "patient") return renderPatientPortal();
    if (screen === "doctor") return renderDoctorPortal();
    if (screen === "admin") return renderAdminPortal();
    if (screen === "insurance") return renderInsurancePortal();
    if (screen === "ai") return renderAiCenter();
    if (screen === "database") return renderDatabaseViewer();
    if (screen === "blockchain") return renderBlockchainLedger();
    return renderPatientPortal();
  };

  return (
    <main className="cureledger-os">
      <aside className="os-sidebar">
        <div className="brand-block">
          <BsActivity />
          <div>
            <strong>CureLedger AI</strong>
            <span>Healthcare OS</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button className={screen === item.key ? "active" : ""} key={item.key} onClick={() => setScreen(item.key)}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="os-main">
        <header className="os-topbar">
          <div>
            <p>Stateful AI Agents with Dynamic UI</p>
            <h1>{navItems.find((item) => item.key === screen)?.label}</h1>
          </div>
          <div className="top-status">
            <span className={state.storage?.connected ? "ok" : "warn"}>DB {state.storage?.connected ? "online" : "offline"}</span>
            <span className={wallet ? "ok" : "warn"}>Wallet {shortWallet(wallet)}</span>
            <button onClick={runDemoSeed}>Seed</button>
            <button onClick={runDemoReset}>Reset</button>
            <button onClick={connectWallet}>
              <FaWallet /> Connect
            </button>
          </div>
        </header>

        <section className="os-stat-grid">
          {stats.map((stat) => (
            <article key={stat.label}>
              <i>{stat.icon}</i>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        {renderActionDeck()}

        <section className="os-layout">
          <div className="os-workspace">{renderScreen()}</div>
          <aside className="os-agent">
            <div className="portal-heading">
              <BsStars />
              <h2>CureLedger AI</h2>
            </div>
            <div className="chat-window os-chat">
              {chat.map((item, index) => (
                <div className={`chat-bubble ${item.role}`} key={`${item.role}-${index}`}>
                  <span>{item.role === "agent" ? "AI" : "You"}</span>
                  <p>{item.text}</p>
                  {item.intent && <small>{item.intent}</small>}
                </div>
              ))}
              {thinking && (
                <div className="chat-bubble agent">
                  <span>AI</span>
                  <p>Thinking, updating MongoDB, and preparing blockchain proof...</p>
                </div>
              )}
            </div>
            <form className="agent-input" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
              <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask anything or command the app..." />
              <button type="submit" aria-label="Send">
                <FaPaperPlane />
              </button>
            </form>
            <div className="command-palette compact">
              {commandChips.map((chip) => (
                <button key={chip} onClick={() => sendMessage(chip)}>{chip}</button>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap app-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{formatCell(cell)}</td>)}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length}>No data yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PatientFormCard({ patient, onSave }) {
  const [draft, setDraft] = useState(patient || {});
  useEffect(() => setDraft(patient || {}), [patient]);
  return (
    <article className="action-card">
      <h3>PatientFormCard</h3>
      <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Patient name" />
      <input value={draft.age || ""} onChange={(e) => setDraft({ ...draft, age: e.target.value })} placeholder="Age" />
      <input value={draft.condition || ""} onChange={(e) => setDraft({ ...draft, condition: e.target.value })} placeholder="Condition" />
      <select value={draft.severity || "moderate"} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
        <option value="stable">Stable</option>
        <option value="moderate">Moderate</option>
        <option value="critical">Critical</option>
      </select>
      <button onClick={() => onSave(draft)}>Save Patient</button>
    </article>
  );
}

function PatientSummaryCard({ patient }) {
  return (
    <article className="action-card">
      <h3>PatientSummaryCard</h3>
      <strong>{patient.name}</strong>
      <span>{patient.condition}</span>
      <b className={`risk-pill ${severityClass[patient.severity]}`}>{patient.severity}</b>
    </article>
  );
}

function PatientEditCard({ patient, onCritical }) {
  return (
    <article className="action-card">
      <h3>PatientEditCard</h3>
      <p>{patient.name} is selected for contextual commands.</p>
      <button onClick={onCritical}>Move To Critical</button>
    </article>
  );
}

function CriticalPatientsTable({ patients }) {
  return (
    <article className="action-card wide-action">
      <h3>CriticalPatientsTable</h3>
      <DataTable columns={["Patient", "Condition", "Risk"]} rows={patients.map((patient) => [patient.name, patient.condition, patient.risk])} />
    </article>
  );
}

function DoctorFormCard({ doctor, onSave }) {
  const [draft, setDraft] = useState(doctor || { name: "Dr Kumar", specialization: "General Physician" });
  useEffect(() => setDraft(doctor || { name: "Dr Kumar", specialization: "General Physician" }), [doctor]);
  return (
    <article className="action-card">
      <h3>DoctorFormCard</h3>
      <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <input value={draft.specialization || ""} onChange={(e) => setDraft({ ...draft, specialization: e.target.value })} />
      <button onClick={() => onSave(draft)}>Save Doctor</button>
    </article>
  );
}

function AppointmentSchedulerCard({ appointments, onBook }) {
  return (
    <article className="action-card">
      <h3>AppointmentSchedulerCard</h3>
      <span>{appointments[0]?.patientName || "No appointment yet"}</span>
      <small>{appointments[0] ? `${appointments[0].doctorName} at ${appointments[0].date} ${appointments[0].time}` : "Ready to book"}</small>
      <button onClick={onBook}>Book Appointment</button>
    </article>
  );
}

function ReportUploadAnalysisCard({ report, onAnalyze }) {
  return (
    <article className="action-card wide-action">
      <h3>ReportUploadAnalysisCard</h3>
      <strong>{report?.fileName || "PDF/Image report ready"}</strong>
      <span>{report?.summary || "Upload or analyze a report to save summary, abnormal values, risk, recommendation, and specialist."}</span>
      <small>Risk: {report?.riskLevel || "not analyzed"} | Specialist: {report?.specialist || "pending"}</small>
      <button onClick={onAnalyze}>Analyze Report</button>
    </article>
  );
}

function DoctorAccessPanel({ permissions, onGrant, onRevoke }) {
  return (
    <article className="action-card">
      <h3>DoctorAccessPanel</h3>
      <span>{permissions.length} active consent permission(s)</span>
      <button onClick={onGrant}>Grant Access</button>
      <button className="danger-action" onClick={onRevoke}>Revoke Access</button>
    </article>
  );
}

function InsuranceClaimCard({ claim, onApprove, onReject }) {
  return (
    <article className="action-card">
      <h3>InsuranceClaimCard</h3>
      <strong>{claim?.id || "No claim"}</strong>
      <span>{claim ? `${claim.patientName} INR ${claim.amount}` : "Create a claim from chat."}</span>
      <b className={`claim-badge ${claim?.status || "pending"}`}>{claim?.status || "pending"}</b>
      <button onClick={onApprove}>Approve</button>
      <button className="danger-action" onClick={onReject}>Reject</button>
    </article>
  );
}

function BlockchainProofCard({ audit }) {
  return (
    <article className="action-card wide-action">
      <h3>BlockchainProofCard</h3>
      <strong>{audit.action}</strong>
      <code>{audit.txHash || "pending transaction"}</code>
      <span>{audit.fallbackMessage || audit.chainStatus}</span>
      <small>{audit.createdAt}</small>
    </article>
  );
}

function DeleteConfirmationCard({ patient, onConfirm }) {
  return (
    <article className="action-card delete-card">
      <h3>DeleteConfirmationCard</h3>
      <strong>Confirm deletion for {patient.name}</strong>
      <span>This action removes patient-linked records, reports, claims, consent, and appointments only after confirmation.</span>
      <button className="danger-action" onClick={onConfirm}>Confirm Delete</button>
    </article>
  );
}

function DashboardFilterCard({ onCritical, onAudit }) {
  return (
    <article className="action-card">
      <h3>DashboardFilterCard</h3>
      <button onClick={onCritical}>Filter Critical</button>
      <button onClick={onAudit}>Show Audit Logs</button>
    </article>
  );
}

function AuditTimelineCard({ audit }) {
  return (
    <article className="action-card">
      <h3>AuditTimelineCard</h3>
      {audit.map((entry) => (
        <small key={entry.id}>{entry.action}: {entry.target}</small>
      ))}
      {!audit.length && <span>No audit entries yet.</span>}
    </article>
  );
}

function RoleSwitcherCard({ role, onSwitch }) {
  return (
    <article className="action-card">
      <h3>RoleSwitcherCard</h3>
      <span>Active role: {role}</span>
      <div className="mini-role-grid">
        {["Patient", "Doctor", "Insurance", "Admin"].map((item) => (
          <button key={item} onClick={() => onSwitch(item)}>{item}</button>
        ))}
      </div>
    </article>
  );
}

function Track4DemoTraceCard({ trace = [] }) {
  return (
    <article className="action-card track-card wide-action">
      <h3>Track4DemoTraceCard</h3>
      <div className="trace-grid">
        {trace.map((item) => (
          <span key={item.label} className={item.status}>
            <b>{item.status === "complete" ? "OK" : item.status === "ready" ? "Ready" : "Waiting"}</b>
            {item.label}
            <small>{item.detail}</small>
          </span>
        ))}
      </div>
    </article>
  );
}

function formatCell(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  if (value && typeof value === "object") return JSON.stringify(value);
  if (value === undefined || value === null || value === "") return "none";
  return String(value);
}
