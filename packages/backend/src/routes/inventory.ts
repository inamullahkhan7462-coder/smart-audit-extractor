import { Router } from 'express';
import { db } from '../db/index.js';
import { inventoryItems, auditSessions } from '../db/schema.js';
import { extractInventoryFromUrdu } from '../services/aiEngine.js';

const router = Router();

/**
 * Stable Database Insert Loop Processing Helper
 */
async function processAndSaveInventory(rawText: string, sessionId: string) {
  const actualSessions = await db.select().from(auditSessions);
  let targetSessionId = sessionId;

  if (actualSessions.length === 0) {
    const [newTestSession] = await db.insert(auditSessions).values({
      sessionName: "Standard Audit Session",
      targetLocation: "Lahore HQ"
    }).returning();
    targetSessionId = newTestSession.id;
  } else {
    targetSessionId = actualSessions[actualSessions.length - 1].id;
  }

  console.log("Sending clean text payload straight to Gemini...");
  const extractedArray = await extractInventoryFromUrdu(rawText);
  console.log("Gemini parsed output list payload:", extractedArray);

  const itemsList = Array.isArray(extractedArray) ? extractedArray : [extractedArray];
  const savedItems = [];

  for (const item of itemsList) {
    if (!item || (!item.englishItemName && !item.originalUrduText)) continue;

    const [insertedItem] = await db.insert(inventoryItems).values({
      sessionId: targetSessionId,
      originalUrduText: item.originalUrduText || rawText.substring(0, 100),
      englishItemName: item.englishItemName || "UNCLASSIFIED ITEM",
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "pcs",
      confidenceScore: item.confidenceScore ? Number(item.confidenceScore) : 0.90,
    }).returning();

    savedItems.push(insertedItem);
  }

  return savedItems;
}

/**
 * 📝 POST /api/inventory/extract
 * Now accepts text extracted from the client-side browser OCR or manual inputs!
 */
router.post('/extract', async (req: any, res: any, next: any) => {
  try {
    const { rawText, sessionId } = req.body;
    if (!rawText || !sessionId) {
      return res.status(400).json({ error: "Missing required parameters: rawText and sessionId." });
    }

    const insertedItems = await processAndSaveInventory(rawText, sessionId);
    return res.status(201).json({ success: true, data: insertedItems });
  } catch (error) {
    next(error); 
  }
});

export default router;