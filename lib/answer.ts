import type { QueryMode, Source } from "./types";

export type AnswerResult = {
  answer: string;
  mode: QueryMode;
  note?: string;
};

const SYSTEM_PROMPT = `你是企业知识库问答助手。你的任务是根据提供的资料回答问题。

规则：
1. 只能使用资料中的信息，不要补充资料之外的知识，不要猜测。
2. 每个结论后面用 [编号] 标注来源，例如 [1]；可以用多个来源。
3. 如果资料不足以回答，直接说“根据现有知识库无法回答这个问题”，并说明还缺什么信息。
4. 回答用中文，简洁，不超过 200 字。`;

export async function answerQuestion(
  question: string,
  sources: Source[],
): Promise<AnswerResult> {
  if (sources.length === 0) {
    return {
      answer:
        "知识库里没有找到相关内容。可以换一种问法，或者先上传相关文档后再问。",
      mode: "no-context",
    };
  }

  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    return {
      answer:
        "未配置 LLM_API_KEY，本次只做检索。下面是命中的原文片段，可以按编号人工查看；配置 Key 后会自动生成带引用的回答。",
      mode: "retrieval-only",
      note: "缺少 LLM_API_KEY",
    };
  }

  const baseUrl = (
    process.env.LLM_BASE_URL?.trim() || "https://api.deepseek.com/v1"
  ).replace(/\/+$/, "");
  const model = process.env.LLM_MODEL?.trim() || "deepseek-chat";

  const context = sources
    .map(
      (source) =>
        `[${source.index}]（文档：${source.title}，第 ${source.ordinal} 段）\n${source.text.slice(0, 1200)}`,
    )
    .join("\n\n");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `问题：${question}\n\n资料：\n${context}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("模型返回为空");

    return { answer, mode: "llm" };
  } catch (error) {
    return {
      answer:
        "大模型调用失败，已退回检索结果。下面是命中的原文片段，可以按编号查看。",
      mode: "retrieval-only",
      note: error instanceof Error ? error.message : "未知错误",
    };
  }
}
