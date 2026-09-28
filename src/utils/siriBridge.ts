// Lets other parts of the site (Spotlight) hand Siri a typed question.
let pending: string | null = null;

export function askSiri(question: string) {
  pending = question;
  window.dispatchEvent(new CustomEvent("app:open", { detail: "siri" }));
  // Siri already open: it picks the question up from this event.
  window.dispatchEvent(new CustomEvent("siri:ask"));
}

export function takeSiriQuestion() {
  const q = pending;
  pending = null;
  return q;
}
