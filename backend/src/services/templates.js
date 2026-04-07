import path from "path";
import { env } from "../config/env.js";

const templatePath = (name) => path.join(env.templateImagesRoot, name);

export const gameTemplates = {
  "minecraft-paper": {
    id: "minecraft-paper",
    name: "Minecraft Paper",
    description: "Paper server with automatic download, plugin support and persistent world data.",
    imageTag: "host-template-minecraft-paper:v3",
    buildContext: templatePath("minecraft-paper"),
    mountPath: "/srv/minecraft/data",
    defaultEnv: {
      EULA: "TRUE",
      MINECRAFT_FLAVOR: "paper",
      MINECRAFT_VERSION: "1.20.6",
      JAVA_MEMORY: "1024M"
    },
    ports: [{ containerPort: 25565, protocol: "tcp", label: "Game" }],
    capabilities: {
      minecraft: true,
      plugins: true,
      mods: false,
      uploads: ["plugins", "world", "configs"]
    },
    runtimeUid: 20001
  },
  "minecraft-vanilla": {
    id: "minecraft-vanilla",
    name: "Minecraft Vanilla",
    description: "Vanilla Minecraft server with persistent data volume.",
    imageTag: "host-template-minecraft-vanilla:v3",
    buildContext: templatePath("minecraft-vanilla"),
    mountPath: "/srv/minecraft/data",
    defaultEnv: {
      EULA: "TRUE",
      MINECRAFT_FLAVOR: "vanilla",
      MINECRAFT_VERSION: "1.20.6",
      JAVA_MEMORY: "1024M"
    },
    ports: [{ containerPort: 25565, protocol: "tcp", label: "Game" }],
    capabilities: {
      minecraft: true,
      plugins: false,
      mods: false,
      uploads: ["world", "configs"]
    },
    runtimeUid: 20002
  },
  "minecraft-fabric": {
    id: "minecraft-fabric",
    name: "Minecraft Fabric",
    description: "Fabric server with mod support and persistent world data.",
    imageTag: "host-template-minecraft-fabric:v3",
    buildContext: templatePath("minecraft-fabric"),
    mountPath: "/srv/minecraft/data",
    defaultEnv: {
      EULA: "TRUE",
      MINECRAFT_FLAVOR: "fabric",
      MINECRAFT_VERSION: "1.20.6",
      FABRIC_LOADER_VERSION: "0.15.11",
      JAVA_MEMORY: "2048M"
    },
    ports: [{ containerPort: 25565, protocol: "tcp", label: "Game" }],
    capabilities: {
      minecraft: true,
      plugins: false,
      mods: true,
      uploads: ["mods", "world", "configs"]
    },
    runtimeUid: 20004
  },
  fivem: {
    id: "fivem",
    name: "FiveM",
    description: "FiveM Linux artifact runner with persistent server-data volume.",
    imageTag: "host-template-fivem:latest",
    buildContext: templatePath("fivem"),
    mountPath: "/srv/fivem/data",
    defaultEnv: {
      FIVEM_ARTIFACT_URL: "",
      GAME_PORT: "30120",
      FXSERVER_LICENSE_KEY: "",
      MAX_CLIENTS: "48"
    },
    ports: [
      { containerPort: 30120, protocol: "tcp", label: "Game TCP" },
      { containerPort: 30120, protocol: "udp", label: "Game UDP" }
    ],
    capabilities: {
      minecraft: false,
      plugins: false,
      mods: false,
      uploads: []
    },
    runtimeUid: 20003
  },
  cs2: {
    id: "cs2",
    name: "Counter-Strike 2",
    description: "SteamCMD-based Counter-Strike 2 dedicated server.",
    imageTag: "host-template-cs2:latest",
    buildContext: templatePath("cs2"),
    mountPath: "/srv/cs2/data",
    defaultEnv: {
      STEAM_LOGIN: "anonymous",
      STEAM_PASSWORD: "",
      STEAM_GUARD_CODE: "",
      GAME_PORT: "27015",
      TV_PORT: "27020",
      MAX_PLAYERS: "10",
      MAP: "de_dust2",
      STEAM_GAME_TOKEN: ""
    },
    ports: [
      { containerPort: 27015, protocol: "udp", label: "Game UDP" },
      { containerPort: 27015, protocol: "tcp", label: "Game TCP" },
      { containerPort: 27020, protocol: "udp", label: "TV UDP" }
    ],
    capabilities: {
      minecraft: false,
      plugins: false,
      mods: false,
      uploads: []
    }
  },
  rust: {
    id: "rust",
    name: "Rust",
    description: "SteamCMD-based Rust dedicated server with persistent identity data.",
    imageTag: "host-template-rust:latest",
    buildContext: templatePath("rust"),
    mountPath: "/srv/rust/data",
    defaultEnv: {
      STEAM_LOGIN: "anonymous",
      STEAM_PASSWORD: "",
      GAME_PORT: "28015",
      QUERY_PORT: "28016",
      WORLD_SIZE: "3500",
      WORLD_SEED: "12345",
      MAX_PLAYERS: "100",
      SERVER_HOSTNAME: "Rust Server",
      SERVER_IDENTITY: "default"
    },
    ports: [
      { containerPort: 28015, protocol: "udp", label: "Game UDP" },
      { containerPort: 28016, protocol: "udp", label: "Query UDP" }
    ],
    capabilities: {
      minecraft: false,
      plugins: false,
      mods: false,
      uploads: []
    }
  },
  terraria: {
    id: "terraria",
    name: "Terraria",
    description: "Terraria dedicated server backed by SteamCMD installs.",
    imageTag: "host-template-terraria:latest",
    buildContext: templatePath("terraria"),
    mountPath: "/srv/terraria/data",
    defaultEnv: {
      STEAM_LOGIN: "anonymous",
      STEAM_PASSWORD: "",
      GAME_PORT: "7777",
      WORLD_FILE: "world.wld",
      MAX_PLAYERS: "8"
    },
    ports: [{ containerPort: 7777, protocol: "tcp", label: "Game TCP" }],
    capabilities: {
      minecraft: false,
      plugins: false,
      mods: false,
      uploads: []
    }
  },
  valheim: {
    id: "valheim",
    name: "Valheim",
    description: "Valheim dedicated server with persistent world saves.",
    imageTag: "host-template-valheim:latest",
    buildContext: templatePath("valheim"),
    mountPath: "/srv/valheim/data",
    defaultEnv: {
      STEAM_LOGIN: "anonymous",
      STEAM_PASSWORD: "",
      GAME_PORT: "2456",
      QUERY_PORT: "2457",
      SERVER_NAME: "Valheim Server",
      WORLD_NAME: "Dedicated",
      SERVER_PASSWORD: "change-me"
    },
    ports: [
      { containerPort: 2456, protocol: "udp", label: "Game UDP" },
      { containerPort: 2457, protocol: "udp", label: "Query UDP" },
      { containerPort: 2458, protocol: "udp", label: "Beacon UDP" }
    ],
    capabilities: {
      minecraft: false,
      plugins: false,
      mods: false,
      uploads: []
    }
  }
};

export const listTemplates = () => Object.values(gameTemplates);

export const getTemplate = (templateKey) => gameTemplates[templateKey] || null;
