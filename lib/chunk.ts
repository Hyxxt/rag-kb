/**
 * 文本切块与词法索引。
 *
 * 中文没有空格，这里用「字符二元组」（bigram）建倒排索引：
 * 「门锁保修」→ 门锁 / 锁保 / 保修。英文和数字按单词处理。
 * 好处是不依赖分词服务和向量模型，SQLite / Turso 都能跑。
 */

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function tokenize(input: string): string[] {
  const text = input.toLowerCase();
  const terms: string[] = [];

  for (const match of text.matchAll(/[a-z0-9][a-z0-9_-]*/g)) {
    if (match[0].length >= 2) terms.push(match[0]);
  }

  const runs = text.match(/[㐀-鿿豈-﫿]+/g) ?? [];
  for (const run of runs) {
    if (run.length === 1) {
      terms.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i += 1) {
      terms.push(run.slice(i, i + 2));
    }
  }

  return terms;
}

export function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

const SECTION_HEADING =
  /^(?:[一二三四五六七八九十]+、|第[一二三四五六七八九十\d]+[章节]|[（(]?[一二三四五六七八九十\d]+[）)、.．])/;

function splitLongParagraph(paragraph: string, maxChars: number): string[] {
  const sentences = paragraph.split(/(?<=[。！？!?；;])/);
  const pieces: string[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    if (buffer && buffer.length + sentence.length > maxChars) {
      pieces.push(buffer);
      buffer = sentence;
    } else {
      buffer += sentence;
    }
  }
  if (buffer) pieces.push(buffer);
  return pieces;
}

export function chunkText(
  input: string,
  maxChars = 520,
  overlapChars = 80,
): string[] {
  const text = normalizeText(input);
  if (!text) return [];

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const pieces: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      pieces.push(paragraph);
    } else {
      pieces.push(...splitLongParagraph(paragraph, maxChars));
    }
  }

  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces) {
    if (!current) {
      current = piece;
      continue;
    }

    // 有明确小标题时按章节切块，检索定位更准；
    // 开头的短标题（文档名）仍然并入第一节，避免产生无意义的碎块。
    if (SECTION_HEADING.test(piece) && current.length >= 80) {
      chunks.push(current);
      current = piece;
      continue;
    }

    if (current.length + piece.length + 2 <= maxChars) {
      current += "\n\n" + piece;
      continue;
    }
    chunks.push(current);
    const overlap = overlapChars > 0 ? current.slice(-overlapChars) : "";
    current = overlap + (overlap ? "\n\n" : "") + piece;
  }

  if (current) chunks.push(current);

  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}
