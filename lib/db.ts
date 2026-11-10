/**
 * 数据库访问层。
 *
 * 本地默认 node:sqlite（零配置，文件在 .data/rag.db）；
 * 配置 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 后自动切换到 Turso 云数据库。
 * 两边表结构一致，SQL 也一致。
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Client } from "@libsql/client";

export type SqlValue = string | number | null;
export type Row = Record<string, unknown>;
export type Statement = { sql: string; args?: SqlValue[] };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    char_count INTEGER NOT NULL,
    chunk_count INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_count INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chunk_terms (
    chunk_id TEXT NOT NULL,
    term TEXT NOT NULL,
    freq INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chunk_terms_term ON chunk_terms(term)`,
];

let localDbPromise: Promise<DatabaseSync> | null = null;
let remoteClientPromise: Promise<Client> | null = null;
let schemaPromise: Promise<void> | null = null;

function tursoUrl(): string {
  return process.env.TURSO_DATABASE_URL?.trim() ?? "";
}

function isTursoEnabled(): boolean {
  return tursoUrl().length > 0;
}

async function getLocalDb(): Promise<DatabaseSync> {
  if (!localDbPromise) {
    localDbPromise = (async () => {
      const { DatabaseSync } = await import("node:sqlite");
      const directory =
        process.env.RAG_DB_DIR?.trim() || path.join(process.cwd(), ".data");
      mkdirSync(directory, { recursive: true });

      const database = new DatabaseSync(path.join(directory, "rag.db"));
      database.exec("PRAGMA journal_mode = WAL;");
      for (const sql of SCHEMA) database.exec(sql);
      return database;
    })();
  }
  return localDbPromise;
}

async function getRemoteClient(): Promise<Client> {
  if (!remoteClientPromise) {
    remoteClientPromise = (async () => {
      // 只加载 web 客户端：走 HTTPS，不依赖原生扩展
      const { createClient } = await import("@libsql/client/web");
      const client = createClient({
        url: tursoUrl(),
        authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
      });
      for (const sql of SCHEMA) await client.execute(sql);
      return client;
    })();
  }
  return remoteClientPromise;
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = isTursoEnabled()
      ? getRemoteClient().then(() => undefined)
      : getLocalDb().then(() => undefined);
  }
  return schemaPromise;
}

export async function dbAll(
  sql: string,
  args: SqlValue[] = [],
): Promise<Row[]> {
  await ensureSchema();

  if (isTursoEnabled()) {
    const client = await getRemoteClient();
    const result = await client.execute({ sql, args });
    return result.rows as unknown as Row[];
  }

  const database = await getLocalDb();
  return database.prepare(sql).all(...args) as unknown as Row[];
}

export async function dbRun(
  sql: string,
  args: SqlValue[] = [],
): Promise<{ lastInsertRowid: number }> {
  await ensureSchema();

  if (isTursoEnabled()) {
    const client = await getRemoteClient();
    const result = await client.execute({ sql, args });
    return { lastInsertRowid: Number(result.lastInsertRowid ?? 0) };
  }

  const database = await getLocalDb();
  const result = database.prepare(sql).run(...args);
  return { lastInsertRowid: Number(result.lastInsertRowid) };
}

export async function dbBatch(statements: Statement[]): Promise<void> {
  if (statements.length === 0) return;
  await ensureSchema();

  if (isTursoEnabled()) {
    const client = await getRemoteClient();
    await client.batch(
      statements.map((statement) => ({
        sql: statement.sql,
        args: statement.args ?? [],
      })),
      "write",
    );
    return;
  }

  const database = await getLocalDb();
  database.exec("BEGIN");
  try {
    for (const statement of statements) {
      database.prepare(statement.sql).run(...(statement.args ?? []));
    }
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // 回滚失败时保留原始错误
    }
    throw error;
  }
}
