export const API_BASE = "https://smart-audit-extractor.vercel.app/api/inventory";

export interface InventoryItem {
  id: string;
  originalUrduText: string;
  englishItemName: string;
  quantity: number;
  unit: string;
  confidenceScore: number; // 0-1
}

// A fallback UUID placeholder so the backend database validation doesn't reject the insert
const DEFAULT_SESSION_ID = "11111111-1111-1111-1111-111111111111";

export const auditApi = {
  extractText: async (rawText: string): Promise<InventoryItem[]> => {
    // Targets: https://smart-audit-extractor.vercel.app/api/inventory/extract
    const res = await fetch(`${API_BASE}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        rawText, 
        sessionId: DEFAULT_SESSION_ID 
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    
    const result = await res.json();
    // If your backend nesting wraps the array inside an object like { success: true, data: [...] }
    return result.data && Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : [result]);
  },

  extractFile: async (file: File): Promise<InventoryItem[]> => {
    // Since our backend currently handles the text extraction route, we redirect the user to the text tab
    throw new Error("Backend file upload endpoint is not registered yet. Please use the text input/paste box tab to extract your data!");
  },
};