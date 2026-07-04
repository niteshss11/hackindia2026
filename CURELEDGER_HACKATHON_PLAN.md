# CureLedger AI Hackathon Plan

## What This Build Demonstrates

- Stateful AI agent with structured actions through `/api/ai/agent`.
- Gemini server-side integration with a safe local fallback parser.
- Dynamic UI updates through persisted state and SSE at `/api/cureledger/events`.
- Role dashboards for Patient, Doctor, Hospital, Insurance, and Admin.
- Wallet login UI, chain display, and localhost Hardhat warning.
- Patient records, consent control, insurance claims, emergency mode, AI health summary, critical alerts, and suggested next actions.
- Blockchain audit story in the UI plus Solidity events/functions for patient registration, record upload, access grant/revoke, prescriptions, claims, and audit logs.
- Demo data for Raj Kumar, Ananya Sharma, Meera Iyer, Dr Kumar, Dr Priya, Blood Report, MRI Scan, Prescription, Discharge Summary, CLM-1001, and CLM-1002.

## Install

```bash
npm install
```

## Add Gemini API Key

Copy `.env.local.example` to `.env.local`, then set:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash
```

Keep this key server-side only. Do not use `NEXT_PUBLIC_` for Gemini.

## Run Hardhat Node

```bash
npm run node
```

Hardhat localhost chain id is `31337`.

## Deploy Contract

In another terminal:

```bash
npm run deploy-local
```

Copy the printed contract address into `.env.local`:

```bash
NEXT_PUBLIC_HEALTH_CARE=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

## Seed Demo Data

```bash
npm run seed
```

This resets the JSON demo dataset and, when a contract address exists, sends demo CureLedger audit actions to the local contract.

## Run Frontend

```bash
npm run dev
```

Open `http://localhost:3000`.

## MetaMask Test

1. Add network: `http://127.0.0.1:8545`
2. Chain ID: `31337`
3. Currency: `ETH`
4. Import a Hardhat private key from the `npm run node` terminal.
5. Connect wallet in CureLedger AI.

## Demo Commands

```text
Add patient Nitesh with dengue
Upload my blood report
Share my blood report with Dr Kumar for 7 days
Revoke Dr Kumar access
Summarize my health history
Explain my blood report
Approve insurance claim
Show blockchain audit
Switch to doctor dashboard
Show critical patients
Emergency access mode
```

## Known Limitations

- MongoDB is not required for the demo; JSON persistence is the local fallback.
- Gemini calls depend on a valid server-side key and internet access. The fallback agent keeps the demo working.
- The UI shows blockchain audit state instantly from local state; local contract actions are available through deploy/seed and can be wired deeper for a production build.
- The old sample hospital marketplace/admin components still exist in the repo for compatibility but the main route is CureLedger AI.

## Final Pitch

CureLedger AI is a patient-owned healthcare intelligence platform: chat is the interface, AI is the workflow engine, and blockchain records prove consent and audit transparency.
