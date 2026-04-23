export const config = {
  api: {
    bodyParser: false,
  },
};

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function isValidUpstreamBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function shouldSendNgrokBypassHeader(apiBaseUrl) {
  try {
    return new URL(apiBaseUrl).hostname.includes("ngrok");
  } catch {
    return false;
  }
}

function getUpstreamBaseUrl(req) {
  const headerValue = req.headers["x-hera-upstream-base-url"];
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}

function buildUpstreamUrl(req, upstreamBaseUrl) {
  const incomingUrl = new URL(req.url, `https://${req.headers.host}`);
  const upstreamPath = incomingUrl.pathname.replace(/^\/api\/hera/, "") || "/";

  return new URL(`${upstreamPath}${incomingUrl.search}`, `${normalizeBaseUrl(upstreamBaseUrl)}/`);
}

function buildUpstreamHeaders(req, upstreamBaseUrl) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === "host" ||
      normalizedKey === "connection" ||
      normalizedKey === "content-length" ||
      normalizedKey === "x-hera-upstream-base-url" ||
      normalizedKey === "x-forwarded-for" ||
      normalizedKey === "x-forwarded-host" ||
      normalizedKey === "x-forwarded-port" ||
      normalizedKey === "x-forwarded-proto" ||
      normalizedKey === "x-vercel-id"
    ) {
      continue;
    }

    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  if (
    shouldSendNgrokBypassHeader(upstreamBaseUrl) &&
    !headers.has("ngrok-skip-browser-warning")
  ) {
    headers.set("ngrok-skip-browser-warning", "true");
  }

  return headers;
}

async function readRequestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const upstreamBaseUrl = getUpstreamBaseUrl(req);

  if (!isValidUpstreamBaseUrl(upstreamBaseUrl)) {
    res.status(400).json({
      error: {
        code: "invalid_upstream_base_url",
        message: "Missing or invalid x-hera-upstream-base-url header.",
      },
    });
    return;
  }

  try {
    const upstreamResponse = await fetch(buildUpstreamUrl(req, upstreamBaseUrl), {
      method: req.method,
      headers: buildUpstreamHeaders(req, upstreamBaseUrl),
      body: await readRequestBody(req),
      redirect: "manual",
    });

    res.status(upstreamResponse.status);

    for (const [key, value] of upstreamResponse.headers.entries()) {
      if (!HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    const body = Buffer.from(await upstreamResponse.arrayBuffer());
    res.send(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream request failed unexpectedly.";

    res.status(502).json({
      error: {
        code: "upstream_request_failed",
        message,
      },
    });
  }
}
