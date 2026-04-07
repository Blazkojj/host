FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000

CMD ["npx", "pm2-runtime", "ecosystem.config.cjs", "--env", "production"]
