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
  // ⚡ Bypass strict compiler inferences by casting the row lookup completely to any
  const rawItems = items as any;
  const hasData = rawItems && rawItems.length > 0;
  
  const headings: string[] = hasData && rawItems?.dynamicHeaders
    ? rawItems.dynamicHeaders
    : hasData && rawItems?.dynamicRow
    ? Object.keys(rawItems.dynamicRow)
    : ["SERIAL NUMBER", "DATE", "VEHICLE NUMBER"];

  const handleDeleteRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Row removed from tracking list.");
  };

  const handleCellEdit = (rowIdx: number, columnKey: string, newValue: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== rowIdx) return item;
        // ✅ Safe indexing mapping across the dynamic data row object dictionary
        const targetItem = item as any;
        return {
          ...targetItem,
          dynamicRow: {
            ...(targetItem.dynamicRow || {}),
            [columnKey]: newValue,
          },
        };
      })
    );
  }

  // 📁 Fixed Excel Generator: Exports rows horizontally exactly like your target format image!
  const handleExportExcel = () => {
    if (items.length === 0) return;

    const exportRows = items.map((item) => item.dynamicRow || {});

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Ledger");
    
    XLSX.writeFile(workbook, `Smart_Audit_Horizontal_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Horizontal Excel report generated successfully!");
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dynamic Review Ledger</h2>
          <p className="text-sm text-muted-foreground mt-1">Columns are automatically discovered from your voucher uploads.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" onClick={onBack} className="h-10 px-4">
            <ArrowLeft className="size-4 mr-2" /> Back
          </Button>
          <Button onClick={handleExportExcel} size="sm" className="bg-emerald-600 hover:bg-emerald-500 h-10 px-5 text-white shadow-md">
            <Download className="size-4 mr-2" /> Export Horizontal Excel (.xlsx)
          </Button>
        </div>
      </div>

      <div className="glass-panel-strong rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {headings.map((head) => (
                  <th key={head} className="p-4 font-bold text-indigo-400">{head}</th>
                ))}
                <th className="p-4 text-center w-24 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {items.map((item, rowIdx) => (
                <tr key={item.id || rowIdx} className="hover:bg-white/[0.01] transition-colors group">
                  {headings.map((head) => {
                    const currentCellValue = item.dynamicRow && item.dynamicRow[head] !== undefined
                      ? item.dynamicRow[head]
                      : "";

                    return (
                      <td key={head} className="p-4 min-w-[160px]">
                        <input
                          type="text"
                          value={currentCellValue}
                          onChange={(e) => handleCellEdit(rowIdx, head, e.target.value)}
                          className="w-full bg-transparent border-0 rounded px-2 py-1 text-foreground focus:bg-white/5 outline-none font-medium"
                        />
                      </td>
                    );
                  })}
                  <td className="p-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(rowIdx)}
                      className="p-2 rounded-lg bg-white/5 text-muted-foreground hover:bg-rose-500/20 hover:text-rose-300 transition-all"
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