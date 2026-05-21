export const API_BASE = "https://smart-audit-extractor.vercel.app/api/inventory";

export interface InventoryItem {
  id: string;
  originalUrduText: string;
  englishItemName: string;
  quantity: number;
  unit: string;
  confidenceScore: number;
  // ✅ Add these two properties so TypeScript knows they exist
  dynamicHeaders?: string[];
  dynamicRow?: Record<string, any>;
}

const DEFAULT_SESSION_ID = "11111111-1111-1111-1111-111111111111";

export const auditApi = {
  extractText: async (rawText: string): Promise<InventoryItem[]> => {
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
    // ✅ Unwraps standard Vercel payload envelope securely
    const dataArray = result.data || result;
    return Array.isArray(dataArray) ? dataArray : [dataArray];
  },

  extractFile: async (files: File | File[]): Promise<InventoryItem[]> => {
    const fd = new FormData();
    const fileArray = Array.isArray(files) ? files : [files];

    fileArray.forEach((file) => {
      fd.append("files", file);
    });
    fd.append("sessionId", DEFAULT_SESSION_ID);

    const res = await fetch(`${API_BASE}/extract/file`, { 
      method: "POST", 
      body: fd 
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    
    const result = await res.json();
    // ✅ Unwraps bulk array collections securely
    const dataArray = result.data || result;
    return Array.isArray(dataArray) ? dataArray : [dataArray];
  },
};