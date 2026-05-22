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
/**
 * ROUTE 2: POST /api/inventory/extract/file (FREE Cloud-Hosted CDN OCR)
 * Configured explicitly to bypass Vercel serverless missing-file (.wasm) crashes!
 */
router.post('/extract/file', upload.array('files', 30), async (req: any, res: any, next: any) => {
    try {
      const { sessionId } = req.body;
      const files = req.files as Express.Multer.File[];
  
      if (!files || files.length === 0 || !sessionId) {
        return res.status(400).json({ error: "Missing required fields: files and sessionId are required." });
      }
  
      console.log(`⏳ Processing serverless cloud-linked OCR for ${files.length} images...`);
      let allCombinedSavedItems: any[] = [];
  
      // ✅ Initialize Tesseract Worker with CDN links so Vercel never crashes over missing .wasm files
      const worker = await createWorker('eng', 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5.1.0/dist/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.1.0/tesseract-core-relaxedsimd.wasm.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_best'
      });
  
      for (const file of files) {
        try {
          console.log(`Reading text from file: ${file.originalname}`);
          
          // 1. Extract text using cloud-loaded WebAssembly binaries (Costs $0!)
          const { data: { text } } = await worker.recognize(file.buffer);
          console.log(`📝 Local OCR extracted text raw sample:\n${text}`);
  
          if (!text || !text.trim()) {
            console.warn(`Skipping empty text extraction for ${file.originalname}`);
            continue;
          }
  
          // 2. Pass the extracted text to our standard backend processing loop
          const savedItemsFromSheet = await processAndSaveInventory(text, sessionId);
          allCombinedSavedItems = allCombinedSavedItems.concat(savedItemsFromSheet);
          
        } catch (singleFileError: any) {
          console.error(`❌ Error processing file ${file.originalname}:`, singleFileError.message);
        }
      }
  
      await worker.terminate(); // Free up serverless container memory
  
      res.status(201).json({ 
        success: true, 
        data: allCombinedSavedItems 
      });
    } catch (error) {
      next(error);
    }
  });

export default router;