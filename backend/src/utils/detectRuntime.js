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
  const mainPyPath = path.join(sourcePath, "main.py");
  const appPyPath = path.join(sourcePath, "app.py");

  if (await exists(packageJsonPath)) {
    const parsed = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));

    return {
      runtime: "node",
      startupCommand: parsed.scripts?.start ? "npm start" : (await exists(indexJsPath) ? "node index.js" : "node .")
    };
  }

  if ((await exists(requirementsPath)) || (await exists(pyprojectPath)) || (await exists(mainPyPath)) || (await exists(appPyPath))) {
    return {
      runtime: "python",
      startupCommand: (await exists(mainPyPath)) ? "python main.py" : (await exists(appPyPath) ? "python app.py" : "python -m app")
    };
  }

  throw new ApiError(
    400,
    "Unable to detect supported runtime. Provide a Node.js or Python project with package.json, requirements.txt, pyproject.toml, main.py or app.py."
  );
};
