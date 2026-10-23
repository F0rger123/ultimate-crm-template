// textFormat.ts — strips markdown formatting an LLM sometimes adds to a
// reply even when told "no markdown" in the system prompt (Gemini in
// particular does this often for lists/emphasis). An SMS has no markdown
// renderer, so **bold**, *italic*, `code`, and "# Heading" show up to the
// recipient as literal asterisks/backticks/hashes — exactly what an owner
// reported seeing. Applied as a last line of defense right before any
// Alfred-composed text goes out over SMS, on top of (not instead of) the
// system prompt instruction.
export const stripMarkdownForSms = (text: string): string => {
  if (!text) return text;
  return text
    // bullet markers "* item" / "- item" at line start -> "• item"
    .replace(/^[ \t]*[*-][ \t]+/gm, "• ")
    // bold/italic pairs: **text**/__text__ -> text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    // remaining single */_ emphasis -> text (not touching stray/mid-word
    // characters like a file_name or a lone "*" used conversationally)
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+?)_(?!_)/g, "$1")
    // inline/fenced code
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    // "## Heading" -> "Heading"
    .replace(/^#{1,6}[ \t]+/gm, "")
    // [text](url) -> text: url
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    .trim();
};
