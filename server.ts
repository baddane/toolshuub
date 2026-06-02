import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { PROBLEM_METHODS } from "./src/data/problemMethods";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

const emailSystemInstruction = `Tu es un expert en communication professionnelle et rédaction d'emails.
L'utilisateur te fournit un brouillon d'email imparfait ou incomplet.
Réponds dans la même langue que le brouillon fourni.

Génère exactement 3 versions améliorées :
1. "Correction & Clarté" : corrige les fautes d'orthographe et de grammaire, améliore la structure et la clarté en restant fidèle à l'intention originale.
2. "Professionnel" : reformule avec un ton professionnel et formel, adapté au contexte business.
3. "Percutant" : réécris de façon concise, directe et impactante pour maximiser le taux de réponse.

Pour chaque version, génère également un sujet d'email optimisé.`;

const emailJsonFormat = `

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

app.post("/api/improve-email", async (req, res) => {
  const { draft, model: requestedModel, provider = "gemini", apiKey = "" } = req.body;
  if (!draft) {
    return res.status(400).json({ error: "Draft is required" });
  }

  const model = requestedModel || "gemini-3-flash-preview";

  try {
    let result: unknown;

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || "" });
      const r = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: emailSystemInstruction + emailJsonFormat },
          { role: "user", content: draft },
        ],
        response_format: { type: "json_object" },
      });
      result = JSON.parse(r.choices[0].message.content || "{}");
    } else if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || "" });
      const r = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: emailSystemInstruction + emailJsonFormat,
        messages: [{ role: "user", content: draft }],
      });
      const block = r.content.find((b) => b.type === "text");
      const text = block && block.type === "text" ? block.text : "{}";
      result = JSON.parse(extractJSON(text));
    } else if (provider === "deepseek") {
      const deepseek = new OpenAI({
        apiKey: apiKey || process.env.DEEPSEEK_API_KEY || "",
        baseURL: "https://api.deepseek.com",
      });
      const isReasoner = model === "deepseek-reasoner";
      const r = await deepseek.chat.completions.create({
        model,
        messages: [
          { role: "system", content: emailSystemInstruction + emailJsonFormat },
          { role: "user", content: draft },
        ],
        ...(isReasoner ? {} : { response_format: { type: "json_object" } }),
      });
      result = JSON.parse(extractJSON(r.choices[0].message.content || "{}"));
    } else {
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });
      const r = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: draft }] }],
        config: {
          systemInstruction: emailSystemInstruction,
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
      result = JSON.parse(r.text || "{}");
    }

    res.json(result);
  } catch (error) {
    console.error("Email improvement error:", error);
    res.status(500).json({ error: "Erreur lors de l'amélioration de l'email." });
  }
});

function buildCognitiveSystemInstruction(bookTitle: string, bookAuthor: string, userContext: string): string {
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
3. useCaseAnalysis : Analyse en Markdown (3-4 paragraphes). Utilise ## pour les titres, **gras** pour les points importants, et - pour les listes à puces.
4. actionPlan : Exactement 5 étapes concrètes avec pour chacune :
   - step : Numéro 1 à 5
   - action : Action précise à effectuer dans les 30 prochains jours (1-2 phrases directes)
   - impact : Résultat attendu de cette action (1 phrase)
5. mindmapMermaid : Code Mermaid VALIDE pour une mindmap. Règles : première ligne "mindmap", deuxième ligne "  root((Titre Court))", nœuds avec 2 espaces par niveau, pas de caractères spéciaux dans les labels.`;
}

const cognitiveJsonFormat = `

CRITIQUE : Réponds UNIQUEMENT avec du JSON valide, sans texte avant ni après. Structure exacte :
{
  "keyQuote": "string",
  "coreConcepts": [{"title": "string", "description": "string", "application": "string"}],
  "useCaseAnalysis": "string",
  "actionPlan": [{"step": 1, "action": "string", "impact": "string"}],
  "mindmapMermaid": "string"
}`;

app.post("/api/cognitive", async (req, res) => {
  const { bookTitle, bookAuthor, userContext, model: requestedModel, provider = "gemini", apiKey = "" } = req.body;
  if (!bookTitle || !userContext) {
    return res.status(400).json({ error: "bookTitle and userContext sont requis" });
  }

  const model = requestedModel || "gemini-3-flash-preview";
  const sysInstruction = buildCognitiveSystemInstruction(bookTitle, bookAuthor || "auteur inconnu", userContext);
  const prompt = `Analyse le livre "${bookTitle}" de ${bookAuthor} et applique ses concepts au contexte suivant : ${userContext}`;

  try {
    let result: unknown;

    if (provider === "openai") {
      result = await generateWithOpenAI(prompt, model, apiKey);
    } else if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || "" });
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: sysInstruction + cognitiveJsonFormat,
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content.find((b) => b.type === "text");
      const text = block && block.type === "text" ? block.text : "{}";
      result = JSON.parse(extractJSON(text));
    } else if (provider === "deepseek") {
      result = await generateWithDeepSeek(prompt, model, apiKey);
    } else {
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });
      const r = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: sysInstruction,
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
      result = JSON.parse(r.text || "{}");
    }

    res.json(result);
  } catch (error) {
    console.error("Cognitive generation error:", error);
    res.status(500).json({ error: "Erreur lors de l'analyse cognitive." });
  }
});

function buildProblemSolverInstruction(problemDescription: string, additionalContext: string): string {
  const methodsList = PROBLEM_METHODS.map(
    (m) => `- ${m.name} [${m.discipline}] : ${m.tagline}`
  ).join("\n");
  return `Tu es un expert mondial en résolution de problèmes, avec une maîtrise encyclopédique des méthodes issues de TOUTES les disciplines humaines.

PROBLÈME SOUMIS : "${problemDescription}"
CONTEXTE ADDITIONNEL : "${additionalContext || 'Non spécifié'}"

Méthodes disponibles :
${methodsList}

Sélectionne les 5 méthodes les plus adaptées à CE problème spécifique. Pour chaque méthode, produis une explication et une solution concrète appliquée au problème. Identifie la méthode à recommander en priorité (isTopRecommendation: true). Génère une synthèse comparative en Markdown et une mindmap Mermaid. Réponds TOUJOURS en français.`;
}

const problemSolverJsonFormat = `

CRITIQUE : Réponds UNIQUEMENT avec du JSON valide. Structure exacte :
{
  "problemSummary": "string",
  "selectedMethods": [
    {"methodName": "string", "discipline": "string", "emoji": "string", "methodExplanation": "string", "appliedSolution": "string", "keySteps": ["string", "string", "string"], "isTopRecommendation": false}
  ],
  "synthesisMarkdown": "string",
  "mindmapMermaid": "string",
  "topRecommendation": "string"
}`;

app.post("/api/problem-solver", async (req, res) => {
  const { problemDescription, additionalContext = "", model: requestedModel, provider = "gemini", apiKey = "" } = req.body;
  if (!problemDescription || problemDescription.trim().length < 10) {
    return res.status(400).json({ error: "problemDescription est requis (minimum 10 caractères)" });
  }

  const model = requestedModel || "gemini-3-flash-preview";
  const sysInstruction = buildProblemSolverInstruction(problemDescription.trim(), additionalContext.trim());
  const prompt = `Analyse ce problème et propose des solutions via les meilleures méthodes disponibles : ${problemDescription}`;

  try {
    let result: unknown;

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || "" });
      const r = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: sysInstruction + problemSolverJsonFormat },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 5000,
      });
      result = JSON.parse(r.choices[0].message.content || "{}");
    } else if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || "" });
      const r = await anthropic.messages.create({
        model,
        max_tokens: 5000,
        system: sysInstruction + problemSolverJsonFormat,
        messages: [{ role: "user", content: prompt }],
      });
      const block = r.content.find((b) => b.type === "text");
      const text = block && block.type === "text" ? block.text : "{}";
      result = JSON.parse(extractJSON(text));
    } else if (provider === "deepseek") {
      result = await generateWithDeepSeek(prompt, model, apiKey);
    } else {
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });
      const r = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: sysInstruction,
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
      result = JSON.parse(r.text || "{}");
    }

    res.json(result);
  } catch (error) {
    console.error("Problem solver error:", error);
    res.status(500).json({ error: "Erreur lors de l'analyse du problème." });
  }
});

app.post("/api/generate", async (req, res) => {
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
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const path = await import("path");
  app.use(express.static("dist"));
  app.get("*", (_req, res) => {
    res.sendFile(path.resolve("dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
