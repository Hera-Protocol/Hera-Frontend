import dns from "node:dns";
import net from "node:net";

/**
 * Addresses a webhook must never reach in production: loopback, private
 * ranges, link-local (which includes cloud metadata at 169.254.169.254),
 * CGNAT, multicast and reserved space, for IPv4 and IPv6.
 */
const BLOCKED = new net.BlockList();
for (const [prefix, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(prefix, bits, "ipv4");
}
for (const [prefix, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED.addSubnet(prefix, bits, "ipv6");
}

/** The IPv4 address hidden in an IPv4-mapped (::ffff:a.b.c.d) or NAT64 (64:ff9b::/96) IPv6 address. */
function embeddedIpv4(address: string): string | undefined {
  const lower = address.toLowerCase();
  const dotted = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return dotted[1];
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const high = Number.parseInt(hex[1]!, 16);
    const low = Number.parseInt(hex[2]!, 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return undefined;
}

/** True for any address a production webhook may not be delivered to. Unparseable input counts as blocked. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = net.isIP(bare);
  if (family === 4) return BLOCKED.check(bare, "ipv4");
  if (family === 6) {
    const v4 = embeddedIpv4(bare);
    if (v4) return BLOCKED.check(v4, "ipv4");
    return BLOCKED.check(bare, "ipv6");
  }
  return true;
}

export class BlockedAddressError extends Error {
  constructor(host: string, address: string) {
    super(`Refusing to deliver to ${host} (${address}): private, loopback or link-local address`);
    this.name = "BlockedAddressError";
  }
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/**
 * A `lookup` for http.request that refuses blocked addresses. Validating the
 * address the socket actually connects to (rather than resolving once up
 * front) closes the DNS-rebinding gap.
 */
export function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    const list = addresses as dns.LookupAddress[];
    const blocked = list.find((entry) => isBlockedAddress(entry.address));
    if (blocked || list.length === 0) return callback(new BlockedAddressError(hostname, blocked?.address ?? "no address"), []);
    if (options.all) return callback(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
}

/** Up-front check used when an endpoint is saved, so obvious mistakes fail fast with a 422. */
export async function resolvesToBlockedAddress(url: string): Promise<boolean> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return isBlockedAddress(host);
  try {
    const addresses = await dns.promises.lookup(host, { all: true });
    return addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address));
  } catch {
    // Unresolvable today may resolve tomorrow; delivery re-checks every time.
    return false;
  }
}
