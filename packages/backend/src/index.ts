import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { db } from './db/index.js';
import { auditSessions } from './db/schema.js';
import inventoryRouter from './routes/inventory.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Universal Middlewares
app.use(cors());
app.use(express.json());

// API Pipelines
app.use('/api/inventory', inventoryRouter);

// Base Health Probe
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'active', system: 'Smart Audit Extractor Engine' });
});

// Create a New Audit Session (Needed so we have a target ID bucket for our inventory)
app.post('/api/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionName, targetLocation } = req.body;
    
    if (!sessionName) {
      return res.status(400).json({ error: "sessionName is required." });
    }

    const [newSession] = await db.insert(auditSessions).values({
      sessionName,
      targetLocation: targetLocation || "Unassigned Site"
    }).returning();

    res.status(201).json(newSession);
  } catch (error) {
    next(error);
  }
});

// Fetch All Audit Sessions
app.get('/api/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await db.select().from(auditSessions);
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

// Global Fallback Error Interceptor
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🚨 Unhandled Exception:", err.message || err);
  res.status(500).json({
    error: "Internal Server Fault",
    details: err.message || "An unexpected error occurred within the engine pipeline."
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Smart Audit Engine humming smoothly on http://localhost:${PORT}`);
});