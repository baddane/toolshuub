import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const systemInstruction = `Tu es un expert en communication professionnelle et rédaction d'emails.
L'utilisateur te fournit un brouillon d'email imparfait ou incomplet.
Réponds dans la même langue que le brouillon fourni.

Génère exactement 3 versions améliorées :
1. "Correction & Clarté" : corrige les fautes d'orthographe et de grammaire, améliore la structure et la clarté en restant fidèle à l'intention originale.
2. "Professionnel" : reformule avec un ton professionnel et formel, adapté au contexte business.
3. "Percutant" : réécris de façon concise, directe et impactante pour maximiser le taux de réponse.

Pour chaque version, génère également un sujet d'email optimisé.`;

const jsonFormatInstruction = `

IMPORTANT: Réponds UNIQUEMENT avec du JSON valide, sans texte avant ou après, sans bloc de code markdown. Le JSON doit contenir exactement cette structure :
{
  "versions": [
    {
      "label": "string (nom de la version)",
      "description": "string (courte description de l'approche)",
      "subject": "string (sujet d'email optimisé)",
      "body": "string (corps de l'email complet)"
    }
  ]
}`;

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonObject = text.match(/\{[\s\S]*\}/);
  if (jsonObject) return jsonObject[0];
  return text;
}

async function improveWithGemini(draft: string, model: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: draft }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          versions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label:       { type: Type.STRING },
                description: { type: Type.STRING },
                subject:     { type: Type.STRING },
                body:        { type: Type.STRING },
              },
              required: ["label", "description", "subject", "body"],
            },
          },
        },
        required: ["versions"],
      },
    },
  });
  return JSON.parse(response.text || "{}");
}

async function improveWithOpenAI(draft: string, model: string, apiKey: string) {
  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || "" });
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemInstruction + jsonFormatInstruction },
      { role: "user", content: draft },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(response.choices[0].message.content || "{}");
}

async function improveWithDeepSeek(draft: string, model: string, apiKey: string) {
  const deepseek = new OpenAI({
    apiKey: apiKey || process.env.DEEPSEEK_API_KEY || "",
    baseURL: "https://api.deepseek.com",
  });
  const isReasoner = model === "deepseek-reasoner";
  const response = await deepseek.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemInstruction + jsonFormatInstruction },
      { role: "user", content: draft },
    ],
    ...(isReasoner ? {} : { response_format: { type: "json_object" } }),
  });
  return JSON.parse(extractJSON(response.choices[0].message.content || "{}"));
}

async function improveWithAnthropic(draft: string, model: string, apiKey: string) {
  const anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || "" });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemInstruction + jsonFormatInstruction,
    messages: [{ role: "user", content: draft }],
  });
  const block = response.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "{}";
  return JSON.parse(extractJSON(text));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { draft, model: requestedModel, provider = "gemini", apiKey = "" } = req.body;
  if (!draft) {
    return res.status(400).json({ error: "Draft is required" });
  }

  const model = requestedModel || "gemini-3-flash-preview";

  try {
    let result: unknown;

    if (provider === "openai") {
      result = await improveWithOpenAI(draft, model, apiKey);
    } else if (provider === "anthropic") {
      result = await improveWithAnthropic(draft, model, apiKey);
    } else if (provider === "deepseek") {
      result = await improveWithDeepSeek(draft, model, apiKey);
    } else {
      result = await improveWithGemini(draft, model, apiKey);
    }

    res.json(result);
  } catch (error) {
    console.error("Email improvement error:", error);
    res.status(500).json({ error: "Erreur lors de l'amélioration de l'email." });
  }
}
