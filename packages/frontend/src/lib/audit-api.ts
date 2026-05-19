export const API_BASE = "https://smart-audit-extractor.vercel.app/api/inventory";

export interface InventoryItem {
  id: string;
  originalUrduText: string;
  englishItemName: string;
  quantity: number;
  unit: string;
  confidenceScore: number;
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
    return result.data && Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : [result]);
  },

  extractFile: async (files: File | File[]): Promise<InventoryItem[]> => {
    const fd = new FormData();
    const fileArray = Array.isArray(files) ? files : [files];

    // Append every selected file under the key name 'files'
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
    return result.data && Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : [result]);
  },
};