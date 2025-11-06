import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import conversationsRouter from "./routes/conversations";
import messagesRouter from "./routes/messages";

const app = express();

// Reason: CORS middleware allows frontend to make requests from different origins
app.use(cors());

// Reason: JSON middleware parses request bodies
app.use(express.json());

// Reason: Structured HTTP logging with request/response details
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/healthz",
    },
  })
);

// Health check endpoint
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/conversations", conversationsRouter);
app.use("/api/conversations", messagesRouter);

// Reason: Global error handler catches unhandled errors and returns consistent format
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ error: err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

export default app;

