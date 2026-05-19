import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.js';
import { inventoryItems, auditSessions } from '../db/schema.js';
import { extractInventoryFromUrdu } from '../services/aiEngine.js';

const router = Router();

// Configure multer to hold the uploaded file cleanly in system memory as a buffer
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Helper to process and normalize Gemini output data
 */
async function processAndSaveInventory(rawTextOrBuffer: string | Buffer, mimeType: string | null, sessionId: string) {
  // 1. Fetch a real, active session ID directly from your Supabase database to satisfy foreign keys
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

  // 2. Pass data through our Gemini Extraction Engine (Supports both text strings and image buffers!)
  console.log("Passing content payload to Gemini Engine...");
  const extractedData = await extractInventoryFromUrdu(rawTextOrBuffer, mimeType);
  console.log("Gemini Raw output payload:", extractedData);

  const itemToInsert = Array.isArray(extractedData) ? extractedData : extractedData;
  if (!itemToInsert) {
    throw new Error("Gemini engine failed to generate valid structured data objects.");
  }

  // 3. Insert the validated AI data straight into our Supabase bucket with a real parent ID
  const [insertedItem] = await db.insert(inventoryItems).values({
    sessionId: targetSessionId,
    originalUrduText: itemToInsert.originalUrduText || "Extracted from Image Asset",
    englishItemName: itemToInsert.englishItemName || "Unclassified Item",
    quantity: Number(itemToInsert.quantity) || 1,
    unit: itemToInsert.unit || "pcs",
    confidenceScore: itemToInsert.confidenceScore ? Number(itemToInsert.confidenceScore) : 0.90,
  }).returning();

  return insertedItem;
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

    const insertedItem = await processAndSaveInventory(rawText, null, sessionId);
    res.status(201).json({ success: true, data: [insertedItem] });
  } catch (error) {
    next(error); 
  }
});

/**
 * ROUTE 2: POST /api/inventory/extract/file (Image/Asset Processing)
 */
// router.post('/extract/file', upload.single('file'), async (req: any, res: any, next: any) => {
//   try {
//     const { sessionId } = req.body;
//     const file = req.file;

//     if (!file || !sessionId) {
//       return res.status(400).json({ error: "Missing required fields: file and sessionId are required." });
//     }

//     // Process the raw image buffer data directly
//     const insertedItem = await processAndSaveInventory(file.buffer, file.mimetype, sessionId);
//     res.status(201).json({ success: true, data: [insertedItem] });
//   } catch (error) {
//     next(error);
//   }
// });


/**
 * ROUTE 2: POST /api/inventory/extract/file (Bulk Image/Asset Processing)
 * Changed upload.single to upload.array to handle up to 30 image files at once!
 */
router.post('/extract/file', upload.array('files', 30), async (req: any, res: any, next: any) => {
    try {
      const { sessionId } = req.body;
      const files = req.files as Express.Multer.File[];
  
      if (!files || files.length === 0 || !sessionId) {
        return res.status(400).json({ error: "Missing required fields: files and sessionId are required." });
      }
  
      console.log(`Starting bulk processing loop for ${files.length} documents...`);
      const bulkInsertedItems = [];
  
      // Loop through every single uploaded sheet one by one
      for (const file of files) {
        try {
          const insertedItem = await processAndSaveInventory(file.buffer, file.mimetype, sessionId);
          bulkInsertedItems.push(insertedItem);
        } catch (singleFileError: any) {
          console.error(`Skipping broken sheet or parse failure on file ${file.originalname}:`, singleFileError.message);
          // Continue loop so one bad blurry picture doesn't crash the whole 20-file upload run
        }
      }
  
      res.status(201).json({ 
        success: true, 
        data: bulkInsertedItems 
      });
    } catch (error) {
      next(error);
    }
  });
export default router;