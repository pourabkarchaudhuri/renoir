/**
 * Detect whether the user explicitly asked for AI-generated images.
 * Product Deck and similar skills prompt for permission instead of auto-running.
 */

/** Skills that show an image-generation permission dialog when placeholders exist. */
const SKILL_IMAGE_PERMISSION = new Set(['product-deck']);

const OPT_OUT =
  /\b(?:no|don't|do not|skip|without|avoid)\b[^.!?\n]{0,40}\b(?:generate|generating|generated|ai)\b[^.!?\n]{0,20}\bimages?\b/i;

const OPT_IN: RegExp[] = [
  /\bgenerate\s+(?:the\s+)?images?\b/i,
  /\bgenerate\s+(?:a\s+)?(?:photo(?:graph)?s?|illustrations?|hero\s+image|og\s+image|visuals?|artwork|graphics?)\b/i,
  /\b(?:create|make|produce|render)\b[^.!?\n]{0,40}\bimages?\b/i,
  /\b(?:fill\s+in|replace)\b[^.!?\n]{0,30}\b(?:placeholders?|images?)\b/i,
  /\b(?:generate|create)\b[^.!?\n]{0,30}\bplaceholders?\b/i,
  /\bai[\s-]?generated\s+images?\b/i,
  /\buse\s+(?:azure\s+)?foundry\b[^.!?\n]{0,30}\bimages?\b/i,
  /\bimage\s+generation\b/i,
  /\badd\s+(?:real\s+)?(?:photos?|images?)\b/i,
  /\bwith\s+generated\s+images?\b/i,
  /\bimage_strategy\s*[:=]\s*generate\b/i,
  /\bgenerate\s+(?:the\s+)?(?:collage|assets?|photography|slots?)\b/i,
  /\b\/run\s*images?\b/i,
  /\bgenerate\s+images?\s+for\b/i,
];

/** True when the user's message explicitly requests AI image generation. */
export function userRequestedImages(userText: string): boolean {
  const t = (userText || '').trim();
  if (!t) return false;
  if (OPT_OUT.test(t)) return false;
  return OPT_IN.some((re) => re.test(t));
}

/** True when the skill should ask before running the image pipeline. */
export function skillPromptsForImagePermission(skillId?: string): boolean {
  return Boolean(skillId && SKILL_IMAGE_PERMISSION.has(skillId));
}

/** True when the user explicitly declined AI images in their message. */
export function userDeclinedImages(userText: string): boolean {
  const t = (userText || '').trim();
  if (!t) return false;
  return OPT_OUT.test(t) || /\bno\s+images?\b/i.test(t);
}

/** Last user turn in a conversation — used to gate the post-artifact image pipeline. */
export function conversationRequestsImages(
  messages: { role: string; content: string }[],
): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  return lastUser ? userRequestedImages(lastUser.content) : false;
}

/** Whether to run the image pipeline immediately after a completed artifact. */
export function shouldRunImagePipeline(
  messages: { role: string; content: string }[],
): boolean {
  return conversationRequestsImages(messages);
}

/** Whether to show an image permission dialog (skill default, user has not opted in/out). */
export function shouldPromptForImagePermission(
  messages: { role: string; content: string }[],
  skillId?: string,
): boolean {
  if (!skillPromptsForImagePermission(skillId)) return false;
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return true;
  if (userRequestedImages(lastUser.content)) return false;
  if (userDeclinedImages(lastUser.content)) return false;
  return true;
}
