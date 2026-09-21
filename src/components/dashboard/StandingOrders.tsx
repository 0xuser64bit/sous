"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callMcp } from "@/lib/mcp/client";
import { limitOrderRows } from "@/lib/mcp/shapes";
import { shortAddr } from "@/lib/utils/format";
import { cancelLimitOrder } from "@/lib/tx/cancelOrder";
import { TxError } from "@/lib/tx/signAndSend";
import { Section } from "@/components/layout/Section";
import { RowsSkeleton, RowsError, sidecarHint } from "@/components/layout/DataRows";

/**
 * Standing limit/stop orders for this wallet, with one-tap cancel.
 * Reads via get_limit_orders; cancels through the shared helper so the
 * pass and the pantry can never disagree on what cancel means.
 */
export function StandingOrders() {
  const { publicKey, signTransaction } = useWallet();
  const wallet = publicKey?.toBase58();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ["limit_orders", wallet],
    queryFn: () =>
      callMcp({ tool: "get_limit_orders", wallet, args: { owner: wallet } }),
    enabled: Boolean(wallet),
    staleTime: 20_000,
  });

  if (!wallet) return null;
  const list = orders.data ? limitOrderRows(orders.data) : [];

  async function onCancel(id: string) {
    if (!signTransaction || cancelling) return;
    setCancelling(id);
    try {
      const { signature, confirmed, note } = await cancelLimitOrder({
        orderId: id,
        wallet,
        signTransaction,
      });
      if (!confirmed) {
        // Unconfirmed is not cancelled: the order may still be resting.
        toast("Sent — still confirming", {
          description: signature ? `${shortAddr(signature, 6)} · ${note}` : note,
        });
      } else {
        toast.success(
          signature ? `Scrapped · ${shortAddr(signature, 6)}` : "Order cancelled",
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["limit_orders", wallet] });
      // Scrapping frees locked funds — the balances board reads stale otherwise.
      await queryClient.invalidateQueries({ queryKey: ["balance"] });
    } catch (e) {
      if (e instanceof TxError && e.code === "rejected") {
        toast("Signature declined", { description: "Nothing moved." });
      } else {
        toast.error("Cancel failed", {
          description: (e instanceof Error ? e.message : "Unknown error").slice(0, 120),
        });
      }
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <Section
        label="Standing orders"
        action={
          <button
            onClick={() => void orders.refetch()}
            aria-label="Refresh standing orders"
            title="Refresh standing orders"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center font-mono text-[13px] transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: "var(--text-tertiary)" }}
            disabled={orders.isFetching}
          >
            <span aria-hidden className={orders.isFetching ? "animate-live inline-block" : "inline-block"}>
              ↻
            </span>
          </button>
        }
      >
        {orders.isPending ? (
          <RowsSkeleton lines={2} />
        ) : orders.isError ? (
          <RowsError message={sidecarHint(orders.error.message)} onRetry={() => void orders.refetch()} />
        ) : !list.length ? (
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            No standing orders — “Limit sell 5 bCOOK → COOK at 2.0” writes one.
          </p>
        ) : (
          <ul className="flex min-w-0 flex-col">
            {list.map((o) => (
              <li
                key={o.id}
                className="flex min-w-0 items-center justify-between gap-3 border-t border-[var(--border-subtle)] py-1.5 text-[12.5px] first:border-t-0"
              >
                <span className="min-w-0 flex-1 truncate font-mono break-all" style={{ color: "var(--text-primary)" }} title={`${o.label} · ${o.id}`}>
                  {o.label}
                </span>
                <button
                  onClick={() => void onCancel(o.id)}
                  disabled={cancelling !== null}
                  className="flex min-h-[36px] shrink-0 items-center px-1 text-[12px] font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ color: "var(--copper-bright)" }}
                >
                  {cancelling === o.id ? "Scrapping…" : "Scrap"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
