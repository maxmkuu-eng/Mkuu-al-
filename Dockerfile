FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build application (Vite + esbuild backend)
RUN npm run build

# Production configuration
ENV NODE_ENV=production
ENV PORT=3000

# Create data and file storage directory
RUN mkdir -p /app/data/files

EXPOSE 3000

# Start production server
CMD ["node", "dist/server.cjs"]
