FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl jq ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /usr/sbin/nologin --uid 20004 minecraft \
  && mkdir -p /srv/minecraft/data /srv/minecraft/server \
  && chown -R minecraft:minecraft /srv/minecraft

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER minecraft
WORKDIR /srv/minecraft/data

EXPOSE 25565/tcp

ENTRYPOINT ["/entrypoint.sh"]
