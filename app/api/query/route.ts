import { connection } from "next/server";
import { answerQuestion } from "@/lib/answer";
import { retrieve } from "@/lib/retrieve";
import type { QueryResponse } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  await connection();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { question } = (body ?? {}) as { question?: unknown };
  const cleanQuestion =
    typeof question === "string" ? question.trim() : "";

  if (!cleanQuestion) {
    return Response.json({ error: "请输入问题" }, { status: 400 });
  }
  if (cleanQuestion.length > 500) {
    return Response.json({ error: "问题不能超过 500 字" }, { status: 400 });
  }

  try {
    const sources = await retrieve(cleanQuestion, 4);
    const result = await answerQuestion(cleanQuestion, sources);
    const payload: QueryResponse = {
      answer: result.answer,
      sources,
      mode: result.mode,
      note: result.note,
    };
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "检索失败" },
      { status: 500 },
    );
  }
}
