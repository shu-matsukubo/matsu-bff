FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY eslint.config.js .prettierrc.json .prettierignore ./
COPY scripts ./scripts
COPY tests ./tests
COPY src ./src

EXPOSE 18082

CMD ["npm", "run", "dev"]
