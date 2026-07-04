import fs from "fs";
import path from "path";
import { readCureLedger } from "../../../lib/cureledger-store";

const dbPath = path.join(process.cwd(), "data", "cureledger-db.json");

export default async function handler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const send = async () => {
    const state = await readCureLedger();
    res.write(`data: ${JSON.stringify(state)}\n\n`);
  };

  await send();
  let lastMtime = fs.statSync(dbPath).mtimeMs;
  const interval = setInterval(async () => {
    try {
      const nextMtime = fs.statSync(dbPath).mtimeMs;
      if (nextMtime !== lastMtime) {
        lastMtime = nextMtime;
        await send();
      } else {
        res.write(": heartbeat\n\n");
      }
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  }, 1200);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
}
