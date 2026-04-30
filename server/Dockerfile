FROM node:20-alpine

WORKDIR /app

# Install root deps (ws is declared at the root level now)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy the rest of the code
COPY server ./server
COPY game ./game

EXPOSE 8765
ENV PORT=8765 HOST=0.0.0.0

CMD ["node", "server/server.js"]
