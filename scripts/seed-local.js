const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const hre = require("hardhat");
require("dotenv").config({ path: ".env.local" });

const metadataUrl = (data) =>
  `data:application/json,${encodeURIComponent(JSON.stringify(data))}`;

const demoDb = require("../data/cureledger-seed.json");
const collectionNames = [
  "patients",
  "doctors",
  "records",
  "claims",
  "permissions",
  "prescriptions",
  "accessRequests",
  "audit",
];

async function seedJson() {
  const target = path.join(__dirname, "..", "data", "cureledger-db.json");
  fs.writeFileSync(target, `${JSON.stringify(demoDb, null, 2)}\n`);
}

async function seedMongo() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cureledger";
  const dbName = process.env.MONGODB_DB || "cureledger";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2500 });

  try {
    await client.connect();
    const db = client.db(dbName);
    for (const name of collectionNames) {
      await db.collection(name).deleteMany({});
      if (demoDb[name]?.length) {
        await db.collection(name).insertMany(demoDb[name]);
      }
    }
    await db.collection("appState").updateOne(
      { id: "singleton" },
      {
        $set: {
          id: "singleton",
          data: {
            version: demoDb.version,
            agentState: demoDb.agentState,
            appState: demoDb.appState,
            aiSummary: demoDb.aiSummary,
            suggestedActions: demoDb.suggestedActions,
            lastFocus: demoDb.lastFocus,
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`MongoDB seeded: ${dbName}`);
  } catch (error) {
    console.log(`MongoDB seed skipped: ${error.message}`);
  } finally {
    await client.close().catch(() => {});
  }
}

async function seedContract() {
  const contractAddress =
    process.env.NEXT_PUBLIC_HEALTH_CARE ||
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.log("No contract address found. JSON demo data seeded only.");
    return;
  }

  const [admin, doctor, patient] = await hre.ethers.getSigners();
  const healthcare = await hre.ethers.getContractAt("Healthcare", contractAddress);

  try {
    await healthcare.connect(patient).registerPatient(
      metadataUrl({
        name: "Raj Kumar",
        condition: "Diabetes",
        risk: "High",
      })
    );
  } catch (_) {}

  try {
    await healthcare.connect(doctor).registerDoctor(
      metadataUrl({
        name: "Dr Kumar",
        specialization: "Cardiologist",
      })
    );
  } catch (_) {}

  try {
    await healthcare
      .connect(patient)
      .uploadRecord(1, metadataUrl({ type: "Blood Report" }), "Blood Report");
    await healthcare
      .connect(patient)
      .grantAccess(1, doctor.address, "Blood Report access for 7 days");
    await healthcare
      .connect(patient)
      .createClaim(1, metadataUrl({ claim: "CLM-1001", status: "Pending" }));
    await healthcare
      .connect(admin)
      .approveClaim(1, "Demo approval for CLM-1001");
  } catch (_) {}

  let logs = [];
  try {
    logs = await healthcare.getAuditLogs();
  } catch (_) {
    console.log("Contract audit readback skipped; UI tracks blockchain tx hashes in MongoDB audit logs.");
  }
  console.log(
    JSON.stringify(
      {
        contractAddress,
        admin: admin.address,
        demoDoctor: doctor.address,
        demoPatient: patient.address,
        auditLogCount: logs.length,
      },
      null,
      2
    )
  );
}

async function main() {
  await seedJson();
  await seedMongo();
  await seedContract();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
