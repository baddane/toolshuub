import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const systemInstruction = `Tu es un expert en SEO YouTube et en marketing de contenu.
Ta mission est de générer des métadonnées complètes et optimisées pour une vidéo YouTube à partir d'un simple titre ou d'un sujet fourni par l'utilisateur.
Réponds TOUJOURS en français.
Génère :
1. 5 propositions de titres accrocheurs (click-worthy) et optimisés SEO.
2. Une description structurée incluant un résumé captivant, des chapitres suggérés et des appels à l'action.
3. Une liste de 15 à 20 tags pertinents.
4. 3 idées de miniatures (thumbnails) visuelles.
5. 3 "hooks" (accroches) pour le début de la vidéo.
6. Un script court pour YouTube Shorts / TikTok (30-60s).
7. Un post prêt à l'emploi pour l'onglet Communauté.
8. Un commentaire épinglé (Pinned Comment) engageant.
9. Une analyse de l'audience cible (qui et pourquoi).
10. 3 variantes de CTA (Call to Action).
11. 10 mots-clés de "Longue Traîne" spécifiques.`;

const jsonFormatInstruction = `

IMPORTANT: Réponds UNIQUEMENT avec du JSON valide, sans texte avant ou après, sans bloc de code markdown. Le JSON doit contenir exactement ces clés :
{
  "titles": ["string", ...],
  "description": "string",
  "tags": ["string", ...],
  "thumbnailIdeas": ["string", ...],
  "hooks": ["string", ...],
  "shortsScript": "string",
  "communityPost": "string",
  "pinnedComment": "string",
  "targetAudience": "string",
  "ctaVariants": ["string", ...],
  "longTailKeywords": ["string", ...]
}`;

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonObject = text.match(/\{[\s\S]*\}/);
  if (jsonObject) return jsonObject[0];
  return text;
}

async function generateWithGemini(prompt: string, model: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titles: { type: Type.ARRAY, items: { type: Type.STRING } },
          description: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          thumbnailIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
          hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
          shortsScript: { type: Type.STRING },
          communityPost: { type: Type.STRING },
          pinnedComment: { type: Type.STRING },
          targetAudience: { type: Type.STRING },
          ctaVariants: { type: Type.ARRAY, items: { type: Type.STRING } },
          longTailKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "titles", "description", "tags", "thumbnailIdeas", "hooks",
          "shortsScript", "communityPost", "pinnedComment", "targetAudience",
          "ctaVariants", "longTailKeywords",
        ],
      },
    },
  });
  return JSON.parse(response.text || "{}");
}

async function generateWithOpenAI(prompt: string, model: string, apiKey: string) {
  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || "" });
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemInstruction + jsonFormatInstruction },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(response.choices[0].message.content || "{}");
}

async function generateWithDeepSeek(prompt: string, model: string, apiKey: string) {
  const deepseek = new OpenAI({
    apiKey: apiKey || process.env.DEEPSEEK_API_KEY || "",
    baseURL: "https://api.deepseek.com",
  });
  const isReasoner = model === "deepseek-reasoner";
  const response = await deepseek.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemInstruction + jsonFormatInstruction },
      { role: "user", content: prompt },
    ],
    ...(isReasoner ? {} : { response_format: { type: "json_object" } }),
  });
  const content = response.choices[0].message.content || "{}";
  return JSON.parse(extractJSON(content));
}

async function generateWithAnthropic(prompt: string, model: string, apiKey: string) {
  const anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || "" });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemInstruction + jsonFormatInstruction,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "{}";
  return JSON.parse(extractJSON(text));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, model: requestedModel, provider = "gemini", apiKey = "" } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const model = requestedModel || "gemini-3-flash-preview";

  try {
    let result: unknown;

    if (provider === "openai") {
      result = await generateWithOpenAI(prompt, model, apiKey);
    } else if (provider === "anthropic") {
      result = await generateWithAnthropic(prompt, model, apiKey);
    } else if (provider === "deepseek") {
      result = await generateWithDeepSeek(prompt, model, apiKey);
    } else {
      result = await generateWithGemini(prompt, model, apiKey);
    }

    res.json(result);
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({ error: "Erreur lors de la génération des métadonnées." });
  }
}
