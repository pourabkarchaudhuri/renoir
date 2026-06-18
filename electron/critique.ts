// 5-dimensional self-critique. Streams a structured review of the latest
// artifact across hierarchy, typography, contrast, spacing, and affordance,
// using whatever LLM transport the user has set up (BYOK or Anthropic).

import { startChat } from './llm.js';

const RUBRIC = `
You are a senior design reviewer. Critique the artifact below across five
dimensions. For each, score 0–10 and give one concrete sentence of feedback
and one concrete sentence of "next move". Be specific — name elements, name
values. End with a P0/P1/P2 priority list of changes.

Dimensions, in order:
  1. Hierarchy
  2. Typography
  3. Contrast
  4. Spacing
  5. Affordance

Format exactly:

  ### Hierarchy 8/10
  Feedback: <one sentence>
  Next:     <one sentence>

  ### Typography 7/10
  …

  ### Priority list
  - P0: <one item>
  - P0: <one item>
  - P1: <one item>
  - P2: <one item>
`;

export interface CritiqueReq {
  conversationId: string;
  artifactHtml: string;
  brief?: string;
}

export async function startCritique(req: CritiqueReq): Promise<{ ok: boolean; error?: string }> {
  const userMsg = `Brief (if any): ${req.brief?.trim() || '(none)'}\n\nArtifact HTML (truncated):\n\`\`\`html\n${req.artifactHtml.slice(0, 12_000)}\n\`\`\``;
  return startChat({
    conversationId: req.conversationId,
    messages: [
      { role: 'system', content: RUBRIC.trim() },
      { role: 'user',   content: userMsg },
    ],
    temperature: 0.4,
  });
}
