import { connection } from "next/server";
import { deleteDocument } from "@/lib/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "缺少文档 ID" }, { status: 400 });
  }

  try {
    await deleteDocument(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 },
    );
  }
}
