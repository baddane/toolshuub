import type { ProviderId } from '../config/providers';

export interface MethodSolution {
  methodName: string;
  discipline: string;
  emoji: string;
  methodExplanation: string;
  appliedSolution: string;
  keySteps: string[];
  isTopRecommendation: boolean;
}

export interface ProblemSolverResult {
  problemSummary: string;
  selectedMethods: MethodSolution[];
  synthesisMarkdown: string;
  mindmapMermaid: string;
  topRecommendation: string;
}

export async function solveProblem(
  problemDescription: string,
  additionalContext: string,
  model: string,
  provider: ProviderId,
  apiKey: string
): Promise<ProblemSolverResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch('/api/problem-solver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemDescription, additionalContext, model, provider, apiKey }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Erreur serveur' }));
      throw new Error(err.error || `Erreur HTTP ${response.status}`);
    }

    return await response.json() as ProblemSolverResult;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error("Délai d'attente dépassé. Réessayez avec un problème plus concis.");
    }
    throw err;
  }
}
