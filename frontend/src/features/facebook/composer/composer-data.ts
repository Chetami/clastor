/**
 * Static content that powers the post composer: reusable marketing templates,
 * a curated emoji palette, and tutor-relevant hashtags. Kept separate from the
 * components so it can grow without touching UI logic.
 */

export interface PostTemplate {
  /** Stable id for React keys. */
  id: string;
  /** Short label shown in the picker. */
  title: string;
  /** lucide-react icon name resolved by the picker. */
  icon: string;
  /** One-line hint shown under the title. */
  hint: string;
  /** The body, with `{{placeholders}}` the user fills in. */
  body: string;
}

/**
 * Starter copy for common tutor marketing moments. Users keep what they like
 * and edit the bracketed placeholders. These are suggestions, not hard rules.
 */
export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: "new-slots",
    title: "New slots",
    icon: "CalendarPlus",
    hint: "Announce freshly opened booking times.",
    body:
      "📚 New slots just opened up for {{subject}}!\n\n" +
      "I've added times on {{days}} — perfect for {{audience}}.\n\n" +
      "Drop a message or DM to grab yours before they go. 🔖",
  },
  {
    id: "promotion",
    title: "Promotion",
    icon: "BadgePercent",
    hint: "Discount or limited-time offer.",
    body:
      "🎉 Limited-time offer!\n\n" +
      "Book {{n}} lessons before {{date}} and get {{discount}}% off your first session.\n\n" +
      "Great for {{audience}} who want to get ahead in {{subject}}. " +
      "Tap the link or message me to claim ✨",
  },
  {
    id: "results",
    title: "Results",
    icon: "Trophy",
    hint: "Celebrate student outcomes.",
    body:
      "🏆 So proud of my students this term!\n\n" +
      "{{count}} of them moved up at least {{amount}} grade(s) in {{subject}}. " +
      "Hard work really does pay off 💪\n\n" +
      "Well done all — onto the next goal! 🚀",
  },
  {
    id: "new-course",
    title: "New course",
    icon: "BookOpen",
    hint: "Launch a new subject or group class.",
    body:
      "🆕 New group class launching!\n\n" +
      "{{subject}} for {{audience}}, starting {{date}}.\n" +
      "Small groups, weekly sessions, and all materials included.\n\n" +
      "Only {{seats}} seats — message me to reserve yours. 📩",
  },
  {
    id: "term-start",
    title: "Term reminder",
    icon: "BellRing",
    hint: "Welcome back / term kickoff.",
    body:
      "🔔 Term starts {{date}}!\n\n" +
      "A quick reminder that {{subject}} lessons resume this week. " +
      "Check your booked time and let me know if anything needs moving.\n\n" +
      "Let's make it a great term 🌟",
  },
  {
    id: "testimonial",
    title: "Testimonial",
    icon: "Quote",
    hint: "Share a parent/student review.",
    body:
      "💬 \"{{quote}}\"\n\n" +
      "— {{who}}, {{relation}}\n\n" +
      "Messages like this make my day. Thank you for trusting me with " +
      "{{subject}} 🙏",
  },
  {
    id: "tip",
    title: "Quick tip",
    icon: "Lightbulb",
    hint: "Free value post to build reach.",
    body:
      "💡 Quick {{subject}} tip:\n\n" +
      "{{tip}}\n\n" +
      "Try it on your next practice paper and let me know how it goes! 👇",
  },
  {
    id: "intro",
    title: "Introduce yourself",
    icon: "UserRound",
    hint: "Pinned-style intro for new visitors.",
    body:
      "👋 Hi, I'm {{name}}!\n\n" +
      "I tutor {{subject}} to {{audience}}, both online and in person.\n\n" +
      "✅ {{credential}}\n" +
      "✅ {{credential2}}\n" +
      "✅ Flexible times to fit your schedule\n\n" +
      "Send a message to chat about how I can help 📩",
  },
];

/**
 * Curated emoji palette, grouped. Kept short on purpose — a giant picker is
 * noisy. Covers the emotions tutors reach for most. The final "🩷" row holds
 * recent/quick reactions users click often.
 */
export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Frequently used",
    emojis: ["😀", "😃", "😄", "😁", "🙂", "😉", "😍", "🥳", "😎", "🤩", "🙏", "👍"],
  },
  {
    label: "School",
    emojis: ["📚", "✏️", "📝", "📖", "🎒", "🧮", "🔬", "🧪", "🎓", "🏫", "✅", "⭐"],
  },
  {
    label: "Celebrate",
    emojis: ["🎉", "🎊", "🏆", "🥇", "🎁", "✨", "🚀", "💪", "🔥", "👏", "💯", "🌟"],
  },
  {
    label: "Love & thanks",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🩷", "🤗", "🥰", "😊", "💌", "🙌"],
  },
  {
    label: "Symbols",
    emojis: ["➡️", "⬇️", "✅", "❌", "❗", "❓", "💬", "📩", "🔗", "🔖", "⏰", "📍"],
  },
];

/**
 * Hashtag shortcuts, appended to the message on click. Kept generic enough to
 * suit most tutoring niches.
 */
export const HASHTAG_SUGGESTIONS: string[] = [
  "#tutoring",
  "#tutor",
  "#mathstutor",
  "#englishtutor",
  "#sciencetutor",
  "#onlinetutoring",
  "#examprep",
  "#GCSE",
  "#ALevels",
  "#studytips",
  "#privatetutor",
  "#learning",
];
