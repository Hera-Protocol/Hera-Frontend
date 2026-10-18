import { Inject, Injectable } from "@nestjs/common";
import {
  canTransition,
  checkTravelRule,
  type CreateTravelRuleInput,
  originatorHasIdentifier,
  type SubjectInput,
  type SubjectRef,
  type TravelRuleEventDto,
  type TravelRuleStatus,
  type TravelRuleTransferDto,
} from "@hera/core";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { actorNameOf, actorOf, type Principal, userIdOf } from "../auth/principal";
import { conflict, notFound, validationFailed } from "../common/api-error";
import { parseSubjectOrThrow } from "../common/subject";
import { DATABASE, type Database, type Executor, isUniqueViolation } from "../db/database";
import { travelRuleEvents, travelRuleTransfers } from "../db/schema";
import { WebhooksService } from "../webhooks/webhooks.service";
import { newReference } from "./reference";

type TransferRow = typeof travelRuleTransfers.$inferSelect;
type EventRow = typeof travelRuleEvents.$inferSelect;

const REFERENCE_ATTEMPTS = 5;

function toEventDto(row: EventRow): TravelRuleEventDto {
  return { status: row.status, ...(row.note ? { note: row.note } : {}), actor: row.actor, at: row.at.toISOString() };
}

function toDto(row: TransferRow, events: EventRow[]): TravelRuleTransferDto {
  return {
    id: row.id,
    reference: row.reference,
    direction: row.direction,
    chain: row.chain,
    asset: row.asset,
    amount: row.amount,
    amountUsd: Number(row.amountUsd),
    ...(row.txHash ? { txHash: row.txHash } : {}),
    jurisdiction: row.jurisdiction,
    originator: row.originator,
    originatorAccount: row.originatorAccount,
    beneficiary: row.beneficiary,
    beneficiaryAccount: row.beneficiaryAccount,
    beneficiaryVasp: row.beneficiaryVasp ?? null,
    status: row.status,
    check: row.check,
    events: events.map(toEventDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Accounts default to the transfer's chain and must stay on it. */
function parseAccount(input: SubjectInput, chain: CreateTravelRuleInput["chain"], field: string): SubjectRef {
  const subject = parseSubjectOrThrow({ ...input, chain: input.chain ?? chain }, `${field}.address`);
  if (subject.chain !== chain) throw validationFailed({ [`${field}.address`]: `This address isn't on ${chain}.` });
  return subject;
}

@Injectable()
export class TravelRuleService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(orgId: string): Promise<TravelRuleTransferDto[]> {
    const rows = await this.db
      .select()
      .from(travelRuleTransfers)
      .where(eq(travelRuleTransfers.orgId, orgId))
      .orderBy(desc(travelRuleTransfers.createdAt));
    return this.withEvents(rows);
  }

  async get(orgId: string, id: string, executor: Executor = this.db): Promise<TravelRuleTransferDto> {
    const rows = await executor
      .select()
      .from(travelRuleTransfers)
      .where(and(eq(travelRuleTransfers.id, id), eq(travelRuleTransfers.orgId, orgId)))
      .limit(1);
    if (rows.length === 0) throw notFound("That transfer");
    const [dto] = await this.withEvents(rows, executor);
    return dto!;
  }

  async create(principal: Principal, input: CreateTravelRuleInput): Promise<TravelRuleTransferDto> {
    const originatorAccount = parseAccount(input.originatorAccount, input.chain, "originatorAccount");
    const beneficiaryAccount = parseAccount(input.beneficiaryAccount, input.chain, "beneficiaryAccount");
    const check = checkTravelRule({
      amountUsd: input.amountUsd,
      jurisdiction: input.jurisdiction,
      counterpartyHosted: input.beneficiaryVasp !== null,
    });
    if (check.required && !originatorHasIdentifier(input.originator)) {
      throw validationFailed({
        originator: "Add a customer ID, national ID, address, or date and place of birth for the originator.",
      });
    }

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.insert(principal, input, { originatorAccount, beneficiaryAccount, check });
      } catch (error) {
        // A reference collision is astronomically rare; retry with a new one.
        if (!isUniqueViolation(error) || attempt >= REFERENCE_ATTEMPTS) throw error;
      }
    }
  }

  async transition(principal: Principal, id: string, to: TravelRuleStatus, note?: string): Promise<TravelRuleTransferDto> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(travelRuleTransfers)
        .where(and(eq(travelRuleTransfers.id, id), eq(travelRuleTransfers.orgId, principal.orgId)))
        .for("update");
      if (!current) throw notFound("That transfer");
      if (!canTransition(current.status, to)) {
        throw conflict("invalid_transition", `A transfer can't move from ${current.status} to ${to}.`);
      }

      const now = new Date();
      await tx.update(travelRuleTransfers).set({ status: to, updatedAt: now }).where(eq(travelRuleTransfers.id, id));
      await tx.insert(travelRuleEvents).values({
        orgId: principal.orgId,
        transferId: id,
        status: to,
        note: note || null,
        actorId: userIdOf(principal),
        actor: actorNameOf(principal),
        at: now,
      });
      await this.audit.record(
        {
          orgId: principal.orgId,
          actor: actorOf(principal),
          action: "travel_rule.transitioned",
          target: id,
          metadata: { reference: current.reference, from: current.status, to },
        },
        tx,
      );
      const dto = await this.get(principal.orgId, id, tx);
      await this.webhooks.emit(tx, principal.orgId, "travel_rule.updated", dto);
      return dto;
    });
  }

  private insert(
    principal: Principal,
    input: CreateTravelRuleInput,
    derived: { originatorAccount: SubjectRef; beneficiaryAccount: SubjectRef; check: TravelRuleTransferDto["check"] },
  ): Promise<TravelRuleTransferDto> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(travelRuleTransfers)
        .values({
          orgId: principal.orgId,
          reference: newReference(),
          direction: input.direction,
          chain: input.chain,
          asset: input.asset,
          amount: input.amount,
          amountUsd: input.amountUsd.toFixed(2),
          txHash: input.txHash || null,
          jurisdiction: input.jurisdiction,
          originator: input.originator,
          originatorAccount: derived.originatorAccount,
          beneficiary: input.beneficiary,
          beneficiaryAccount: derived.beneficiaryAccount,
          beneficiaryVasp: input.beneficiaryVasp,
          status: "draft",
          check: derived.check,
          createdBy: userIdOf(principal),
        })
        .returning();
      await tx.insert(travelRuleEvents).values({
        orgId: principal.orgId,
        transferId: row!.id,
        status: "draft",
        note: "Transfer created",
        actorId: userIdOf(principal),
        actor: actorNameOf(principal),
        at: row!.createdAt,
      });
      await this.audit.record(
        {
          orgId: principal.orgId,
          actor: actorOf(principal),
          action: "travel_rule.created",
          target: row!.id,
          metadata: { reference: row!.reference, jurisdiction: input.jurisdiction, amountUsd: input.amountUsd, required: derived.check.required },
        },
        tx,
      );
      const dto = await this.get(principal.orgId, row!.id, tx);
      await this.webhooks.emit(tx, principal.orgId, "travel_rule.updated", dto);
      return dto;
    });
  }

  private async withEvents(rows: TransferRow[], executor: Executor = this.db): Promise<TravelRuleTransferDto[]> {
    if (rows.length === 0) return [];
    const events = await executor
      .select()
      .from(travelRuleEvents)
      .where(inArray(travelRuleEvents.transferId, rows.map((r) => r.id)))
      .orderBy(asc(travelRuleEvents.at));
    const byTransfer = new Map<string, EventRow[]>();
    for (const event of events) byTransfer.set(event.transferId, [...(byTransfer.get(event.transferId) ?? []), event]);
    return rows.map((row) => toDto(row, byTransfer.get(row.id) ?? []));
  }
}
