import { GoogleGenAI, Type, Schema } from '@google/genai';
import { ExtractedInventoryItem } from '@audit-extractor/shared';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize the modern Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Parses mixed Urdu, Roman-Urdu stock text, or image buffers into a structured English data object.
 * @param contentInput The raw text string or an image File Buffer recorded during the physical audit count.
 * @param mimeType The file format string (e.g., 'image/png', 'image/jpeg') if a buffer is provided.
 */
export async function extractInventoryFromUrdu(contentInput: string | Buffer, mimeType: string | null = null) {
  
  // Base core prompt instructions for the extraction engine
  const baseInstructions = `
    You are an expert bilingual audit and inventory extraction assistant.
    Your task is to analyze the following data recorded during a physical inventory count.
    The source material may be written in standard Urdu script (Arabic/Persian characters) or Roman Urdu (Urdu spoken using English letters).
    
    Extract the item name, translate it clearly into English, find the numerical quantity, and identify the unit of measurement.
  `;

  // Establish the content contents block matching the input type
  let contentsPayload: any[] = [];

  if (Buffer.isBuffer(contentInput) && mimeType) {
    // Scenario A: Input is an uploaded image file buffer
    contentsPayload = [
      baseInstructions + `\nAnalyze the attached image asset directly to extract the inventory item details.`,
      {
        inlineData: {
          data: contentInput.toString("base64"),
          mimeType: mimeType
        }
      }
    ];
  } else {
    // Scenario B: Input is a standard raw text string snippet
    contentsPayload = [
      baseInstructions + `\nInput text string to analyze: "${contentInput}"`
    ];
  }

  // Define a strict JSON schema so Gemini outputs exactly what our shared TypeScript engine expects
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      originalUrduText: { 
        type: Type.STRING, 
        description: "The raw input string exactly as provided, or a concise text summary transcribing the specific line scanned from the source image." 
      },
      englishItemName: { 
        type: Type.STRING, 
        description: "The title of the inventory item translated cleanly into English capital casing. Example: 'WHEAT BAG' or 'SOAP BOX'." 
      },
      quantity: { 
        type: Type.NUMBER, 
        description: "The exact numerical count or amount parsed from the content source." 
      },
      unit: { 
        type: Type.STRING, 
        description: "The physical unit of measurement translated to English. Examples: 'bags', 'kg', 'boxes', 'units', 'liters'." 
      },
      confidenceScore: { 
        type: Type.NUMBER, 
        description: "Your confidence level in this extraction between 0.00 (completely uncertain) and 1.00 (absolutely certain)." 
      }
    },
    required: ["originalUrduText", "englishItemName", "quantity", "unit", "confidenceScore"],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentsPayload,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature keeps extraction highly accurate and deterministic
      }
    });

    if (!response.text) {
      throw new Error("AI Engine returned an empty extraction result.");
    }

    // Return the safely parsed structured JSON object matching ExtractedInventoryItem
    return JSON.parse(response.text) as ExtractedInventoryItem;
  } catch (error) {
    console.error("AI Extraction Engine Error:", error);
    throw error;
  }
}