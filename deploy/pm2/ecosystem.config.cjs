// pm2 process for the Hera API. PGlite is single-process, so exactly one fork instance.
module.exports = {
  apps: [
    {
      name: "hera-api",
      cwd: "/opt/hera/current/apps/api",
      script: "dist/main.js",
      // Secrets and settings live outside the release folders, so they survive deploys.
      node_args: "--env-file=/opt/hera/shared/.env",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "700M",
      kill_timeout: 10000,
      time: true,
      env: { NODE_ENV: "production" },
    },
  ],
};
