import { profile } from "~/data/profile";

// Visitor messages reach Ambuj's inbox via Web3Forms (client-side by design;
// the access key can only send to the owner's address).
const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined;

export const contactFormEnabled = !!WEB3FORMS_KEY;

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Honeypot: real people never tick it. */
  botcheck?: boolean;
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** Sends the message; resolves true on success. */
export async function sendContactMessage(m: ContactMessage): Promise<boolean> {
  if (!WEB3FORMS_KEY) return false;
  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `[Portfolio] ${m.subject || "New message"}`,
        from_name: m.name,
        name: m.name,
        email: m.email,
        replyto: m.email,
        message: m.message,
        botcheck: m.botcheck ?? false
      })
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

/** Fallback when the form isn't configured: open the visitor's mail app. */
export const mailtoLink = (m: Pick<ContactMessage, "name" | "email" | "subject" | "message">) =>
  `mailto:${profile.email}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(`${m.message}\n\n— ${m.name} (${m.email})`)}`;
