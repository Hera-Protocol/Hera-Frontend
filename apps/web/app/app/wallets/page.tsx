"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { WalletCard } from "@/components/monitor/wallet-card";
import { WatchWalletDialog } from "@/components/monitor/watch-wallet-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorBlock, PageHeader, Skeleton } from "@/components/ui/misc";
import { useWallets } from "@/lib/queries";

export default function WalletsPage() {
  const wallets = useWallets();
  const [open, setOpen] = useState(false);
  const add = (
    <Button onClick={() => setOpen(true)}>
      <Plus className="size-4" aria-hidden />
      Watch a wallet
    </Button>
  );
  return (
    <>
      <PageHeader title="Watched wallets" description="Hera rescreens these on a schedule and raises an alert when something risky shows up." actions={add} />
      {wallets.isPending ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-[18px]" role="status" aria-label="Loading wallets">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[168px] rounded-[16px]" />
          ))}
        </div>
      ) : wallets.isError ? (
        <Card>
          <ErrorBlock error={wallets.error} onRetry={() => wallets.refetch()} />
        </Card>
      ) : wallets.data.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing on the watchlist yet"
            body="Watch a treasury wallet, a customer's deposit address or a muxed sub-account. Hera screens it now, then keeps checking."
            action={add}
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-[18px]">
          {wallets.data.map((w) => (
            <li key={w.id} className="flex">
              <WalletCard wallet={w} />
            </li>
          ))}
        </ul>
      )}
      <WatchWalletDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
