import bcrypt from "bcryptjs";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { query } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";

const router = express.Router();

const authSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(100)
});

const buildToken = (user) =>
  jwt.sign(
    {
      role: user.role
    },
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: "7d"
    }
  );

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = authSchema.parse(req.body);
    const email = parsed.email.toLowerCase();
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);

    if (existing.rowCount > 0) {
      throw new ApiError(409, "Account already exists.");
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const result = await query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          role,
          can_hosting,
          hosting_expires_at,
          max_bots,
          max_servers,
          max_ram_mb,
          max_cpu,
          max_storage_mb,
          blocked
        )
        VALUES (
          $1, $2, $3, 'user', true,
          NOW() + INTERVAL '30 days',
          2, 2, 4096, 4, 10240, false
        )
        RETURNING id, email, role, can_hosting, hosting_expires_at, max_bots, max_servers, max_ram_mb, max_cpu, max_storage_mb, blocked
      `,
      [crypto.randomUUID(), email, passwordHash]
    );

    const user = result.rows[0];
    res.status(201).json({
      token: buildToken(user),
      user
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = authSchema.parse(req.body);
    const result = await query(`SELECT * FROM users WHERE email = $1`, [parsed.email.toLowerCase()]);

    if (result.rowCount === 0) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(parsed.password, user.password_hash);

    if (!valid) {
      throw new ApiError(401, "Invalid email or password.");
    }

    if (user.blocked) {
      throw new ApiError(403, "Account is blocked.");
    }

    res.json({
      token: buildToken(user),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        can_hosting: user.can_hosting,
        hosting_expires_at: user.hosting_expires_at,
        max_bots: user.max_bots,
        max_servers: user.max_servers,
        max_ram_mb: user.max_ram_mb,
        max_cpu: user.max_cpu,
        max_storage_mb: user.max_storage_mb,
        blocked: user.blocked
      }
    });
  })
);

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

export default router;
