import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.settings.findUnique({ where: { id: "default" } });
    return NextResponse.json({ ok: true, timestamp: Date.now() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
