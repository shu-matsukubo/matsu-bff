FROM node:22-bookworm-slim

WORKDIR /app
COPY src ./src
ENV NODE_ENV=production

EXPOSE 18082
CMD ["node", "src/server.js"]
