import type { ApiErrorBody, AuditEventDto, InviteDto, InviteLookupResponse, MeResponse, MemberDto, MembershipDto } from "@hera/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashToken } from "../src/auth/tokens";
import { emailVerifications, invites } from "../src/db/schema";
import { createHarness, type Harness, newUser, signedIn, tokenFrom } from "./harness";

const JSON_HEADER = ["Content-Type", "application/json"] as const;
const errorOf = (body: unknown) => (body as ApiErrorBody).error;

let h: Harness;
let owner: Awaited<ReturnType<typeof signedIn>>;

beforeAll(async () => {
  h = await createHarness();
  owner = await signedIn(h, { name: "Olive Owner", company: "Team Test Ltd" });
});

afterAll(async () => {
  await h?.close();
});

async function invite(email: string, role: "admin" | "analyst" | "viewer", by = owner.agent) {
  const res = await by.post("/v1/invites").send({ email, role }).expect(201);
  const mail = (await h.mail(email)).at(-1);
  return { invite: res.body as InviteDto, token: tokenFrom(mail), mail };
}

describe("email verification", () => {
  it("emails a verification link at signup and confirms it once", async () => {
    const { agent, user, me } = await signedIn(h);
    expect(me.user.emailVerified).toBe(false);

    const [mail] = await h.mail(user.email);
    expect(mail).toMatchObject({ tag: "verify-email", subject: "Confirm your email for Hera" });
    expect(mail!.text).toContain("http://localhost:3000/verify-email?token=");
    expect(mail!.html).toContain("#FFF5E8");
    const token = tokenFrom(mail);

    await h.http().post("/v1/auth/verify-email").send({ token }).expect(200, { ok: true });
    expect(((await agent.get("/v1/auth/me").expect(200)).body as MeResponse).user.emailVerified).toBe(true);
    const reused = await h.http().post("/v1/auth/verify-email").send({ token }).expect(422);
    expect(errorOf(reused.body).fields).toHaveProperty("token");
  });

  it("rejects unknown, short and expired tokens", async () => {
    await h.http().post("/v1/auth/verify-email").send({ token: "x".repeat(40) }).expect(422);
    await h.http().post("/v1/auth/verify-email").send({ token: "short" }).expect(422);

    const { me } = await signedIn(h);
    await h.db.insert(emailVerifications).values({ tokenHash: hashToken("expired-verify-token-1"), userId: me.user.id, expiresAt: new Date(Date.now() - 1000) });
    await h.http().post("/v1/auth/verify-email").send({ token: "expired-verify-token-1" }).expect(422);
  });

  it("resends for unverified users only, and needs a session", async () => {
    const { agent, user } = await signedIn(h);
    await agent.post("/v1/auth/resend-verification").set(...JSON_HEADER).expect(202, { ok: true });
    const sent = await h.mail(user.email);
    expect(sent.map((m) => m.tag)).toEqual(["verify-email", "verify-email"]);
    expect(tokenFrom(sent[0])).not.toBe(tokenFrom(sent[1]));

    await h.http().post("/v1/auth/verify-email").send({ token: tokenFrom(sent[1]) }).expect(200);
    await agent.post("/v1/auth/resend-verification").set(...JSON_HEADER).expect(202);
    expect(await h.mail(user.email)).toHaveLength(2);

    await h.http().post("/v1/auth/resend-verification").set(...JSON_HEADER).expect(401);
  });

  it("doesn't block login while unverified", async () => {
    const { user } = await signedIn(h);
    const res = await h.http().post("/v1/auth/login").send({ email: user.email, password: user.password }).expect(200);
    expect((res.body as MeResponse).user.emailVerified).toBe(false);
  });

  it("emails password reset links", async () => {
    const { user } = await signedIn(h);
    await h.http().post("/v1/auth/forgot-password").send({ email: user.email }).expect(202);
    const reset = (await h.mail(user.email)).find((m) => m.tag === "password-reset");
    expect(reset?.text).toContain("http://localhost:3000/reset-password?token=");
    await h.http().post("/v1/auth/reset-password").send({ token: tokenFrom(reset), password: "fresh password 77" }).expect(200);
    await h.http().post("/v1/auth/login").send({ email: user.email, password: "fresh password 77" }).expect(200);
  });
});

describe("invites", () => {
  const newbie = `newbie-${Date.now()}@example.com`;
  let analyst: Awaited<ReturnType<typeof invite>>;

  it("invites a new person by email", async () => {
    analyst = await invite(newbie, "analyst");
    expect(analyst.invite).toMatchObject({ email: newbie, role: "analyst", invitedBy: "Olive Owner" });
    expect(Date.parse(analyst.invite.expiresAt) - Date.now()).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
    expect(analyst.invite.acceptedAt).toBeUndefined();
    expect(analyst.mail).toMatchObject({ tag: "team-invite", subject: "Olive Owner invited you to Team Test Ltd on Hera" });

    const lookup = (await h.http().get(`/v1/invites/lookup?token=${analyst.token}`).expect(200)).body as InviteLookupResponse;
    expect(lookup).toEqual({ email: newbie, orgName: "Team Test Ltd", role: "analyst", invitedBy: "Olive Owner", existingUser: false, expired: false });
    await h.http().get(`/v1/invites/lookup?token=${"z".repeat(30)}`).expect(404);
  });

  it("409s duplicates and existing members", async () => {
    const pending = await owner.agent.post("/v1/invites").send({ email: newbie.toUpperCase(), role: "viewer" }).expect(409);
    expect(errorOf(pending.body).code).toBe("invite_pending");
    const member = await owner.agent.post("/v1/invites").send({ email: owner.user.email, role: "viewer" }).expect(409);
    expect(errorOf(member.body).code).toBe("already_member");
    await owner.agent.post("/v1/invites").send({ email: "x@example.com", role: "owner" }).expect(422);
  });

  it("creates the account on accept, with password rules and a verified email", async () => {
    const missing = await h.http().post("/v1/invites/accept").send({ token: analyst.token, password: "x" }).expect(422);
    expect(Object.keys(errorOf(missing.body).fields!).sort()).toEqual(["name", "password"]);

    const agent = h.agent();
    const res = await agent.post("/v1/invites/accept").send({ token: analyst.token, name: "Nia Newbie", password: "nia password 12" }).expect(200);
    const me = res.body as MeResponse;
    expect(me).toMatchObject({ role: "analyst", org: { id: owner.me.org.id }, user: { email: newbie, name: "Nia Newbie", emailVerified: true } });
    expect(String(res.headers["set-cookie"])).toMatch(/hera_session=/);
    await agent.get("/v1/wallets").expect(200);

    const again = await h.http().post("/v1/invites/accept").send({ token: analyst.token, name: "Nia", password: "nia password 12" }).expect(410);
    expect(errorOf(again.body).code).toBe("invite_expired");
    const list = (await owner.agent.get("/v1/invites").expect(200)).body as InviteDto[];
    expect(list.find((i) => i.id === analyst.invite.id)?.acceptedAt).toBeDefined();
  });

  it("adds an existing user after checking their password, and lets them switch orgs", async () => {
    const other = await signedIn(h, { company: "Other Org" });
    const { token } = await invite(other.user.email, "viewer");
    const lookup = (await h.http().get(`/v1/invites/lookup?token=${token}`).expect(200)).body as InviteLookupResponse;
    expect(lookup.existingUser).toBe(true);

    const wrong = await h.http().post("/v1/invites/accept").send({ token, password: "not my password 1" }).expect(401);
    expect(errorOf(wrong.body).code).toBe("invalid_credentials");
    const agent = h.agent();
    const me = (await agent.post("/v1/invites/accept").send({ token, password: other.user.password }).expect(200)).body as MeResponse;
    expect(me).toMatchObject({ role: "viewer", org: { name: "Team Test Ltd" }, user: { emailVerified: true } });

    const orgs = (await agent.get("/v1/me/orgs").expect(200)).body as MembershipDto[];
    expect(orgs.map((o) => [o.orgName, o.role])).toEqual([
      ["Other Org", "owner"],
      ["Team Test Ltd", "viewer"],
    ]);
    const switched = (await agent.post("/v1/auth/switch-org").send({ orgId: other.me.org.id }).expect(200)).body as MeResponse;
    expect(switched).toMatchObject({ role: "owner", org: { name: "Other Org" } });
    expect(((await agent.get("/v1/auth/me").expect(200)).body as MeResponse).org.name).toBe("Other Org");

    const denied = await agent.post("/v1/auth/switch-org").send({ orgId: "00000000-0000-4000-8000-000000000000" }).expect(403);
    expect(errorOf(denied.body).code).toBe("forbidden");
    await agent.post("/v1/auth/switch-org").send({ orgId: "nope" }).expect(422);
  });

  it("410s expired and revoked invites, and resend issues a new link", async () => {
    const expired = await invite(`late-${Date.now()}@example.com`, "viewer");
    await h.db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.id, expired.invite.id));
    expect(((await h.http().get(`/v1/invites/lookup?token=${expired.token}`).expect(200)).body as InviteLookupResponse).expired).toBe(true);
    const res = await h.http().post("/v1/invites/accept").send({ token: expired.token, name: "Late", password: "late password 1" }).expect(410);
    expect(errorOf(res.body).code).toBe("invite_expired");

    const resent = (await owner.agent.post(`/v1/invites/${expired.invite.id}/resend`).set(...JSON_HEADER).expect(200)).body as InviteDto;
    expect(Date.parse(resent.expiresAt)).toBeGreaterThan(Date.now());
    const fresh = tokenFrom((await h.mail(expired.invite.email)).at(-1));
    expect(fresh).not.toBe(expired.token);
    await h.http().get(`/v1/invites/lookup?token=${expired.token}`).expect(404);

    await owner.agent.delete(`/v1/invites/${expired.invite.id}`).set(...JSON_HEADER).expect(204);
    await owner.agent.delete(`/v1/invites/${expired.invite.id}`).set(...JSON_HEADER).expect(204); // idempotent
    await h.http().post("/v1/invites/accept").send({ token: fresh, name: "Late", password: "late password 1" }).expect(410);
    const resendRevoked = await owner.agent.post(`/v1/invites/${expired.invite.id}/resend`).set(...JSON_HEADER).expect(409);
    expect(errorOf(resendRevoked.body).code).toBe("invite_revoked");
  });
});

describe("members", () => {
  let admin: { agent: ReturnType<Harness["agent"]>; me: MeResponse };
  let analyst: { agent: ReturnType<Harness["agent"]>; me: MeResponse };

  async function join(role: "admin" | "analyst" | "viewer") {
    const email = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    const { token } = await invite(email, role);
    const agent = h.agent();
    const me = (await agent.post("/v1/invites/accept").send({ token, name: `The ${role}`, password: "member password 1" }).expect(200)).body as MeResponse;
    return { agent, me };
  }

  beforeAll(async () => {
    admin = await join("admin");
    analyst = await join("analyst");
  });

  it("keeps invites and role changes to admins", async () => {
    await analyst.agent.get("/v1/invites").expect(403);
    await analyst.agent.post("/v1/invites").send({ email: "a@example.com", role: "viewer" }).expect(403);
    await analyst.agent.patch(`/v1/org/members/${admin.me.user.id}`).send({ role: "viewer" }).expect(403);
  });

  it("lets admins change non-owners but never owners, and never grant owner", async () => {
    const changed = (await admin.agent.patch(`/v1/org/members/${analyst.me.user.id}`).send({ role: "viewer" }).expect(200)).body as MemberDto;
    expect(changed).toMatchObject({ userId: analyst.me.user.id, role: "viewer" });
    await analyst.agent.post("/v1/wallets").send({ address: "0x1111111111111111111111111111111111111111", label: "x" }).expect(403);
    await admin.agent.patch(`/v1/org/members/${analyst.me.user.id}`).send({ role: "analyst" }).expect(200);

    const touchOwner = await admin.agent.patch(`/v1/org/members/${owner.me.user.id}`).send({ role: "admin" }).expect(403);
    expect(errorOf(touchOwner.body).message).toMatch(/owner/);
    await admin.agent.patch(`/v1/org/members/${analyst.me.user.id}`).send({ role: "owner" }).expect(403);
    await admin.agent.delete(`/v1/org/members/${owner.me.user.id}`).set(...JSON_HEADER).expect(403);
    await admin.agent.patch("/v1/org/members/00000000-0000-4000-8000-000000000000").send({ role: "viewer" }).expect(404);
  });

  it("protects the last owner", async () => {
    const demote = await owner.agent.patch(`/v1/org/members/${owner.me.user.id}`).send({ role: "admin" }).expect(409);
    expect(errorOf(demote.body).code).toBe("last_owner");
    const leave = await owner.agent.delete(`/v1/org/members/${owner.me.user.id}`).set(...JSON_HEADER).expect(409);
    expect(errorOf(leave.body).code).toBe("last_owner");

    // With a second owner, the first can step down.
    await owner.agent.patch(`/v1/org/members/${admin.me.user.id}`).send({ role: "owner" }).expect(200);
    await owner.agent.patch(`/v1/org/members/${owner.me.user.id}`).send({ role: "admin" }).expect(200);
    const back = await admin.agent.patch(`/v1/org/members/${admin.me.user.id}`).send({ role: "admin" }).expect(409);
    expect(errorOf(back.body).code).toBe("last_owner");
    await admin.agent.patch(`/v1/org/members/${owner.me.user.id}`).send({ role: "owner" }).expect(200);
  });

  it("removes members and revokes their sessions; anyone can leave", async () => {
    const viewer = await join("viewer");
    await viewer.agent.delete(`/v1/org/members/${analyst.me.user.id}`).set(...JSON_HEADER).expect(403);

    await analyst.agent.get("/v1/auth/me").expect(200);
    await admin.agent.delete(`/v1/org/members/${analyst.me.user.id}`).set(...JSON_HEADER).expect(204);
    await analyst.agent.get("/v1/auth/me").expect(401);

    await viewer.agent.delete(`/v1/org/members/${viewer.me.user.id}`).set(...JSON_HEADER).expect(204);
    await viewer.agent.get("/v1/auth/me").expect(401);

    const org = (await owner.agent.get("/v1/org").expect(200)).body as { members: MemberDto[] };
    expect(org.members.map((m) => m.userId)).not.toContain(analyst.me.user.id);
    expect(org.members.map((m) => m.userId)).not.toContain(viewer.me.user.id);
  });

  it("audits every team action", async () => {
    const events = (await owner.agent.get("/v1/audit?limit=500").expect(200)).body as AuditEventDto[];
    const actions = new Set(events.map((e) => e.action));
    for (const action of ["invite.created", "invite.accepted", "invite.resent", "invite.revoked", "member.role_changed", "member.removed", "member.left"]) {
      expect(actions, action).toContain(action);
    }
    expect((await owner.agent.get("/v1/audit/verify").expect(200)).body).toMatchObject({ valid: true });
  });
});

describe("notification preferences", () => {
  it("toggles alert emails", async () => {
    const { agent } = await signedIn(h, newUser());
    await agent.patch("/v1/me/notifications").send({ alertEmails: false }).expect(200, { alertEmails: false });
    await agent.patch("/v1/me/notifications").send({ alertEmails: "no" }).expect(422);
  });
});
