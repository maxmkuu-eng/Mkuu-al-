FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build application (Vite + esbuild backend)
# Normalize the live-search model before compiling so the backend never ships
# with the retired gemini-2.5-flash model.
RUN sed -i "s/gemini-2\.5-flash/gemini-3.6-flash/g" server/geminiService.ts && npm run build

# Production configuration
ENV NODE_ENV=production
ENV PORT=3000

# Create data and file storage directory
RUN mkdir -p /app/data/files

EXPOSE 3000

# Start production server
CMD ["node", "dist/server.cjs"]
