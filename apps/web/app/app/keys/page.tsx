"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { API_KEY_SCOPES, type ApiKeyDto, type ApiKeyScope, createApiKeySchema, type CreateApiKeyResponse } from "@hera/core";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { shortDate } from "@/components/admin/format";
import { NoAccess } from "@/components/admin/no-access";
import { SecretDialog } from "@/components/admin/secret-dialog";
import { Tag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/field";
import { DataTable, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useRole } from "@/lib/hooks/account";
import { applyApiError } from "@/lib/hooks/forms";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/lib/queries";

const SCOPE_INFO: Record<ApiKeyScope, { tone: "peacock" | "iris" | "sun" | "blush"; body: string }> = {
  read: { tone: "peacock", body: "Read wallets, alerts, screenings and the overview; list and download reports." },
  screen: { tone: "iris", body: "Screen addresses with POST /v1/screen." },
  monitor: { tone: "sun", body: "Add, refresh and remove watched wallets, and update alerts." },
  travel_rule: { tone: "blush", body: "Create and move Travel Rule transfers. These carry IVMS101 personal data." },
};

function ScopeTag({ scope }: { scope: ApiKeyScope }) {
  return <Tag tone={SCOPE_INFO[scope].tone}>{scope}</Tag>;
}

export default function ApiKeysPage() {
  const { isAdmin } = useRole();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreateApiKeyResponse | null>(null);

  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys stay on your server. Give each one only the scopes it needs."
        actions={
          isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              Create key
            </Button>
          )
        }
      />
      {isAdmin ? (
        <KeysTable onCreate={() => setCreating(true)} />
      ) : (
        <NoAccess
          title="API keys are for owners and admins"
          body="Keys can screen addresses, read your data and file Travel Rule transfers from a server, so only owners and admins can see or create them. Ask one of them for a key with the scopes your integration needs."
          action={
            <ButtonLink href="/developers" variant="secondary">
              Read the API docs
            </ButtonLink>
          }
        />
      )}

      <CreateKeyDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(response) => {
          setCreating(false);
          setCreated(response);
        }}
      />
      {created && (
        <SecretDialog
          open
          title={`Key created: ${created.key.name}`}
          secret={created.secret}
          envName="HERA_API_KEY"
          onDone={() => {
            setCreated(null);
            toast.success(`${created.key.name} is ready to use`);
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="text-ink-soft">Scopes:</span>
            {created.key.scopes.map((s) => (
              <ScopeTag key={s} scope={s} />
            ))}
          </div>
        </SecretDialog>
      )}
    </>
  );
}

/* ─── List ───────────────────────────────────────────── */

function KeysTable({ onCreate }: { onCreate: () => void }) {
  const keysQuery = useApiKeys();
  const revoke = useRevokeApiKey();
  const [target, setTarget] = useState<ApiKeyDto | null>(null);

  if (keysQuery.isPending) {
    return (
      <Card>
        <LoadingBlock rows={4} />
      </Card>
    );
  }
  if (keysQuery.isError) {
    return (
      <Card>
        <ErrorBlock error={keysQuery.error} onRetry={() => keysQuery.refetch()} />
      </Card>
    );
  }

  const rows = [...keysQuery.data].sort(
    (a, b) => Number(Boolean(a.revokedAt)) - Number(Boolean(b.revokedAt)) || b.createdAt.localeCompare(a.createdAt),
  );

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No API keys yet"
          body="Create one to call Hera from your backend. You'll see the secret once, so have somewhere safe ready to paste it."
          action={<Button onClick={onCreate}>Create your first key</Button>}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <DataTable minWidth={760}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Key</th>
            <th scope="col">Scopes</th>
            <th scope="col">Last used</th>
            <th scope="col">Created</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => {
            const revoked = Boolean(k.revokedAt);
            return (
              <tr key={k.id} className={cn(revoked && "opacity-60")}>
                <td className={cn("font-bold", revoked && "line-through")}>
                  {k.name}
                  {revoked && <span className="sr-only"> (revoked)</span>}
                </td>
                <td className="font-mono">{k.prefix}…</td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <ScopeTag key={s} scope={s} />
                    ))}
                  </span>
                </td>
                <td className={cn(!revoked && "text-ink-soft")} title={k.lastUsedAt ? formatDateTime(k.lastUsedAt) : undefined}>
                  {k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}
                </td>
                <td className={cn(!revoked && "text-ink-soft")} title={formatDateTime(k.createdAt)}>
                  {shortDate(k.createdAt)}
                </td>
                <td className="text-right">
                  {revoked ? (
                    <span className="text-[13px] font-bold" title={k.revokedAt ? `Revoked ${formatDateTime(k.revokedAt)}` : undefined}>
                      Revoked
                    </span>
                  ) : (
                    <Button variant="danger" size="sm" className="min-h-9 shadow-none" aria-label={`Revoke ${k.name}`} onClick={() => setTarget(k)}>
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={`Revoke ${target?.name ?? "key"}?`}
        confirmLabel="Revoke key"
        loading={revoke.isPending}
        onConfirm={async () => {
          if (!target) return;
          try {
            await revoke.mutateAsync(target.id);
            toast.success(`${target.name} revoked`);
            setTarget(null);
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      >
        <p>
          Anything still using <span className="font-mono">{target?.prefix}…</span> gets a 401 from the next request. This can&apos;t be undone; you can always
          create a new key.
        </p>
      </ConfirmDialog>
    </Card>
  );
}

/* ─── Create ─────────────────────────────────────────── */

function CreateKeyDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: CreateApiKeyResponse) => void }) {
  const create = useCreateApiKey();
  const [formError, setFormError] = useState<string | null>(null);
  const scopesErrorId = useId();
  const form = useForm({ resolver: zodResolver(createApiKeySchema), defaultValues: { name: "", scopes: [] as ApiKeyScope[] } });
  const { register, handleSubmit, formState, reset, watch } = form;
  const selected = watch("scopes") ?? [];

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const response = await create.mutateAsync(values);
      reset();
      onCreated(response);
    } catch (error) {
      setFormError(applyApiError(form, error));
    }
  });

  return (
    <Dialog open={open} onClose={close} title="Create an API key" className="max-w-[600px]">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Name" hint="Where it's used, like checkout-prod or reporting-bot." error={formState.errors.name?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid || undefined} mono {...register("name")} />
          )}
        </Field>
        <fieldset className="flex flex-col gap-2" aria-describedby={formState.errors.scopes ? scopesErrorId : undefined}>
          <legend className="mb-1.5 text-sm font-semibold">Scopes</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
            {API_KEY_SCOPES.map((scope) => {
              const on = selected.includes(scope);
              return (
                <label
                  key={scope}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-[12px] border-2 border-line p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iris",
                    on ? "bg-paper-2 shadow-hard-sm" : "bg-card",
                  )}
                >
                  <input type="checkbox" value={scope} className="mt-0.5 size-[18px] shrink-0 accent-ink focus-visible:outline-none" {...register("scopes")} />
                  <span className="flex flex-col gap-1">
                    <ScopeTag scope={scope} />
                    <span className="text-[13px] leading-snug">{SCOPE_INFO[scope].body}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {formState.errors.scopes && (
            <span id={scopesErrorId} className="text-[13px] font-medium text-risk-severe">
              {formState.errors.scopes.message ?? "Pick at least one scope"}
            </span>
          )}
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="ink" loading={create.isPending}>
            Create key
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
