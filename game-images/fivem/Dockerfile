FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl xz-utils ca-certificates libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash --uid 20003 fivem \
  && mkdir -p /srv/fivem/data /srv/fivem/cache /srv/fivem/server \
  && chown -R fivem:fivem /srv/fivem

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER fivem
WORKDIR /srv/fivem

EXPOSE 30120/tcp 30120/udp

ENTRYPOINT ["/entrypoint.sh"]
