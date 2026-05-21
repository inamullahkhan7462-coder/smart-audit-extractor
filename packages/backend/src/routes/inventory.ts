import { Router } from "express";
import multer from "multer";
import { db } from "../db/index.js"; 
import { inventoryItems, auditSessions } from "../db/schema.js"; 
import { extractInventoryFromUrdu } from "../services/aiEngine.js"; 

const router = Router();

// Configure multer to temporarily hold incoming image/document uploads in memory buffers
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 🛠️ Helper Function: Handles database session management and inserts parsed data into Supabase
 */
async function processAndSaveInventory(rawTextOrBuffer: string | Buffer, mimeType: string | null, sessionId: string) {
  const actualSessions = await db.select().from(auditSessions);
  let targetSessionId = sessionId;

  if (actualSessions.length === 0) {
    const [newTestSession] = await db.insert(auditSessions).values({
      sessionName: "Standard Audit Session",
      targetLocation: "Auditing Hub"
    }).returning();
    targetSessionId = newTestSession.id;
  } else {
    targetSessionId = actualSessions[actualSessions.length - 1].id;
  }

  console.log("Running standard stable Gemini extraction...");
  const result = await extractInventoryFromUrdu(rawTextOrBuffer, mimeType);
  console.log("Gemini parsed output:", result);

  // Insert standard record cleanly into Supabase
  const [insertedItem] = await db.insert(inventoryItems).values({
    sessionId: targetSessionId,
    originalUrduText: result.originalUrduText || "N/A",
    englishItemName: (result.englishItemName || "UNKNOWN RECORD").toUpperCase(),
    quantity: Number(result.quantity) || 0,
    unit: result.unit || "kg",
    confidenceScore: Number(result.confidenceScore) || 0.95,
  }).returning();

  return [insertedItem]; 
}

/**
 * 📝 Endpoint 1: POST /api/inventory/extract
 * Handles raw copy-pasted text inputs from the manual input box
 */
router.post("/extract", async (req, res) => {
  try {
    const { rawText, sessionId } = req.body;
    if (!rawText) {
      return res.status(400).json({ error: "No raw text payload provided." });
    }

    const savedRecords = await processAndSaveInventory(rawText, null, sessionId);
    return res.json(savedRecords);
  } catch (error: any) {
    console.error("Text processing router failure:", error);
    return res.status(500).json({ error: error.message || "Internal extraction error." });
  }
});

/**
 * 📁 Endpoint 2: POST /api/inventory/extract/file
 * Handles image files dropped into the drag-and-drop zone
 */
router.post("/extract/file", upload.array("files"), async (req: any, res: any) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { sessionId } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No document assets received by backend router." });
    }

    const totalSavedResults = [];

    // Loop through files (currently handling 1 document efficiently)
    for (const file of files) {
      try {
        const records = await processAndSaveInventory(file.buffer, file.mimetype, sessionId);
        totalSavedResults.push(...records);
      } catch (fileError) {
        console.error(`Skipping broken image asset ${file.originalname}:`, fileError);
        // Continue processing other files if a single one fails
      }
    }

    return res.json(totalSavedResults);
  } catch (error: any) {
    console.error("File processing batch pipeline failure:", error);
    return res.status(500).json({ error: error.message || "Internal system extraction error." });
  }
});

// 🎯 Export the complete router instance so packages/backend/src/index.ts can use it
export default router;