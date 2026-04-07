import express from "express";
import { pingDatabase } from "../db.js";
import { pingDocker } from "../docker.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    await pingDatabase();
    await pingDocker();

    res.json({
      ok: true,
      services: {
        database: "up",
        docker: "up"
      }
    });
  })
);

export default router;
