import { connection } from "next/server";
import { listDocuments, seedDocuments } from "@/lib/store";

export async function POST() {
  await connection();

  try {
    const result = await seedDocuments();
    const documents = await listDocuments();
    return Response.json({ ...result, documents });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "初始化示例数据失败" },
      { status: 500 },
    );
  }
}
