FROM node:20-alpine

WORKDIR /app
COPY server/package.json server/package-lock.json* ./server/
WORKDIR /app/server
RUN npm install --omit=dev

WORKDIR /app
COPY server ./server
COPY game ./game

EXPOSE 8765
ENV PORT=8765
WORKDIR /app/server
CMD ["node", "server.js"]
