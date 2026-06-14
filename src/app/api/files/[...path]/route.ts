import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getMimeType, readUserFile, userOwnsFile } from "@/lib/storage/local";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const relativePath = pathSegments.join("/");

  if (!userOwnsFile(session.userId, relativePath)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const data = await readUserFile(relativePath);
    const filename = pathSegments[pathSegments.length - 1] ?? "file";

    return new NextResponse(data, {
      headers: {
        "Content-Type": getMimeType(filename),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
