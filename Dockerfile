FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
RUN npm ci

# Copy shared types first
COPY packages/ packages/

# Copy API source
COPY apps/api/ apps/api/

# Copy web source (separate layer so changes trigger rebuild)
COPY apps/web/ apps/web/

# Copy root configs
COPY nx.json tsconfig.base.json postcss.config.js ./

# Build frontend — always rebuilds when web source changes
RUN cd apps/web && npx vite build --outDir ../../dist/web --emptyOutDir

# Create storage dirs
RUN mkdir -p storage/uploads storage/processed storage/output data

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "--import", "tsx/esm", "apps/api/src/main.ts"]
