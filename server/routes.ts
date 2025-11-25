import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // API endpoint to get all channels
  app.get("/api/channels", async (_req, res) => {
    const channels = await storage.getAllChannels();
    res.json(channels);
  });

  // API endpoint to get bot status
  app.get("/api/bot/status", (_req, res) => {
    res.json({ status: "running" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
