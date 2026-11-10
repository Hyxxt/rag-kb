export type DocumentMeta = {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  charCount: number;
  chunkCount: number;
};

export type Source = {
  index: number;
  chunkId: string;
  documentId: string;
  title: string;
  ordinal: number;
  text: string;
  score: number;
};

export type QueryMode = "llm" | "retrieval-only" | "no-context";

export type QueryResponse = {
  answer: string;
  sources: Source[];
  mode: QueryMode;
  note?: string;
};

export type EvalQuestion = {
  question: string;
  expectedAny: string[];
};

export type EvalRow = {
  question: string;
  expected: string[];
  hit: boolean;
  answerHit?: boolean;
  topTitle: string;
  topOrdinal: number;
};

export type EvalResponse = {
  total: number;
  passed: number;
  answerPassed?: number;
  withLlm: boolean;
  rows: EvalRow[];
};
