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

const SYSTEM_INSTRUCTION = `Tu es un expert en SEO YouTube et en marketing de contenu.
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
