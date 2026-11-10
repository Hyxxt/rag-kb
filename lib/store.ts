import { randomUUID } from "node:crypto";
import { chunkText, termFrequency, tokenize } from "./chunk";
import { dbAll, dbBatch, type Statement } from "./db";
import { SAMPLE_DOCS } from "./samples";
import type { DocumentMeta } from "./types";

type DocumentRow = {
  id: string;
  title: string;
  source: string;
  created_at: string;
  char_count: number | bigint;
  chunk_count: number | bigint;
};

export type ChunkRow = {
  id: string;
  document_id: string;
  ordinal: number | bigint;
  text: string;
  token_count: number | bigint;
  title: string;
};

function mapDocument(row: DocumentRow): DocumentMeta {
  return {
    id: String(row.id),
    title: String(row.title),
    source: String(row.source),
    createdAt: String(row.created_at),
    charCount: Number(row.char_count),
    chunkCount: Number(row.chunk_count),
  };
}

async function runInBatches(
  statements: Statement[],
  size = 400,
): Promise<void> {
  for (let i = 0; i < statements.length; i += size) {
    await dbBatch(statements.slice(i, i + size));
  }
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  const rows = (await dbAll(
    `SELECT id, title, source, created_at, char_count, chunk_count
     FROM documents ORDER BY created_at DESC`,
  )) as unknown as DocumentRow[];
  return rows.map(mapDocument);
}

export async function createDocument(input: {
  title: string;
  text: string;
  source?: string;
}): Promise<DocumentMeta> {
  const text = input.text.trim();
  if (!text) throw new Error("文档内容为空");

  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error("文档切块后为空");

  const id = randomUUID();
  const source = input.source?.trim() || "upload";
  const createdAt = new Date().toISOString();

  const statements: Statement[] = [
    {
      sql: `INSERT INTO documents
        (id, title, source, created_at, char_count, chunk_count)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, input.title, source, createdAt, text.length, chunks.length],
    },
  ];

  const termStatements: Statement[] = [];

  chunks.forEach((chunk, index) => {
    const chunkId = randomUUID();
    const tokens = tokenize(chunk);
    statements.push({
      sql: `INSERT INTO chunks (id, document_id, ordinal, text, token_count)
        VALUES (?, ?, ?, ?, ?)`,
      args: [chunkId, id, index + 1, chunk, tokens.length],
    });

    for (const [term, freq] of termFrequency(tokens)) {
      termStatements.push({
        sql: `INSERT INTO chunk_terms (chunk_id, term, freq) VALUES (?, ?, ?)`,
        args: [chunkId, term, freq],
      });
    }
  });

  try {
    await dbBatch(statements);
    await runInBatches(termStatements);
  } catch (error) {
    await deleteDocument(id).catch(() => undefined);
    throw error;
  }

  return {
    id,
    title: input.title,
    source,
    createdAt,
    charCount: text.length,
    chunkCount: chunks.length,
  };
}

export async function deleteDocument(id: string): Promise<void> {
  await dbBatch([
    {
      sql: `DELETE FROM chunk_terms
        WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id = ?)`,
      args: [id],
    },
    { sql: `DELETE FROM chunks WHERE document_id = ?`, args: [id] },
    { sql: `DELETE FROM documents WHERE id = ?`, args: [id] },
  ]);
}

let autoSeedPromise: Promise<{ inserted: number }> | null = null;

/**
 * 线上没有持久磁盘时（AUTO_SEED=1），冷启动后自动补一次示例数据，
 * 避免演示站打开是空库。并发请求共用同一个 Promise，避免重复写入。
 */
export async function seedIfEmpty(): Promise<{ inserted: number }> {
  if (process.env.AUTO_SEED !== "1") return { inserted: 0 };

  if (!autoSeedPromise) {
    autoSeedPromise = (async () => {
      const rows = await dbAll(`SELECT COUNT(*) AS n FROM documents`);
      if (Number(rows[0]?.n ?? 0) > 0) return { inserted: 0 };
      return seedDocuments();
    })().catch((error) => {
      autoSeedPromise = null;
      throw error;
    });
  }

  return autoSeedPromise;
}

export async function seedDocuments(): Promise<{ inserted: number }> {
  const rows = await dbAll(
    `SELECT COUNT(*) AS n FROM documents WHERE source = 'sample'`,
  );
  const existing = Number(rows[0]?.n ?? 0);
  if (existing > 0) return { inserted: 0 };

  for (const doc of SAMPLE_DOCS) {
    await createDocument({ ...doc, source: "sample" });
  }
  return { inserted: SAMPLE_DOCS.length };
}

export async function corpusStats(): Promise<{
  count: number;
  avgdl: number;
}> {
  const rows = await dbAll(
    `SELECT COUNT(*) AS n, COALESCE(AVG(token_count), 0) AS avgdl FROM chunks`,
  );
  return {
    count: Number(rows[0]?.n ?? 0),
    avgdl: Number(rows[0]?.avgdl ?? 0),
  };
}

export async function findTermRows(
  terms: string[],
): Promise<{ chunkId: string; term: string; freq: number }[]> {
  if (terms.length === 0) return [];

  const placeholders = terms.map(() => "?").join(",");
  const rows = await dbAll(
    `SELECT chunk_id, term, freq FROM chunk_terms WHERE term IN (${placeholders})`,
    terms,
  );

  return rows.map((row) => ({
    chunkId: String(row.chunk_id),
    term: String(row.term),
    freq: Number(row.freq),
  }));
}

export async function chunksWithTitles(ids: string[]): Promise<ChunkRow[]> {
  if (ids.length === 0) return [];

  const rows: ChunkRow[] = [];
  for (let i = 0; i < ids.length; i += 400) {
    const slice = ids.slice(i, i + 400);
    const placeholders = slice.map(() => "?").join(",");
    const batch = (await dbAll(
      `SELECT c.id, c.document_id, c.ordinal, c.text, c.token_count, d.title
       FROM chunks c JOIN documents d ON d.id = c.document_id
       WHERE c.id IN (${placeholders})`,
      slice,
    )) as unknown as ChunkRow[];
    rows.push(...batch);
  }
  return rows;
}
