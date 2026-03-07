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

export async function generateYouTubeMetadata(prompt: string, model: string = "gemini-3-flash-preview"): Promise<YouTubeMetadata> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erreur lors de la génération des métadonnées.");
    }

    return response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La requête a expiré. Veuillez réessayer.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
