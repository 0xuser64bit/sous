import { NextResponse } from "next/server";
import { getConnection } from "@/lib/chain/connection";
import { COOKIE_RPC_URL } from "@/lib/chain/config";

export async function GET() {
  try {
    // Never hang the caller (or a load balancer): the RPC gets 10s.
    const slot = await Promise.race([
      getConnection().getSlot(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC timed out after 10s")), 10_000),
      ),
    ]);
    return NextResponse.json({ ok: true, slot, rpc: COOKIE_RPC_URL });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        rpc: COOKIE_RPC_URL,
        error: e instanceof Error ? e.message : "rpc error",
      },
      { status: 502 },
    );
  }
}
