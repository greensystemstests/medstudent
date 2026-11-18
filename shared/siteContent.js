// The parts of the public site an admin can change from the dashboard: main text and main images.
// This list is the single source of truth. The server only accepts keys from it (and enforces each
// length), and the site shows the default below until an admin saves a change, so an empty database
// leaves the site exactly as it is in the code.
//
// Deliberately NOT here: legal pages, prices, the €180 fee, FAQ answers, and anything a regulator or
// the payment flow relies on. Those change through a reviewed code change.

export const CONTENT_GROUPS = [
  { id: "hero", label: "Home page: top section" },
  { id: "why", label: "Home page: Why StudyBg" },
  { id: "universities", label: "Home page: universities" },
  { id: "journey", label: "Home page: how it works" },
  { id: "gateway", label: "Home page: the Gateway" },
  { id: "closing", label: "Home page: closing call to action" },
];

const text = (key, group, label, def, extra = {}) => ({ key, group, label, type: "text", default: def, max: 300, ...extra });
const image = (key, group, label, hint) => ({ key, group, label, type: "image", hint });

export const SITE_CONTENT = [
  text("home.hero.badge", "hero", "Small badge above the headline", "Independent admissions support · Medicine & Dentistry", { max: 90 }),
  text("home.hero.title", "hero", "Headline (first part)", "Want to study medicine in Bulgaria?", { max: 120 }),
  text("home.hero.titleAccent", "hero", "Headline (green part)", "Find out where you stand first.", { max: 120 }),
  text(
    "home.hero.intro",
    "hero",
    "Paragraph under the headline",
    "Thinking of studying Medicine or Dentistry in English at a Bulgarian medical university, but not sure which one may fit your situation? Start with a free preliminary check before deciding whether to use StudyBg.",
    { multiline: true, max: 500 },
  ),
  text("home.hero.primaryButton", "hero", "Main green button", "Check your eligibility — Free", { max: 60 }),
  text("home.hero.note", "hero", "Line under the buttons", "5 questions · runs in your browser · no sign-up, no payment", { max: 120 }),
  image("home.hero.image", "hero", "Photo in the top-right card", "Wide photo (16:9 works best). Shown with a dark fade at the bottom."),
  text("home.hero.imageCaption", "hero", "Caption on that photo", "Medical University of Sofia", { max: 80 }),
  text("home.hero.cardTitle", "hero", "Title of the top-right card", "What the free check shows you", { max: 80 }),

  text("home.why.title", "why", "Section title", "Why StudyBg?", { max: 80 }),
  text(
    "home.why.intro",
    "why",
    "Intro paragraph",
    "Four universities, four sets of rules, documents from your own country, and deadlines that don’t line up. Here’s where we help.",
    { multiline: true, max: 400 },
  ),
  text("home.why.card1.title", "why", "Card 1 title", "Compare the four routes", { max: 60 }),
  text(
    "home.why.card1.text",
    "why",
    "Card 1 text",
    "See each university side by side, with a link to its official admissions page and the date we last checked it.",
    { multiline: true, max: 300 },
  ),
  text("home.why.card2.title", "why", "Card 2 title", "Understand what they’ll ask for", { max: 60 }),
  text(
    "home.why.card2.text",
    "why",
    "Card 2 text",
    "Get an independent read of the qualification and document requirements for your situation, in plain language.",
    { multiline: true, max: 300 },
  ),
  text("home.why.card3.title", "why", "Card 3 title", "Keep everything in one place", { max: 60 }),
  text(
    "home.why.card3.text",
    "why",
    "Card 3 text",
    "Your application, documents and our review notes live in your StudyBg account, not scattered across emails.",
    { multiline: true, max: 300 },
  ),
  text("home.why.calloutLead", "why", "Highlighted note: bold start", "You can apply directly to each university.", { max: 120 }),
  text(
    "home.why.callout",
    "why",
    "Highlighted note: rest of the sentence",
    "StudyBg is an independent service for applicants who want structured guidance and support.",
    { multiline: true, max: 300 },
  ),

  text("home.universities.title", "universities", "Section title", "Compare the four medical universities", { max: 100 }),
  text(
    "home.universities.intro",
    "universities",
    "Intro paragraph",
    "Requirements are set by each university and change between years. Each card links to the official page it’s based on. The university makes the final decision.",
    { multiline: true, max: 400 },
  ),
  image("uni.mu-sofia.image", "universities", "Photo: Medical University of Sofia", "Wide photo (16:9 works best)."),
  image("uni.mu-plovdiv.image", "universities", "Photo: Medical University of Plovdiv", "Wide photo (16:9 works best)."),
  image("uni.mu-varna.image", "universities", "Photo: Medical University of Varna", "Wide photo (16:9 works best)."),
  image("uni.mu-pleven.image", "universities", "Photo: Medical University of Pleven", "Wide photo (16:9 works best)."),

  text("home.journey.title", "journey", "Section title", "How it works, in six steps", { max: 80 }),

  text("home.gateway.intro", "gateway", "Paragraph under the Gateway title", "For when you’ve decided on Bulgaria and want someone independent to go through your file with you. One payment, no subscription.", {
    multiline: true,
    max: 400,
  }),
  text("home.gateway.startButton", "gateway", "Start button", "Start my application", { max: 40 }),

  text("home.closing.title", "closing", "Title", "Still deciding? Start with the free check.", { max: 100 }),
  text(
    "home.closing.text",
    "closing",
    "Paragraph",
    "Five questions, a clear list of what’s ready and what needs checking, and a link to the official requirements. Then decide if you want our help.",
    { multiline: true, max: 400 },
  ),
];

export const CONTENT_BY_KEY = Object.fromEntries(SITE_CONTENT.map((c) => [c.key, c]));

/** Clean what an admin typed: normal line breaks, no control characters, trimmed, and within the limit. */
export function cleanContentText(def, raw) {
  const value = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!value) return { error: "This can't be empty. Use “Reset to original” to go back to the original text." };
  if (!def.multiline && value.includes("\n")) return { error: "This one is a single line." };
  if (value.length > def.max) return { error: `Keep this to ${def.max} characters or fewer (it is ${value.length}).` };
  return { value };
}
