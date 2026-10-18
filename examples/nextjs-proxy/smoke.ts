/** Calls the route handler directly (no Next.js server) to show the narrow response shape. Needs HERA_API_KEY and HERA_BASE_URL. */
import { POST } from "./app/api/screen/route";

const call = (body: unknown, cookie = "session=user_1") =>
  POST(new Request("http://localhost/api/screen", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }));

for (const [label, res] of [
  ["no session", await call({ address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" }, "")],
  ["typo (rejected by the SDK locally)", await call({ address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVA" })],
  ["muxed address", await call({ address: "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK" })],
] as const) {
  console.log(`${label}: ${res.status} ${await res.text()}`);
}
