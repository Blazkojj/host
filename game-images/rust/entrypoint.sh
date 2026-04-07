#!/bin/bash
set -euo pipefail

INSTALL_DIR="/srv/rust/data"
GAME_PORT="${GAME_PORT:-28015}"
QUERY_PORT="${QUERY_PORT:-28016}"
WORLD_SIZE="${WORLD_SIZE:-3500}"
WORLD_SEED="${WORLD_SEED:-12345}"
MAX_PLAYERS="${MAX_PLAYERS:-100}"
SERVER_HOSTNAME="${SERVER_HOSTNAME:-Rust Server}"
SERVER_IDENTITY="${SERVER_IDENTITY:-default}"

mkdir -p "$INSTALL_DIR"

/home/steam/steamcmd/steamcmd.sh \
  +force_install_dir "$INSTALL_DIR" \
  +login "${STEAM_LOGIN:-anonymous}" "${STEAM_PASSWORD:-}" \
  +app_update 258550 validate \
  +quit

cd "$INSTALL_DIR"
exec ./RustDedicated -batchmode \
  +server.port "$GAME_PORT" \
  +server.queryport "$QUERY_PORT" \
  +server.level "Procedural Map" \
  +server.seed "$WORLD_SEED" \
  +server.worldsize "$WORLD_SIZE" \
  +server.maxplayers "$MAX_PLAYERS" \
  +server.hostname "$SERVER_HOSTNAME" \
  +server.identity "$SERVER_IDENTITY" \
  -logFile /proc/1/fd/1
