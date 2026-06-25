export interface JobOffer {
  description: string;
  metaDescription: string;
  keywords: string[];
  skills: string[];
}

export async function generateJobOffer(
  poste: string,
  entreprise: string,
  ville: string,
  model: string = "gemini-3-flash-preview",
  provider: string = "gemini",
  apiKey: string = ""
): Promise<JobOffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch("/api/generate-job-offer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poste, entreprise, ville, model, provider, apiKey }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erreur lors de la génération de l'offre d'emploi.");
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
