FROM cm2network/steamcmd:root

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates lib32gcc-s1 libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /srv/valheim/data

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /srv/valheim/data

EXPOSE 2456/udp 2457/udp 2458/udp

ENTRYPOINT ["/entrypoint.sh"]
