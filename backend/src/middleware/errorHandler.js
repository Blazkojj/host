import { ApiError } from "../utils/apiError.js";

export const notFoundHandler = (_req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
};

export const errorHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.details
    });
    return;
  }

  if (error.name === "ZodError") {
    res.status(400).json({
      error: "Validation failed.",
      details: error.flatten()
    });
    return;
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({
      error: "Archive exceeds configured upload limit."
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    error: "Internal server error."
  });
};
