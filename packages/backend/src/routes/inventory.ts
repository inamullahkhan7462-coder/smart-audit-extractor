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
  
    // 2. Call the upgraded Gemini Engine
    console.log("Sending content payload to dynamic Gemini table processor...");
    const dynamicResult = await extractInventoryFromUrdu(rawTextOrBuffer, mimeType);
    console.log("Gemini parsed dynamic table data output:", dynamicResult);
  
    const headers = dynamicResult.headers || [];
    const extractedRows = dynamicResult.rows || []; // ✅ Reading the array of extracted rows
    
    const savedItems = [];
  
    // 3. Process and map each extracted row object
    for (const row of extractedRows) {
      if (Object.keys(row).length === 0) continue;
  
      // Create a clean summary string for storage in originalUrduText
      const aggregatedDataString = Object.entries(row)
        .map(([key, val]) => `${key}: ${val}`)
        .join(" | ");
  
      // Identify primary weight fields for standard quantity metrics
      const primaryWeightKey = headers.find((h: string) => h.includes("NET WEIGHT") || h.includes("WEIGHT") || h.includes("QUANTITY")) || "";
      const calculatedQuantity = Number(row[primaryWeightKey]) || 0;
  
      // Insert record into Supabase while saving the dynamic properties
      const [insertedItem] = await db.insert(inventoryItems).values({
        sessionId: targetSessionId,
        originalUrduText: aggregatedDataString, 
        englishItemName: String(row["PARTY NAME"] || row["VEHICLE NUMBER"] || "FLAT RECORD").toUpperCase(),
        quantity: calculatedQuantity,
        unit: primaryWeightKey.includes("WEIGHT") ? "kg" : "pcs",
        confidenceScore: dynamicResult.confidenceScore ? Number(dynamicResult.confidenceScore) : 0.95,
      }).returning();
  
      // Attach payloads so the frontend grid can map columns on the fly
      savedItems.push({
        ...insertedItem,
        dynamicHeaders: headers,
        dynamicRow: row
      });
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