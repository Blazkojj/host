#!/bin/bash
set -euo pipefail

INSTALL_DIR="/srv/cs2/data"
GAME_PORT="${GAME_PORT:-27015}"
TV_PORT="${TV_PORT:-27020}"
MAP="${MAP:-de_dust2}"
MAX_PLAYERS="${MAX_PLAYERS:-10}"

mkdir -p "$INSTALL_DIR"

/home/steam/steamcmd/steamcmd.sh \
  +force_install_dir "$INSTALL_DIR" \
  +login "${STEAM_LOGIN:-anonymous}" "${STEAM_PASSWORD:-}" "${STEAM_GUARD_CODE:-}" \
  +app_update 730 validate \
  +quit

cd "$INSTALL_DIR"
exec ./game/bin/linuxsteamrt64/cs2 -dedicated +map "$MAP" +port "$GAME_PORT" +tv_port "$TV_PORT" +sv_setsteamaccount "${STEAM_GAME_TOKEN:-}" -maxplayers "$MAX_PLAYERS"
