"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CreateWebhookResponse,
  createWebhookSchema,
  updateWebhookSchema,
  WEBHOOK_EVENTS,
  type WebhookDeliveryDto,
  type WebhookEndpointDto,
  type WebhookEventType,
} from "@hera/core";
import { Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { NoAccess } from "@/components/admin/no-access";
import { SecretDialog } from "@/components/admin/secret-dialog";
import { Pill, Tag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/field";
import { DataTable, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Skeleton, Switch } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useRole } from "@/lib/hooks/account";
import { applyApiError } from "@/lib/hooks/forms";
import {
  useCreateWebhook,
  useDeleteWebhook,
  useRedeliver,
  useRotateWebhookSecret,
  useTestWebhook,
  useUpdateWebhook,
  useWebhookDeliveries,
  useWebhooks,
} from "@/lib/queries";

const PAUSE_AT = 20;

const EVENT_TONE: Record<WebhookEventType, "neutral" | "blush" | "peacock" | "iris" | "sun"> = {
  "screening.completed": "peacock",
  "alert.created": "blush",
  "alert.updated": "sun",
  "wallet.activity": "peacock",
  "travel_rule.updated": "blush",
  "report.ready": "iris",
};

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function health(e: WebhookEndpointDto) {
  if (!e.enabled) return { label: "Paused", dot: "bg-ink-soft", text: "text-ink-soft" };
  if (e.failureCount === 0) return { label: "Healthy", dot: "bg-peacock", text: "" };
  return { label: `Failing · ${e.failureCount} in a row`, dot: "bg-tangerine", text: "" };
}

type Editing = { mode: "create" } | { mode: "edit"; endpoint: WebhookEndpointDto } | null;
type Confirming = { kind: "delete" | "rotate"; endpoint: WebhookEndpointDto } | null;

export default function WebhooksPage() {
  const { atLeast, isAdmin } = useRole();
  const [editing, setEditing] = useState<Editing>(null);
  const [secret, setSecret] = useState<CreateWebhookResponse | null>(null);

  if (!atLeast("analyst")) {
    return (
      <>
        <PageHeader title="Webhooks" description="Signed events pushed to your backend. Failed deliveries retry for 24 hours." />
        <NoAccess
          title="Webhooks aren't visible to viewers"
          body="Endpoints and their deliveries show where your compliance data goes, so analysts can view them and owners and admins manage them. Ask an admin if you need access."
          action={
            <ButtonLink href="/developers" variant="secondary">
              Read about webhooks
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Signed events pushed to your backend. Failed deliveries retry for 24 hours."
        actions={
          isAdmin && (
            <Button onClick={() => setEditing({ mode: "create" })}>
              <Plus className="size-4" aria-hidden />
              Add endpoint
            </Button>
          )
        }
      />
      {!isAdmin && (
        <p className="-mt-2 text-sm text-ink-soft">You can view endpoints and deliveries. Owners and admins add, change and test them.</p>
      )}

      <Endpoints canManage={isAdmin} onAdd={() => setEditing({ mode: "create" })} onEdit={(endpoint) => setEditing({ mode: "edit", endpoint })} onSecret={setSecret} />

      <VerifyCard />

      <EndpointDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onCreated={(response) => {
          setEditing(null);
          setSecret(response);
        }}
      />
      {secret && (
        <SecretDialog
          open
          title={`Signing secret for ${hostOf(secret.endpoint.url)}`}
          secret={secret.secret}
          envName="HERA_WEBHOOK_SECRET"
          note="This is the only time Hera will show the full signing secret. Put it in your receiver's environment and use it to verify every delivery."
          onDone={() => setSecret(null)}
        />
      )}
    </>
  );
}

/* ─── Endpoint cards + deliveries ────────────────────── */

function Endpoints({
  canManage,
  onAdd,
  onEdit,
  onSecret,
}: {
  canManage: boolean;
  onAdd: () => void;
  onEdit: (e: WebhookEndpointDto) => void;
  onSecret: (r: CreateWebhookResponse) => void;
}) {
  const webhooks = useWebhooks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const remove = useDeleteWebhook();
  const rotate = useRotateWebhookSecret();

  const endpoints = webhooks.data ?? [];
  const selected = endpoints.find((e) => e.id === selectedId) ?? endpoints[0] ?? null;

  useEffect(() => {
    if (selectedId && webhooks.data && !webhooks.data.some((e) => e.id === selectedId)) setSelectedId(null);
  }, [selectedId, webhooks.data]);

  if (webhooks.isPending) {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-[18px]" role="status" aria-label="Loading endpoints">
        <Skeleton className="h-[220px] rounded-[16px]" />
        <Skeleton className="h-[220px] rounded-[16px]" />
      </div>
    );
  }
  if (webhooks.isError) {
    return (
      <Card>
        <ErrorBlock error={webhooks.error} onRetry={() => webhooks.refetch()} />
      </Card>
    );
  }
  if (endpoints.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No endpoints yet"
          body={
            canManage
              ? "Add an HTTPS URL and Hera will POST signed events to it: new alerts, wallet activity, Travel Rule updates and finished reports."
              : "When an owner or admin adds an endpoint, it shows up here with its delivery history."
          }
          action={canManage ? <Button onClick={onAdd}>Add your first endpoint</Button> : undefined}
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-[18px]">
        {endpoints.map((e) => (
          <EndpointCard
            key={e.id}
            endpoint={e}
            selected={selected?.id === e.id}
            canManage={canManage}
            onSelect={() => setSelectedId(e.id)}
            onEdit={() => onEdit(e)}
            onDelete={() => setConfirming({ kind: "delete", endpoint: e })}
            onRotate={() => setConfirming({ kind: "rotate", endpoint: e })}
          />
        ))}
      </div>

      {selected && <Deliveries endpoint={selected} canManage={canManage} />}

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        loading={remove.isPending || rotate.isPending}
        tone={confirming?.kind === "rotate" ? "ink" : "danger"}
        title={confirming?.kind === "rotate" ? "Rotate the signing secret?" : "Delete this endpoint?"}
        confirmLabel={confirming?.kind === "rotate" ? "Rotate secret" : "Delete endpoint"}
        onConfirm={async () => {
          if (!confirming) return;
          const { endpoint, kind } = confirming;
          try {
            if (kind === "delete") {
              await remove.mutateAsync(endpoint.id);
              toast.success(`Deleted ${hostOf(endpoint.url)}`);
            } else {
              const response = await rotate.mutateAsync(endpoint.id);
              onSecret(response);
            }
            setConfirming(null);
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      >
        {confirming?.kind === "rotate" ? (
          <p>
            The current secret (<span className="font-mono">{confirming.endpoint.secretPrefix}…</span>) stops working immediately. Have your receiver ready to take
            the new one.
          </p>
        ) : (
          <p>
            Hera stops sending events to <span className="font-mono break-all">{confirming?.endpoint.url}</span>. This can&apos;t be undone.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function EndpointCard({
  endpoint: e,
  selected,
  canManage,
  onSelect,
  onEdit,
  onDelete,
  onRotate,
}: {
  endpoint: WebhookEndpointDto;
  selected: boolean;
  canManage: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRotate: () => void;
}) {
  const h = health(e);
  const test = useTestWebhook();
  const update = useUpdateWebhook();
  const failing = e.enabled && e.failureCount > 0;

  return (
    <article
      aria-label={`Endpoint ${e.url}`}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-[16px] border-line bg-card p-[18px]",
        selected ? "border-[3px] shadow-[6px_6px_0_var(--iris)]" : "border-2",
        !selected && (failing ? "shadow-[4px_4px_0_var(--tangerine)]" : "shadow-hard"),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className={cn("flex items-center gap-2 text-[13px] font-bold", h.text)}>
          <span className={cn("size-2.5 rounded-full border-2 border-line", h.dot)} aria-hidden />
          {h.label}
        </span>
        <span className="font-mono text-xs text-ink-soft" title="Start of the signing secret">
          {e.secretPrefix}…
        </span>
      </div>
      <strong className="font-mono text-sm break-all">{e.url}</strong>
      <span className="text-sm text-ink-soft">
        {[e.description, e.lastDeliveryAt ? `last delivery ${timeAgo(e.lastDeliveryAt)}` : "no deliveries yet"].filter(Boolean).join(" · ")}
      </span>
      <div className="flex flex-wrap gap-1.5" aria-label="Subscribed events">
        {e.events.map((ev) => (
          <Tag key={ev} tone={EVENT_TONE[ev]}>
            {ev}
          </Tag>
        ))}
      </div>

      {failing && (
        <p className="rounded-[10px] border-2 border-line bg-tangerine/20 px-2.5 py-2 text-[13px] leading-normal">
          Hera pauses an endpoint after {PAUSE_AT} failures in a row. {Math.max(PAUSE_AT - e.failureCount, 0)} to go.
        </p>
      )}
      {!e.enabled && (
        <p className="rounded-[10px] border-2 border-line bg-paper-2 px-2.5 py-2 text-[13px] leading-normal">
          {e.failureCount >= PAUSE_AT
            ? `Paused after ${e.failureCount} failures in a row. Fix the receiver, then turn it back on.`
            : "Paused. Nothing is sent until it's turned back on."}{" "}
          Turning it on resets the failure count; deliveries that were waiting go out.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 border-t border-dashed border-line/30 pt-3">
        {canManage && (
          <Switch
            checked={e.enabled}
            label={
              <>
                Enabled<span className="sr-only"> for {e.url}</span>
              </>
            }
            onChange={(enabled) =>
              update.mutate(
                { id: e.id, enabled },
                {
                  onSuccess: () => toast.success(enabled ? `${hostOf(e.url)} is back on` : `${hostOf(e.url)} paused`),
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant={selected ? "ink" : "secondary"} size="sm" className="min-h-10 shadow-none" aria-pressed={selected} aria-label={`View deliveries for ${e.url}`} onClick={onSelect}>
            View deliveries
          </Button>
          {canManage && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="min-h-10 shadow-none"
                loading={test.isPending}
                aria-label={`Send a test event to ${e.url}`}
                onClick={async () => {
                  try {
                    await test.mutateAsync(e.id);
                    onSelect();
                    toast.success("Test event queued", {
                      description: e.enabled ? "It goes out within a few seconds. Watch the deliveries below." : "It waits until the endpoint is turned back on.",
                    });
                  } catch (error) {
                    toast.error(errorMessage(error));
                  }
                }}
              >
                Send test event
              </Button>
              <Button variant="secondary" size="sm" className="min-h-10 shadow-none" onClick={onRotate} aria-label={`Rotate signing secret for ${e.url}`}>
                Rotate secret
              </Button>
              <Button variant="secondary" size="sm" className="min-h-10 shadow-none" onClick={onEdit} aria-label={`Edit ${e.url}`}>
                Edit
              </Button>
              <Button variant="danger" size="sm" className="min-h-10 shadow-none" onClick={onDelete} aria-label={`Delete ${e.url}`}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function deliveryStatus(d: WebhookDeliveryDto): { label: string; tone: "peacock" | "sun" | "blush" | "neutral" } {
  if (d.status === "succeeded") return { label: "Succeeded", tone: "peacock" };
  if (d.status === "failed") return { label: "Failed", tone: "blush" };
  return d.attempts > 0 ? { label: "Retrying", tone: "sun" } : { label: "Pending", tone: "neutral" };
}

function Deliveries({ endpoint, canManage }: { endpoint: WebhookEndpointDto; canManage: boolean }) {
  const deliveries = useWebhookDeliveries(endpoint.id);
  const redeliver = useRedeliver();
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <Card className="overflow-hidden" aria-live="off">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-line px-5 py-4">
        <h2 className="min-w-0 text-[22px] font-extrabold break-all">Deliveries · {hostOf(endpoint.url)}</h2>
        <span className="text-[13px] text-ink-soft">Latest 50 · refreshes every 10 seconds</span>
      </div>
      {deliveries.isPending ? (
        <LoadingBlock rows={4} />
      ) : deliveries.isError ? (
        <ErrorBlock error={deliveries.error} onRetry={() => deliveries.refetch()} />
      ) : deliveries.data.length === 0 ? (
        <EmptyState
          title="No deliveries yet"
          body={canManage ? "Send a test event to check the endpoint is wired up." : "Deliveries appear here as soon as a subscribed event happens."}
        />
      ) : (
        <DataTable minWidth={760}>
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Status</th>
              <th scope="col">Response</th>
              <th scope="col">Attempts</th>
              <th scope="col">When</th>
              {canManage && (
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {deliveries.data.map((d) => {
              const s = deliveryStatus(d);
              const when = d.lastAttemptAt ?? d.createdAt;
              return (
                <tr key={d.id}>
                  <td>
                    <span className="font-mono font-medium">{d.eventType}</span>
                    <div className="font-mono text-xs text-ink-soft" title={d.eventId}>
                      {d.eventId.slice(0, 12)}…
                    </div>
                  </td>
                  <td>
                    <Pill tone={s.tone}>{s.label}</Pill>
                  </td>
                  <td className="max-w-[220px] font-mono">
                    {d.responseStatus ?? (d.error ? "error" : "—")}
                    {d.error && (
                      <div className="truncate text-xs text-ink-soft" title={d.error}>
                        {d.error}
                      </div>
                    )}
                  </td>
                  <td>
                    {d.attempts}
                    {d.status === "pending" && d.nextAttemptAt && <span className="text-ink-soft"> · next {timeAgo(d.nextAttemptAt)}</span>}
                  </td>
                  <td className="whitespace-nowrap text-ink-soft" title={formatDateTime(when)}>
                    {timeAgo(when)}
                  </td>
                  {canManage && (
                    <td className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-9 shadow-none"
                        loading={busyId === d.id}
                        disabled={busyId !== null}
                        aria-label={`Redeliver ${d.eventType} ${d.eventId}`}
                        onClick={async () => {
                          setBusyId(d.id);
                          try {
                            await redeliver.mutateAsync(d.id);
                            toast.success("Queued again", { description: "Same event, byte for byte." });
                          } catch (error) {
                            toast.error(errorMessage(error));
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        Redeliver
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </Card>
  );
}

/* ─── Add / edit ─────────────────────────────────────── */

interface EndpointFormValues {
  url: string;
  description: string;
  events: WebhookEventType[];
}

function EndpointDialog({ editing, onClose, onCreated }: { editing: Editing; onClose: () => void; onCreated: (r: CreateWebhookResponse) => void }) {
  return (
    <Dialog open={editing !== null} onClose={onClose} title={editing?.mode === "edit" ? "Edit endpoint" : "Add an endpoint"} className="max-w-[600px]">
      {editing && <EndpointForm key={editing.mode === "edit" ? editing.endpoint.id : "new"} editing={editing} onClose={onClose} onCreated={onCreated} />}
    </Dialog>
  );
}

function EndpointForm({ editing, onClose, onCreated }: { editing: NonNullable<Editing>; onClose: () => void; onCreated: (r: CreateWebhookResponse) => void }) {
  const create = useCreateWebhook();
  const update = useUpdateWebhook();
  const [formError, setFormError] = useState<string | null>(null);
  const eventsErrorId = useId();
  const existing = editing.mode === "edit" ? editing.endpoint : null;

  const form = useForm<EndpointFormValues>({
    // Create and edit validate with their own core schemas; the fields are the same.
    resolver: (existing ? zodResolver(updateWebhookSchema) : zodResolver(createWebhookSchema)) as unknown as Resolver<EndpointFormValues>,
    defaultValues: { url: existing?.url ?? "", description: existing?.description ?? "", events: existing?.events ?? [] },
  });
  const { register, handleSubmit, formState, watch, setValue } = form;
  const selected = watch("events") ?? [];
  const allSelected = selected.length === WEBHOOK_EVENTS.length;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const description = values.description.trim();
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, url: values.url, events: values.events, description });
        toast.success("Endpoint saved");
        onClose();
      } else {
        const response = await create.mutateAsync({ url: values.url, events: values.events, description: description || undefined });
        onCreated(response);
      }
    } catch (error) {
      setFormError(applyApiError(form, error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <Field label="Endpoint URL" hint="HTTPS only. http://localhost works for local testing." error={formState.errors.url?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://api.example.com/hooks/hera"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            mono
            {...register("url")}
          />
        )}
      </Field>
      <Field label="Description (optional)" hint="So the team knows what it's for." error={formState.errors.description?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...register("description")} />
        )}
      </Field>
      <fieldset className="flex flex-col gap-2" aria-describedby={formState.errors.events ? eventsErrorId : undefined}>
        <legend className="mb-1.5 flex w-full items-center justify-between gap-3 text-sm font-semibold">
          Events
        </legend>
        <div className="flex flex-wrap gap-2">
          {WEBHOOK_EVENTS.map((ev) => {
            const on = selected.includes(ev);
            return (
              <label
                key={ev}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border-2 border-line px-2.5 font-mono text-[13px] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iris",
                  on ? "bg-ink text-paper shadow-hard-sm" : "bg-card",
                )}
              >
                <input type="checkbox" value={ev} className="size-4 accent-sun focus-visible:outline-none" {...register("events")} />
                {ev}
              </label>
            );
          })}
        </div>
        <button
          type="button"
          className="self-start text-[13px] font-semibold text-iris underline-offset-2 hover:underline"
          onClick={() => setValue("events", allSelected ? [] : [...WEBHOOK_EVENTS], { shouldDirty: true, shouldValidate: formState.isSubmitted })}
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
        {formState.errors.events && (
          <span id={eventsErrorId} className="text-[13px] font-medium text-risk-severe">
            Pick at least one event
          </span>
        )}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="ink" loading={create.isPending || update.isPending}>
          {existing ? "Save changes" : "Add endpoint"}
        </Button>
      </div>
    </form>
  );
}

/* ─── Verify snippet ─────────────────────────────────── */

function VerifyCard() {
  return (
    <section
      aria-labelledby="verify-title"
      className="flex flex-col gap-2.5 rounded-[16px] border-2 border-line bg-ink px-5 py-[18px] text-paper shadow-[4px_4px_0_var(--peacock)] dark:bg-card dark:text-ink"
    >
      <h2 id="verify-title" className="text-xl font-extrabold">
        Verify every delivery
      </h2>
      <p className="text-sm opacity-80">
        Each request carries a <span className="font-mono">hera-signature</span> header: an HMAC of the timestamp and raw body with your signing secret. Reject
        anything that doesn&apos;t verify.
      </p>
      <pre className="overflow-x-auto font-mono text-[13px] leading-[1.7] whitespace-pre">
        <code>
          <span className="text-blush">const</span>
          {" event = Hera.webhooks."}
          <span className="text-peacock">constructEvent</span>
          {"(rawBody, req.headers["}
          <span className="text-sun">&quot;hera-signature&quot;</span>
          {"], process.env.HERA_WEBHOOK_SECRET);\n"}
          <span className="text-blush">if</span>
          {" (event.type === "}
          <span className="text-sun">&quot;alert.created&quot;</span>
          {") page(event.data.title);"}
        </code>
      </pre>
    </section>
  );
}
