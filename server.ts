import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

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

const jobOfferSystemInstruction = `Tu es un expert en recrutement, rédaction d'offres d'emploi et référencement SEO.

À partir du poste, de l'entreprise et de la ville fournis, génère automatiquement une offre d'emploi professionnelle en français comprenant obligatoirement les sections suivantes :

1. Description du poste
Rédige exactement 2 paragraphes détaillés et professionnels décrivant :
- les principales missions du poste ;
- les responsabilités ;
- les qualités et aptitudes attendues ;
- les perspectives d'évolution éventuelles.
La description doit être adaptée au poste indiqué, rédigée dans un style professionnel, attractive pour les candidats et mentionner naturellement le nom de l'entreprise, la ville et l'intitulé du poste.

2. Meta Description SEO
Rédige une meta description optimisée SEO entre 140 et 160 caractères. Elle doit obligatoirement contenir le poste, la ville et l'entreprise si cela reste naturel.

3. Mots-clés SEO
Génère entre 25 et 40 mots-clés SEO. Ils doivent inclure le poste exact, les variantes du poste, les termes liés au recrutement, le secteur d'activité associé, la ville, et des expressions du type : emploi {POSTE}, offre d'emploi {POSTE}, recrutement {POSTE}, {POSTE} {VILLE}, emploi {VILLE}, travail {VILLE}.

4. Compétences requises
Génère une liste de 15 à 25 compétences professionnelles pertinentes pour le poste.

Consignes importantes :
- Ne jamais utiliser de placeholders dans la réponse finale.
- Adapter le contenu au métier demandé.
- Utiliser un français professionnel et naturel.
- Optimiser fortement le contenu pour le référencement SEO.
- Éviter les répétitions excessives.`;

const jobOfferJsonFormat = `

IMPORTANT: Réponds UNIQUEMENT avec du JSON valide, sans texte avant ou après, sans bloc de code markdown. Le JSON doit contenir exactement cette structure :
{
  "description": "string (exactement 2 paragraphes détaillés, séparés par un saut de ligne)",
  "metaDescription": "string (entre 140 et 160 caractères)",
  "keywords": ["string", ... (entre 25 et 40 mots-clés SEO)],
  "skills": ["string", ... (entre 15 et 25 compétences)]
}`;

app.post("/api/generate-job-offer", async (req, res) => {
  const { poste, entreprise, ville, model: requestedModel, provider = "gemini", apiKey = "" } = req.body;
  if (!poste || !entreprise || !ville) {
    return res.status(400).json({ error: "Le poste, l'entreprise et la ville sont requis." });
  }

  const model = requestedModel || "gemini-3-flash-preview";
  const prompt = `Poste : ${poste}\nEntreprise : ${entreprise}\nVille : ${ville}`;

  try {
    let result: unknown;

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY || "" });
      const r = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: jobOfferSystemInstruction + jobOfferJsonFormat },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });
      result = JSON.parse(r.choices[0].message.content || "{}");
    } else if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || "" });
      const r = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: jobOfferSystemInstruction + jobOfferJsonFormat,
        messages: [{ role: "user", content: prompt }],
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
          { role: "system", content: jobOfferSystemInstruction + jobOfferJsonFormat },
          { role: "user", content: prompt },
        ],
        ...(isReasoner ? {} : { response_format: { type: "json_object" } }),
      });
      result = JSON.parse(extractJSON(r.choices[0].message.content || "{}"));
    } else {
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });
      const r = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: jobOfferSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description:     { type: Type.STRING },
              metaDescription: { type: Type.STRING },
              keywords:        { type: Type.ARRAY, items: { type: Type.STRING } },
              skills:          { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["description", "metaDescription", "keywords", "skills"],
          },
        },
      });
      result = JSON.parse(r.text || "{}");
    }

    res.json(result);
  } catch (error) {
    console.error("Job offer generation error:", error);
    res.status(500).json({ error: "Erreur lors de la génération de l'offre d'emploi." });
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
