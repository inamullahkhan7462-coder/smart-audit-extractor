import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.js';
import { inventoryItems, auditSessions } from '../db/schema.js';
import { extractInventoryFromUrdu } from '../services/aiEngine.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Core Helper to process a single text input or image buffer.
 * Adapts dynamic schema payloads cleanly to your existing DB columns.
 */
async function processAndSaveInventory(rawTextOrBuffer: string | Buffer, mimeType: string | null, sessionId: string) {
  // 1. Resolve a valid session ID to satisfy foreign key constraints
  const actualSessions = await db.select().from(auditSessions);
  let targetSessionId = sessionId;

  if (actualSessions.length === 0) {
    const [newTestSession] = await db.insert(auditSessions).values({
      sessionName: "Dynamic Layout Session",
      targetLocation: "Auditing Hub"
    }).returning();
    targetSessionId = newTestSession.id;
  } else {
    targetSessionId = actualSessions[actualSessions.length - 1].id;
  }

  // 2. Call the upgraded, schema-agnostic Gemini Engine
  console.log("Sending content payload to dynamic Gemini table processor...");
  const dynamicResult = await extractInventoryFromUrdu(rawTextOrBuffer, mimeType);
  console.log("Gemini parsed dynamic table data output:", dynamicResult);

  const headers = dynamicResult.headers || [];
  const singleRow = dynamicResult.rowData || {}; // 👈 Changed from rows to single row object
  
  const savedItems = [];

  // Skip execution if Gemini returned an empty record
  if (Object.keys(singleRow).length > 0) {
    // Create a clean summary string of all row entries to place inside originalUrduText column safely
    const aggregatedDataString = Object.entries(singleRow)
      .map(([key, val]) => `${key}: ${val}`)
      .join(" | ");

    // Identify primary weight markers for your default quantity/unit columns
    const primaryWeightKey = headers.find((h: string) => h.includes("NET WEIGHT") || h.includes("WEIGHT") || h.includes("QUANTITY")) || "";
    const calculatedQuantity = Number(singleRow[primaryWeightKey]) || 0;

    // 3. Insert record into Supabase while saving the raw dynamic data payload
    const [insertedItem] = await db.insert(inventoryItems).values({
      sessionId: targetSessionId,
      originalUrduText: aggregatedDataString, 
      englishItemName: String(singleRow["PARTY NAME"] || singleRow["VEHICLE NUMBER"] || "FLAT RECORD").toUpperCase(),
      quantity: calculatedQuantity,
      unit: primaryWeightKey.includes("WEIGHT") ? "kg" : "pcs",
      confidenceScore: dynamicResult.confidenceScore ? Number(dynamicResult.confidenceScore) : 0.95,
    }).returning();

    // Attach the dynamic payload directly to the item object so your frontend grid can build dynamic headers
    const extendedItem = {
      ...insertedItem,
      dynamicHeaders: headers,
      dynamicRow: singleRow
    };
    savedItems.push(extendedItem);
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

    const insertedItem = await processAndSaveInventory(rawText, null, sessionId);
    res.status(201).json({ success: true, data: [insertedItem] });
  } catch (error) {
    next(error); 
  }
});

/**
 * ROUTE 2: POST /api/inventory/extract/file (Bulk Image Processing)
 */
router.post('/extract/file', upload.array('files', 30), async (req: any, res: any, next: any) => {
  try {
    const { sessionId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0 || !sessionId) {
      return res.status(400).json({ error: "Missing required fields: files and sessionId are required." });
    }

    console.log(`Processing horizontal table batch pipeline for ${files.length} documents...`);
    const allCombinedSavedItems: any[] = [];

    // Loop through every uploaded document sheet
    for (const file of files) {
      try {
        const savedDataPayload = await processAndSaveInventory(file.buffer, file.mimetype, sessionId);
        allCombinedSavedItems.push(savedDataPayload);
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