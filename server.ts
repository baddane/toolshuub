import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

app.post("/api/generate", async (req, res) => {
  const { prompt, model: requestedModel } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const model = requestedModel || "gemini-3-flash-preview";

  try {
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
            "ctaVariants", "longTailKeywords"
          ],
        },
      },
    });

    res.json(JSON.parse(response.text || "{}"));
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
