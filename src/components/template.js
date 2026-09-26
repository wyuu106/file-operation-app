/** @typedef {import('../api').Segment} Segment */

export const defaultSegments = [
  { kind: "date", value: "" },
  { kind: "literal", value: "請求書" },
  { kind: "number", value: "" },
];

export const labels = {
  date: "日付",
  original: "ファイル名",
  company: "会社名",
  name: "名前",
  number: "連番",
  literal: "固定文字",
};

/** @param {string|undefined} value */
export function formattedName(value) {
  const plain = value
    ?.trim()
    .replace(/様+$/, "")
    .trim();
  return plain ? `${plain}様` : "";
}

/** @param {string} pattern */
export function readPattern(pattern) {
  try {
    const value = JSON.parse(pattern);
    if (Array.isArray(value)) {
      return value;
    }
  } catch {
    // 古い形式は編集画面で作り直せる。
  }
  return defaultSegments;
}

/** @param {Segment[]} segments */
export function exampleName(segments) {
  const date = new Date();
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const parts = segments.map((segment) => {
    switch (segment.kind) {
      case "date":
        return day;
      case "original":
        return "invoice";
      case "company":
        return "【A社】";
      case "name":
        return formattedName("太郎");
      case "number":
        return "001";
      default:
        return segment.value || "固定文字";
    }
  });
  const base = parts.reduce(
    (name, part, index) =>
      name +
      (index > 0 &&
      segments[index - 1].kind !== "company"
        ? "_"
        : "") +
      part,
    "",
  );
  return `${base}.pdf`;
}
