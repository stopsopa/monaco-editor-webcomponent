/**
 * Removes the common indentation of a block of text and optionally indents the result again.
 *
 *   trimLeft("    a\n      b")      -> "a\n  b"
 *   trimLeft("    a\n      b", 2)   -> "  a\n    b"
 *
 * - Blank (whitespace-only) lines are ignored when the common indentation is measured and they are
 *   never padded by `offset`, so the result has no trailing-whitespace-only lines of its own making.
 * - Indentation is counted in characters: a tab counts as one, the same as a space. Text that mixes
 *   tabs and spaces for indentation is therefore de-indented by the smallest character count.
 */
export default function trimLeft(str: string, offset: number | string = 0) {
  let o = typeof offset === "number" ? offset : parseInt(offset, 10);

  if (isNaN(o)) {
    throw new Error(`offset must be a number, ${offset}`);
  }

  if (o < 0) {
    throw new Error(`offset must be a non-negative number, ${offset}`);
  }

  // Auto-detect indentation
  const lines = str.split("\n");

  let diff = Infinity;

  lines.forEach((line) => {
    if (!/^\s*$/.test(line)) {
      const lengthBefore = line.length;

      const lengthAfter = line.replace(/^\s+/, "").length;

      const indentation = lengthBefore - lengthAfter;

      if (indentation < diff) {
        diff = indentation;
      }
    }
  });

  let result = lines.map((line) => line.substring(diff));

  if (o > 0) {
    const spaces = " ".repeat(o);

    result = result.map((line) => (line === "" ? line : `${spaces}${line}`));
  }

  return result.join("\n");
}
