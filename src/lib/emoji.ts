// Lightweight :shortcode: → emoji replacer. Curated, not exhaustive — covers
// the shortcuts people actually type in chat. No external dependency.

const MAP: Record<string, string> = {
  // Faces
  smile: '😄', grin: '😁', joy: '😂', laugh: '😆', wink: '😉', blush: '😊',
  smirk: '😏', sweat: '😅', sleepy: '😴', sob: '😭', cry: '😢',
  thinking: '🤔', neutral: '😐', upside_down: '🙃', confused: '😕',
  hot: '🥵', cold: '🥶', star_struck: '🤩', sunglasses: '😎',
  // Hands & gestures
  thumbsup: '👍', '+1': '👍', thumbsdown: '👎', '-1': '👎',
  ok_hand: '👌', clap: '👏', wave: '👋', pray: '🙏', muscle: '💪',
  point_right: '👉', point_left: '👈', point_up: '☝️', point_down: '👇',
  raised_hands: '🙌', handshake: '🤝',
  // Hearts / status
  heart: '❤️', sparkling_heart: '💖', broken_heart: '💔',
  star: '⭐', star2: '🌟', boom: '💥', fire: '🔥', sparkles: '✨',
  zap: '⚡', rocket: '🚀', dart: '🎯', tada: '🎉', confetti: '🎊',
  white_check_mark: '✅', check: '✅', x: '❌', warning: '⚠️',
  bug: '🐛', wrench: '🔧', hammer: '🔨', gear: '⚙️',
  // Objects
  bulb: '💡', bell: '🔔', lock: '🔒', key: '🔑', mag: '🔍',
  art: '🎨', camera: '📷', tv: '📺', package: '📦', label: '🏷️',
  pencil: '✏️', memo: '📝', book: '📘', books: '📚',
  // Time / nature
  hourglass: '⏳', clock: '🕒', calendar: '📅',
  sun: '☀️', moon: '🌙', rainbow: '🌈', fire2: '🔥', snowflake: '❄️',
  // Charts
  chart: '📊', chart_up: '📈', chart_down: '📉',
  // People
  eyes: '👀', tongue: '😛', kiss: '😘',
};

export function expandEmoji(input: string): string {
  if (!input) return input;
  return input.replace(/:([a-z0-9_+\-]+):/gi, (m, code) => {
    const key = String(code).toLowerCase();
    return MAP[key] || m;
  });
}
