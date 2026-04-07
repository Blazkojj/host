import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { ApiError } from "./apiError.js";

export const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const setOwnershipRecursive = async (targetPath, uid, gid = uid) => {
  const stat = await fs.lstat(targetPath);
  await fs.chown(targetPath, uid, gid);

  if (!stat.isDirectory()) {
    return;
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    await setOwnershipRecursive(path.join(targetPath, entry.name), uid, gid);
  }
};

const assertSafePath = (rootPath, entryName) => {
  const normalized = path.normalize(entryName);

  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new ApiError(400, "Archive contains unsafe paths.");
  }

  const targetPath = path.join(rootPath, normalized);
  const relative = path.relative(rootPath, targetPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ApiError(400, "Archive contains unsafe paths.");
  }
};

export const extractZipSafely = async (zipPath, destinationPath) => {
  const archive = new AdmZip(zipPath);
  const entries = archive.getEntries();

  if (entries.length === 0) {
    throw new ApiError(400, "Archive is empty.");
  }

  for (const entry of entries) {
    assertSafePath(destinationPath, entry.entryName);
  }

  archive.extractAllTo(destinationPath, true);
};

export const removeIfExists = async (targetPath) => {
  await fs.rm(targetPath, { recursive: true, force: true });
};

export const writeTextFile = async (targetPath, content) => {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, "utf8");
};
