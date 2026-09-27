/** AI replies are shown as plain text (Siri bubble, Terminal): strip markdown. */
export const toPlainText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) → label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s*[-*•]\s+/gm, "") // bullets
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, "$1$2") // italics
    .replace(/[*#]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
