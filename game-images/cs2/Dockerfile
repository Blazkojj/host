FROM cm2network/steamcmd:root

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates lib32gcc-s1 libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /srv/cs2/data

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /srv/cs2/data

EXPOSE 27015/tcp 27015/udp 27020/udp

ENTRYPOINT ["/entrypoint.sh"]
