import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `You are a senior software engineer doing a code review.
Review the code the user submits. Respond with ONLY valid JSON, no markdown fences, using exactly this shape:
{
  "summary": "one or two sentence overall verdict",
  "bugs": [{ "severity": "critical|high|medium|low", "line": number or null, "title": "short title", "description": "what is wrong and why", "fix": "how to fix it" }],
  "explanation": { "overview": "what the code does in plain English", "steps": ["step-by-step walkthrough"] },
  "optimizations": [{ "title": "short title", "description": "what to change and why", "impact": "readability|performance|memory|maintainability" }],
  "security": [{ "severity": "critical|high|medium|low", "title": "short title", "description": "the risk", "fix": "how to fix it" }],
  "improvedCode": "the full corrected and improved code as a plain string"
}
Rules: be accurate, do not invent problems, use empty arrays when nothing is found, and use real line numbers (1-based) from the submitted code.`;

let client;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function reviewCode({ code, language }) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const numbered = code.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
  const contents = `Language: ${language}\n\nCode (with line numbers):\n${numbered}`;

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await getClient().models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
      const text = res.text.replace(/^```json\s*|```$/g, "").trim();
      const data = JSON.parse(text);
      return {
        summary: data.summary ?? "",
        bugs: data.bugs ?? [],
        explanation: data.explanation ?? { overview: "", steps: [] },
        optimizations: data.optimizations ?? [],
        security: data.security ?? [],
        improvedCode: data.improvedCode ?? "",
      };
    } catch (e) {
      lastErr = e;
      const status = e.status || e.code;
      if (status === 503 || status === 429) await sleep(1000 * 2 ** attempt); // retry busy/quota errors
      else if (e instanceof SyntaxError) continue; // malformed JSON, try again
      else break;
    }
  }
  throw lastErr;
}
