# CureLedger AI

CureLedger AI is a Track 04 healthcare workflow demo: chat drives a stateful AI agent, dynamic UI cards, real backend CRUD, persistent MongoDB/JSON storage, live SSE updates, and blockchain audit proof.

## Requirements

- Node.js 18.17.x recommended
- npm 8+
- Optional MongoDB at `mongodb://127.0.0.1:27017/cureledger`
- Optional Hardhat local chain for real audit transactions
- Optional Gemini API key
- Optional Ollama fallback

## Environment

Copy `.env.example` to `.env.local` and fill what you have:

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
MONGODB_URI=mongodb://127.0.0.1:27017/cureledger
CURELEDGER_USE_MONGO=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_HEALTH_CARE=
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

By default the demo uses fast JSON persistence at `data/cureledger-db.json`. To use MongoDB, start MongoDB and set `CURELEDGER_USE_MONGO=true`.

## Ollama Fallback

```bash
ollama pull llama3.2
ollama serve
```

Gemini is used first. If Gemini is unavailable, quota-limited, or returns bad JSON, the API tries Ollama. If Ollama is also unavailable, the deterministic local parser keeps the demo working and returns structured JSON actions.

## Install And Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Blockchain Setup

Terminal 1:

```bash
npm run node
```

Terminal 2:

```bash
npm run deploy-local
```

Copy the deployed address into `.env.local`:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_HEALTH_CARE=0x...
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

If the chain is unavailable, CureLedger does not break. It saves a local immutable audit hash and shows: `Blockchain unavailable, local immutable audit hash created for demo.`

## Demo Data

In the UI, use the `Seed` and `Reset` buttons, or call:

```bash
npm run seed
```

## Judge Demo Script

Use these chat commands:

```text
Add patient Rahul age 45 with diabetes severity critical
Show critical patients
Move him to critical
Book appointment for Rahul with Dr Kumar
Upload Rahul blood report
Analyze Rahul blood report
Grant Dr Kumar access for 7 days
Create insurance claim for Rahul amount 50000
Approve the claim
Show blockchain audit
Switch to admin dashboard
Delete Rahul
Confirm delete
```

Each command proves:

```text
Chat -> AI intent -> Dynamic UI -> Backend API -> Database update -> Live UI update -> Blockchain/local proof -> Memory -> Persistence
```

## API Routes

- `/api/agent`
- `/api/patients`
- `/api/doctors`
- `/api/appointments`
- `/api/reports`
- `/api/consent`
- `/api/claims`
- `/api/audit`
- `/api/events`
- `/api/seed`
- `/api/reset`

## Troubleshooting

- Gemini missing or quota exceeded: start Ollama or use the local parser fallback.
- Ollama error: run `ollama pull llama3.2` and `ollama serve`.
- Blockchain error: start `npm run node`, deploy with `npm run deploy-local`, and set the contract address.
- MetaMask localhost: RPC `http://127.0.0.1:8545`, chain ID `31337`, currency `ETH`.
- MongoDB offline: the JSON fallback is expected and persists locally.
