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
  // Define a powerful array schema so Gemini can generate unlimited structured rows per image!
  const responseSchema: Schema = {
    type: Type.ARRAY,
    description: "List of all structured audit data points, weights, metadata attributes, and line items found on the document.",
    items: {
      type: Type.OBJECT,
      properties: {
        originalUrduText: { 
          type: Type.STRING, 
          description: "The raw handwritten text string or field name exactly as written in Urdu/Roman-Urdu on the paper. Example: 'صافی وزن 1726' or 'گاڑی نمبر LRT 3894' or 'پہلا وزن 1932'." 
        },
        englishItemName: { 
          type: Type.STRING, 
          description: "The field identifier or item name translated into clean English capitals. Examples: 'NET WEIGHT', 'VEHICLE NUMBER', 'GROSS WEIGHT', 'TARE WEIGHT', 'PARTY NAME', 'SERIAL NUMBER'." 
        },
        quantity: { 
          type: Type.NUMBER, 
          description: "The literal numerical count, weight value, or serial index value parsed from the specific field. If the value contains characters (like vehicle license plates '3894'), strip letters and return only the numerical digits." 
        },
        unit: { 
          type: Type.STRING, 
          description: "The unit of measurement. Use 'kg' for weights, 'No.' for serial indexes/vehicle digits, or 'text' if it's a structural name identifier." 
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