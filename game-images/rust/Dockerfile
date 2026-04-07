FROM cm2network/steamcmd:root

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates lib32gcc-s1 libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /srv/rust/data

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /srv/rust/data

EXPOSE 28015/udp 28016/udp

ENTRYPOINT ["/entrypoint.sh"]
