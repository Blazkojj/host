FROM node:20-bookworm-slim
WORKDIR /srv/app
ENV NODE_ENV=production
COPY . .
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
RUN useradd --create-home --shell /usr/sbin/nologin --uid 10001 appuser && chown -R appuser:appuser /srv/app
USER appuser
CMD ["sh", "-lc", "npm start"]
