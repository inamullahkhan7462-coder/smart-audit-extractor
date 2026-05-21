import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractInventoryFromUrdu(contentInput: string | Buffer, mimeType: string | null = null) {
  
  const baseInstructions = `
    You are an expert financial auditor and advanced document data modeling assistant.
    Your objective is to analyze the provided weight slip / invoice voucher and flatten it into a horizontal database row.
    
    CRITICAL EXTRACTION GUIDELINES:
    1. Scan the entire document for text pairs where a field label matches a value (e.g., 'صافی وزن' next to '1726', or 'SERIAL NUMBER' next to '138').
    2. Dynamically generate an array of clean, English column headers that capture all discovered attributes.
    3. Translate all Urdu or Roman-Urdu keys cleanly into English Capital Casing (e.g., 'صافی وزن' -> 'NET WEIGHT', 'گاڑی نمبر' -> 'VEHICLE NUMBER', 'پہلا وزن' -> 'GROSS WEIGHT', 'دوسرا وزن' -> 'TARE WEIGHT').
    4. For EVERY document/image provided, you MUST construct an object inside the 'rows' array. The keys of this object must perfectly match your generated English headers.
    5. Ensure values are mapped correctly: Keep full registration text for strings (e.g., 'LRT 3894'), but extract pure numbers for weights or digits (e.g., 1726, 138). Do not return empty objects.
  `;

  let contentsPayload: any[] = [];

  if (Buffer.isBuffer(contentInput) && mimeType) {
    contentsPayload = [
      baseInstructions + `\nExtract the data from this document image and format it into the requested horizontal rows structure.`,
      {
        inlineData: {
          data: contentInput.toString("base64"),
          mimeType: mimeType
        }
      }
    ];
  } else {
    contentsPayload = [
      baseInstructions + `\nExtract the data from this raw text string:\n"${contentInput}"`
    ];
  }

  // 🎯 Updated Schema: Explicitly tracking an array of flat rows
  const responseSchema: any = {
    type: Type.OBJECT,
    properties: {
      headers: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "The list of dynamically discovered English column headers. Example: ['SERIAL NUMBER', 'DATE', 'PARTY NAME', 'VEHICLE NUMBER', 'NET WEIGHT']"
      },
      rows: {
        type: Type.ARRAY,
        description: "An array containing one data object per processed invoice/image page.",
        items: {
          type: Type.OBJECT,
          description: "Data object where keys perfectly match the items in the headers array.",
        }
      },
      confidenceScore: {
        type: Type.NUMBER,
        description: "Overall extraction reliability score from 0.00 to 1.00."
      }
    },
    required: ["headers", "rows", "confidenceScore"],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentsPayload,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.15,
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