const DEFAULT_BETA_USERNAME = "Username";
const DEFAULT_BETA_PASSWORD = "Hera123";
const DEFAULT_UPSTREAM_API_BASE_URL = "https://6573-102-216-202-19.ngrok-free.app";
const DEFAULT_UPSTREAM_API_KEY = "hera-demo-api-key";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function missingEnv() {
  return (
    !process.env.HERA_BETA_USERNAME ||
    !process.env.HERA_BETA_PASSWORD ||
    !process.env.HERA_UPSTREAM_API_BASE_URL ||
    !process.env.HERA_UPSTREAM_API_KEY
  );
}

function configuredUsername() {
  return process.env.HERA_BETA_USERNAME || DEFAULT_BETA_USERNAME;
}

function configuredPassword() {
  return process.env.HERA_BETA_PASSWORD || DEFAULT_BETA_PASSWORD;
}

function configuredApiBaseUrl() {
  return process.env.HERA_UPSTREAM_API_BASE_URL || DEFAULT_UPSTREAM_API_BASE_URL;
}

function configuredApiKey() {
  return process.env.HERA_UPSTREAM_API_KEY || DEFAULT_UPSTREAM_API_KEY;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({
      error: {
        code: "method_not_allowed",
        message: "Only POST is supported.",
      },
    });
    return;
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch {
    res.status(400).json({
      error: {
        code: "invalid_json",
        message: "Request body must be valid JSON.",
      },
    });
    return;
  }

  const username = typeof payload?.username === "string" ? payload.username.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!username || !password) {
    res.status(400).json({
      error: {
        code: "missing_credentials",
        message: "Username and password are required.",
      },
    });
    return;
  }

  if (
    username !== configuredUsername() ||
    password !== configuredPassword()
  ) {
    res.status(401).json({
      error: {
        code: "invalid_credentials",
        message: "Incorrect username or password.",
      },
    });
    return;
  }

  res.status(200).json({
    username,
    apiBaseUrl: configuredApiBaseUrl(),
    apiKey: configuredApiKey(),
    isDefaultDemo: missingEnv(),
  });
}
