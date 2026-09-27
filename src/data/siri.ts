// Siri's instructions and tools. Imported by the serverless proxy
// (api/siri/chat.ts) so the prompt can't be swapped out from the browser.
import { profile, profileAsText } from "./profile";

export const SIRI_FALLBACK = `I can help you explore ${profile.firstName}'s portfolio — ask me about his projects, skills or education, or ask me to open an app, play music or toggle dark mode!`;

export const SIRI_SYSTEM_PROMPT = `You are Siri, a friendly assistant inside ${profile.name}'s macOS-style web portfolio.
Visitors are often recruiters or fellow developers. You can answer questions about ${profile.firstName} and control the interface through tool calls.
Keep replies short, warm and conversational (1–3 sentences) — they are read aloud.

Everything you know about ${profile.firstName} is below. This is the ONLY source of truth:
"""
${profileAsText()}
"""

RULES:
1. Answer questions about ${profile.firstName} using ONLY the facts above. Never invent experience, companies, numbers, dates or projects. If the answer isn't there, say you don't know and suggest emailing him at ${profile.email}.
2. Only call download_resume when the user explicitly asks for the résumé / CV.
3. For time/date questions, call get_current_time.
4. Prefer calling a tool over giving instructions when the user asks you to do something in the interface.
5. If the request is unrelated to ${profile.firstName} or the portfolio, reply exactly: "${SIRI_FALLBACK}"
6. Refer to ${profile.firstName} in the third person. You are Siri, not ${profile.firstName}.`;

export const SIRI_TOOLS = [
  { type: "function", function: { name: "toggle_dark_mode", description: "Toggles the dark/light theme." } },
  { type: "function", function: { name: "play_music", description: "Plays the background music / song." } },
  { type: "function", function: { name: "pause_music", description: "Pauses the currently playing music / song." } },
  { type: "function", function: { name: "set_volume", description: "Sets the system volume.", parameters: { type: "object", properties: { level: { type: "number", description: "Volume level 0-100." } }, required: ["level"] } } },
  { type: "function", function: { name: "set_brightness", description: "Sets the display brightness.", parameters: { type: "object", properties: { level: { type: "number", description: "Brightness level 1-100." } }, required: ["level"] } } },
  { type: "function", function: { name: "toggle_wifi", description: "Toggles Wi-Fi on or off." } },
  { type: "function", function: { name: "toggle_bluetooth", description: "Toggles Bluetooth on or off." } },
  { type: "function", function: { name: "open_app", description: "Opens an app window.", parameters: { type: "object", properties: { app_id: { type: "string", description: "One of: finder, safari, bear, terminal, vscode, mail, notes, music, photos, facetime, typora, system-settings" } }, required: ["app_id"] } } },
  { type: "function", function: { name: "close_app", description: "Closes an app window.", parameters: { type: "object", properties: { app_id: { type: "string", description: "One of: finder, safari, bear, terminal, vscode, mail, notes, music, photos, facetime, typora, system-settings" } }, required: ["app_id"] } } },
  { type: "function", function: { name: "get_current_time", description: "Returns the current date and time." } },
  { type: "function", function: { name: "toggle_fullscreen", description: "Toggles full screen mode." } },
  { type: "function", function: { name: "download_resume", description: `Downloads ${profile.firstName}'s résumé PDF. Only call this when the user explicitly asks for the résumé / CV or to download it.` } },
  { type: "function", function: { name: "open_launchpad", description: `Opens the Launchpad to show ${profile.firstName}'s projects.` } },
];
