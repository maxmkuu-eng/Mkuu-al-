FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
# The lockfile is currently out of sync with package.json, so use npm install
# to resolve the declared dependency graph during the container build.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build
RUN npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/server.cjs

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# The runtime image only needs package.json. Avoid the stale lockfile and
# skip install scripts so nested development-tool binaries cannot break the
# production image.
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY --from=builder /app/dist ./dist

# Create storage directories for files and database
RUN mkdir -p /app/data/files

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
