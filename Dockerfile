FROM node:20-slim

# Install poppler-utils for PDF rendering, build tools for native modules
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libpoppler-glib-dev \
    build-essential \
    python3 \
    pkg-config \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
RUN npm ci

COPY . .

# Build frontend
RUN cd apps/web && npx vite build --outDir ../../dist/web --emptyOutDir

# Create storage dirs
RUN mkdir -p storage/uploads storage/processed storage/output data

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "--import", "tsx/esm", "apps/api/src/main.ts"]
