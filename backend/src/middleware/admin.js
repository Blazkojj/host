import { ApiError } from "../utils/apiError.js";

export const adminMiddleware = (req, _res, next) => {
  if (req.user?.role !== "admin") {
    next(new ApiError(403, "Administrator access required."));
    return;
  }

  next();
};
