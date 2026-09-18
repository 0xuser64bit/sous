import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

export async function GET() {
  const rpc = process.env.NEXT_PUBLIC_COOKIE_RPC_URL ?? "https://rpc.cookiescan.io";
  try {
    const conn = new Connection(rpc, "confirmed");
    const slot = await conn.getSlot();
    return NextResponse.json({ ok: true, slot, rpc });
  } catch (e) {
    return NextResponse.json(
      { ok: false, rpc, error: e instanceof Error ? e.message : "rpc error" },
      { status: 502 },
    );
  }
}
