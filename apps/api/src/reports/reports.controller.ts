import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile } from "@nestjs/common";
import { type CreateReportInput, createReportSchema, type ReportDto, type ReportVerifyResponse } from "@hera/core";
import type { Response } from "express";
import { z } from "zod";
import { AllowApiKey, CurrentPrincipal, MinRole, Public } from "../auth/access.decorators";
import type { Principal } from "../auth/principal";
import { IdPipe } from "../common/id.pipe";
import { RateLimit } from "../common/rate-limit";
import { ZodPipe } from "../common/zod.pipe";
import { ReportJobs } from "./report-jobs.service";
import { ReportsService } from "./reports.service";

const verifyQuery = z.object({ sha256: z.string().trim().min(1, "Pass the SHA-256 to check").max(128) });

@Controller("reports")
@AllowApiKey("read")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly jobs: ReportJobs,
  ) {}

  @Post()
  @MinRole("analyst")
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodPipe(createReportSchema)) body: CreateReportInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReportDto> {
    const { status, report } = await this.reports.create(principal, body);
    res.status(status);
    if (status === 202) this.jobs.poke();
    return report;
  }

  @Get()
  list(@CurrentPrincipal() principal: Principal): Promise<ReportDto[]> {
    return this.reports.list(principal.orgId);
  }

  // Declared before :id so "verify" never reaches the id route.
  @Get("verify")
  @Public()
  @RateLimit("verify")
  verify(@Query(new ZodPipe(verifyQuery)) query: { sha256: string }): Promise<ReportVerifyResponse> {
    return this.reports.verify(query.sha256);
  }

  @Get(":id")
  get(@CurrentPrincipal() principal: Principal, @Param("id", IdPipe) id: string): Promise<ReportDto> {
    return this.reports.get(principal.orgId, id);
  }

  @Get(":id/pdf")
  async pdf(@CurrentPrincipal() principal: Principal, @Param("id", IdPipe) id: string): Promise<StreamableFile> {
    const { reference, bytes } = await this.reports.artifact(principal, id, "pdf");
    return new StreamableFile(bytes, { type: "application/pdf", disposition: `attachment; filename="${reference}.pdf"`, length: bytes.length });
  }

  /** The exact canonical bytes whose SHA-256 is `jsonSha256`. */
  @Get(":id/json")
  async json(@CurrentPrincipal() principal: Principal, @Param("id", IdPipe) id: string): Promise<StreamableFile> {
    const { reference, bytes } = await this.reports.artifact(principal, id, "json");
    return new StreamableFile(bytes, { type: "application/json; charset=utf-8", disposition: `inline; filename="${reference}.json"`, length: bytes.length });
  }
}
