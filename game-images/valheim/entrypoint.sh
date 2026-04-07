#!/bin/bash
set -euo pipefail

INSTALL_DIR="/srv/valheim/data"
GAME_PORT="${GAME_PORT:-2456}"
SERVER_NAME="${SERVER_NAME:-Valheim Server}"
WORLD_NAME="${WORLD_NAME:-Dedicated}"
SERVER_PASSWORD="${SERVER_PASSWORD:-change-me}"

mkdir -p "$INSTALL_DIR/worlds"

/home/steam/steamcmd/steamcmd.sh \
  +force_install_dir "$INSTALL_DIR" \
  +login "${STEAM_LOGIN:-anonymous}" "${STEAM_PASSWORD:-}" \
  +app_update 896660 validate \
  +quit

cd "$INSTALL_DIR"
exec ./valheim_server.x86_64 -name "$SERVER_NAME" -port "$GAME_PORT" -world "$WORLD_NAME" -password "$SERVER_PASSWORD" -savedir "$INSTALL_DIR/worlds"
