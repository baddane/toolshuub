import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

function buildSystemInstruction(bookTitle: string, bookAuthor: string, userContext: string): string {
  return `Tu es un expert en analyse de livres stratégiques et en application pratique des concepts business.

Livre analysé : "${bookTitle}" par ${bookAuthor}
Contexte professionnel de l'utilisateur : "${userContext}"

Ta mission est de produire une analyse personnalisée, pratique et directement actionnable. Réponds TOUJOURS en français.

Génère exactement :
1. keyQuote : Une citation emblématique du livre (50-100 mots max, entre guillemets)
2. coreConcepts : Exactement 5 concepts clés avec pour chacun :
   - title : Nom du concept (3-6 mots)
   - description : Explication claire du concept (2-3 phrases)
   - application : Application concrète au contexte fourni (2-3 phrases précises)
3. useCaseAnalysis : Analyse en Markdown (3-4 paragraphes) sur comment ce livre s'applique au contexte. Utilise ## pour les titres de sections, **gras** pour les points importants, et - pour les listes à puces.
4. actionPlan : Exactement 5 étapes concrètes avec pour chacune :
   - step : Numéro 1 à 5
   - action : Action précise à effectuer dans les 30 prochains jours (1-2 phrases directes)
   - impact : Résultat attendu de cette action (1 phrase)
5. mindmapMermaid : Code Mermaid VALIDE pour une mindmap. Règles strictes :
   - Première ligne : exactement "mindmap" (sans rien d'autre)
   - Deuxième ligne : "  root((Titre Court))" avec 2 espaces d'indentation
   - 4 à 5 nœuds principaux avec 2 espaces supplémentaires par niveau
   - Utilise UNIQUEMENT des espaces (jamais de tabulations)
   - Labels sans caractères spéciaux (pas de parenthèses, crochets, guillemets dans les labels sauf root)
   - Maximum 5 nœuds principaux avec 2-3 sous-nœuds chacun`;
}

const jsonFormatInstruction = `

CRITIQUE : Réponds UNIQUEMENT avec du JSON valide, sans texte avant ni après, sans bloc de code markdown. Structure exacte requise :
{
  "keyQuote": "string",
  "coreConcepts": [
    {"title": "string", "description": "string", "application": "string"}
  ],
  "useCaseAnalysis": "string",
  "actionPlan": [
    {"step": 1, "action": "string", "impact": "string"}
  ],
  "mindmapMermaid": "string"
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
          keyQuote: { type: Type.STRING },
          coreConcepts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                application: { type: Type.STRING },
              },
              required: ["title", "description", "application"],
            },
          },
          useCaseAnalysis: { type: Type.STRING },
          actionPlan: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                step: { type: Type.INTEGER },
                action: { type: Type.STRING },
                impact: { type: Type.STRING },
              },
              required: ["step", "action", "impact"],
            },
          },
          mindmapMermaid: { type: Type.STRING },
        },
        required: ["keyQuote", "coreConcepts", "useCaseAnalysis", "actionPlan", "mindmapMermaid"],
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
    max_tokens: 4096,
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
    max_tokens: 4096,
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

  const {
    bookTitle,
    bookAuthor,
    userContext,
    model: requestedModel,
    provider = "gemini",
    apiKey = "",
  } = req.body;

  if (!bookTitle || !userContext) {
    return res.status(400).json({ error: "bookTitle and userContext sont requis" });
  }

  const model = requestedModel || "gemini-3-flash-preview";
  const systemInstruction = buildSystemInstruction(bookTitle, bookAuthor || "auteur inconnu", userContext);
  const prompt = `Analyse le livre "${bookTitle}" de ${bookAuthor} et applique ses concepts au contexte suivant : ${userContext}`;

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
    console.error("Cognitive generation error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    let userError = "Erreur lors de l'analyse cognitive. Réessayez ou changez de modèle.";
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('authentication')) {
      userError = "Clé API invalide ou expirée. Vérifiez votre clé dans les paramètres.";
    } else if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      userError = "Limite de requêtes atteinte. Attendez quelques secondes et réessayez.";
    } else if (msg.toLowerCase().includes('json') || msg.toLowerCase().includes('parse') || msg.toLowerCase().includes('syntax')) {
      userError = "Le modèle a retourné une réponse invalide. Réessayez ou utilisez un autre modèle.";
    } else if (msg.includes('timeout') || msg.includes('abort')) {
      userError = "Délai d'attente dépassé. Essayez avec un contexte plus court.";
    }
    res.status(500).json({ error: userError });
  }
}
