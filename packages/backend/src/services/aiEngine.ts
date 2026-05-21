import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Dynamically extracts document data into a flattened horizontal matrix layout.
 * Supports any invoice, weight slip, or ledger template dynamically.
 */
export async function extractInventoryFromUrdu(contentInput: string | Buffer, mimeType: string | null = null) {
  
  const baseInstructions = `
    You are an expert bilingual financial auditor and advanced document data-modeling engine.
    Your objective is to analyze the provided inventory/weight slip document and structure it horizontally.
    
    EXTRACTION RULES:
    1. Scan the document completely and identify all core informational fields (e.g., Serial Number, Date, Vehicle Number, Weights, Party Name).
    2. Dynamically determine clean, English column headers for all discovered attributes. 
    3. Translate all Urdu/Roman-Urdu keys cleanly into English Capital Casing (e.g., 'صافی وزن' becomes 'NET WEIGHT', 'گاڑی نمبر' becomes 'VEHICLE NUMBER', 'پہلا وزن' becomes 'GROSS WEIGHT').
    4. Provide the parsed values mapped perfectly inside a single rowData object matching your generated headers. 
    5. Clean up the values: Keep full registration text for strings, but extract pure numbers for weights or digits where possible.
  `;

  let contentsPayload: any[] = [];

  if (Buffer.isBuffer(contentInput) && mimeType) {
    contentsPayload = [
      baseInstructions + `\nAnalyze the attached document image, determine its horizontal structural columns, and extract the text.`,
      {
        inlineData: {
          data: contentInput.toString("base64"),
          mimeType: mimeType
        }
      }
    ];
  } else {
    contentsPayload = [
      baseInstructions + `\nAnalyze this raw log text input, determine the structural columns, and extract the row data:\n"${contentInput}"`
    ];
  }

  // 🎯 The Magic Schema: Universal Flat Table Data Capture Structure
  const responseSchema: any = {
    type: Type.OBJECT,
    properties: {
      headers: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "The list of dynamically discovered English column headers for this document layout. Example: ['SERIAL NUMBER', 'DATE', 'PARTY NAME', 'VEHICLE NUMBER', 'NET WEIGHT']"
      },
      rowData: {
        type: Type.OBJECT,
        description: "A single horizontal record row where keys match the items in the headers array. Example: {'SERIAL NUMBER': 138, 'VEHICLE NUMBER': 'LRT 3894', 'NET WEIGHT': 1726}",
      },
      confidenceScore: {
        type: Type.NUMBER,
        description: "Overall extraction reliability score from 0.00 to 1.00."
      }
    },
    required: ["headers", "rowData", "confidenceScore"],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentsPayload,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1, // Keeps mapping deterministic and highly accurate
      }
    });

    if (!response.text) {
      throw new Error("AI Engine returned an empty extraction block.");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Dynamic Table Extraction Engine Error:", error);
    throw error;
  }
}