import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join("/");

    // Resolve the full path - support both absolute and relative to ~/.tviz
    let fullPath: string;
    if (relativePath.startsWith("/")) {
      fullPath = relativePath;
    } else {
      fullPath = path.join(os.homedir(), ".tviz", relativePath);
    }

    // Security: ensure path is within allowed directories
    const tvizDir = path.join(os.homedir(), ".tviz");
    const resolvedPath = path.resolve(fullPath);

    if (!resolvedPath.startsWith(tvizDir) && !resolvedPath.startsWith("/var/folders")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!existsSync(resolvedPath)) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const imageBuffer = await readFile(resolvedPath);

    // Determine content type from extension
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    }[ext] || "application/octet-stream";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Image serve error:", error);
    return NextResponse.json({ error: "Failed to load image" }, { status: 500 });
  }
}
