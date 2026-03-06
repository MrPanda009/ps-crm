// app/api/chat/route.ts — Server-side Gemini proxy (keeps API key safe)

import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/gemini";
import type { ChatMessage, GeminiResponse, ExtractedComplaint } from "@/lib/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface GeminiApiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiCandidate {
  content: { parts: { text: string }[] };
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string };
}

/**
 * POST /api/chat
 * Accepts conversation messages and proxies them to Google Gemini.
 * Returns a structured GeminiResponse (reply + optional extracted complaint).
 */
export async function POST(req: NextRequest): Promise<NextResponse<GeminiResponse | { error: string }>> {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const messages = body.messages as ChatMessage[];

  // Build Gemini API contents: system instruction + conversation history
  const contents: GeminiApiContent[] = [
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "Understood. I am JanSamadhan AI, ready to help Delhi citizens report civic issues." }] },
    ...messages.map((m) => ({
      role: m.role === "user" ? "user" as const : "model" as const,
      parts: [{ text: m.text }],
    })),
  ];

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
      },
    );

    const data = (await geminiRes.json()) as GeminiApiResponse;

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 502 });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawText) {
      return NextResponse.json({ error: "Empty response from Gemini" }, { status: 502 });
    }

    // Try to parse extracted complaint JSON from code block
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as { extracted: ExtractedComplaint; reply: string };
        return NextResponse.json({
          reply: parsed.reply || "Please review the details above.",
          extracted: parsed.extracted,
        });
      } catch {
        // Malformed JSON — fall through to plain text
      }
    }

    // Plain conversational reply
    return NextResponse.json({ reply: rawText.trim(), extracted: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
