import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

import { PROBLEM_METHODS } from "../src/data/problemMethods";

function buildSystemInstruction(problemDescription: string, additionalContext: string): string {
  const methodsList = PROBLEM_METHODS.map(
    (m) => `- ${m.name} [${m.discipline}] : ${m.tagline}`
  ).join("\n");

  return `Tu es un expert mondial en résolution de problèmes, avec une maîtrise encyclopédique des méthodes issues de TOUTES les disciplines humaines.

PROBLÈME SOUMIS : "${problemDescription}"
CONTEXTE ADDITIONNEL : "${additionalContext || 'Non spécifié'}"

Voici les méthodes disponibles issues de disciplines variées :
${methodsList}

Ta mission :
1. Analyser en profondeur le problème soumis.
2. Sélectionner les 5 méthodes les PLUS ADAPTÉES à CE problème spécifique (pas nécessairement les plus connues — choisir les plus efficaces).
3. Pour chaque méthode, produire une explication claire ET une solution concrète appliquée au problème.
4. Identifier quelle méthode tu recommandes EN PREMIER.
5. Générer une synthèse comparative et une mindmap.

RÈGLES CRITIQUES :
- Réponds TOUJOURS en français.
- Chaque appliedSolution doit être SPÉCIFIQUE au problème (pas générique).
- keySteps doit contenir exactement 3 étapes concrètes et actionnables.
- La mindmapMermaid doit commencer par "mindmap", utiliser 2 espaces d'indentation, et éviter les caractères spéciaux dans les labels.
- synthesisMarkdown doit utiliser ## pour les titres, **gras**, et listes - avec 3-4 paragraphes.`;
}

const jsonFormatInstruction = `

CRITIQUE : Réponds UNIQUEMENT avec du JSON valide, sans texte avant ni après. Structure exacte :
{
  "problemSummary": "string (reformulation synthétique du problème en 2-3 phrases)",
  "selectedMethods": [
    {
      "methodName": "string",
      "discipline": "string",
      "emoji": "string (1 emoji pertinent)",
      "methodExplanation": "string (comment fonctionne cette méthode, 2-3 phrases)",
      "appliedSolution": "string (solution concrète appliquée AU problème spécifique, 3-4 phrases)",
      "keySteps": ["string", "string", "string"],
      "isTopRecommendation": false
    }
  ],
  "synthesisMarkdown": "string (analyse comparative Markdown)",
  "mindmapMermaid": "string (code Mermaid mindmap valide)",
  "topRecommendation": "string (nom de la méthode recommandée en priorité)"
}`;

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonObject = text.match(/\{[\s\S]*\}/);
  if (jsonObject) return jsonObject[0];
  return text;
}

async function generateWithGemini(
  prompt: string,
  systemInstruction: string,
  model: string,
  apiKey: string
) {
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
          problemSummary: { type: Type.STRING },
          selectedMethods: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                methodName: { type: Type.STRING },
                discipline: { type: Type.STRING },
                emoji: { type: Type.STRING },
                methodExplanation: { type: Type.STRING },
                appliedSolution: { type: Type.STRING },
                keySteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                isTopRecommendation: { type: Type.BOOLEAN },
              },
              required: ["methodName", "discipline", "emoji", "methodExplanation", "appliedSolution", "keySteps", "isTopRecommendation"],
            },
          },
          synthesisMarkdown: { type: Type.STRING },
          mindmapMermaid: { type: Type.STRING },
          topRecommendation: { type: Type.STRING },
        },
        required: ["problemSummary", "selectedMethods", "synthesisMarkdown", "mindmapMermaid", "topRecommendation"],
      },
    },
  });
  return JSON.parse(response.text || "{}");
}

async function generateWithOpenAI(
  prompt: string,
  systemInstruction: string,
  model: string,
  apiKey: string
) {
  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || "" });
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemInstruction + jsonFormatInstruction },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 5000,
  });
  return JSON.parse(response.choices[0].message.content || "{}");
}

async function generateWithDeepSeek(
  prompt: string,
  systemInstruction: string,
  model: string,
  apiKey: string
) {
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
    max_tokens: 5000,
  });
  const content = response.choices[0].message.content || "{}";
  return JSON.parse(extractJSON(content));
}

async function generateWithAnthropic(
  prompt: string,
  systemInstruction: string,
  model: string,
  apiKey: string
) {
  const anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || "" });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 5000,
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

  const {
    problemDescription,
    additionalContext = "",
    model: requestedModel,
    provider = "gemini",
    apiKey = "",
  } = req.body;

  if (!problemDescription || problemDescription.trim().length < 10) {
    return res.status(400).json({ error: "problemDescription est requis (minimum 10 caractères)" });
  }

  const model = requestedModel || "gemini-3-flash-preview";
  const systemInstruction = buildSystemInstruction(problemDescription.trim(), additionalContext.trim());
  const prompt = `Analyse ce problème et propose des solutions via les meilleures méthodes disponibles : ${problemDescription}`;

  try {
    let result: unknown;

    if (provider === "openai") {
      result = await generateWithOpenAI(prompt, systemInstruction, model, apiKey);
    } else if (provider === "anthropic") {
      result = await generateWithAnthropic(prompt, systemInstruction, model, apiKey);
    } else if (provider === "deepseek") {
      result = await generateWithDeepSeek(prompt, systemInstruction, model, apiKey);
    } else {
      result = await generateWithGemini(prompt, systemInstruction, model, apiKey);
    }

    res.json(result);
  } catch (error) {
    console.error("Problem solver error:", error);
    res.status(500).json({ error: "Erreur lors de l'analyse du problème." });
  }
}
