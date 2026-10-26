import "dotenv/config";
import cors from "cors";
import express from "express";
import authRouter from "./routes/auth.js";
import goalsRouter from "./routes/goals.js";
import phasesRouter from "./routes/phases.js";
import tasksRouter from "./routes/task.js";
import progressRouter from "./routes/progress.js";
import aiRouter from "./routes/ai.js";
import draftsRouter from "./routes/drafts.js";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "levelup-api", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/phases", phasesRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/progress", progressRouter);
app.use("/api/ai", aiRouter);
app.use("/api/drafts", draftsRouter);

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server" });
});

app.listen(port, () => console.log(`LevelUp API running at http://localhost:${port}`));

