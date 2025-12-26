import { getDb, Run } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = getDb();
    const runs = db.prepare("SELECT * FROM runs ORDER BY started_at DESC").all() as Run[];
    db.close();
    return NextResponse.json(runs);
  } catch (error) {
    // DB doesn't exist yet - return empty array
    return NextResponse.json([]);
  }
}
