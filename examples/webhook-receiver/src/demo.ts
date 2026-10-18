/** Starts the receiver on a free port, sends the test events, and shuts down. Exit code 1 on any mismatch. */
import type { AddressInfo } from "node:net";
import { WEBHOOK_PATH } from "./config";
import { sendTestEvents } from "./send-test-event";
import { createReceiver } from "./server";

const server = createReceiver((line) => console.log(`  [receiver] ${line}`));
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as AddressInfo;

const ok = await sendTestEvents(`http://127.0.0.1:${port}${WEBHOOK_PATH}`);
await new Promise((resolve) => setTimeout(resolve, 100)); // let async handlers log
server.close();
console.log(ok ? "\nAll deliveries behaved as expected." : "\nSome deliveries did not behave as expected.");
process.exitCode = ok ? 0 : 1;
