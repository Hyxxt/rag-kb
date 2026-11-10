import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "星火知识库 · 带引用的 RAG 问答",
  description:
    "自测项目：中文 bigram 倒排索引 + BM25 检索 + 大模型带引用回答，支持本地 SQLite / Turso。",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-sm shadow-indigo-500/30 transition-transform group-hover:-rotate-6">
                <SparkIcon className="size-5" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold tracking-tight text-slate-900">
                  星火知识库
                </span>
                <span className="block text-[11px] text-slate-500">
                  RAG · 检索增强问答
                </span>
              </span>
            </Link>

            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                知识库问答
              </Link>
              <Link
                href="/eval"
                className="rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                检索评测
              </Link>
              <span className="ml-2 hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 sm:flex">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                可现场演示
              </span>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200/70">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>中文 bigram 倒排索引 · BM25 排序 · 大模型带引用回答</p>
            <p>本地 SQLite / 线上 Turso · Next.js + TypeScript</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
