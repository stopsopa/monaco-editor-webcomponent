export default function trimLeft(str, offset = 0) {
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
    result = result.map((line) => `${spaces}${line}`);
  }
  return result.join("\n");
}
