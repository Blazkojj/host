import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../db.js";
import { ApiError } from "../utils/apiError.js";

export const authMiddleware = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new ApiError(401, "Authorization token is required.");
    }

    const token = header.replace("Bearer ", "");
    const payload = jwt.verify(token, env.jwtSecret);
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
        WHERE id = $1
      `,
      [payload.sub]
    );

    if (result.rowCount === 0) {
      throw new ApiError(401, "User does not exist.");
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
};
