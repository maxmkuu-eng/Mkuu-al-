FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the application, then enforce one Gemini Personal Chat model only.
ARG MKUU_BUILD_MARKER=gemini-single-3.8-2026-09-03-01
RUN echo "[MKUU-BUILD] MARKER=${MKUU_BUILD_MARKER}" \
  && node scripts/enable-puter-image-studio.cjs \
  && sed -i "s/gemini-2\.5-flash/gemini-3.8-flash/g" server/geminiService.ts \
  && npm run build \
  && node scripts/fix-gemini-runtime-fallback.cjs \
  && npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs \
  && node scripts/verify-gemini-build.cjs

ENV NODE_ENV=production
ENV PORT=3000

RUN mkdir -p /app/data/files

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
