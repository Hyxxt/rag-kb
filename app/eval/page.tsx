"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EvalResponse } from "@/lib/types";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HitBadge({ hit }: { hit: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
        hit
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-rose-50 text-rose-700 ring-rose-200"
      }`}
    >
      {hit ? (
        <CheckIcon className="size-3" />
      ) : (
        <CrossIcon className="size-3" />
      )}
      {hit ? "命中" : "未命中"}
    </span>
  );
}

function Percent({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <span className="tabular-nums">
      <span className="text-2xl font-semibold text-slate-900">{percent}%</span>
      <span className="ml-1.5 text-xs text-slate-400">
        {value} / {total}
      </span>
    </span>
  );
}

export default function EvalPage() {
  const [result, setResult] = useState<EvalResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [withLlm, setWithLlm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/documents", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { documents?: unknown[] }) => {
        if (!cancelled) setDocCount(data.documents?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) setDocCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function runEval() {
    if (running) return;
    setRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withLlm }),
      });
      const data = (await response.json()) as EvalResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "评测失败");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "评测失败");
    } finally {
      setRunning(false);
    }
  }

  const retrievalPercent =
    result && result.total > 0
      ? Math.round((result.passed / result.total) * 100)
      : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-indigo-600">
            EVALUATION · RETRIEVAL
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            10 个问题，看看检索到底准不准
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            用固定的问题和参考答案跑一遍检索链路，输出命中率。可选同时调用大模型，
            检查回答里是否包含正确答案，方便对比“检索到了”和“答对了”。
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-[10px] text-slate-500">知识库文档</p>
            <p className="text-xl font-semibold tabular-nums text-slate-900">
              {docCount ?? "—"}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            去管理知识库
          </Link>
        </div>
      </div>

      {docCount === 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          知识库为空，评测会全部未命中。先回到{" "}
          <Link href="/" className="font-semibold underline underline-offset-2">
            问答页
          </Link>{" "}
          载入 3 份示例文档。
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">评测结果</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {result
                  ? `本次检查 ${result.total} 个问题${
                      result.withLlm ? "（含大模型回答）" : "（仅检索）"
                    }`
                  : "还没有运行评测"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={withLlm}
                  onChange={(event) => setWithLlm(event.target.checked)}
                  disabled={running}
                  className="size-3.5 accent-indigo-600"
                />
                同时检查模型回答
              </label>
              <button
                type="button"
                onClick={() => void runEval()}
                disabled={running}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? "评测中…" : "开始评测"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          {running ? (
            <div className="space-y-3 p-5">
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              {[0, 1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-lg bg-slate-50"
                />
              ))}
              {withLlm && (
                <p className="text-center text-[11px] text-slate-400">
                  正在逐题检索并调用大模型，通常需要 10–30 秒…
                </p>
              )}
            </div>
          ) : result ? (
            <>
              <div className="grid gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] text-slate-500">检索命中率</p>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <Percent value={result.passed} total={result.total} />
                    <span className="text-[10px] text-slate-400">Top-4</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${retrievalPercent}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] text-slate-500">答案命中率</p>
                  <div className="mt-1">
                    {typeof result.answerPassed === "number" ? (
                      <Percent
                        value={result.answerPassed}
                        total={result.total}
                      />
                    ) : (
                      <span className="text-2xl font-semibold text-slate-300">
                        —
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {result.withLlm
                      ? "回答中是否包含参考答案"
                      : "未开启模型检查"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] text-slate-500">评测方式</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result.withLlm ? "检索 + 模型" : "纯检索"}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    固定题库 · 每题取 Top-4
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="w-10 px-4 py-2.5 font-medium">#</th>
                      <th className="px-3 py-2.5 font-medium">问题</th>
                      <th className="px-3 py-2.5 font-medium">期望关键词</th>
                      <th className="px-3 py-2.5 font-medium">命中片段</th>
                      <th className="px-3 py-2.5 font-medium">检索</th>
                      {result.withLlm && (
                        <th className="px-3 py-2.5 font-medium">回答</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, index) => (
                      <tr
                        key={row.question}
                        className="border-b border-slate-50 align-top transition-colors last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {index + 1}
                        </td>
                        <td className="max-w-[240px] px-3 py-3 text-xs leading-5 text-slate-700">
                          {row.question}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.expected.slice(0, 3).map((item) => (
                              <span
                                key={item}
                                className="shrink-0 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="max-w-[220px] px-3 py-3">
                          <p
                            className="truncate text-[11px] text-slate-600"
                            title={row.topTitle}
                          >
                            {row.topTitle}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {row.topOrdinal > 0
                              ? `第 ${row.topOrdinal} 段`
                              : "无结果"}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <HitBadge hit={row.hit} />
                        </td>
                        {result.withLlm && (
                          <td className="px-3 py-3">
                            <HitBadge hit={row.answerHit === true} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <CheckIcon className="size-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">
                运行一次评测
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                默认只测检索，几秒完成；勾选“同时检查模型回答”会额外调用 10
                次大模型，用来区分检索命中和回答正确。
              </p>
              <button
                type="button"
                onClick={() => void runEval()}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-500"
              >
                开始评测
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">评测口径</h2>
            <ul className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
              <li>
                <span className="font-medium text-slate-800">检索命中</span>
                ：返回的 Top-4 片段中，任意一个包含该题的任一期望关键词，即算命中。
              </li>
              <li>
                <span className="font-medium text-slate-800">答案命中</span>
                ：模型回答文本中包含任一期望关键词，即算通过。
              </li>
              <li>
                <span className="font-medium text-slate-800">题库来源</span>
                ：10 道题全部由知识库中的 3 份示例文档构造，答案都在文档里。
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-5">
            <h2 className="text-sm font-semibold text-amber-900">
              这个评测的局限
            </h2>
            <p className="mt-2 text-xs leading-5 text-amber-800">
              关键词命中是词法级指标，比较宽松：片段里出现关键词，不代表模型一定答对；
              回答里出现关键词，也不代表表述完全正确。真实项目还需要人工抽检或
              LLM-as-judge，并对未命中问题做 bad case 分析。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">检索链路</h2>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
              <li>1. 问题转小写，中文切 bigram，英文按单词。</li>
              <li>2. 倒排表取出包含这些词的候选片段。</li>
              <li>3. BM25（k1=1.5, b=0.75）打分排序。</li>
              <li>4. 取 Top-4 交给大模型生成答案。</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
