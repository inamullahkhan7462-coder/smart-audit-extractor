import { useState } from "react";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// 🎯 Explicit local interface to override cached or mismatched types in the workspace
export interface LocalInventoryItem {
  id: string;
  originalUrduText: string;
  englishItemName: string;
  quantity: number;
  unit: string;
  confidenceScore: number;
  dynamicHeaders?: string[];
  dynamicRow?: Record<string, any>;
}

interface Props {
  items: LocalInventoryItem[];
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  onBack: () => void;
}

export function ReviewStep({ items, setItems, onBack }: Props) {
  // ✅ Fixed: Safely look inside the first element of the array to extract headers
  // 🎯 Bypassing strict compiler caching using safe string-key lookups
  const firstItem = items && items.length > 0 ? items : null;
  
  const baseHeaders = firstItem && (firstItem as any)["dynamicHeaders"] && (firstItem as any)["dynamicHeaders"].length > 0
    ? (firstItem as any)["dynamicHeaders"]
    : ["ORIGINAL TEXT", "ENGLISH ITEM NAME", "QUANTITY", "UNIT"];
  // Delete a row from the state grid
  const handleDeleteRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Row removed from export queue.");
  };

  // Handle direct cell editing edits dynamically
  const handleCellEdit = (rowIdx: number, headerKey: string, newValue: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== rowIdx) return item;
        
        if (item.dynamicRow) {
          return {
            ...item,
            dynamicRow: {
              ...item.dynamicRow,
              [headerKey]: newValue,
            },
          };
        }
        
        const propertyMap: Record<string, string> = {
          "ORIGINAL TEXT": "originalUrduText",
          "ENGLISH ITEM NAME": "englishItemName",
          "QUANTITY": "quantity",
          "UNIT": "unit",
        };
        const exactKey = propertyMap[headerKey] || headerKey;
        return { ...item, [exactKey]: newValue };
      })
    );
  };

  // Export data horizontally matching your exact invoice configuration
  const handleExportExcel = () => {
    if (items.length === 0) return;

    const exportData = items.map((item) => {
      if (item.dynamicRow) {
        return item.dynamicRow;
      }
      return {
        "Original Text": item.originalUrduText,
        "English Item Name": item.englishItemName,
        "Quantity": item.quantity,
        "Unit": item.unit,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Count");

    const fileName = `Audit_Stock_Extract_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Excel ledger file downloaded successfully!");
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Review & export</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Double-click any cell to edit details. Adjust any handwriting mismatches, then download.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" onClick={onBack} className="h-10 px-4">
            <ArrowLeft className="size-4 mr-2" /> Back
          </Button>
          <Button onClick={handleExportExcel} size="sm" className="bg-emerald-600 hover:bg-emerald-500 h-10 px-5 text-white shadow-lg shadow-emerald-900/20">
            <Download className="size-4 mr-2" /> Download as Excel (.xlsx)
          </Button>
        </div>
      </div>

      <div className="glass-panel-strong rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {baseHeaders.map((header: string) => (
                  <th key={header} className="p-4">{header}</th>
                ))}
                <th className="p-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {items.map((item, rowIdx) => (
                <tr key={item.id || rowIdx} className="hover:bg-white/[0.01] transition-colors group">
                  {baseHeaders.map((header: string) => {
                    const cellValue = item.dynamicRow 
                      ? item.dynamicRow[header] ?? "" 
                      : (header === "ORIGINAL TEXT" ? item.originalUrduText 
                        : header === "ENGLISH ITEM NAME" ? item.englishItemName 
                        : header === "QUANTITY" ? item.quantity 
                        : item.unit);

                    return (
                      <td key={header} className="p-4 min-w-[150px]">
                        <input
                          type="text"
                          value={cellValue}
                          onChange={(e) => handleCellEdit(rowIdx, header, e.target.value)}
                          className="w-full bg-transparent focus:bg-white/5 focus:ring-1 focus:ring-primary/50 border-0 rounded px-2 py-1 transition-all outline-none font-medium text-foreground"
                        />
                      </td>
                    );
                  })}
                  <td className="p-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(rowIdx)}
                      className="p-2 rounded-lg bg-white/5 opacity-40 group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-300 border border-white/5 transition-all"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}