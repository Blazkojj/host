import express from "express";
import { z } from "zod";
import { query } from "../db.js";
import { adminMiddleware } from "../middleware/admin.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { deleteWorkload, getAdminContainerOverview, getOverviewStats } from "../services/workloadService.js";

const router = express.Router();

const updateUserSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  can_hosting: z.coerce.boolean().optional(),
  hosting_expires_at: z.string().datetime().nullable().optional(),
  max_bots: z.coerce.number().int().min(0).max(1000).optional(),
  max_servers: z.coerce.number().int().min(0).max(1000).optional(),
  max_ram_mb: z.coerce.number().int().min(128).max(1048576).optional(),
  max_cpu: z.coerce.number().min(0).max(256).optional(),
  max_storage_mb: z.coerce.number().int().min(512).max(10485760).optional(),
  blocked: z.coerce.boolean().optional()
});

router.use(authMiddleware, adminMiddleware);

router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const overview = await getOverviewStats();
    res.json({ overview });
  })
);

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const result = await query(
      `
        SELECT
          id,
          email,
          role,
          can_hosting,
          hosting_expires_at,
          max_bots,
          max_servers,
          max_ram_mb,
          max_cpu,
          max_storage_mb,
          blocked,
          created_at,
          updated_at
        FROM users
        ORDER BY created_at ASC
      `
    );

    res.json({ users: result.rows });
  })
);

router.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.parse(req.body);
    const entries = Object.entries(parsed).filter(([, value]) => value !== undefined);

    if (entries.length === 0) {
      throw new ApiError(400, "No fields to update.");
    }

    const values = [];
    const sets = entries.map(([key, value], index) => {
      values.push(value);
      return `${key} = $${index + 1}`;
    });

    values.push(req.params.id);

    const result = await query(
      `
        UPDATE users
        SET ${sets.join(", ")},
            updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING
          id,
          email,
          role,
          can_hosting,
          hosting_expires_at,
          max_bots,
          max_servers,
          max_ram_mb,
          max_cpu,
          max_storage_mb,
          blocked,
          created_at,
          updated_at
      `,
      values
    );

    if (result.rowCount === 0) {
      throw new ApiError(404, "User not found.");
    }

    res.json({ user: result.rows[0] });
  })
);

router.get(
  "/containers",
  asyncHandler(async (_req, res) => {
    const containers = await getAdminContainerOverview();
    res.json({ containers });
  })
);

router.post(
  "/containers/:id/kill",
  asyncHandler(async (req, res) => {
    const result = await query(`SELECT * FROM workloads WHERE id = $1`, [req.params.id]);

    if (result.rowCount === 0) {
      throw new ApiError(404, "Workload not found.");
    }

    await deleteWorkload({
      workloadId: result.rows[0].id,
      user: req.user
    });

    res.json({ success: true });
  })
);

export default router;
