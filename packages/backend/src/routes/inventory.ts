import { Router } from 'express';
import { db } from '../db/index.js';
import { inventoryItems, auditSessions } from '../db/schema.js';
import { extractInventoryFromUrdu } from '../services/aiEngine.js';

const router = Router();

/**
 * POST /api/inventory/extract
 * Description: Processes raw text using Gemini and saves the outcome to the DB
 */
router.post('/extract', async (req: any, res: any, next: any) => {
  try {
    const { rawText, sessionId } = req.body;

    if (!rawText || !sessionId) {
      return res.status(400).json({ error: "Missing required fields: rawText and sessionId are required." });
    }

    // 1. Verify the parent audit session exists safely
    // 1. Verify the parent audit session exists safely (Bypassed for local testing placeholder)
    const DEFAULT_SESSION_ID = "11111111-1111-1111-1111-111111111111";
    let existingSession = null;

    if (sessionId === DEFAULT_SESSION_ID) {
      // If it's our local testing placeholder, mock an existing session object so it doesn't crash
      existingSession = { id: DEFAULT_SESSION_ID };
    } else {
      const sessionCheck = await db.select().from(auditSessions);
      existingSession = sessionCheck.find(session => session.id === sessionId);
    }
    
    if (!existingSession) {
      return res.status(404).json({ error: "The provided sessionId does not exist." });
    }

    // 2. Pass text through our Gemini Extraction Engine
    const extractedData = await extractInventoryFromUrdu(rawText);

    // 3. Insert the validated AI data straight into our Supabase bucket
    const [insertedItem] = await db.insert(inventoryItems).values({
      sessionId: sessionId,
      originalUrduText: extractedData.originalUrduText,
      englishItemName: extractedData.englishItemName,
      quantity: extractedData.quantity,
      unit: extractedData.unit,
      confidenceScore: extractedData.confidenceScore,
    }).returning();

    // 4. Return the database record back to the user
    res.status(201).json({
      success: true,
      data: insertedItem
    });

  } catch (error) {
    next(error); 
  }
});

export default router;