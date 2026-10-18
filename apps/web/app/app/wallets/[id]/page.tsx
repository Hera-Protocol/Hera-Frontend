"use client";

import type { ScreeningResponse, WalletDto } from "@hera/core";
import { ArrowLeft, FileDown, RotateCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SeverityDot, shortAgo } from "@/components/monitor/alert-bits";
import { ReasonsList } from "@/components/screening/reasons";
import { DataStatusBanner } from "@/components/screening/profile";
import { Tag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Address, EmptyState, ErrorBlock, LoadingBlock, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, timeAgo, titleCase } from "@/lib/format";
import { chainName, classifyScreenError, subjectToRequest, subLabel, useEvidenceExport } from "@/lib/hooks/monitor";
import { useAlerts, useDeleteWallet, useRefreshWallet, useScreen, useScreening, useScreenings, useWallets } from "@/lib/queries";
import { BAND_STYLE } from "@/lib/risk";

export default function WalletDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wallets = useWallets();
  const wallet = wallets.data?.find((w) => w.id === id);

  if (wallets.isPending) {
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Loading wallet">
        <Skeleton className="h-[150px] rounded-[18px]" />
        <Skeleton className="h-[260px] rounded-[16px]" />
      </div>
    );
  }
  if (wallets.isError) {
    return (
      <Card>
        <ErrorBlock error={wallets.error} onRetry={() => wallets.refetch()} />
      </Card>
    );
  }
  if (!wallet) {
    return (
      <Card>
        <EmptyState
          title="That wallet isn't on your watchlist"
          body="It may have been removed, or it belongs to another organization."
          action={<ButtonLink href="/app/wallets">Back to wallets</ButtonLink>}
        />
      </Card>
    );
  }
  return <WalletDetail wallet={wallet} />;
}

function WalletDetail({ wallet }: { wallet: WalletDto }) {
  const router = useRouter();
  const refresh = useRefreshWallet();
  const remove = useDeleteWallet();
  const screen = useScreen();
  const evidence = useEvidenceExport();
  const [confirming, setConfirming] = useState(false);
  const band = wallet.lastBand ? BAND_STYLE[wallet.lastBand] : null;
  const request = subjectToRequest(wallet.subject);

  // A past screening of the same subject, if there is one, gives reasons without a new screen.
  const history = useScreenings(50);
  const match = history.data?.items.find((s) => s.display === wallet.display && s.chain === wallet.chain);
  const matched = useScreening(screen.data ? null : (match?.id ?? null));
  const latest: ScreeningResponse | undefined = screen.data ?? matched.data;

  const rescreen = async () => {
    try {
      const updated = await refresh.mutateAsync(wallet.id);
      toast.success(
        updated.lastBand ? `Rescreened: ${updated.lastScore} · ${BAND_STYLE[updated.lastBand].label.toLowerCase()}` : "Rescreened",
        { description: updated.lastScore !== wallet.lastScore ? `Was ${wallet.lastScore ?? "n/a"}.` : "No change in score." },
      );
    } catch (e) {
      const c = classifyScreenError(e);
      toast.error(c.kind === "chain_unavailable" ? "The chain data source is slow right now. Try again in a minute." : c.message);
    }
  };

  const exportEvidence = () =>
    evidence.exportFor(
      (latest && latest.id === screen.data?.id ? Promise.resolve(latest) : screen.mutateAsync(request)).then((r) => r.id),
    );

  const stop = async () => {
    try {
      await remove.mutateAsync(wallet.id);
      toast.success(`Stopped watching ${wallet.label}`);
      router.push("/app/wallets");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <Link href="/app/wallets" className="inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        All wallets
      </Link>

      <section className={cn("flex flex-wrap items-center gap-5 rounded-[18px] border-2 border-line p-5 shadow-hard-lg sm:p-[22px]", band?.soft ?? "bg-card")}>
        <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-line bg-card">
          <span className={cn("font-display text-[36px] leading-none font-extrabold", band?.text)}>{wallet.lastScore ?? "–"}</span>
          <span className="font-mono text-[11px] uppercase">{band?.label ?? "unscored"}</span>
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[30px] leading-none font-extrabold sm:text-[34px]">{wallet.label}</h1>
            <Tag>{chainName(wallet.chain)}</Tag>
            {subLabel(wallet.subject) && <Tag tone="iris">{subLabel(wallet.subject)}</Tag>}
          </div>
          <Address value={wallet.display} full className="text-[14px]" />
          <span className="text-sm text-ink-soft">
            {wallet.customerRef && (
              <>
                Customer ref <span className="font-mono">{wallet.customerRef}</span> ·{" "}
              </>
            )}
            watched since {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(wallet.createdAt))} · rescreened {timeAgo(wallet.lastCheckedAt)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" size="sm" className="min-h-10" loading={refresh.isPending} onClick={rescreen}>
            {!refresh.isPending && <RotateCw className="size-4" aria-hidden />}
            Rescreen now
          </Button>
          <Button variant="secondary" size="sm" className="min-h-10" loading={evidence.isPending || (screen.isPending && !latest)} onClick={exportEvidence}>
            <FileDown className="size-4" aria-hidden />
            Export evidence PDF
          </Button>
          <Button variant="danger" size="sm" className="min-h-10" onClick={() => setConfirming(true)}>
            <Trash2 className="size-4" aria-hidden />
            Stop watching
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-[22px]">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[22px]">
          <LatestScreening
            wallet={wallet}
            latest={latest}
            loading={screen.isPending || (Boolean(match) && matched.isPending && !screen.data)}
            error={screen.error}
            onRun={() => screen.mutate(request)}
          />
          {latest && <DataStatusBanner result={latest} />}
          <WalletActivity wallet={wallet} />
        </div>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-[22px]">
          <OpenAlerts walletId={wallet.id} />
          <Card className="flex flex-col gap-2.5 p-[18px] text-sm">
            <h2 className="text-xl font-extrabold">Monitoring</h2>
            <dl className="flex flex-col gap-2">
              {[
                ["Last activity", wallet.lastActivityAt ? formatDateTime(wallet.lastActivityAt) : "none seen"],
                ["Last checked", wallet.lastCheckedAt ? formatDateTime(wallet.lastCheckedAt) : "never"],
                ["Watching since", formatDateTime(wallet.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-dashed border-line/25 pb-2 last:border-0">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-right font-mono text-[13px]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[13px] text-ink-soft">
              Reasons worth 25 points or more open an alert. Webhooks for <span className="font-mono">alert.created</span> and{" "}
              <span className="font-mono">wallet.activity</span> are set up on the{" "}
              <Link href="/app/webhooks" className="font-semibold text-iris hover:underline">
                webhooks page
              </Link>
              .
            </p>
          </Card>
        </aside>
      </div>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Stop watching?">
        <p className="text-[15px]">
          Hera will stop rescreening <strong>{wallet.label}</strong>. Past screenings, alerts and the audit trail are kept.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Keep watching
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={stop}>
            Stop watching
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function LatestScreening({
  wallet,
  latest,
  loading,
  error,
  onRun,
}: {
  wallet: WalletDto;
  latest?: ScreeningResponse;
  loading: boolean;
  error: unknown;
  onRun: () => void;
}) {
  const band = latest?.band ?? wallet.lastBand;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-line px-5 py-4">
        <h2 className="text-xl font-extrabold">{band ? `Why it's ${BAND_STYLE[band].label.toLowerCase()}` : "Latest screening"}</h2>
        {latest && (
          <Link href={`/app/screen?id=${latest.id}`} className="text-sm font-semibold text-iris hover:underline">
            Full result, screened {timeAgo(latest.screenedAt)}
          </Link>
        )}
      </div>
      {loading ? (
        <LoadingBlock rows={3} />
      ) : error ? (
        <ErrorBlock error={new Error(classifyScreenError(error).kind === "chain_unavailable" ? "The chain data source is slow right now." : classifyScreenError(error).message)} onRetry={onRun} />
      ) : latest ? (
        <div className="px-5 py-1">
          <ReasonsList reasons={latest.reasons} chain={latest.subject.chain} compact />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 px-5 py-5">
          <p className="min-w-0 flex-[1_1_240px] text-[15px] text-ink-soft">
            The watchlist keeps the score, not the reasons. Rescreen to see the latest reasons, with every label and transaction behind them.
          </p>
          <Button variant="secondary" onClick={onRun}>
            Show latest reasons
          </Button>
        </div>
      )}
    </Card>
  );
}

function OpenAlerts({ walletId }: { walletId: string }) {
  const alerts = useAlerts("open");
  const mine = alerts.data?.filter((a) => a.walletId === walletId) ?? [];
  if (alerts.isPending) return <Skeleton className="h-[140px] rounded-[16px]" />;
  if (alerts.isError) {
    return (
      <Card>
        <ErrorBlock error={alerts.error} onRetry={() => alerts.refetch()} />
      </Card>
    );
  }
  if (mine.length === 0) {
    return (
      <Card className="flex flex-col gap-1.5 !bg-peacock-soft p-[18px]">
        <h2 className="text-xl font-extrabold">No open alerts</h2>
        <p className="text-sm">Nothing on this wallet needs a decision right now.</p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-2.5 !bg-risk-severe-soft p-[18px]">
      <h2 className="text-xl font-extrabold text-risk-severe">
        {mine.length} open {mine.length === 1 ? "alert" : "alerts"}
      </h2>
      <ul className="flex flex-col gap-2">
        {mine.map((a) => (
          <li key={a.id}>
            <Link href={`/app/alerts?id=${a.id}`} className="flex items-start gap-2.5 rounded-[10px] text-sm hover:underline">
              <SeverityDot severity={a.severity} className="mt-1" />
              <span className="min-w-0 flex-1">
                {a.title}, raised {timeAgo(a.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={`/app/alerts?id=${mine[0]!.id}`} className="text-sm font-bold text-risk-severe hover:underline">
        Decide in the queue →
      </Link>
    </Card>
  );
}

/** Built from this wallet's alerts plus when watching began: there's no per-wallet event feed yet. */
function WalletActivity({ wallet }: { wallet: WalletDto }) {
  const alerts = useAlerts("all");
  const mine = (alerts.data ?? []).filter((a) => a.walletId === wallet.id);
  const items = [
    ...mine.map((a) => ({
      key: a.id,
      dot: <SeverityDot severity={a.severity} className="mt-1" />,
      title: `Alert raised: ${a.title}`,
      detail: `${titleCase(a.status)}${a.disposition ? ` · ${a.disposition.replace("_", " ")}` : ""} · score ${a.score}`,
      at: a.createdAt,
      href: `/app/alerts?id=${a.id}`,
    })),
    {
      key: "created",
      dot: <span className="mt-1 size-3 shrink-0 rounded-full border-2 border-line bg-iris" aria-hidden />,
      title: "Started watching",
      detail: `Screened on add${wallet.lastScore !== undefined ? `, now ${wallet.lastScore}` : ""}`,
      at: wallet.createdAt,
      href: undefined,
    },
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card className="overflow-hidden">
      <div className="border-b-2 border-line px-5 py-4">
        <h2 className="text-xl font-extrabold">Activity</h2>
      </div>
      {alerts.isPending ? (
        <LoadingBlock rows={3} />
      ) : alerts.isError ? (
        <ErrorBlock error={alerts.error} onRetry={() => alerts.refetch()} />
      ) : (
        <ol className="px-5 py-2">
          {items.map((it, i) => (
            <li key={it.key} className={cn("flex gap-3.5 py-3", i > 0 && "border-t border-dashed border-line/25")}>
              {it.dot}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {it.href ? (
                  <Link href={it.href} className="text-[15px] font-bold hover:underline">
                    {it.title}
                  </Link>
                ) : (
                  <strong className="text-[15px]">{it.title}</strong>
                )}
                <span className="text-[13px] text-ink-soft">{it.detail}</span>
              </div>
              <span className="font-mono text-xs whitespace-nowrap text-ink-soft" title={formatDateTime(it.at)}>
                {shortAgo(it.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
