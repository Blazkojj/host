FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl jq ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /srv/minecraft/data /srv/minecraft/server

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /srv/minecraft/data

EXPOSE 25565/tcp

ENTRYPOINT ["/entrypoint.sh"]
