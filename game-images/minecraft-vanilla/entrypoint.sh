#!/bin/sh
set -eu

DATA_DIR="/srv/minecraft/data"
SERVER_DIR="/srv/minecraft/server"
VERSION="${MINECRAFT_VERSION:-1.20.6}"
MEMORY="${JAVA_MEMORY:-1024M}"

mkdir -p "$DATA_DIR" "$SERVER_DIR"
cd "$DATA_DIR"

printf 'eula=%s\n' "$(printf '%s' "${EULA:-FALSE}" | tr '[:upper:]' '[:lower:]')" > eula.txt

if [ ! -f "$SERVER_DIR/server.jar" ]; then
  MANIFEST="$(curl -fsSL "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")"
  VERSION_URL="$(printf '%s' "$MANIFEST" | jq -r --arg VERSION "$VERSION" '.versions[] | select(.id == $VERSION) | .url' | head -n 1)"

  if [ -z "$VERSION_URL" ] || [ "$VERSION_URL" = "null" ]; then
    echo "Unable to find Minecraft version $VERSION" >&2
    exit 1
  fi

  SERVER_URL="$(curl -fsSL "$VERSION_URL" | jq -r '.downloads.server.url')"
  curl -fsSL "$SERVER_URL" -o "$SERVER_DIR/server.jar"
fi

exec java -Xms"$MEMORY" -Xmx"$MEMORY" -jar "$SERVER_DIR/server.jar" nogui
