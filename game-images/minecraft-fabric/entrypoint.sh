#!/bin/sh
set -eu

DATA_DIR="/srv/minecraft/data"
SERVER_DIR="/srv/minecraft/server"
VERSION="${MINECRAFT_VERSION:-1.20.6}"
LOADER_VERSION="${FABRIC_LOADER_VERSION:-0.15.11}"
MEMORY="${JAVA_MEMORY:-2048M}"

mkdir -p "$DATA_DIR" "$SERVER_DIR" "$DATA_DIR/mods"
cd "$DATA_DIR"

printf 'eula=%s\n' "$(printf '%s' "${EULA:-FALSE}" | tr '[:upper:]' '[:lower:]')" > eula.txt

if [ ! -f "$SERVER_DIR/server.jar" ]; then
  INSTALLER_VERSION="$(curl -fsSL https://meta.fabricmc.net/v2/versions/installer | jq -r '.[0].version')"
  curl -fsSL "https://meta.fabricmc.net/v2/versions/loader/${VERSION}/${LOADER_VERSION}/${INSTALLER_VERSION}/server/jar" -o "$SERVER_DIR/server.jar"
fi

exec java -Xms"$MEMORY" -Xmx"$MEMORY" -jar "$SERVER_DIR/server.jar" nogui
