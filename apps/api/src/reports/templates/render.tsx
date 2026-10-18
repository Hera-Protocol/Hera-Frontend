import { renderToBuffer } from "@react-pdf/renderer";
import type { ReportSnapshot } from "../snapshot";
import { AuditReport } from "./audit";
import { EvidenceReport } from "./evidence";
import { TravelRuleReport } from "./travel-rule";

/** Render a frozen snapshot. The PDF never reads anything but the snapshot and its hash. */
export function renderReportPdf(snapshot: ReportSnapshot, jsonSha256: string): Promise<Buffer> {
  switch (snapshot.type) {
    case "screening_evidence":
      return renderToBuffer(<EvidenceReport snapshot={snapshot} jsonSha256={jsonSha256} />);
    case "travel_rule":
      return renderToBuffer(<TravelRuleReport snapshot={snapshot} jsonSha256={jsonSha256} />);
    case "audit":
      return renderToBuffer(<AuditReport snapshot={snapshot} jsonSha256={jsonSha256} />);
  }
}
