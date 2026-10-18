try {
  process.loadEnvFile();
} catch {
  // no .env
}

export const LOCAL_SECRET = "whsec_local_example_secret_change_me";
export const PORT = Number(process.env.PORT ?? 4242);
export const WEBHOOK_SECRET = process.env.HERA_WEBHOOK_SECRET?.trim() || LOCAL_SECRET;
export const WEBHOOK_PATH = "/webhooks/hera";
