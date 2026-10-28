import { describe, expect, it } from "vitest";
import {
  chunkArray,
  paginateByWeight,
  splitTextPages,
  wrapPaperText,
} from "@/lib/paper/pagination";

describe("paper pagination", () => {
  it("always returns one page for an empty list", () => {
    expect(chunkArray([], 8)).toEqual([[]]);
  });

  it("splits rows into fixed-size pages", () => {
    const rows = Array.from({ length: 17 }, (_, index) => index);
    expect(chunkArray(rows, 6)).toEqual([
      [0, 1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10, 11],
      [12, 13, 14, 15, 16],
    ]);
  });

  it("wraps text on word boundaries and preserves blank lines", () => {
    expect(wrapPaperText("one two three\n\nfour", 9)).toEqual([
      "one two",
      "three",
      "",
      "four",
    ]);
  });

  it("splits very long words rather than losing text", () => {
    expect(wrapPaperText("abcdefghijkl", 5)).toEqual(["abcde", "fghij", "kl"]);
  });

  it("splits wrapped text into pages without dropping the tail", () => {
    const pages = splitTextPages("one two three four five six", 2, 7);
    expect(pages).toEqual([
      ["one two", "three"],
      ["four", "five"],
      ["six"],
    ]);
    expect(pages.flat().join(" ")).toBe("one two three four five six");
  });

  it("keeps an empty text as one empty page", () => {
    expect(splitTextPages("", 8)).toEqual([[]]);
  });

  it("packs weighted rows and gives an oversized row its own page", () => {
    const rows = [{ w: 3 }, { w: 4 }, { w: 20 }, { w: 2 }];
    expect(paginateByWeight(rows, (row) => row.w, 8)).toEqual([
      [{ w: 3 }, { w: 4 }],
      [{ w: 20 }],
      [{ w: 2 }],
    ]);
  });

  it("always returns one page for an empty weighted list", () => {
    expect(paginateByWeight([], () => 1, 8)).toEqual([[]]);
  });
});
