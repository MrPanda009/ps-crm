// lib/gemini.ts — Gemini AI conversational client for civic complaint extraction

/** Shape of a single conversation message */
export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

/** Structured complaint data extracted by Gemini */
export interface ExtractedComplaint {
  title: string;
  description: string;
  category_id: number;
  category_name: string;
  severity: "L1" | "L2" | "L3" | "L4";
  severity_label: string;
  ward_name: string;
  pincode: string;
  address_text: string;
  assigned_department: string;
  latitude: number;
  longitude: number;
}

/** Shape returned from Gemini: either a reply or an extraction */
export interface GeminiResponse {
  reply: string;
  extracted: ExtractedComplaint | null;
}

/** Child-category taxonomy mirroring main.py */
const CATEGORY_LIST = `
1=Metro Station Issue (DMRC) | 2=Metro Track/Safety (DMRC) | 3=Escalator/Lift (DMRC)
4=Metro Parking (DMRC) | 5=Metro Station Hygiene (DMRC) | 6=Metro Property Damage (DMRC)
7=National Highway Damage (NHAI) | 8=Toll Plaza Issue (NHAI) | 9=Expressway Problem (NHAI)
10=Highway Bridge Damage (NHAI) | 11=State Highway/City Road (PWD) | 12=Flyover/Overbridge (PWD)
13=Government Building Issue (PWD) | 14=Large Drainage System (PWD) | 15=Colony Road/Lane (MCD)
16=Garbage Collection (MCD) | 17=Street Sweeping (MCD) | 18=Park Maintenance (MCD)
19=Public Toilet (MCD) | 20=Local Drain/Sewage (MCD) | 21=Stray Animals (MCD)
22=Street Light MCD zone (MCD) | 23=Connaught Place/Lutyens Issue (NDMC)
24=NDMC Road/Infrastructure (NDMC) | 25=NDMC Street Light (NDMC)
26=Central Govt Residential Zone (NDMC) | 27=Water Supply Failure (DJB)
28=Water Pipe Leakage (DJB) | 29=Sewer Line Blockage (DJB) | 30=Contaminated Water (DJB)
31=Power Outage (DISCOM) | 32=Transformer Issue (DISCOM) | 33=Exposed/Fallen Wire (DISCOM)
34=Electricity Pole Damage (DISCOM) | 35=Crime/Safety Issue (DELHI_POLICE)
36=Traffic Signal Problem (TRAFFIC_POLICE) | 37=Illegal Parking (TRAFFIC_POLICE)
38=Road Accident Black Spot (TRAFFIC_POLICE) | 39=Illegal Tree Cutting (FOREST_DEPT)
40=Air Pollution/Burning (DPCC) | 41=Noise Pollution (DPCC) | 42=Industrial Waste Dumping (DPCC)
`.trim();

const SYSTEM_PROMPT = `You are JanSamadhan AI, a helpful civic complaint assistant for Delhi municipal services.
Your job: have a short, friendly conversation with the citizen to collect ALL required fields for their complaint, then output structured JSON.

REQUIRED FIELDS:
- title (5-10 word summary)
- description (2-3 sentences)
- category_id (integer 1-42, pick from the list below)
- severity (L1=Low, L2=Medium, L3=High, L4=Critical)
- ward_name (real Delhi ward name)
- pincode (valid 6-digit Delhi pincode)
- address_text (detailed location description)
- assigned_department (derive from category)
- latitude, longitude (approximate from locality if possible, else 28.6139,77.2090 as fallback)

CATEGORY LIST (id=Name (Department)):
${CATEGORY_LIST}

RULES:
1. Greet warmly on the first message. Ask what issue they want to report.
2. If the user's message is unclear, ask a specific clarifying question. Never make up data.
3. When you still need info, reply in plain conversational text. Do NOT output JSON yet.
4. Once you have ALL required fields, respond with ONLY a JSON block wrapped in \`\`\`json ... \`\`\` containing:
{
  "extracted": {
    "title": "...",
    "description": "...",
    "category_id": <int>,
    "category_name": "...",
    "severity": "L1|L2|L3|L4",
    "severity_label": "Low|Medium|High|Critical",
    "ward_name": "...",
    "pincode": "...",
    "address_text": "...",
    "assigned_department": "...",
    "latitude": <float>,
    "longitude": <float>
  },
  "reply": "Here is your complaint summary. Please review and type YES to submit."
}
5. If user says something unrelated to civic issues, politely redirect.
6. Keep responses concise (2-3 sentences max unless listing confirmation).
7. Be empathetic — the citizen is reporting a real problem.`;

/**
 * Send the conversation history to Gemini and get a response.
 * Calls the Next.js API route to keep the API key server-side.
 */
export async function sendToGemini(messages: ChatMessage[]): Promise<GeminiResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to contact AI assistant");
  }

  return res.json() as Promise<GeminiResponse>;
}

/** Export system prompt for server-side use */
export { SYSTEM_PROMPT };
