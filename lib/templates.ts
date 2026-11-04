// Starter automations for /automations/new?template=<key>: five tones for sending a website link in DMs.
// Wording stays topic-neutral (the link can be anything the Reel talks about). Every field stays editable.
// Limits: button labels ≤ 20 chars, messages ≤ 640. {username} becomes the commenter's @handle.

export type Template = {
  key: string;
  emoji: string;
  title: string;
  blurb: string;
  name: string;
  keywords: string;
  match_mode: "exact" | "contains";
  initial_message: string;
  button_label: string;
  comment_replies: string;
  content_message: string;
  link_button_label: string;
  not_following_message: string;
  verification_error_message: string;
};

export const TEMPLATES: Template[] = [
  {
    key: "classic",
    emoji: "🔗",
    title: "Classic",
    blurb: "Friendly and clear. Works for any Reel.",
    name: "Link in DMs",
    keywords: "LINK",
    match_mode: "contains",
    initial_message: "Hey {username}! 👋 Thanks for the comment. Tap below and I'll send you the link 👇",
    button_label: "Send me the link",
    comment_replies: "Link's in your DMs 🔗\nSent it over {username}!\nCheck your inbox 👀",
    content_message: "Here's the link from the Reel 🙌 Have a look and let me know what you think!",
    link_button_label: "Open link",
    not_following_message: "Almost there 💛 The link is for followers. Tap View profile, hit Follow, then come back and tap I've followed.",
    verification_error_message: "I couldn't check that just now 🙈 Give it a few seconds and tap I've followed again.",
  },
  {
    key: "hype",
    emoji: "🔥",
    title: "Hype",
    blurb: "High energy for Reels that are blowing up.",
    name: "Link in DMs (hype)",
    keywords: "LINK",
    match_mode: "contains",
    initial_message: "{username} YOU'RE FAST 🔥 The link is ready to go. Smash the button 👇",
    button_label: "Give me the link 🔥",
    comment_replies: "🔥 Sent! Check your DMs\nIncoming {username} 🚀\nIt's in your inbox, go go go ⚡",
    content_message: "Boom 💥 here's the link! Go check it out 👀",
    link_button_label: "Let's go 🚀",
    not_following_message: "Wait wait wait ✋ this one's for the squad. Tap View profile, follow, then smash I've followed and it's yours 🔥",
    verification_error_message: "Instagram's lagging 😤 Give it a sec and tap I've followed again.",
  },
  {
    key: "minimal",
    emoji: "✨",
    title: "Minimal",
    blurb: "Short and clean. No fluff, just the link.",
    name: "Link in DMs (minimal)",
    keywords: "LINK",
    match_mode: "exact",
    initial_message: "Hi {username}, here's what you asked for 👇",
    button_label: "Get the link",
    comment_replies: "Sent ✓\nCheck your DMs ✓\nIn your inbox {username} ✓",
    content_message: "Here you go ✨",
    link_button_label: "Open",
    not_following_message: "Follow to unlock. Tap View profile, follow, then I've followed.",
    verification_error_message: "Couldn't verify. Try I've followed again in a moment.",
  },
  {
    key: "mystery",
    emoji: "🤫",
    title: "Mystery",
    blurb: "Playful secret-link vibe that drives curiosity.",
    name: "Secret link",
    keywords: "LINK",
    match_mode: "contains",
    initial_message: "Psst {username} 🤫 You found the secret link. Only people who comment get it. Ready? 👇",
    button_label: "Reveal the link 🤫",
    comment_replies: "Shh… check your DMs 🤫\nThe secret's in your inbox {username} 🔐\nDelivered quietly 👀",
    content_message: "You're in 🗝️ Here's the link. Keep it between us 😉",
    link_button_label: "Open the link",
    not_following_message: "The link's only for followers 🔐 Tap View profile, follow, then tap I've followed and I'll reveal it.",
    verification_error_message: "The vault's stuck 😅 Wait a moment and tap I've followed again.",
  },
  {
    key: "curious",
    emoji: "👀",
    title: "Curious",
    blurb: "Warm and conversational, like a personal reply.",
    name: "Link in DMs (curious)",
    keywords: "LINK",
    match_mode: "contains",
    initial_message: "Ooh, you want to know more, {username}? 👀 Tap below and I'll send the link straight to you 👇",
    button_label: "Show me 👀",
    comment_replies: "Just sent it to your DMs 💌\nCheck your inbox {username} ✨\nDMed you the link 👀",
    content_message: "Here it is 💫 Everything I talked about in the Reel is right here. Enjoy!",
    link_button_label: "Take a look",
    not_following_message: "So close 💛 Follow me to get the link: tap View profile, follow, then tap I've followed.",
    verification_error_message: "Hmm, I couldn't check that 🤔 Tap I've followed again in a few seconds.",
  },
];

export const templateByKey = (key?: string) => TEMPLATES.find((t) => t.key === key);
