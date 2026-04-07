import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { uploadArchive, uploadAsset } from "../middleware/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createBotWorkload,
  createServerWorkload,
  deleteWorkload,
  fetchLogSnapshot,
  listTemplatesForApi,
  listUserWorkloads,
  restartWorkload,
  startWorkload,
  stopWorkload,
  updateWorkloadSettings,
  uploadWorkloadAsset
} from "../services/workloadService.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const workloads = await listUserWorkloads(req.user.id);
    res.json({ workloads });
  })
);

router.get(
  "/templates",
  asyncHandler(async (_req, res) => {
    res.json({ templates: listTemplatesForApi() });
  })
);

router.post(
  "/bots",
  uploadArchive.single("archive"),
  asyncHandler(async (req, res) => {
    const workload = await createBotWorkload({
      user: req.user,
      input: req.body,
      archiveFile: req.file
    });

    res.status(201).json({ workload });
  })
);

router.post(
  "/servers",
  asyncHandler(async (req, res) => {
    const workload = await createServerWorkload({
      user: req.user,
      input: req.body
    });

    res.status(201).json({ workload });
  })
);

router.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const workload = await startWorkload({
      workloadId: req.params.id,
      user: req.user
    });

    res.json({ workload });
  })
);

router.post(
  "/:id/stop",
  asyncHandler(async (req, res) => {
    const workload = await stopWorkload({
      workloadId: req.params.id,
      user: req.user
    });

    res.json({ workload });
  })
);

router.post(
  "/:id/restart",
  asyncHandler(async (req, res) => {
    const workload = await restartWorkload({
      workloadId: req.params.id,
      user: req.user
    });

    res.json({ workload });
  })
);

router.get(
  "/:id/logs",
  asyncHandler(async (req, res) => {
    const logs = await fetchLogSnapshot({
      workloadId: req.params.id,
      user: req.user,
      tail: Number(req.query.tail || 200)
    });

    res.json({ logs });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const workload = await updateWorkloadSettings({
      workloadId: req.params.id,
      user: req.user,
      input: req.body
    });

    res.json({ workload });
  })
);

router.post(
  "/:id/assets",
  uploadAsset.single("asset"),
  asyncHandler(async (req, res) => {
    const result = await uploadWorkloadAsset({
      workloadId: req.params.id,
      user: req.user,
      file: req.file,
      assetType: req.body.assetType
    });

    res.json(result);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await deleteWorkload({
      workloadId: req.params.id,
      user: req.user
    });

    res.json(result);
  })
);

export default router;
