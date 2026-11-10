import { connection } from "next/server";
import { createDocument, listDocuments, seedIfEmpty } from "@/lib/store";

export async function GET() {
  await connection();
  try {
    await seedIfEmpty();
    const documents = await listDocuments();
    return Response.json({ documents });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "读取文档失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  await connection();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { title, text } = (body ?? {}) as {
    title?: unknown;
    text?: unknown;
  };

  const cleanTitle = typeof title === "string" ? title.trim() : "";
  const cleanText = typeof text === "string" ? text.trim() : "";

  if (!cleanTitle) {
    return Response.json({ error: "请填写文档标题" }, { status: 400 });
  }
  if (cleanTitle.length > 80) {
    return Response.json({ error: "标题不能超过 80 字" }, { status: 400 });
  }
  if (!cleanText) {
    return Response.json({ error: "请粘贴文档内容" }, { status: 400 });
  }
  if (cleanText.length > 60_000) {
    return Response.json(
      { error: "单篇文档不能超过 60000 字" },
      { status: 400 },
    );
  }

  try {
    const document = await createDocument({ title: cleanTitle, text: cleanText });
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "创建文档失败" },
      { status: 500 },
    );
  }
}
