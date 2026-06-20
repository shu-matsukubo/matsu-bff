FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM deps AS build

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 18082

CMD ["node", "dist/index.js"]

FROM deps AS development

COPY tsconfig.json ./
COPY src ./src

EXPOSE 18082

CMD ["npm", "run", "dev"]
