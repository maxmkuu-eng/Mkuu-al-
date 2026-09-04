FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Final Gemini/Exa runtime build. The source patch is validated before bundling.
ARG MKUU_BUILD_MARKER=gemini-exa-rest-final-2026-09-04-01
RUN echo "[MKUU-BUILD] MARKER=${MKUU_BUILD_MARKER}" \
  && node scripts/enable-puter-image-studio.cjs \
  && npm run build \
  && npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs \
  && node scripts/verify-gemini-build.cjs

ENV NODE_ENV=production
ENV PORT=3000

RUN mkdir -p /app/data/files

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
