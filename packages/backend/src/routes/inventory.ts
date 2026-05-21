import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.js';
import { inventoryItems, auditSessions } from '../db/schema.js';
import { extractInventoryFromUrdu } from '../services/aiEngine.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Core Helper to process a single text input or image buffer
 * Supports multiple items extracted from a single source!
 */
async function processAndSaveInventory(rawTextOrBuffer: string | Buffer, mimeType: string | null, sessionId: string) {
  // 1. Resolve a valid session ID to satisfy foreign key constraints
  const actualSessions = await db.select().from(auditSessions);
  let targetSessionId = sessionId;

  if (actualSessions.length === 0) {
    const [newTestSession] = await db.insert(auditSessions).values({
      sessionName: "Local Testing Session",
      targetLocation: "Lahore HQ"
    }).returning();
    targetSessionId = newTestSession.id;
  } else {
    targetSessionId = actualSessions[actualSessions.length - 1].id;
  }

  // 2. Call the upgraded Gemini Engine (Returns an array of extracted items now!)
  console.log("Sending content payload to Gemini...");
  const extractedArray = await extractInventoryFromUrdu(rawTextOrBuffer, mimeType);
  console.log("Gemini parsed array output:", extractedArray);

  // Normalize to ensure we are dealing with an array loop
  const itemsList = Array.isArray(extractedArray) ? extractedArray : [extractedArray];
  const savedItems = [];

  // 3. Loop through every single parsed item row found by Gemini and write it to Supabase
  for (const item of itemsList) {
    if (!item || (!item.englishItemName && !item.originalUrduText)) continue;

    const [insertedItem] = await db.insert(inventoryItems).values({
      sessionId: targetSessionId,
      originalUrduText: item.originalUrduText || (mimeType ? "Extracted from Image" : String(rawTextOrBuffer).substring(0, 100)),
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
 * ROUTE 1: POST /api/inventory/extract (Text Processing)
 */
router.post('/extract', async (req: any, res: any, next: any) => {
  try {
    const { rawText, sessionId } = req.body;
    if (!rawText || !sessionId) {
      return res.status(400).json({ error: "Missing required fields: rawText and sessionId are required." });
    }

    const insertedItems = await processAndSaveInventory(rawText, null, sessionId);
    res.status(201).json({ success: true, data: insertedItems });
  } catch (error) {
    next(error); 
  }
});

/**
 * ROUTE 2: POST /api/inventory/extract/file (Bulk Image Processing)
 * Accepts a field named 'files' with up to 30 uploads simultaneously!
 */
router.post('/extract/file', upload.array('files', 30), async (req: any, res: any, next: any) => {
  try {
    const { sessionId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0 || !sessionId) {
      return res.status(400).json({ error: "Missing required fields: files and sessionId are required." });
    }

    console.log(`Processing bulk pipeline for ${files.length} images...`);
    let allCombinedSavedItems: any[] = [];

    // Loop through every uploaded document sheet
    for (const file of files) {
      try {
        const savedItemsFromSheet = await processAndSaveInventory(file.buffer, file.mimetype, sessionId);
        allCombinedSavedItems = allCombinedSavedItems.concat(savedItemsFromSheet);
      } catch (singleFileError: any) {
        console.error(`Skipping broken/blurry image ${file.originalname}:`, singleFileError.message);
      }
    }

    res.status(201).json({ 
      success: true, 
      data: allCombinedSavedItems 
    });
  } catch (error) {
    next(error);
  }
});

export default router;