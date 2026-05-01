export interface EmailVersion {
  label: string;
  description: string;
  subject: string;
  body: string;
}

export interface EmailImproveResult {
  versions: EmailVersion[];
}

export async function improveEmail(
  draft: string,
  model: string = "gemini-3-flash-preview",
  provider: string = "gemini",
  apiKey: string = ""
): Promise<EmailImproveResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch("/api/improve-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft, model, provider, apiKey }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erreur lors de l'amélioration de l'email.");
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
