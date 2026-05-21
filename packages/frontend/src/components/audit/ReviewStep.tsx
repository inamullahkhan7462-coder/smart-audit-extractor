import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface Props {
  items: any[];
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  onBack: () => void;
}

export function ReviewStep({ items, setItems, onBack }: Props) {
  const headers = ["ORIGINAL TEXT", "ENGLISH ITEM NAME", "QUANTITY", "UNIT"];

  const handleDeleteRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Row removed from export queue.");
  };

  const handleCellEdit = (rowIdx: number, field: string, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === rowIdx ? { ...item, [field]: value } : item))
    );
  };

  const handleExportExcel = () => {
    if (items.length === 0) return;

    const exportData = items.map((item) => ({
      "Original Text Details": item.originalUrduText,
      "English Item Name / Summary": item.englishItemName,
      "Quantity": item.quantity,
      "Unit": item.unit,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Count");
    XLSX.writeFile(workbook, `Audit_Stock_Reset_Extract_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Excel ledger file downloaded successfully!");
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Review & export</h2>
          <p className="text-sm text-muted-foreground mt-1">Double-click any cell to edit details.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" onClick={onBack} className="h-10 px-4">
            <ArrowLeft className="size-4 mr-2" /> Back
          </Button>
          <Button onClick={handleExportExcel} size="sm" className="bg-emerald-600 hover:bg-emerald-500 h-10 px-5 text-white shadow-lg">
            <Download className="size-4 mr-2" /> Download as Excel (.xlsx)
          </Button>
        </div>
      </div>

      <div className="glass-panel-strong rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {headers.map((h) => <th key={h} className="p-4">{h}</th>)}
                <th className="p-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {items.map((item, rowIdx) => (
                <tr key={item.id || rowIdx} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4 min-w-[250px]">
                    <input type="text" value={item.originalUrduText || ""} onChange={(e) => handleCellEdit(rowIdx, "originalUrduText", e.target.value)} className="w-full bg-transparent border-0 rounded px-2 py-1 text-foreground" />
                  </td>
                  <td className="p-4 min-w-[250px]">
                    <input type="text" value={item.englishItemName || ""} onChange={(e) => handleCellEdit(rowIdx, "englishItemName", e.target.value)} className="w-full bg-transparent border-0 rounded px-2 py-1 text-foreground" />
                  </td>
                  <td className="p-4">
                    <input type="text" value={item.quantity || 0} onChange={(e) => handleCellEdit(rowIdx, "quantity", e.target.value)} className="w-full bg-transparent border-0 rounded px-2 py-1 text-foreground" />
                  </td>
                  <td className="p-4">
                    <input type="text" value={item.unit || "kg"} onChange={(e) => handleCellEdit(rowIdx, "unit", e.target.value)} className="w-full bg-transparent border-0 rounded px-2 py-1 text-foreground" />
                  </td>
                  <td className="p-4 text-center">
                    <button type="button" onClick={() => handleDeleteRow(rowIdx)} className="p-2 rounded-lg bg-white/5 text-muted-foreground hover:bg-rose-500/20 hover:text-rose-300 transition-all"><Trash2 className="size-4" /></button>
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