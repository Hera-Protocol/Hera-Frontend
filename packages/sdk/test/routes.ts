import type { CreateTravelRuleInput } from "@hera/core";
import type { Hera } from "../src";
import { G, json, screening, UUID } from "./helpers";

export const travelRuleInput: CreateTravelRuleInput = {
  direction: "outgoing",
  chain: "evm:1",
  asset: "USDC",
  amount: "250.00",
  amountUsd: 250,
  jurisdiction: "EU",
  originator: { type: "natural", firstName: "Olu", lastName: "Originator", customerId: "C-1042" },
  originatorAccount: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  beneficiary: { type: "natural", firstName: "Bea", lastName: "Neficiary" },
  beneficiaryAccount: { address: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3" },
  beneficiaryVasp: { name: "Coinbase Europe", lei: "549300ZJ7HSN6TTQ6P20" },
};

export interface Route {
  name: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** OpenAPI-style template, relative to /v1. */
  template: string;
  /** Concrete path the call should hit (with query). */
  path: string;
  body?: unknown;
  call: (hera: Hera) => Promise<unknown>;
  /** API key scope the route accepts; null = dashboard session only (keys get 403). Checked against openapi.json. */
  scope: "screen" | "read" | "monitor" | "travel_rule" | null;
  /** Response the mock should return for the call to succeed. */
  response?: () => Response;
}

const pdf = () => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { headers: { "content-type": "application/pdf" } });
const noContent = () => new Response(null, { status: 204 });

/** Every SDK method that talks to the API. The drift test checks each against openapi.json. */
export const ROUTES: Route[] = [
  { name: "screen", scope: "screen", method: "POST", template: "/screen", path: "/screen", body: { address: G }, call: (h) => h.screen(G), response: () => json(screening()) },
  {
    name: "guard", scope: "screen",
    method: "POST",
    template: "/screen",
    path: "/screen",
    body: { address: G, memo: { type: "id", value: "42" } },
    call: (h) => h.guard({ address: G, memo: { type: "id", value: "42" } }),
    response: () => json(screening()),
  },
  { name: "screenings.list", scope: "read", method: "GET", template: "/screenings", path: "/screenings?limit=10", call: (h) => h.screenings.list({ limit: 10 }) },
  { name: "screenings.get", scope: "read", method: "GET", template: "/screenings/{id}", path: `/screenings/${UUID}`, call: (h) => h.screenings.get(UUID) },
  { name: "wallets.list", scope: "read", method: "GET", template: "/wallets", path: "/wallets", call: (h) => h.wallets.list() },
  {
    name: "wallets.watch", scope: "monitor",
    method: "POST",
    template: "/wallets",
    path: "/wallets",
    body: { address: G, label: "Treasury" },
    call: (h) => h.wallets.watch({ address: G, label: "Treasury" }),
  },
  { name: "wallets.unwatch", scope: "monitor", method: "DELETE", template: "/wallets/{id}", path: `/wallets/${UUID}`, call: (h) => h.wallets.unwatch(UUID), response: noContent },
  { name: "wallets.refresh", scope: "monitor", method: "POST", template: "/wallets/{id}/refresh", path: `/wallets/${UUID}/refresh`, call: (h) => h.wallets.refresh(UUID) },
  { name: "alerts.list", scope: "read", method: "GET", template: "/alerts", path: "/alerts?status=open", call: (h) => h.alerts.list({ status: "open" }) },
  { name: "alerts.get", scope: "read", method: "GET", template: "/alerts/{id}", path: `/alerts/${UUID}`, call: (h) => h.alerts.get(UUID) },
  {
    name: "alerts.update", scope: "monitor",
    method: "PATCH",
    template: "/alerts/{id}",
    path: `/alerts/${UUID}`,
    body: { status: "closed", disposition: "false_positive", note: "Known customer" },
    call: (h) => h.alerts.update(UUID, { status: "closed", disposition: "false_positive", note: "Known customer" }),
  },
  {
    name: "travelRule.create", scope: "travel_rule",
    method: "POST",
    template: "/travel-rule/transfers",
    path: "/travel-rule/transfers",
    body: travelRuleInput,
    call: (h) => h.travelRule.create(travelRuleInput),
  },
  { name: "travelRule.list", scope: "travel_rule", method: "GET", template: "/travel-rule/transfers", path: "/travel-rule/transfers", call: (h) => h.travelRule.list() },
  { name: "travelRule.get", scope: "travel_rule", method: "GET", template: "/travel-rule/transfers/{id}", path: `/travel-rule/transfers/${UUID}`, call: (h) => h.travelRule.get(UUID) },
  {
    name: "travelRule.transition", scope: "travel_rule",
    method: "POST",
    template: "/travel-rule/transfers/{id}/transition",
    path: `/travel-rule/transfers/${UUID}/transition`,
    body: { to: "awaiting_counterparty", note: "Sent to VASP" },
    call: (h) => h.travelRule.transition(UUID, "awaiting_counterparty", "Sent to VASP"),
  },
  {
    name: "reports.create", scope: "read",
    method: "POST",
    template: "/reports",
    path: "/reports",
    body: { type: "screening_evidence", screeningId: UUID },
    call: (h) => h.reports.create({ type: "screening_evidence", screeningId: UUID }),
  },
  { name: "reports.list", scope: "read", method: "GET", template: "/reports", path: "/reports", call: (h) => h.reports.list() },
  { name: "reports.get", scope: "read", method: "GET", template: "/reports/{id}", path: `/reports/${UUID}`, call: (h) => h.reports.get(UUID) },
  { name: "reports.download", scope: "read", method: "GET", template: "/reports/{id}/pdf", path: `/reports/${UUID}/pdf`, call: (h) => h.reports.download(UUID), response: pdf },
  { name: "reports.snapshot", scope: "read", method: "GET", template: "/reports/{id}/json", path: `/reports/${UUID}/json`, call: (h) => h.reports.snapshot(UUID) },
];
