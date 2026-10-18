"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createInviteSchema, INVITABLE_ROLES, type InviteDto, type MemberDto, ROLES, type Role } from "@hera/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Avatar } from "@/components/admin/avatar";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { shortDate } from "@/components/admin/format";
import { Pill, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo, titleCase } from "@/lib/format";
import { useRole } from "@/lib/hooks/account";
import { applyApiError } from "@/lib/hooks/forms";
import { useCreateInvite, useInvites, useMe, useOrg, useRemoveMember, useResendInvite, useRevokeInvite, useUpdateMember } from "@/lib/queries";

const ROLE_TONE: Record<Role, "sun" | "blush" | "iris" | "peacock"> = {
  owner: "sun",
  admin: "blush",
  analyst: "iris",
  viewer: "peacock",
};

const ROLE_HELP: { role: Role; body: string }[] = [
  { role: "admin", body: "Everything except deleting the org. Manages keys, webhooks and the team." },
  { role: "analyst", body: "Screens, watches wallets, decides alerts, files Travel Rule transfers." },
  { role: "viewer", body: "Read-only. Can download reports. Good for auditors." },
];

export default function TeamPage() {
  const { data: me } = useMe();
  const { isAdmin } = useRole();
  if (!me) return null;

  return (
    <>
      <PageHeader title="Team" description={`Who can see what at ${me.org.name}.`} />
      {isAdmin ? (
        <InviteCard />
      ) : (
        <Card className="flex flex-wrap items-center gap-3 p-4 text-[15px]">
          <Pill tone={ROLE_TONE[me.role]}>{titleCase(me.role)}</Pill>
          <span>Only owners and admins can invite people or change roles. Ask one of them if you need something changed.</span>
        </Card>
      )}
      <MembersCard />
      {isAdmin && <InvitesCard />}
    </>
  );
}

/* ─── Invite ─────────────────────────────────────────── */

function InviteCard() {
  const create = useCreateInvite();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(createInviteSchema), defaultValues: { email: "", role: "analyst" as const } });
  const { register, handleSubmit, formState, reset } = form;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const invite = await create.mutateAsync(values);
      toast.success(`Invite sent to ${invite.email}`, { description: "The link works for 7 days." });
      reset({ email: "", role: values.role });
    } catch (error) {
      setFormError(applyApiError(form, error, { already_member: "email", invite_pending: "email" }));
    }
  });

  return (
    <section aria-labelledby="invite-title" className="flex flex-col gap-3 rounded-[18px] border-[3px] border-line bg-card p-5 shadow-[6px_6px_0_var(--blush)]">
      <h2 id="invite-title" className="text-[22px] font-extrabold">
        Invite someone
      </h2>
      <FormError message={formError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-2.5">
        <Field label="Work email" error={formState.errors.email?.message} className="flex-[1_1_280px]">
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className="py-2.5 text-[15px]"
              {...register("email")}
            />
          )}
        </Field>
        <Field label="Role" error={formState.errors.role?.message} className="flex-[1_1_180px] sm:flex-[0_1_200px]">
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="py-2.5 text-[15px]" {...register("role")}>
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {titleCase(r)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" loading={create.isPending} className="w-full sm:mt-[26px] sm:w-auto">
          Send invite
        </Button>
      </form>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5 text-[13px] leading-normal" aria-label="What each role can do">
        {ROLE_HELP.map((r) => (
          <li key={r.role} className="rounded-[12px] border-2 border-line bg-paper px-3 py-2.5">
            <strong>{titleCase(r.role)}</strong>
            <br />
            {r.body}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Members ────────────────────────────────────────── */

type PendingAction = { kind: "remove"; member: MemberDto } | { kind: "role"; member: MemberDto; role: Role };

function MembersCard() {
  const { data: me } = useMe();
  const org = useOrg();
  const { isAdmin, isOwner } = useRole();
  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();
  const qc = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);

  const members = org.data?.members ?? [];
  const ownerCount = members.filter((m) => m.role === "owner").length;

  const changeRole = async (member: MemberDto, role: Role) => {
    try {
      await updateMember.mutateAsync({ userId: member.userId, role });
      toast.success(`${member.name} is now ${role === "admin" || role === "analyst" || role === "owner" ? "an" : "a"} ${titleCase(role)}`);
      if (member.userId === me?.user.id) qc.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const confirm = async () => {
    if (!pending) return;
    if (pending.kind === "role") {
      await changeRole(pending.member, pending.role);
      setPending(null);
      return;
    }
    const { member } = pending;
    const self = member.userId === me?.user.id;
    try {
      await removeMember.mutateAsync(member.userId);
      setPending(null);
      if (self) {
        // Leaving deletes this org's sessions, so the current one is gone.
        toast.success(`You left ${org.data?.name ?? "the organization"}`);
        qc.clear();
        router.replace("/login");
        return;
      }
      toast.success(`${member.name} was removed`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader title={org.data ? `Members · ${members.length}` : "Members"} />
      {org.isPending ? (
        <LoadingBlock rows={3} />
      ) : org.isError ? (
        <ErrorBlock error={org.error} onRetry={() => org.refetch()} />
      ) : members.length === 0 ? (
        <EmptyState title="No members yet" body="Invite a teammate above to get started." />
      ) : (
        <ul>
          {members.map((m, i) => {
            const self = m.userId === me?.user.id;
            const lastOwner = m.role === "owner" && ownerCount <= 1;
            // Admins can't touch owners or make anyone an owner; nobody demotes the last owner.
            const canEditRole = isAdmin && !lastOwner && (isOwner || m.role !== "owner");
            const roleOptions = isOwner ? ROLES : ROLES.filter((r) => r !== "owner");
            const canRemove = !lastOwner && (self || (isAdmin && (isOwner || m.role !== "owner")));
            const removeHint = lastOwner ? "The last owner can't be removed. Make someone else an owner first." : undefined;
            return (
              <li key={m.userId} className={cn("flex flex-wrap items-center gap-3.5 px-5 py-3.5", i > 0 && "border-t border-dashed border-line/30")}>
                <Avatar name={m.name} seed={m.email} />
                <div className="flex min-w-0 flex-[1_1_220px] flex-col">
                  <strong className="flex flex-wrap items-center gap-2 text-[15px]">
                    {m.name}
                    {self && <Tag tone="sun">You</Tag>}
                  </strong>
                  <span className="truncate text-[13px] text-ink-soft">{m.email}</span>
                </div>
                <span className="text-[13px] text-ink-soft" title={new Date(m.joinedAt).toLocaleString()}>
                  Joined {shortDate(m.joinedAt)}
                </span>
                {canEditRole ? (
                  <label className="flex">
                    <span className="sr-only">Role for {m.name}</span>
                    <select
                      value={m.role}
                      disabled={updateMember.isPending}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        if (self) setPending({ kind: "role", member: m, role });
                        else void changeRole(m, role);
                      }}
                      className="min-h-10 rounded-[10px] border-2 border-line bg-paper px-2.5 text-sm font-semibold"
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {titleCase(r)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <Pill tone={ROLE_TONE[m.role]} title={lastOwner ? "The last owner keeps the owner role" : undefined}>
                    {titleCase(m.role)}
                  </Pill>
                )}
                {(isAdmin || self) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-10 shadow-none"
                    disabled={!canRemove}
                    title={removeHint}
                    aria-label={self ? "Leave this organization" : `Remove ${m.name}`}
                    onClick={() => setPending({ kind: "remove", member: m })}
                  >
                    {self ? "Leave" : "Remove"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isOwner && ownerCount === 1 && (
        <p className="border-t-2 border-line bg-paper-2 px-5 py-2.5 text-[13px]">
          You&apos;re the only owner, so you can&apos;t leave or change your role. Make someone else an owner first.
        </p>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        loading={removeMember.isPending || updateMember.isPending}
        title={
          pending?.kind === "role"
            ? "Change your own role?"
            : pending && pending.member.userId === me?.user.id
              ? `Leave ${org.data?.name ?? "this organization"}?`
              : `Remove ${pending?.member.name ?? "member"}?`
        }
        confirmLabel={pending?.kind === "role" ? `Become ${pending ? titleCase(pending.role) : ""}` : pending?.member.userId === me?.user.id ? "Leave" : "Remove"}
        tone={pending?.kind === "role" ? "ink" : "danger"}
        onConfirm={confirm}
      >
        {pending?.kind === "role" ? (
          <p>
            You&apos;ll become {pending.role === "viewer" ? "a" : "an"} <strong>{titleCase(pending.role)}</strong>. You may lose access to this page, and only an
            owner or admin can change it back.
          </p>
        ) : pending && pending.member.userId === me?.user.id ? (
          <p>You&apos;ll lose access straight away and be signed out of this organization. Someone will need to invite you again to come back.</p>
        ) : pending ? (
          <p>
            <strong>{pending.member.name}</strong> ({pending.member.email}) loses access straight away and is signed out of this organization. Their past
            actions stay in the audit log.
          </p>
        ) : null}
      </ConfirmDialog>
    </Card>
  );
}

/* ─── Pending invites ────────────────────────────────── */

function expiryLabel(invite: InviteDto): { text: string; expired: boolean } {
  const expired = new Date(invite.expiresAt).getTime() <= Date.now();
  const rel = timeAgo(invite.expiresAt);
  return expired ? { text: `Expired ${rel}`, expired } : { text: `Expires ${rel}`, expired };
}

function InvitesCard() {
  const invites = useInvites();
  const resend = useResendInvite();
  const revoke = useRevokeInvite();
  const [busyId, setBusyId] = useState<string | null>(null);
  const pending = (invites.data ?? []).filter((i) => !i.acceptedAt && !i.revokedAt);

  const act = async (invite: InviteDto, kind: "resend" | "revoke") => {
    setBusyId(`${kind}:${invite.id}`);
    try {
      if (kind === "resend") {
        await resend.mutateAsync(invite.id);
        toast.success(`Sent a fresh link to ${invite.email}`, { description: "The old link no longer works." });
      } else {
        await revoke.mutateAsync(invite.id);
        toast.success(`Invite for ${invite.email} revoked`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader title={invites.data ? `Pending invites · ${pending.length}` : "Pending invites"} />
      {invites.isPending ? (
        <LoadingBlock rows={2} />
      ) : invites.isError ? (
        <ErrorBlock error={invites.error} onRetry={() => invites.refetch()} />
      ) : pending.length === 0 ? (
        <p className="px-5 py-6 text-[15px] text-ink-soft">No pending invites. New ones show up here until they&apos;re accepted.</p>
      ) : (
        <ul>
          {pending.map((invite, i) => {
            const expiry = expiryLabel(invite);
            return (
              <li key={invite.id} className={cn("flex flex-wrap items-center gap-3.5 px-5 py-3.5", i > 0 && "border-t border-dashed border-line/30")}>
                <span className="min-w-0 flex-[1_1_220px] font-mono text-sm break-all">{invite.email}</span>
                <Pill tone={ROLE_TONE[invite.role]}>{titleCase(invite.role)}</Pill>
                <span className={cn("text-[13px]", expiry.expired ? "font-semibold text-risk-severe" : "text-ink-soft")}>{expiry.text}</span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-10 shadow-none"
                    loading={busyId === `resend:${invite.id}`}
                    disabled={busyId !== null}
                    aria-label={`Resend invite to ${invite.email}`}
                    onClick={() => act(invite, "resend")}
                  >
                    Resend
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="min-h-10 shadow-none"
                    loading={busyId === `revoke:${invite.id}`}
                    disabled={busyId !== null}
                    aria-label={`Revoke invite for ${invite.email}`}
                    onClick={() => act(invite, "revoke")}
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
