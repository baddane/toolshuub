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
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Erreur lors de la génération des métadonnées.");
  }

  return response.json();
}
