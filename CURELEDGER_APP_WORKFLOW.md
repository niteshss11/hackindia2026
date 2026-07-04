# CureLedger AI Workflow

CureLedger AI is a role-based healthcare operating system with an AI command center, MongoDB backend, and blockchain proof ledger.

## Roles

- Patient Portal: view records, upload reports, grant/revoke doctor access, create claims, inspect personal audit.
- Doctor Portal: view permitted patients, request access, add notes/prescriptions, trigger emergency access workflow.
- Admin/Hospital Portal: manually add patients, doctors, and records; inspect all patients and operational data.
- Insurance Portal: review claim proof packets, approve/reject claims, verify audit trail.
- Database Viewer: inspect MongoDB collections from inside the app.
- Blockchain Ledger: inspect contract address, wallet, transaction hashes, and audit status.

## Data Storage

MongoDB stores real app data:

- patients
- doctors
- records
- permissions
- claims
- prescriptions
- accessRequests
- audit
- agent state

The JSON file is only a safety mirror/fallback. The app prefers MongoDB when it is running at `mongodb://127.0.0.1:27017/cureledger`.

## Blockchain Storage

Blockchain stores proof, not private medical data. The app records transaction hashes in MongoDB audit rows.

Important actions produce blockchain audit proof:

- patient registered
- doctor registered
- record uploaded/hash created
- access granted
- access revoked
- claim created
- claim approved/rejected
- emergency access requested
- AI audit logged

## AI Agent Behavior

The AI can answer general questions and control the app.

General question:

```text
What is CureLedger AI?
```

The AI answers normally.

Action command:

```text
Add patient Raj age 45 with diabetes severity critical
```

The backend:

1. Converts the chat into a structured action.
2. Updates MongoDB.
3. Adds an audit row.
4. Sends blockchain proof when MetaMask is connected.
5. Returns updated state.
6. Frontend opens the correct role screen and updates tables/cards.

Follow-up commands use state memory:

```text
Approve the claim
```

The agent uses the selected/latest claim.

## Winning Demo Flow

1. Open Admin/Hospital Portal.
2. Add a patient manually.
3. Add a doctor manually.
4. Use AI: `Upload Raj blood report`.
5. Use AI: `Grant Dr Kumar access for 7 days`.
6. Open Doctor Portal and show access workflow.
7. Use AI: `Create insurance claim for Raj amount 50000`.
8. Open Insurance Portal.
9. Use AI: `Approve the claim`.
10. Open Database Viewer to show MongoDB documents.
11. Open Blockchain Ledger to show transaction hashes and confirmed audit proof.

