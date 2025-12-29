import { getDb, Run, getDbPath } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs";

export async function GET() {
  try {
    const dbPath = getDbPath();
    const exists = fs.existsSync(dbPath);
    console.log(`DB_PATH: ${dbPath}, exists: ${exists}`);

    const db = getDb();
    const runs = db.prepare("SELECT * FROM runs ORDER BY started_at DESC").all() as Run[];
    db.close();
    return NextResponse.json(runs);
  } catch (error) {
    const dbPath = getDbPath();
    return NextResponse.json({ error: "DB error", path: dbPath, msg: String(error) });
  }
}
