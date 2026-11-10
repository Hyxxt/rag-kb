import { connection } from "next/server";
import { answerQuestion } from "@/lib/answer";
import { retrieve } from "@/lib/retrieve";
import { EVAL_QUESTIONS } from "@/lib/samples";
import type { EvalResponse, EvalRow } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  await connection();

  let withLlm = false;
  try {
    const body = (await request.json()) as { withLlm?: unknown };
    withLlm = body?.withLlm === true;
  } catch {
    // 没传 body 时按纯检索评测处理
  }

  try {
    const rows: EvalRow[] = [];

    for (const item of EVAL_QUESTIONS) {
      const sources = await retrieve(item.question, 4);
      const hit = sources.some((source) =>
        item.expectedAny.some((expected) => source.text.includes(expected)),
      );

      rows.push({
        question: item.question,
        expected: item.expectedAny,
        hit,
        topTitle: sources[0]?.title ?? "未命中",
        topOrdinal: sources[0]?.ordinal ?? 0,
      });
    }

    if (withLlm) {
      await Promise.all(
        rows.map(async (row, index) => {
          const sources = await retrieve(row.question, 4);
          const result = await answerQuestion(row.question, sources);
          row.answerHit = EVAL_QUESTIONS[index].expectedAny.some((expected) =>
            result.answer.includes(expected),
          );
        }),
      );
    }

    const passed = rows.filter((row) => row.hit).length;
    const answerPassed = withLlm
      ? rows.filter((row) => row.answerHit).length
      : undefined;

    const payload: EvalResponse = {
      total: rows.length,
      passed,
      answerPassed,
      withLlm,
      rows,
    };
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "评测失败" },
      { status: 500 },
    );
  }
}
