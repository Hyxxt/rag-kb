/**
 * 接口冒烟测试：需要先启动服务（npm run dev 或 npm start）。
 * 用法：npm run smoke
 * 可选：BASE_URL=http://localhost:3100 npm run smoke
 *
 * 不配置 LLM_API_KEY 也能跑：只验证检索、评测、入库和降级路径。
 */

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`✓ ${name}${detail ? `：${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `：${detail}` : ""}`);
  }
}

async function request(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { response, data, contentType };
}

function postJson(path, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

const home = await request("/");
check("GET / 返回 200", home.response.status === 200, `HTTP ${home.response.status}`);
check(
  "GET / 是 HTML",
  String(home.contentType).includes("text/html"),
  home.contentType,
);

const seeded = await postJson("/api/seed");
check("POST /api/seed 返回 200", seeded.response.status === 200, `HTTP ${seeded.response.status}`);
check(
  "示例文档已就绪",
  Array.isArray(seeded.data.documents) && seeded.data.documents.length >= 3,
  `${seeded.data.documents?.length ?? 0} 篇`,
);

const documents = await request("/api/documents");
const docs = documents.data.documents ?? [];
const chunkCount = docs.reduce((sum, doc) => sum + (doc.chunkCount ?? 0), 0);
check("GET /api/documents 返回 200", documents.response.status === 200, `HTTP ${documents.response.status}`);
check("文档数 >= 3", docs.length >= 3, `${docs.length} 篇`);
check("片段数 >= 15", chunkCount >= 15, `${chunkCount} 个片段`);

const evalResult = await postJson("/api/eval", { withLlm: false });
check("POST /api/eval 返回 200", evalResult.response.status === 200, `HTTP ${evalResult.response.status}`);
check(
  "检索评测 10/10",
  evalResult.data.total === 10 && evalResult.data.passed === 10,
  `${evalResult.data.passed ?? 0}/${evalResult.data.total ?? 0}`,
);
check(
  "评测默认不调用大模型",
  evalResult.data.withLlm === false,
  `withLlm=${evalResult.data.withLlm}`,
);

const query = await postJson("/api/query", {
  question: "X1 智能门锁整机保修多久？",
});
check("POST /api/query 返回 200", query.response.status === 200, `HTTP ${query.response.status}`);
check(
  "检索到来源片段",
  Array.isArray(query.data.sources) && query.data.sources.length > 0,
  `${query.data.sources?.length ?? 0} 条`,
);
check(
  "Top-1 片段包含「保修」",
  Boolean(query.data.sources?.[0]?.text?.includes("保修")),
  query.data.sources?.[0]?.title ?? "无",
);
check(
  "回答非空",
  typeof query.data.answer === "string" && query.data.answer.trim().length > 0,
);
check(
  "模式为 llm 或 retrieval-only",
  query.data.mode === "llm" || query.data.mode === "retrieval-only",
  query.data.mode,
);

const emptyQuestion = await postJson("/api/query", { question: "   " });
check(
  "空问题返回 400",
  emptyQuestion.response.status === 400,
  `HTTP ${emptyQuestion.response.status}`,
);

const missingQuestion = await postJson("/api/query", {});
check(
  "缺少 question 返回 400",
  missingQuestion.response.status === 400,
  `HTTP ${missingQuestion.response.status}`,
);

if (failures > 0) {
  console.error(`\n${failures} 项失败。`);
  process.exitCode = 1;
} else {
  console.log("\n全部通过。");
}
