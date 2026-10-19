# Hera API image. Build context: repository root.
FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
# Only the API and the packages it depends on (core), not web/sdk/examples.
RUN pnpm install --frozen-lockfile --filter @hera/api...
RUN pnpm --filter @hera/api build
# Production node_modules for the API, with @hera/core copied in as a regular package.
RUN pnpm --filter @hera/api deploy --legacy --prod /out

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/apps/api/assets ./assets
# Report PDFs and the mail drop live under /data (a volume).
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:4000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
