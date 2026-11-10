import { tokenize } from "./chunk";
import { chunksWithTitles, corpusStats, findTermRows } from "./store";
import type { Source } from "./types";

/**
 * 词法检索 + BM25 打分。
 *
 * 查询和文档使用同一套 bigram 分词；先走倒排表拿候选块，
 * 再按 BM25（k1=1.5, b=0.75）排序，返回 topK。
 */
export async function retrieve(
  question: string,
  topK = 4,
): Promise<Source[]> {
  const terms = [...new Set(tokenize(question))].slice(0, 40);
  if (terms.length === 0) return [];

  const [stats, termRows] = await Promise.all([
    corpusStats(),
    findTermRows(terms),
  ]);

  if (stats.count === 0 || termRows.length === 0) return [];

  const byChunk = new Map<string, Map<string, number>>();
  const documentFrequency = new Map<string, number>();

  for (const row of termRows) {
    let frequencies = byChunk.get(row.chunkId);
    if (!frequencies) {
      frequencies = new Map<string, number>();
      byChunk.set(row.chunkId, frequencies);
    }
    frequencies.set(row.term, row.freq);
    documentFrequency.set(
      row.term,
      (documentFrequency.get(row.term) ?? 0) + 1,
    );
  }

  const chunks = await chunksWithTitles([...byChunk.keys()]);
  const averageLength = stats.avgdl || 1;
  const k1 = 1.5;
  const b = 0.75;

  const scored = chunks.map((chunk) => {
    const frequencies = byChunk.get(String(chunk.id));
    if (!frequencies) return { chunk, score: 0 };

    const length = Number(chunk.token_count) || 1;
    let score = 0;

    for (const [term, freq] of frequencies) {
      const df = documentFrequency.get(term) ?? 1;
      const idf = Math.log(1 + (stats.count - df + 0.5) / (df + 0.5));
      score +=
        (idf * (freq * (k1 + 1))) /
        (freq + k1 * (1 - b + (b * length) / averageLength));
    }

    return { chunk, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item, index) => ({
      index: index + 1,
      chunkId: String(item.chunk.id),
      documentId: String(item.chunk.document_id),
      title: String(item.chunk.title),
      ordinal: Number(item.chunk.ordinal),
      text: String(item.chunk.text),
      score: Math.round(item.score * 1000) / 1000,
    }));
}
