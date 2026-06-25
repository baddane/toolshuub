import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const systemInstruction = `Tu es un expert en recrutement, rédaction d'offres d'emploi et référencement SEO.

À partir du poste, de l'entreprise et de la ville fournis, génère automatiquement une offre d'emploi professionnelle en français comprenant obligatoirement les sections suivantes :

1. Description du poste
Commence OBLIGATOIREMENT le premier paragraphe par la formule exacte « Une entreprise basée à {VILLE} » (en remplaçant {VILLE} par la ville fournie). Ne cite JAMAIS le nom de l'entreprise dans la description.
Rédige exactement 2 paragraphes détaillés et professionnels décrivant :
- les principales missions du poste ;
- les responsabilités ;
- les qualités et aptitudes attendues ;
- les perspectives d'évolution éventuelles.
La description doit être adaptée au poste indiqué, rédigée dans un style professionnel, attractive pour les candidats et mentionner naturellement la ville et l'intitulé du poste.

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

const jsonFormatInstruction = `

IMPORTANT: Réponds UNIQUEMENT avec du JSON valide, sans texte avant ou après, sans bloc de code markdown. Le JSON doit contenir exactement cette structure :
{
  "description": "string (exactement 2 paragraphes détaillés, séparés par un saut de ligne)",
  "metaDescription": "string (entre 140 et 160 caractères)",
  "keywords": ["string", ... (entre 25 et 40 mots-clés SEO)],
  "skills": ["string", ... (entre 15 et 25 compétences)]
}`;

function buildPrompt(poste: string, entreprise: string, ville: string): string {
  return `Poste : ${poste}\nEntreprise : ${entreprise}\nVille : ${ville}`;
}

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
          description:     { type: Type.STRING },
          metaDescription: { type: Type.STRING },
          keywords:        { type: Type.ARRAY, items: { type: Type.STRING } },
          skills:          { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["description", "metaDescription", "keywords", "skills"],
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
  return JSON.parse(extractJSON(response.choices[0].message.content || "{}"));
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

  const { poste, entreprise, ville, model: requestedModel, provider = "gemini", apiKey = "" } = req.body;
  if (!poste || !entreprise || !ville) {
    return res.status(400).json({ error: "Le poste, l'entreprise et la ville sont requis." });
  }

  const model = requestedModel || "gemini-3-flash-preview";
  const prompt = buildPrompt(poste, entreprise, ville);

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
    console.error("Job offer generation error:", error);
    res.status(500).json({ error: "Erreur lors de la génération de l'offre d'emploi." });
  }
}
