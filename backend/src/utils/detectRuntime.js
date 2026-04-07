import fs from "fs/promises";
import path from "path";
import { ApiError } from "./apiError.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "__pycache__", "dist", "build", ".next", "__MACOSX"]);

const exists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const toRelative = (basePath, targetPath) => path.relative(basePath, targetPath).replace(/\\/g, "/") || ".";

const detectNodeRuntime = async (projectRoot, archiveRoot) => {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const hasPackageJson = await exists(packageJsonPath);
  const candidates = [
    { file: path.join(projectRoot, "index.js"), command: "node index.js" },
    { file: path.join(projectRoot, "main.js"), command: "node main.js" },
    { file: path.join(projectRoot, "bot.js"), command: "node bot.js" },
    { file: path.join(projectRoot, "app.js"), command: "node app.js" },
    { file: path.join(projectRoot, "index.mjs"), command: "node index.mjs" },
    { file: path.join(projectRoot, "main.mjs"), command: "node main.mjs" },
    { file: path.join(projectRoot, "bot.mjs"), command: "node bot.mjs" },
    { file: path.join(projectRoot, "index.cjs"), command: "node index.cjs" },
    { file: path.join(projectRoot, "main.cjs"), command: "node main.cjs" },
    { file: path.join(projectRoot, "bot.cjs"), command: "node bot.cjs" },
    { file: path.join(projectRoot, "src", "index.js"), command: "node src/index.js" },
    { file: path.join(projectRoot, "src", "main.js"), command: "node src/main.js" },
    { file: path.join(projectRoot, "src", "bot.js"), command: "node src/bot.js" },
    { file: path.join(projectRoot, "src", "app.js"), command: "node src/app.js" }
  ];
  const existingCandidate = [];

  for (const candidate of candidates) {
    if (await exists(candidate.file)) {
      existingCandidate.push(candidate);
    }
  }

  if (!hasPackageJson && existingCandidate.length === 0) {
    return null;
  }

  const parsed = hasPackageJson ? JSON.parse(await fs.readFile(packageJsonPath, "utf8")) : {};

  let startupCommand = "node .";
  let entryFile = "auto";

  if (parsed.scripts?.start) {
    startupCommand = "npm start";
    entryFile = "package.json:scripts.start";
  } else {
    for (const candidate of existingCandidate) {
      startupCommand = candidate.command;
      entryFile = toRelative(projectRoot, candidate.file);
      break;
    }
  }

  return {
    runtime: "node",
    startupCommand,
    entryFile,
    projectRoot,
    projectRootRelative: toRelative(archiveRoot, projectRoot)
  };
};

const detectPythonRuntime = async (projectRoot, archiveRoot) => {
  const requirementsPath = path.join(projectRoot, "requirements.txt");
  const pyprojectPath = path.join(projectRoot, "pyproject.toml");
  const candidates = [
    { file: path.join(projectRoot, "main.py"), command: "python main.py" },
    { file: path.join(projectRoot, "bot.py"), command: "python bot.py" },
    { file: path.join(projectRoot, "app.py"), command: "python app.py" },
    { file: path.join(projectRoot, "src", "main.py"), command: "python src/main.py" },
    { file: path.join(projectRoot, "src", "bot.py"), command: "python src/bot.py" },
    { file: path.join(projectRoot, "src", "app.py"), command: "python src/app.py" }
  ];

  const hasPythonIndicators =
    (await exists(requirementsPath)) ||
    (await exists(pyprojectPath)) ||
    (await Promise.all(candidates.map((candidate) => exists(candidate.file)))).some(Boolean);

  if (!hasPythonIndicators) {
    return null;
  }

  let startupCommand = "python -m app";
  let entryFile = (await exists(pyprojectPath)) ? toRelative(projectRoot, pyprojectPath) : "auto";

  for (const candidate of candidates) {
    if (await exists(candidate.file)) {
      startupCommand = candidate.command;
      entryFile = toRelative(projectRoot, candidate.file);
      break;
    }
  }

  return {
    runtime: "python",
    startupCommand,
    entryFile,
    projectRoot,
    projectRootRelative: toRelative(archiveRoot, projectRoot)
  };
};

const scoreProjectRoot = async (projectRoot) => {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const requirementsPath = path.join(projectRoot, "requirements.txt");
  const pyprojectPath = path.join(projectRoot, "pyproject.toml");

  let score = 0;

  if (await exists(packageJsonPath)) {
    score += 100;
  }

  if (await exists(requirementsPath)) {
    score += 100;
  }

  if (await exists(pyprojectPath)) {
    score += 80;
  }

  const entryFiles = [
    "index.js",
    "main.js",
    "bot.js",
    "app.js",
    "index.mjs",
    "main.mjs",
    "main.py",
    "bot.py",
    "app.py",
    "src/index.js",
    "src/main.js",
    "src/bot.js",
    "src/app.js",
    "src/main.py",
    "src/bot.py",
    "src/app.py"
  ];

  for (const relativePath of entryFiles) {
    if (await exists(path.join(projectRoot, relativePath))) {
      score += 15;
    }
  }

  return score;
};

const findProjectRoots = async (archiveRoot) => {
  const queue = [{ dir: archiveRoot, depth: 0 }];
  const visited = new Set();
  const candidates = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (visited.has(current.dir)) {
      continue;
    }

    visited.add(current.dir);

    const nodeRuntime = await detectNodeRuntime(current.dir, archiveRoot);
    const pythonRuntime = nodeRuntime ? null : await detectPythonRuntime(current.dir, archiveRoot);
    const detected = nodeRuntime || pythonRuntime;

    if (detected) {
      candidates.push({
        ...detected,
        depth: current.depth,
        score: await scoreProjectRoot(current.dir)
      });
    }

    if (current.depth >= 4) {
      continue;
    }

    const entries = await fs.readdir(current.dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      queue.push({
        dir: path.join(current.dir, entry.name),
        depth: current.depth + 1
      });
    }
  }

  return candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.depth - right.depth;
  });
};

export const detectRuntime = async (archiveRoot) => {
  const candidates = await findProjectRoots(archiveRoot);

  if (candidates.length === 0) {
    throw new ApiError(
      400,
      "Unable to detect supported runtime. Upload a Node.js or Python ZIP containing package.json, requirements.txt, pyproject.toml, main.py, app.py or a common bot entry file."
    );
  }

  return candidates[0];
};
