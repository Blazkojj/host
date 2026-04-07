import fs from "fs";
import multer from "multer";
import path from "path";
import { env, runtimePaths } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(runtimePaths.uploads, { recursive: true });
    cb(null, runtimePaths.uploads);
  },
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${suffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (_req, file, cb) => {
  if (path.extname(file.originalname).toLowerCase() !== ".zip") {
    cb(new ApiError(400, "Only ZIP archives are supported."));
    return;
  }

  cb(null, true);
};

export const uploadArchive = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.uploadLimitMb * 1024 * 1024
  }
});
