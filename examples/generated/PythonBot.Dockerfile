FROM python:3.12-slim
WORKDIR /srv/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY . .
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi
RUN useradd --create-home --shell /usr/sbin/nologin --uid 10001 appuser && chown -R appuser:appuser /srv/app
USER appuser
CMD ["sh", "-lc", "python main.py"]
