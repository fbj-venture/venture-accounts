import type { UploadEvent } from "#/routes/api/books/import.ts";

// Collapses a stream of UploadEvents into human-readable lines. Per-row
// "importing" events update the same trailing line in place (there can be
// 50-100+ of them per statement) instead of appending one DOM node each.
export function toDisplayLines(events: UploadEvent[]): string[] {
  const lines: string[] = [];

  for (const event of events) {
    switch (event.phase) {
      case "uploaded":
        lines.push(
          `Uploaded ${event.fileName} (${Math.round(event.size / 1024)} KB).`,
        );
        break;
      case "extracting":
        lines.push("Extracting transactions from the PDF...");
        break;
      case "extracted":
        lines.push(
          `Found ${event.rowCount} transaction${event.rowCount === 1 ? "" : "s"} ` +
          `for account ${event.accountNumber}, statement dated ${event.statementDate}.`,
        );
        break;
      case "importing": {
        const text =
          `Importing ${event.index + 1}/${event.total}: ` +
          `${event.status === "skipped" ? "skipped (already imported)" : "imported"} - ` +
          event.transaction.details;
        if (lines.at(-1)?.startsWith("Importing ")) {
          lines[lines.length - 1] = text;
        } else {
          lines.push(text);
        }
        break;
      }
      case "done":
        lines.push(
          `Done - ${event.imported} imported, ${event.skipped} skipped, ${event.total} total.`,
        );
        break;
      case "error":
        lines.push(`Error: ${event.message}`);
        break;
    }
  }

  return lines;
}

// Phases before per-row importing starts don't have a natural 0-100 value
// (there's nothing to count yet), so they get fixed checkpoints; importing
// then scales smoothly across the rest of the bar.
export function toProgressValue(events: UploadEvent[]): number {
  const lastEvent = events.at(-1);
  if (!lastEvent) return 0;

  switch (lastEvent.phase) {
    case "uploaded":
      return 5;
    case "extracting":
      return 10;
    case "extracted":
      return 15;
    case "importing":
      return 15 + ((lastEvent.index + 1) / lastEvent.total) * 85;
    case "done":
    case "error":
      return 100;
  }
}
