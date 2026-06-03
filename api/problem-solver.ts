import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const PROBLEM_METHODS = [
  { name: '5 Whys (5 Pourquoi)',                    discipline: 'Industrie / Toyota',                  tagline: 'Remonter à la cause racine en posant "Pourquoi ?" cinq fois de suite.' },
  { name: 'Design Thinking',                         discipline: 'Design / Innovation',                 tagline: "Résoudre centrée sur l'humain via empathie, idéation et prototypage rapide." },
  { name: 'First Principles Thinking',               discipline: 'Physique / Philosophie',              tagline: 'Décomposer jusqu\'aux vérités fondamentales et reconstruire sans présupposés.' },
  { name: 'Systems Thinking',                        discipline: 'Cybernétique / Ingénierie',           tagline: 'Voir les boucles de rétroaction et interdépendances plutôt que les causes linéaires.' },
  { name: 'Theory of Constraints',                   discipline: 'Management / Production',             tagline: "Identifier et éliminer le goulot d'étranglement qui limite tout le système." },
  { name: 'Cycle PDCA',                              discipline: 'Management Qualité',                  tagline: 'Itérer en boucle : Planifier, Faire, Vérifier, Ajuster — sans jamais s\'arrêter.' },
  { name: 'Approche Cognitivo-Comportementale',      discipline: 'Psychologie Clinique',                tagline: 'Identifier les schémas de pensée dysfonctionnels qui amplifient le problème.' },
  { name: 'Inversion',                               discipline: 'Mathématiques / Philosophie',         tagline: 'Résoudre un problème en pensant à l\'inverse : "Que faire pour garantir l\'échec ?"' },
  { name: 'Biomimétisme',                            discipline: 'Biologie / Ingénierie',               tagline: "Imiter les 3,8 milliards d'années d'évolution de la nature pour résoudre des défis humains." },
  { name: 'Appreciative Inquiry',                    discipline: 'Psychologie Organisationnelle',       tagline: 'Partir des forces existantes plutôt que des déficits pour générer un changement durable.' },
  { name: 'SCAMPER',                                 discipline: 'Créativité / Innovation',             tagline: "Substituer, Combiner, Adapter, Modifier, Proposer un autre usage, Éliminer, Renverser." },
  { name: 'Méthode Socratique',                      discipline: 'Philosophie',                         tagline: 'Révéler la vérité par un questionnement systématique qui déconstruit les présupposés.' },
  { name: 'Force Field Analysis',                    discipline: 'Psychologie Sociale',                 tagline: 'Cartographier les forces pour et contre le changement pour identifier où agir.' },
  { name: 'TRIZ',                                    discipline: 'Ingénierie / Innovation',             tagline: "40 principes inventifs extraits de l'analyse de 400 000 brevets pour résoudre les contradictions." },
  { name: 'Marginal Gains',                          discipline: 'Science du Sport',                    tagline: "Améliorer chaque élément de 1% pour créer une amélioration totale spectaculaire." },
  { name: 'Latticework of Mental Models',            discipline: 'Multi-disciplinaire',                 tagline: "Utiliser simultanément des modèles issus de multiples disciplines pour voir ce que les autres ratent." },
  { name: 'Cynefin Framework',                       discipline: 'Science de la Complexité',            tagline: 'Classifier le type de problème (simple, compliqué, complexe, chaotique) avant d\'agir.' },
  { name: 'Reframing Cognitif (Neurosciences)',      discipline: 'Neurosciences Cognitives',            tagline: 'Utiliser la neuroplasticité pour reconstruire la représentation mentale du problème.' },
  { name: 'Lateral Thinking',                        discipline: 'Psychologie / Créativité',            tagline: 'Contourner les schémas logiques habituels pour générer des solutions non-conventionnelles.' },
  { name: 'Wicked Problems Framework',               discipline: 'Sciences Sociales / Urbanisme',       tagline: 'Approcher les problèmes irréductibles en acceptant leur complexité et en agissant par itérations.' },
];

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

  if (!problemDescription || problemDescription.trim().length < 3) {
    return res.status(400).json({ error: "problemDescription est requis (minimum 3 caractères)" });
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
    const msg = error instanceof Error ? error.message : String(error);
    let userError = "Erreur lors de l'analyse du problème. Réessayez ou changez de modèle.";
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('authentication')) {
      userError = "Clé API invalide ou expirée. Vérifiez votre clé dans les paramètres.";
    } else if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      userError = "Limite de requêtes atteinte. Attendez quelques secondes et réessayez.";
    } else if (msg.toLowerCase().includes('json') || msg.toLowerCase().includes('parse') || msg.toLowerCase().includes('syntax')) {
      userError = "Le modèle a retourné une réponse invalide. Réessayez ou utilisez un autre modèle.";
    } else if (msg.includes('timeout') || msg.includes('abort')) {
      userError = "Délai d'attente dépassé. Essayez avec un problème plus concis.";
    }
    res.status(500).json({ error: userError });
  }
}
