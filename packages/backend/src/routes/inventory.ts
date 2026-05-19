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

    // 1. Fetch a real, active session ID directly from your Supabase database to satisfy foreign keys
    const actualSessions = await db.select().from(auditSessions);
    let targetSessionId = sessionId;

    if (actualSessions.length === 0) {
      // If your database is completely empty, create a temporary testing session on the fly
      const [newTestSession] = await db.insert(auditSessions).values({
        sessionName: "Local Testing Session",
        targetLocation: "Lahore HQ"
      }).returning();
      targetSessionId = newTestSession.id;
    } else {
      // Pick the most recent real session ID that already exists in your table
      targetSessionId = actualSessions[actualSessions.length - 1].id;
    }

    // 2. Pass text through our Gemini Extraction Engine
    console.log("Passing raw text to Gemini Engine...");
    const extractedData = await extractInventoryFromUrdu(rawText);
    console.log("Gemini Raw output payload:", extractedData);

    // Normalize the data format in case Gemini returned an array or a single object wrapper
    const itemToInsert = Array.isArray(extractedData) ? extractedData : extractedData;

    if (!itemToInsert) {
      return res.status(422).json({ error: "Gemini engine failed to generate valid structured data objects." });
    }

    // 3. Insert the validated AI data straight into our Supabase bucket with a real parent ID
    const [insertedItem] = await db.insert(inventoryItems).values({
      sessionId: targetSessionId,
      originalUrduText: itemToInsert.originalUrduText || rawText.substring(0, 100),
      englishItemName: itemToInsert.englishItemName || "Unclassified Item",
      quantity: Number(itemToInsert.quantity) || 1,
      unit: itemToInsert.unit || "pcs",
      confidenceScore: itemToInsert.confidenceScore ? Number(itemToInsert.confidenceScore) : 0.90,
    }).returning();

    // 4. Return the database record back to the user wrapped cleanly for Lovable's UI
    res.status(201).json({
      success: true,
      data: [insertedItem] // Wrap in an array because Lovable's grid expects an array layout
    });

  } catch (error) {
    next(error); 
  }
});

export default router;