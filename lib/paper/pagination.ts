/**
 * Pagination helpers for long logbook sheets.
 *
 * Fixed sheets clip at one A4 page (`overflow: hidden`), while flow sheets
 * fragment across pages without repeating the college header. The reliable
 * pattern is the one used by the members/schedule sheets: split the data here
 * and render explicit PaperPage siblings, each with its own header and number.
 */

/** Split items into fixed-size pages. Always returns at least one page. */
export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("page size must be a positive integer");
  }
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

/**
 * Pack items into pages using an estimated height/weight per item. This is for
 * table rows whose height depends on how much text wraps inside a cell.
 * A single item heavier than the page budget still gets its own page.
 */
export function paginateByWeight<T>(
  items: readonly T[],
  weight: (item: T) => number,
  maxWeight: number,
): T[][] {
  if (!Number.isFinite(maxWeight) || maxWeight <= 0) {
    throw new Error("maxWeight must be a positive number");
  }
  if (items.length === 0) return [[]];

  const pages: T[][] = [];
  let page: T[] = [];
  let used = 0;

  for (const item of items) {
    const itemWeight = Math.max(1, Math.ceil(weight(item)));
    if (page.length > 0 && used + itemWeight > maxWeight) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(item);
    used += itemWeight;
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

/**
 * Wrap free text to a conservative character width so read-only Field text
 * cannot wrap past its reserved underline rows. Blank lines are preserved so
 * paragraph spacing survives pagination.
 */
export function wrapPaperText(value: string, maxChars = 100): string[] {
  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    throw new Error("maxChars must be a positive integer");
  }
  if (value.length === 0) return [];

  const lines: string[] = [];
  for (const rawLine of value.replace(/\r\n/g, "\n").split("\n")) {
    if (rawLine.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const rawWord of rawLine.split(/\s+/)) {
      let word = rawWord;
      while (word.length > maxChars) {
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }
      if (!word) continue;
      if (!line) {
        line = word;
      } else if (line.length + 1 + word.length <= maxChars) {
        line += ` ${word}`;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

/** Split free text into pages of at most `linesPerPage` wrapped lines. */
export function splitTextPages(
  value: string,
  linesPerPage = 32,
  maxChars = 100,
): string[][] {
  return chunkArray(wrapPaperText(value, maxChars), linesPerPage);
}
