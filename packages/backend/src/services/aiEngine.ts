import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize the modern Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Parses OCR-extracted text from weight slips/vouchers into structured English data objects.
 * Optimized strictly for lightweight text streaming to completely bypass 429 quota blocks!
 */
export async function extractInventoryFromUrdu(textInput: string) {
  
  const baseInstructions = `
    You are an expert bilingual audit and inventory extraction assistant.
    Your task is to analyze the following raw text layout extracted from an inventory weight slip or voucher.
    The source text may contain a mix of standard Urdu script or Roman Urdu.
    
    INSTRUCTIONS:
    1. Parse all relevant attributes (e.g., Serial numbers, Vehicle license plates, Weight metrics, Party names).
    2. For 'englishItemName', create an uppercase summary identifier (e.g., "VEHICLE: LRT 3894 - PARTY: AHMED").
    3. For 'originalUrduText', combine all extracted field attributes into a single clean, readable string line.
    4. Parse 'quantity' as a pure number (Net weight value or bundle count) and match 'unit' to 'kg' or 'pcs'.
  `;

  // Strict JSON schema telling Gemini to return a clean array of objects matching our standard 4 columns
  const responseSchema: Schema = {
    type: Type.ARRAY,
    description: "Array containing the structured inventory line item data points.",
    items: {
      type: Type.OBJECT,
      properties: {
        originalUrduText: { 
          type: Type.STRING,
          description: "Combined details string of the fields found on the slip."
        },
        englishItemName: { 
          type: Type.STRING,
          description: "Main identifier summary translated into clean English capitals."
        },
        quantity: { 
          type: Type.NUMBER,
          description: "The literal numerical count or net weight value."
        },
        unit: { 
          type: Type.STRING,
          description: "The unit of measurement: 'kg' or 'pcs'."
        },
        confidenceScore: { 
          type: Type.NUMBER,
          description: "Your reading assurance level between 0.00 and 1.00."
        }
      },
      required: ["originalUrduText", "englishItemName", "quantity", "unit", "confidenceScore"],
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        baseInstructions, 
        `Analyze this extracted voucher text layout string:\n"${textInput}"`
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature keeps extraction highly accurate
      }
    });

    if (!response.text) {
      throw new Error("AI Engine returned an empty extraction result.");
    }

    // Safely return the parsed structured JSON array back to your routing loop
    return JSON.parse(response.text) as any[];
  } catch (error) {
    console.error("AI Extraction Engine Error:", error);
    throw error;
  }
}