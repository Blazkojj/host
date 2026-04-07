import fs from "fs/promises";
import path from "path";
import { ApiError } from "./apiError.js";

const exists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const detectRuntime = async (sourcePath) => {
  const packageJsonPath = path.join(sourcePath, "package.json");
  const requirementsPath = path.join(sourcePath, "requirements.txt");
  const pyprojectPath = path.join(sourcePath, "pyproject.toml");
  const indexJsPath = path.join(sourcePath, "index.js");
  const mainJsPath = path.join(sourcePath, "main.js");
  const botJsPath = path.join(sourcePath, "bot.js");
  const srcIndexJsPath = path.join(sourcePath, "src", "index.js");
  const mainPyPath = path.join(sourcePath, "main.py");
  const appPyPath = path.join(sourcePath, "app.py");
  const botPyPath = path.join(sourcePath, "bot.py");
  const toRelative = (targetPath) => path.relative(sourcePath, targetPath).replace(/\\/g, "/");

  if (await exists(packageJsonPath)) {
    const parsed = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    const entryFile = parsed.scripts?.start
      ? "package.json:scripts.start"
      : (await exists(indexJsPath))
        ? toRelative(indexJsPath)
        : (await exists(mainJsPath))
          ? toRelative(mainJsPath)
          : (await exists(botJsPath))
            ? toRelative(botJsPath)
            : (await exists(srcIndexJsPath))
              ? toRelative(srcIndexJsPath)
              : "auto";

    return {
      runtime: "node",
      startupCommand: parsed.scripts?.start
        ? "npm start"
        : (await exists(indexJsPath))
          ? "node index.js"
          : (await exists(mainJsPath))
            ? "node main.js"
            : (await exists(botJsPath))
            ? "node bot.js"
            : (await exists(srcIndexJsPath))
              ? "node src/index.js"
              : "node .",
      entryFile
    };
  }

  if (
    (await exists(requirementsPath)) ||
    (await exists(pyprojectPath)) ||
    (await exists(mainPyPath)) ||
    (await exists(appPyPath)) ||
    (await exists(botPyPath))
  ) {
    const entryFile = (await exists(mainPyPath))
      ? toRelative(mainPyPath)
      : (await exists(botPyPath))
        ? toRelative(botPyPath)
        : (await exists(appPyPath))
          ? toRelative(appPyPath)
          : (await exists(pyprojectPath))
            ? toRelative(pyprojectPath)
            : "auto";

    return {
      runtime: "python",
      startupCommand: (await exists(mainPyPath))
        ? "python main.py"
        : (await exists(botPyPath))
          ? "python bot.py"
          : (await exists(appPyPath))
            ? "python app.py"
            : "python -m app",
      entryFile
    };
  }

  throw new ApiError(
    400,
    "Unable to detect supported runtime. Provide a Node.js or Python project with package.json, requirements.txt, pyproject.toml, main.py or app.py."
  );
};
