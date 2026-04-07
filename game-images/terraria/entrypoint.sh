#!/bin/bash
set -euo pipefail

INSTALL_DIR="/srv/terraria/data"
GAME_PORT="${GAME_PORT:-7777}"
WORLD_FILE="${WORLD_FILE:-world.wld}"
MAX_PLAYERS="${MAX_PLAYERS:-8}"

mkdir -p "$INSTALL_DIR"

/home/steam/steamcmd/steamcmd.sh \
  +force_install_dir "$INSTALL_DIR" \
  +login "${STEAM_LOGIN:-anonymous}" "${STEAM_PASSWORD:-}" \
  +app_update 105600 validate \
  +quit

if [ ! -f "$INSTALL_DIR/serverconfig.txt" ]; then
  cat > "$INSTALL_DIR/serverconfig.txt" <<EOF
world=${INSTALL_DIR}/${WORLD_FILE}
port=${GAME_PORT}
maxplayers=${MAX_PLAYERS}
autocreate=1
worldname=Terraria
difficulty=1
EOF
fi

cd "$INSTALL_DIR"
exec ./TerrariaServer.bin.x86_64 -config "$INSTALL_DIR/serverconfig.txt"
