FROM node:24-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund
COPY dist/ ./dist/
COPY server/host.mjs server/room.mjs ./server/
ENV PORT=4173
EXPOSE 4173
CMD ["node", "server/host.mjs"]
