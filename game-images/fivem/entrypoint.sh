#!/bin/sh
set -eu

DATA_DIR="/srv/fivem/data"
CACHE_DIR="/srv/fivem/cache"
SERVER_DIR="/srv/fivem/server"
PORT="${GAME_PORT:-30120}"

mkdir -p "$DATA_DIR" "$CACHE_DIR" "$SERVER_DIR" "$DATA_DIR/resources"

if [ -z "${FIVEM_ARTIFACT_URL:-}" ]; then
  echo "FIVEM_ARTIFACT_URL must point to a Linux server artifact." >&2
  exit 1
fi

if [ ! -f "$CACHE_DIR/artifact.tar.xz" ]; then
  curl -fsSL "$FIVEM_ARTIFACT_URL" -o "$CACHE_DIR/artifact.tar.xz"
  rm -rf "$SERVER_DIR"/*
  tar -xJf "$CACHE_DIR/artifact.tar.xz" -C "$SERVER_DIR" --strip-components=1
fi

if [ ! -f "$DATA_DIR/server.cfg" ]; then
  cat > "$DATA_DIR/server.cfg" <<EOF
sv_hostname "FiveM Server"
endpoint_add_tcp "0.0.0.0:${PORT}"
endpoint_add_udp "0.0.0.0:${PORT}"
set sv_enforceGameBuild 2944
sv_maxclients ${MAX_CLIENTS:-48}
EOF
fi

cd "$SERVER_DIR"
exec bash ./run.sh \
  +set endpoint_add_tcp "0.0.0.0:${PORT}" \
  +set endpoint_add_udp "0.0.0.0:${PORT}" \
  +set sv_licenseKey "${FXSERVER_LICENSE_KEY:-}" \
  +exec "$DATA_DIR/server.cfg"
