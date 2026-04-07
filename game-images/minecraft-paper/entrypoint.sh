#!/bin/sh
set -eu

DATA_DIR="/srv/minecraft/data"
SERVER_DIR="/srv/minecraft/server"
VERSION="${MINECRAFT_VERSION:-1.20.6}"
BUILD="${PAPER_BUILD:-latest}"
MEMORY="${JAVA_MEMORY:-1024M}"

mkdir -p "$DATA_DIR" "$SERVER_DIR"
cd "$DATA_DIR"

printf 'eula=%s\n' "$(printf '%s' "${EULA:-FALSE}" | tr '[:upper:]' '[:lower:]')" > eula.txt
if [ ! -f "$SERVER_DIR/server.jar" ]; then
  if [ "$BUILD" = "latest" ]; then
    BUILD="$(curl -fsSL "https://api.papermc.io/v2/projects/paper/versions/${VERSION}" | jq -r '.builds[-1]')"
  fi

  curl -fsSL "https://api.papermc.io/v2/projects/paper/versions/${VERSION}/builds/${BUILD}/downloads/paper-${VERSION}-${BUILD}.jar" -o "$SERVER_DIR/server.jar"
fi

exec java -Xms"$MEMORY" -Xmx"$MEMORY" -jar "$SERVER_DIR/server.jar" nogui
