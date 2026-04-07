FROM cm2network/steamcmd:root

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates lib32gcc-s1 libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /srv/terraria/data

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /srv/terraria/data

EXPOSE 7777/tcp

ENTRYPOINT ["/entrypoint.sh"]
