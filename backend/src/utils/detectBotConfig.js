import fs from "fs/promises";
import path from "path";

const ALLOWED_EXTENSIONS = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".py",
  ".json",
  ".env",
  ".example",
  ".toml",
  ".yaml",
  ".yml",
  ".txt"
]);

const MAX_FILE_SIZE = 512 * 1024;
const COMMON_TOKEN_KEYS = ["TOKEN", "DISCORD_TOKEN", "BOT_TOKEN", "CLIENT_TOKEN"];
const PLACEHOLDER_PATTERNS = [/your[_ -]?token/i, /paste[_ -]?token/i, /changeme/i, /example/i, /placeholder/i];

const looksLikeRealValue = (value) => {
  if (!value || value.length < 20) {
    return false;
  }

  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
};

const normalizeKey = (key) => key.replace(/[^A-Z0-9_]/gi, "").toUpperCase();
const toRelative = (rootPath, filePath) => path.relative(rootPath, filePath).replace(/\\/g, "/");

const shouldScanFile = async (filePath) => {
  const extension = path.extname(filePath).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension) && !path.basename(filePath).startsWith(".env")) {
    return false;
  }

  const stat = await fs.stat(filePath);
  return stat.isFile() && stat.size <= MAX_FILE_SIZE;
};

const collectFiles = async (rootPath) => {
  const queue = [rootPath];
  const files = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (["node_modules", ".git", "__pycache__", "dist", "build"].includes(entry.name)) {
          continue;
        }

        queue.push(fullPath);
        continue;
      }

      if (await shouldScanFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
};

const extractEnvKeys = (content, file) => {
  const matches = [];
  const patterns = [
    /process\.env\.([A-Z0-9_]+)/g,
    /process\.env\[['"]([A-Z0-9_]+)['"]\]/g,
    /os\.environ\[['"]([A-Z0-9_]+)['"]\]/g,
    /os\.getenv\(['"]([A-Z0-9_]+)['"]\)/g,
    /environ\.get\(['"]([A-Z0-9_]+)['"]\)/g,
    /getenv\(['"]([A-Z0-9_]+)['"]\)/g
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(content);

    while (match) {
      const key = normalizeKey(match[1]);

      if (key.includes("TOKEN") || key.includes("DISCORD")) {
        matches.push({
          file,
          key,
          sourceType: "env-reference",
          hasValue: false
        });
      }

      match = pattern.exec(content);
    }
  }

  return matches;
};

const extractEnvValues = (content, file) => {
  const values = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = normalizeKey(trimmed.slice(0, index));
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key.includes("TOKEN") || key.includes("DISCORD")) {
      values.push({
        file,
        key,
        value,
        sourceType: "env-file",
        hasValue: looksLikeRealValue(value)
      });
    }
  }

  return values;
};

const extractJsonValues = (content, file) => {
  const values = [];

  try {
    const parsed = JSON.parse(content);
    const visit = (node, parentKey = "") => {
      if (!node || typeof node !== "object") {
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        const normalized = normalizeKey(key || parentKey);

        if (typeof value === "string" && (normalized.includes("TOKEN") || normalized.includes("DISCORD"))) {
          values.push({
            file,
            key: normalized,
            value,
            sourceType: "json",
            hasValue: looksLikeRealValue(value)
          });
        }

        if (typeof value === "object") {
          visit(value, normalized);
        }
      }
    };

    visit(parsed);
  } catch {
  }

  return values;
};

const extractInlineValues = (content, file) => {
  const values = [];
  const patterns = [
    /(?:token|discordToken|botToken)\s*[:=]\s*["'`]([^"'`]{20,})["'`]/gi
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(content);

    while (match) {
      values.push({
        file,
        key: "TOKEN",
        value: match[1].trim(),
        sourceType: "inline",
        hasValue: looksLikeRealValue(match[1].trim())
      });
      match = pattern.exec(content);
    }
  }

  return values;
};

export const detectBotConfig = async (sourcePath) => {
  const files = await collectFiles(sourcePath);
  const keySet = new Set(COMMON_TOKEN_KEYS);
  const sourceHints = [];
  const tokenCandidates = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const relativeFile = toRelative(sourcePath, filePath);

    extractEnvKeys(content, relativeFile).forEach((item) => {
      keySet.add(item.key);
      sourceHints.push(item);
    });

    if (path.basename(filePath).startsWith(".env")) {
      const envValues = extractEnvValues(content, relativeFile);
      tokenCandidates.push(...envValues);
      sourceHints.push(...envValues);
      continue;
    }

    if (path.extname(filePath).toLowerCase() === ".json") {
      const jsonValues = extractJsonValues(content, relativeFile);
      tokenCandidates.push(...jsonValues);
      sourceHints.push(...jsonValues);
    }

    const inlineValues = extractInlineValues(content, relativeFile);
    tokenCandidates.push(...inlineValues);
    sourceHints.push(...inlineValues);
  }

  const realValue = tokenCandidates.find((candidate) => candidate.hasValue && looksLikeRealValue(candidate.value));
  const detectedTokenKeys = [...keySet];
  const detectedTokenSources = sourceHints.filter(
    (item, index, array) =>
      array.findIndex((candidate) => candidate.file === item.file && candidate.key === item.key && candidate.sourceType === item.sourceType) === index
  );
  const primarySource = detectedTokenSources.find((item) => item.hasValue) || detectedTokenSources[0] || null;

  return {
    detectedTokenKeys,
    detectedTokenKey: detectedTokenKeys.find((key) => COMMON_TOKEN_KEYS.includes(key)) || detectedTokenKeys[0] || "TOKEN",
    detectedTokenValue: realValue?.value || null,
    detectedTokenSources,
    detectedTokenSource: primarySource,
    autoDetectedToken: Boolean(realValue?.value)
  };
};
