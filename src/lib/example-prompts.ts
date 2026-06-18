// Curated example prompts shown as click-to-fill chips per render kind.
// Authored fresh — not derived from any external source.

export type RenderKind = 'image' | 'video' | 'audio' | 'storyboard' | 'hyperframe';

export interface ExamplePrompt {
  title: string;
  body: string;
}

const PROMPTS: Record<RenderKind, ExamplePrompt[]> = {
  image: [
    { title: 'Editorial product hero',
      body: 'Studio-lit hero shot of a brushed-aluminum espresso press on warm marble, 50mm lens, soft top-light, cream backdrop, ultra-clean composition.' },
    { title: 'Mood-board collage',
      body: 'A six-tile mood-board collage evoking quiet luxury — linen textures, dusk-lit interiors, brass details, soft drop shadows, restrained four-color palette.' },
    { title: 'Cinematic scene',
      body: 'Cinematic frame: a lone figure walking a foggy boardwalk at dawn, anamorphic look, color graded toward teal and amber, generous negative space.' },
    { title: 'Soft 3D illustration',
      body: 'Soft-3D abstract suggesting collaboration: rounded translucent forms intersecting, pastel gradients, gentle volumetric light, no text.' },
    { title: 'Risograph poster',
      body: 'Two-color risograph poster of an alpine ridge at sunrise, fluorescent pink and federal blue, slight registration drift, halftone grain.' },
    { title: 'Magazine cover',
      body: 'Magazine cover: studio portrait of a chef plating a dish, masthead "RESERVE" at top, two cover-line teasers, paper-stock grain.' },
  ],
  video: [
    { title: 'Hero loop · 4s',
      body: '4-second seamless loop: a glass perfume bottle slowly rotating on a soft pedestal, gentle gleam, dust motes in a single shaft of light.' },
    { title: 'Slow-mo pour',
      body: 'Slow-motion pour of espresso into a porcelain cup, droplets, light catching the stream, dark velvet backdrop, 6 seconds.' },
    { title: 'Kinetic typography',
      body: 'Kinetic typography of the phrase "Made for what is yet to come" — words animate in word by word with a soft scale-up and subtle drop shadow on a paper backdrop.' },
    { title: 'Launch teaser · 8s',
      body: '8-second teaser: macro shots of a new keyboard cut to a slow beat, ending on bold logo reveal with anamorphic flares.' },
    { title: 'Time-lapse · cityscape',
      body: 'Time-lapse from dawn to dusk over a downtown skyline, fixed camera, accelerated cloud motion, color grade leaning teal, 10 seconds.' },
    { title: '3D turntable',
      body: 'Turntable orbit of a clean 3D render of running shoes against a soft HDRI light, micro-imperfections, infinite-loop friendly, 12 seconds.' },
  ],
  audio: [
    { title: 'Editorial voiceover',
      body: 'Read this in a calm, mid-paced editorial voice with restrained warmth, no music: "We did not change everything. We refined what mattered."' },
    { title: 'Energetic ad read',
      body: 'Read this with upbeat ad energy, slight smile in voice, clear consonants: "Free shipping ends Sunday — link in bio."' },
    { title: 'Podcast intro',
      body: 'Generate a 6-second podcast intro: warm pad, single piano motif, then a calm voice "Today on Reserve — the case for slowness."' },
    { title: 'Music bed · cinematic',
      body: '20-second cinematic underscore: low cellos, slow build, single piano motif, restrained reverb, no percussion.' },
    { title: 'UI success chime',
      body: 'Two-note rising success chime, friendly, ~600ms, glassy timbre, soft attack.' },
    { title: 'Radio bumper',
      body: '8-second radio bumper for "Reserve": short funk loop, voice tag at the end with the show name.' },
  ],
  storyboard: [
    { title: 'Athlete morning',
      body: `Wide: a runner crests a dawn ridge, fog burning off the valley below
Medium: hand laces a worn shoe, close on the bow
Close: panting breath misting the cold air
Tracking: feet hitting frosted gravel
Wide: silhouette against a rising sun, holding still`,
    },
    { title: 'Coffee ritual',
      body: `Top-down: beans poured into a hand grinder, golden side-light
Macro: ground coffee falling like silk into a portafilter
Wide: barista pulling a shot, steam rising into a window's morning beam
Close: crema settling on the surface, swirl pattern
Wide: cup placed on a wooden counter, customer's hands appearing in frame`,
    },
    { title: 'Product unbox',
      body: `Hero: a black box on a paper backdrop, single hard light
Top-down: hands lifting the lid, foam parting
Close: device emerging, soft reflection on its face
Macro: button being pressed, LED pulse
Wide: device sitting on a desk in a calm room, plant in soft focus`,
    },
  ],
  hyperframe: [
    { title: 'Hero zoom · 3s',
      body: 'Render the artifact with a subtle 1.0→1.04 zoom on the hero region, ease-out, 3 seconds, 24fps.' },
    { title: 'Feature tour · 6s',
      body: 'Pan camera left-to-right through the three feature blocks of the artifact, dwell 0.8s on each, total 6s, 30fps.' },
    { title: 'Dark mode swap · 2s',
      body: 'Smoothly transition the artifact from light to dark theme over 2 seconds, ease-out, no harsh flash, 24fps.' },
    { title: 'Counter tick · 2.4s',
      body: 'Tick the visible counter from 0 to 12,000 over 2.4 seconds with a snappy ease-out, 30fps.' },
  ],
};

export function getExamples(kind: RenderKind): ExamplePrompt[] { return PROMPTS[kind] || []; }
