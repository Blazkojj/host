const escapeShell = (value) => value.replace(/(["`\\$])/g, "\\$1");

export const generateBotDockerfile = ({ runtime, startupCommand }) => {
  const escapedCommand = escapeShell(startupCommand);

  if (runtime === "node") {
    return `FROM node:20-bookworm-slim
WORKDIR /srv/app
ENV NODE_ENV=production
COPY . .
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
RUN useradd --create-home --shell /usr/sbin/nologin --uid 10001 appuser && chown -R appuser:appuser /srv/app
USER appuser
CMD ["sh", "-lc", "${escapedCommand}"]
`;
  }

  if (runtime === "python") {
    return `FROM python:3.12-slim
WORKDIR /srv/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY . .
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi
RUN useradd --create-home --shell /usr/sbin/nologin --uid 10001 appuser && chown -R appuser:appuser /srv/app
USER appuser
CMD ["sh", "-lc", "${escapedCommand}"]
`;
  }

  throw new Error(`Unsupported runtime: ${runtime}`);
};
