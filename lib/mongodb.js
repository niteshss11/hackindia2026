const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "cureledger";

let clientPromise;

export function isMongoConfigured() {
  return Boolean(
    uri &&
      process.env.CURELEDGER_DISABLE_MONGO !== "true" &&
      process.env.CURELEDGER_USE_MONGO === "true"
  );
}

export async function getMongoDb() {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured; using JSON fallback.");
  }
  if (!clientPromise) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(uri, {
      connectTimeoutMS: 900,
      serverSelectionTimeoutMS: 900,
      socketTimeoutMS: 1200,
      maxPoolSize: 3,
    });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(dbName);
}

export async function getMongoStatus() {
  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    return {
      connected: true,
      uri: uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@"),
      dbName,
    };
  } catch (error) {
    return {
      connected: false,
      uri: uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@"),
      dbName,
      error: error.message,
    };
  }
}
