"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type {
  DocumentMeta,
  QueryMode,
  QueryResponse,
  Source,
} from "@/lib/types";

const SUGGESTED_QUESTIONS = [
  "X1 智能门锁整机保修多久？",
  "门锁离线后怎么重新配网？",
  "7 天无理由退货需要满足什么条件？",
  "经销商首次进货最少多少台？",
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  response?: QueryResponse;
  error?: string;
};

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 12l16-8-5.5 16-3-6.5L4 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M11.5 13.5L20 4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 4.5A1.5 1.5 0 016.5 3H19v18H6.5A1.5 1.5 0 015 19.5v-15Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M5 17.5h14M9 7h6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 7h16M9 7V4.5h6V7m-8 0l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ModeBadge({ mode }: { mode: QueryMode }) {
  const meta: Record<QueryMode, { label: string; className: string }> = {
    llm: {
      label: "大模型回答",
      className: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    },
    "retrieval-only": {
      label: "仅检索",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
    },
    "no-context": {
      label: "未命中",
      className: "bg-slate-100 text-slate-600 ring-slate-200",
    },
  };
  const current = meta[mode];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${current.className}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {current.label}
    </span>
  );
}

function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g);

  return (
    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
      {parts.map((part, index): ReactNode => {
        if (/^\[\d+\]$/.test(part)) {
          return (
            <span
              key={index}
              className="mx-0.5 inline-flex -translate-y-px items-center rounded bg-indigo-50 px-1 text-[11px] font-semibold text-indigo-600 ring-1 ring-indigo-100"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

function SourceCard({ source }: { source: Source }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-[10px] font-semibold text-white">
          {source.index}
        </span>
        <p
          className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700"
          title={source.title}
        >
          {source.title}
        </p>
        <span className="shrink-0 text-[10px] text-slate-400">
          第 {source.ordinal} 段
        </span>
        <span className="hidden shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200 sm:inline">
          BM25 {source.score.toFixed(2)}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-4 text-xs leading-5 text-slate-600">
        {source.text}
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/documents", { cache: "no-store" });
    const data = (await response.json()) as {
      documents?: DocumentMeta[];
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || "读取文档失败");
    setDocuments(data.documents ?? []);
  }, []);

  useEffect(() => {
    loadDocuments()
      .catch((error) =>
        setNotice(error instanceof Error ? error.message : "读取文档失败"),
      )
      .finally(() => setLoadingDocs(false));
  }, [loadDocuments]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const last = messages[messages.length - 1];
    if (!asking && last?.role === "assistant") {
      const node = document.getElementById(`message-${last.id}`);
      if (node) {
        const top =
          node.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop -
          8;
        container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return;
      }
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, asking]);

  async function ask(raw: string) {
    const cleanQuestion = raw.trim();
    if (!cleanQuestion || asking) return;

    setMessages((previous) => [
      ...previous,
      { id: crypto.randomUUID(), role: "user", text: cleanQuestion },
    ]);
    setQuestion("");
    setAsking(true);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion }),
      });
      const data = (await response.json().catch(() => ({}))) as
        | (QueryResponse & { error?: string })
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          ("error" in data && data.error) || `请求失败（${response.status}）`,
        );
      }

      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          response: data as QueryResponse,
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          error: error instanceof Error ? error.message : "请求失败",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(question);
  }

  function handleComposerKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function handleSeed() {
    if (seeding) return;
    setSeeding(true);
    setNotice(null);

    try {
      const response = await fetch("/api/seed", { method: "POST" });
      const data = (await response.json()) as {
        inserted?: number;
        documents?: DocumentMeta[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "载入示例失败");

      setDocuments(data.documents ?? []);
      setNotice(
        data.inserted && data.inserted > 0
          ? `已载入 ${data.inserted} 份示例文档，可以直接提问。`
          : "示例文档已经在知识库里。",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "载入示例失败");
    } finally {
      setSeeding(false);
    }
  }

  async function handleSaveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setFormError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text }),
      });
      const data = (await response.json()) as {
        document?: DocumentMeta;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "保存文档失败");

      setTitle("");
      setText("");
      setFormOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadDocuments();
      setNotice(`《${data.document?.title ?? "文档"}》已切块并建立索引。`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存文档失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 300 * 1024) {
      setFormError("文件超过 300KB，建议只粘贴主要章节。");
      event.target.value = "";
      return;
    }

    try {
      const content = await file.text();
      setText(content);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.(txt|md|markdown)$/i, ""));
      }
      setFormError(null);
    } catch {
      setFormError("读取文件失败，请直接粘贴内容。");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "删除失败");
      setConfirmDeleteId(null);
      await loadDocuments();
      setNotice("文档已删除，对应的索引片段也一起清理了。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  const totalChunks = documents.reduce(
    (sum, document) => sum + document.chunkCount,
    0,
  );
  const totalChars = documents.reduce(
    (sum, document) => sum + document.charCount,
    0,
  );
  const hasSamples = documents.some(
    (document) => document.source === "sample",
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <section className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-indigo-600">
            PORTFOLIO · RAG
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            让每一句回答，
            <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
              都能回到原文
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            上传文档后自动切块并建立中文倒排索引。提问时先检索 Top-4
            片段，再让大模型基于片段作答，并标注 [编号] 引用；资料不足时会明确拒答。
          </p>
        </div>

        <dl className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm sm:px-4">
            <dt className="text-[10px] text-slate-500">文档</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
              {loadingDocs ? "—" : documents.length}
            </dd>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm sm:px-4">
            <dt className="text-[10px] text-slate-500">知识片段</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
              {loadingDocs ? "—" : totalChunks}
            </dd>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm sm:px-4">
            <dt className="text-[10px] text-slate-500">总字数</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
              {loadingDocs
                ? "—"
                : totalChars >= 1000
                  ? `${(totalChars / 1000).toFixed(1)}k`
                  : totalChars}
            </dd>
          </div>
        </dl>
      </section>

      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-4 py-2.5 text-sm text-indigo-700">
          <p className="leading-5">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-indigo-400 transition-colors hover:text-indigo-700"
            aria-label="关闭提示"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24">
          <div className="flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">知识库</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {documents.length} 份文档 · {totalChunks} 个片段
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormOpen((open) => !open);
                  setFormError(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {formOpen ? "收起" : "+ 添加"}
              </button>
            </div>

            {!formOpen && documents.length > 0 && !hasSamples && (
              <div className="border-b border-slate-100 px-3 py-2.5">
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="w-full rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 px-3 py-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {seeding ? "正在载入…" : "再载入 3 份示例文档"}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3">
              {formOpen && (
                <form
                  onSubmit={handleSaveDocument}
                  className="animate-rise mb-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">
                      添加文档
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFormOpen(false);
                        setFormError(null);
                      }}
                      className="text-[11px] text-slate-400 transition-colors hover:text-slate-700"
                    >
                      关闭
                    </button>
                  </div>

                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={80}
                    placeholder="文档标题，例如：售后政策 v2"
                    className="mt-2.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />

                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={6}
                    placeholder="粘贴文档正文……"
                    className="mt-2 min-h-[130px] max-h-[260px] w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />

                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-700"
                    >
                      读取 .txt / .md
                    </button>
                    <span className="tabular-nums">
                      {text.length.toLocaleString("zh-CN")} / 60000 字
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.markdown,text/plain,text/markdown"
                    onChange={handleFile}
                    className="hidden"
                  />

                  {formError && (
                    <p className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-[11px] text-rose-600">
                      {formError}
                    </p>
                  )}

                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "切块建索引中…" : "存入知识库"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormOpen(false);
                        setFormError(null);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      取消
                    </button>
                  </div>

                  <p className="mt-2 text-[10px] leading-4 text-slate-400">
                    按约 520 字切块、重叠 80 字，并建立中文 bigram 倒排索引。
                  </p>
                </form>
              )}

              {loadingDocs ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-16 animate-pulse rounded-xl bg-slate-100"
                    />
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
                  <SparkIcon className="mx-auto size-7 text-indigo-400" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    知识库还是空的
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    载入 3 份示例文档，或粘贴自己的产品手册、售后政策。
                  </p>
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {seeding ? "正在切块建索引…" : "载入示例文档"}
                  </button>
                </div>
              ) : (
                <ul className="space-y-1">
                  {documents.map((document) => (
                    <li
                      key={document.id}
                      className="group rounded-xl border border-transparent px-2.5 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <BookIcon className="size-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-xs font-medium text-slate-800"
                            title={document.title}
                          >
                            {document.title}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {document.chunkCount} 个片段 ·{" "}
                            {document.charCount.toLocaleString("zh-CN")} 字
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                                document.source === "sample"
                                  ? "bg-sky-50 text-sky-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {document.source === "sample" ? "示例" : "上传"}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {formatDate(document.createdAt)}
                            </span>
                          </div>
                        </div>

                        {confirmDeleteId === document.id ? (
                          <div className="flex shrink-0 flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(document.id)}
                              disabled={deletingId === document.id}
                              className="rounded bg-rose-600 px-1.5 py-1 text-[9px] text-white transition-colors hover:bg-rose-500 disabled:opacity-60"
                            >
                              {deletingId === document.id ? "删除中" : "确认删除"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[9px] text-slate-500 hover:bg-slate-50"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(document.id)}
                            aria-label={`删除 ${document.title}`}
                            className="shrink-0 rounded-md p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
              <p className="text-[10px] leading-4 text-slate-400">
                数据保存在服务端：本地为 SQLite，线上可切 Turso。
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:h-[calc(100vh-13rem)] lg:max-h-[820px] lg:min-h-[620px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                知识库问答
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                先检索你的文档，再基于命中片段回答
              </p>
            </div>
            <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500 sm:inline">
              Top-4 片段
            </span>
          </div>

          <div
            ref={scrollRef}
            className="min-h-[380px] flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5"
          >
            {messages.length === 0 && !asking ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center px-4 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 text-indigo-500 ring-1 ring-indigo-100">
                  <SparkIcon className="size-6" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  问点什么吧
                </h3>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  回答只使用知识库里的内容；资料不足时会明确说“无法回答”，不会编造。
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void ask(suggestion)}
                      disabled={documents.length === 0}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                {documents.length === 0 && (
                  <p className="mt-4 text-[11px] text-amber-600">
                    先载入示例文档或添加自己的文档，再开始提问。
                  </p>
                )}
              </div>
            ) : (
              messages.map((message) =>
                message.role === "user" ? (
                  <div
                    key={message.id}
                    className="animate-rise flex justify-end"
                  >
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
                      {message.text}
                    </div>
                  </div>
                ) : (
                  <div
                    key={message.id}
                    id={`message-${message.id}`}
                    className="animate-rise flex gap-3"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                      <SparkIcon className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      {message.error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm leading-6 text-rose-700">
                          {message.error}
                        </div>
                      ) : message.response ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <ModeBadge mode={message.response.mode} />
                            {message.response.note && (
                              <span className="text-[10px] text-amber-600">
                                备注：{message.response.note}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <AnswerText text={message.response.answer} />
                          </div>

                          {message.response.sources.length > 0 && (
                            <div className="mt-2.5 space-y-2">
                              <p className="text-[10px] font-medium tracking-wider text-slate-400">
                                引用来源 · {message.response.sources.length}
                              </p>
                              {message.response.sources.map((source) => (
                                <SourceCard
                                  key={source.chunkId}
                                  source={source}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                ),
              )
            )}

            {asking && (
              <div className="animate-rise flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                  <SparkIcon className="size-4" />
                </span>
                <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-indigo-400" />
                    <span className="ml-1 text-xs text-slate-500">
                      正在检索并生成…
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4"
          >
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                disabled={asking}
                placeholder="例如：X1 整机保修多久？"
                className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={asking || !question.trim()}
                aria-label="发送问题"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <SendIcon className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-400">
              <span>Enter 发送 · Shift + Enter 换行</span>
              <span>
                {documents.length} 份文档 · {totalChunks} 个片段
              </span>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
