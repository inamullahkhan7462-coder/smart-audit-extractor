import { Router } from 'express';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import { db } from '../db/index.js';
import { inventoryItems, auditSessions } from '../db/schema.js';
import { extractInventoryFromUrdu } from '../services/aiEngine.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Core Helper to process text strings through Gemini and save to Supabase
 */
async function processAndSaveInventory(rawText: string, sessionId: string) {
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

  console.log("Sending clean text payload to Gemini...");
  const extractedArray = await extractInventoryFromUrdu(rawText);
  console.log("Gemini parsed output:", extractedArray);

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
 * ROUTE 1: POST /api/inventory/extract (Text Processing)
 */
router.post('/extract', async (req: any, res: any, next: any) => {
  try {
    const { rawText, sessionId } = req.body;
    if (!rawText || !sessionId) {
      return res.status(400).json({ error: "Missing required fields: rawText and sessionId are required." });
    }

    const insertedItems = await processAndSaveInventory(rawText, sessionId);
    res.status(201).json({ success: true, data: insertedItems });
  } catch (error) {
    next(error); 
  }
});

/**
 * ROUTE 2: POST /api/inventory/extract/file (FREE Local OCR + High Speed)
 */
router.post('/extract/file', upload.array('files', 30), async (req: any, res: any, next: any) => {
  try {
    const { sessionId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0 || !sessionId) {
      return res.status(400).json({ error: "Missing required fields: files and sessionId are required." });
    }

    console.log(`⏳ Processing local OCR for ${files.length} images...`);
    let allCombinedSavedItems: any[] = [];

    // Initialize Tesseract Worker locally
    const worker = await createWorker('eng'); // Supports English/Roman-Urdu layouts natively

    for (const file of files) {
      try {
        console.log(`Reading text locally from file: ${file.originalname}`);
        
        // 1. Extract text from image buffer LOCALLY (Costs $0!)
        const { data: { text } } = await worker.recognize(file.buffer);
        console.log(`📝 Local OCR extracted text raw sample:\n${text}`);

        if (!text.trim()) {
          console.warn(`Skipping empty text extraction for ${file.originalname}`);
          continue;
        }

        // 2. Pass the extracted text to our standard backend processing loop
        const savedItemsFromSheet = await processAndSaveInventory(text, sessionId);
        allCombinedSavedItems = allCombinedSavedItems.concat(savedItemsFromSheet);
        
      } catch (singleFileError: any) {
        console.error(`❌ Error in local processing for ${file.originalname}:`, singleFileError.message);
      }
    }

    await worker.terminate(); // Clean up worker memory

    res.status(201).json({ 
      success: true, 
      data: allCombinedSavedItems 
    });
  } catch (error) {
    next(error);
  }
});

export default router;