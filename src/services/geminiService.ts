export interface YouTubeMetadata {
  titles: string[];
  description: string;
  tags: string[];
  thumbnailIdeas: string[];
  hooks: string[];
  shortsScript: string;
  communityPost: string;
  pinnedComment: string;
  targetAudience: string;
  ctaVariants: string[];
  longTailKeywords: string[];
}

export interface VideoInput {
  subject: string;
  chapters: string;
  siteUrl: string;
  articleUrl: string;
}

const SYSTEM_INSTRUCTION = `Agis comme un expert en SEO YouTube et en rédaction pour les chaînes éducatives.
Ta mission est de générer des métadonnées complètes et optimisées pour une vidéo YouTube.
Réponds TOUJOURS en français.

Pour le champ "description", tu dois rédiger une description YouTube professionnelle, optimisée pour l'algorithme YouTube et pour le référencement Google.
Style : clair, professionnel, pédagogique, optimisé SEO, facile à lire.
Longueur : entre 180 et 300 mots.
La description doit être structurée avec des emojis et des sauts de ligne pour être agréable à lire sur YouTube.

Voici EXACTEMENT la structure à respecter pour la description (adapte le contenu au sujet fourni) :

---
[Paragraphe d'accroche : 2-3 phrases qui posent le problème/contexte et captent l'attention]

[Paragraphe de transition : 1-2 phrases qui résument ce que la vidéo couvre]

Vous découvrirez notamment :

✅ [Point clé 1]
✅ [Point clé 2]
✅ [Point clé 3]
✅ [Point clé 4]
✅ [Point clé 5]

[Paragraphe cible : 1-2 phrases qui précisent à qui s'adresse la vidéo]

📌 Chapitres de la vidéo

[Reprendre EXACTEMENT les chapitres fournis par l'utilisateur avec les horaires]

🌍 Mon site : [URL du site fourni par l'utilisateur]

📖 Lire l'article complet : [URL de l'article fourni par l'utilisateur]

💬 [Question engageante pour inciter les commentaires] 👇

🔔 Abonnez-vous à la chaîne pour plus de conseils sur :
[Thème 1]
[Thème 2]
[Thème 3]
[Thème 4]

#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5 #hashtag6
---

IMPORTANT :
- Si l'utilisateur ne fournit pas de chapitres, de site ou d'article, OMETS ces sections (ne mets pas de placeholder).
- Les URLs du site et de l'article doivent apparaître EN FIN de description, juste avant la question engageante.
- Les hashtags doivent être sur une seule ligne en fin de description.

Pour les autres champs, génère :
1. 5 propositions de titres accrocheurs (click-worthy) et optimisés SEO.
2. Une liste de 15 à 20 tags pertinents.
3. 3 idées de miniatures (thumbnails) visuelles.
4. 3 "hooks" (accroches) pour le début de la vidéo.
5. Un script court pour YouTube Shorts / TikTok (30-60s).
6. Un post prêt à l'emploi pour l'onglet Communauté.
7. Un commentaire épinglé (Pinned Comment) engageant.
8. Une analyse de l'audience cible (qui et pourquoi).
9. 3 variantes de CTA (Call to Action).
10. 10 mots-clés de "Longue Traîne" spécifiques.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    titles: { type: "ARRAY", items: { type: "STRING" } },
    description: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    thumbnailIdeas: { type: "ARRAY", items: { type: "STRING" } },
    hooks: { type: "ARRAY", items: { type: "STRING" } },
    shortsScript: { type: "STRING" },
    communityPost: { type: "STRING" },
    pinnedComment: { type: "STRING" },
    targetAudience: { type: "STRING" },
    ctaVariants: { type: "ARRAY", items: { type: "STRING" } },
    longTailKeywords: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "titles", "description", "tags", "thumbnailIdeas", "hooks",
    "shortsScript", "communityPost", "pinnedComment", "targetAudience",
    "ctaVariants", "longTailKeywords",
  ],
};

export function loadApiKey(): string {
  try {
    return localStorage.getItem('gemini_api_key') || '';
  } catch {
    return '';
  }
}

export function saveApiKey(key: string) {
  try {
    if (key) {
      localStorage.setItem('gemini_api_key', key);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  } catch {}
}

export function buildPrompt(input: VideoInput): string {
  let prompt = `Le sujet de la vidéo est : ${input.subject}`;
  if (input.chapters.trim()) {
    prompt += `\n\nLes chapitres de la vidéo sont :\n${input.chapters}`;
  }
  if (input.siteUrl.trim()) {
    prompt += `\n\nLe site à promouvoir est : ${input.siteUrl}`;
  }
  if (input.articleUrl.trim()) {
    prompt += `\n\nL'article associé est : ${input.articleUrl}`;
  }
  return prompt;
}

export async function generateYouTubeMetadata(
  prompt: string,
  model: string = "gemini-3-flash-preview",
  apiKey: string
): Promise<YouTubeMetadata> {
  if (!apiKey) {
    throw new Error("Veuillez entrer votre clé API Gemini pour utiliser l'outil.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 400 || response.status === 403) {
        throw new Error("Clé API invalide. Vérifiez votre clé Gemini et réessayez.");
      }
      if (response.status === 429) {
        throw new Error("Limite de requêtes atteinte. Attendez quelques secondes et réessayez.");
      }
      throw new Error(errorData?.error?.message || "Erreur lors de la génération des métadonnées.");
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Réponse vide de l'API. Réessayez avec un sujet différent.");
    }

    return JSON.parse(text);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La requête a expiré. Veuillez réessayer.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
