import type { ProviderId } from '../config/providers';

export interface CognitiveConcept {
  title: string;
  description: string;
  application: string;
}

export interface ActionStep {
  step: number;
  action: string;
  impact: string;
}

export interface CognitiveResult {
  bookTitle: string;
  keyQuote: string;
  coreConcepts: CognitiveConcept[];
  useCaseAnalysis: string;
  actionPlan: ActionStep[];
  mindmapMermaid: string;
}

export async function generateCognitiveAnalysis(
  bookTitle: string,
  bookAuthor: string,
  userContext: string,
  model: string,
  provider: ProviderId,
  apiKey: string
): Promise<CognitiveResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch('/api/cognitive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookTitle, bookAuthor, userContext, model, provider, apiKey }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erreur serveur' }));
      throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
    }

    const data = await response.json();
    return { bookTitle, ...data } as CognitiveResult;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error("Délai d'attente dépassé. Réessayez avec un contexte plus court.");
    }
    throw err;
  }
}
