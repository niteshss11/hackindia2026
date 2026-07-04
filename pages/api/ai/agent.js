import {
  applyAgentAction,
  fallbackIntent,
} from "../../../lib/cureledger-store";

const schemaHint = `Return only JSON:
{
  "intent": "ADD_PATIENT | LIST_PATIENTS | GET_PATIENT | UPDATE_PATIENT | DELETE_PATIENT_REQUEST | DELETE_PATIENT_CONFIRM | SELECT_PATIENT | ADD_DOCTOR | BOOK_APPOINTMENT | REQUEST_ACCESS | UPLOAD_RECORD | ANALYZE_REPORT | GRANT_ACCESS | REVOKE_ACCESS | ADD_PRESCRIPTION | ADD_DIAGNOSIS | CREATE_CLAIM | APPROVE_CLAIM | REJECT_CLAIM | SUMMARIZE_HISTORY | EXPLAIN_REPORT | SHOW_CRITICAL_PATIENTS | SHOW_AUDIT | SHOW_CONSENT | SWITCH_ROLE | TOGGLE_EMERGENCY | READ_DASHBOARD | GENERIC_ANSWER | HELP",
  "message": "short user-facing response",
  "uiAction": "OPEN_PATIENT_PANEL | OPEN_RECORDS_PANEL | OPEN_CONSENT_PANEL | OPEN_INSURANCE_PANEL | OPEN_SUMMARY_CARD | OPEN_REPORT_EXPLANATION | OPEN_CRITICAL_PANEL | OPEN_AUDIT_PANEL | OPEN_DOCTOR_DASHBOARD | OPEN_INSURANCE_DASHBOARD | OPEN_ADMIN_DASHBOARD | OPEN_HOSPITAL_DASHBOARD | OPEN_PRESCRIPTION_PANEL | SHOW_DASHBOARD",
  "data": {
    "patientName": "optional",
    "doctor": "optional",
    "role": "optional",
    "risk": "optional Normal | Moderate | High",
    "status": "optional",
    "note": "optional",
    "answer": "optional for general questions"
  }
}`;

function parseJson(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function askGemini(message, appState) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const models = [
    process.env.GEMINI_MODEL,
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ].filter(Boolean);
  const prompt = [
    "You are CureLedger AI, a stateful healthcare workflow agent.",
    "Convert the user command into one safe structured action. Support natural language, not only exact commands.",
    "If the user asks a general question or asks for an explanation that does not mutate data, use GENERIC_ANSWER and put the answer in data.answer.",
    "If the user names a patient or doctor, include that name in data.patientName or data.doctor.",
    "Do not diagnose. Include medical safety wording for summaries.",
    `Current app state: ${JSON.stringify(appState || {})}`,
    `User command: ${message}`,
    schemaHint,
  ].join("\n\n");

  let lastError = null;
  for (const model of [...new Set(models)]) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        lastError = new Error(`Gemini ${model} failed: ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = parseJson(text);
      if (parsed) return parsed;
      lastError = new Error(`Gemini ${model} returned invalid JSON`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Gemini request failed");
}

async function askOllama(message, appState) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";
  const prompt = [
    "You are CureLedger AI. Return one JSON action only, no markdown.",
    "Use structured intents for healthcare workflow. Never return plain text alone.",
    `Current app state: ${JSON.stringify(appState || {})}`,
    `User command: ${message}`,
    schemaHint,
  ].join("\n\n");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.15 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama fallback failed: ${response.status}. Start Ollama with "ollama serve" and pull ${model}.`);
  }

  const payload = await response.json();
  const parsed = parseJson(payload?.response);
  if (!parsed) throw new Error(`Ollama returned invalid JSON. Make sure model ${model} is available.`);
  parsed.provider = "ollama";
  return parsed;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, state, appState } = req.body || {};
    const incomingState = state || appState || {};
    if (!message) return res.status(400).json({ error: "Message is required" });

    const localAction = fallbackIntent(message, incomingState);
    let action = null;
    let usedFallback = false;
    let aiProvider = "local-parser";
    let providerError = "";
    const localIsSpecific =
      localAction.intent !== "HELP" &&
      localAction.intent !== "GENERIC_ANSWER" &&
      !(localAction.intent === "READ_DASHBOARD" && localAction.uiAction === "SHOW_DASHBOARD");

    if (localIsSpecific) {
      action = localAction;
      usedFallback = true;
    } else {
      try {
        action = await askGemini(message, incomingState);
        aiProvider = "gemini";
      } catch (error) {
        providerError = error.message;
        usedFallback = true;
      }
      if (!action) {
        try {
          action = await askOllama(message, incomingState);
          aiProvider = "ollama";
        } catch (error) {
          providerError = `${providerError ? `${providerError}; ` : ""}${error.message}`;
          action = localAction;
          usedFallback = true;
          aiProvider = "local-parser";
        }
      }
    }

    const result = await applyAgentAction(action, message, incomingState);
    return res.status(200).json({ ...result, usedFallback, aiProvider, providerError });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
