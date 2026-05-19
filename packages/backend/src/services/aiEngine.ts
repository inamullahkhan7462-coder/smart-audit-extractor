import { GoogleGenAI, Type, Schema } from '@google/genai';
import { ExtractedInventoryItem } from '@audit-extractor/shared';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize the modern Google Gen AI SDK
// Make sure you add GEMINI_API_KEY to your packages/backend/.env later!
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Parses mixed Urdu or Roman-Urdu stock text into a structured English data object.
 * @param rawUrduInput The raw text recorded during the physical audit count.
 */
export async function extractInventoryFromUrdu(rawUrduInput: string): Promise<ExtractedInventoryItem> {
  const prompt = `
    You are an expert bilingual audit and inventory extraction assistant.
    Your task is to analyze the following raw text recorded during a physical inventory count.
    The text may be written in standard Urdu script (Arabic/Persian characters) or Roman Urdu (Urdu spoken using English letters).
    
    Extract the item name, translate it clearly into English, find the numerical quantity, and identify the unit of measurement.
    
    Input text to analyze: "${rawUrduInput}"
  `;

  // Define a strict JSON schema so Gemini outputs exactly what our shared TypeScript engine expects
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      originalUrduText: { 
        type: Type.STRING, 
        description: "The raw input string exactly as provided by the user." 
      },
      englishItemName: { 
        type: Type.STRING, 
        description: "The title of the inventory item translated cleanly into English capital casing. Example: 'WHEAT BAG' or 'SOAP BOX'." 
      },
      quantity: { 
        type: Type.NUMBER, 
        description: "The exact numerical count or amount parsed from the text." 
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
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature keeps the extraction highly accurate and deterministic
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