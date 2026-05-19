import { useState } from "react";
import { ArrowLeft, Download, Trash2, Pencil } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import type { InventoryItem } from "@/lib/audit-api";

interface Props {
  items: InventoryItem[];
  setItems: (next: InventoryItem[]) => void;
  onBack: () => void;
}

type CellKey = keyof Pick<InventoryItem, "originalUrduText" | "englishItemName" | "quantity" | "unit" | "confidenceScore">;

const COLS: { key: CellKey; label: string; align?: "right"; type: "text" | "number" }[] = [
  { key: "originalUrduText", label: "Original Text", type: "text" },
  { key: "englishItemName", label: "English Item Name", type: "text" },
  { key: "quantity", label: "Quantity", align: "right", type: "number" },
  { key: "unit", label: "Unit", type: "text" },
  { key: "confidenceScore", label: "Confidence", align: "right", type: "number" },
];

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone =
    score >= 0.85 ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
    : score >= 0.6 ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
    : "bg-rose-500/15 text-rose-300 border-rose-400/30";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      <span className="size-1.5 rounded-full bg-current" /> {pct}%
    </span>
  );
}

export function ReviewStep({ items, setItems, onBack }: Props) {
  const [editing, setEditing] = useState<{ row: number; col: CellKey } | null>(null);

  const updateCell = (row: number, col: CellKey, raw: string) => {
    const next = items.slice();
    const item = { ...next[row] };
    if (col === "quantity") item.quantity = Number(raw) || 0;
    else if (col === "confidenceScore") {
      const n = Number(raw);
      item.confidenceScore = isNaN(n) ? 0 : Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
    } else (item as any)[col] = raw;
    next[row] = item;
    setItems(next);
  };

  const removeRow = (row: number) => setItems(items.filter((_, i) => i !== row));

  const exportXlsx = () => {
    const rows = items.map((it) => ({
      "Original Text": it.originalUrduText,
      "English Item Name": it.englishItemName,
      "Quantity": it.quantity,
      "Unit": it.unit,
      "Confidence Score": `${Math.round(it.confidenceScore * 100)}%`,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 32 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> Step 2 & 3
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">Review & export</h2>
          <p className="text-sm text-muted-foreground">Double-click any cell to edit. Remove bad rows, then download.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button
            onClick={exportXlsx}
            disabled={items.length === 0}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 border-0 h-11 px-5 shadow-lg shadow-emerald-500/20">
            <Download className="size-4" /> Download as Excel (.xlsx)
          </Button>
        </div>
      </div>

      <div className="glass-panel-strong rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1.5"><Pencil className="size-3" /> Double-click a cell to edit</span>
          <span className="text-muted-foreground">{items.length} {items.length === 1 ? "row" : "rows"}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-white/5">
                {COLS.map((c) => (
                  <th key={c.key} className={`px-5 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
                ))}
                <th className="px-5 py-3 font-medium text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-sm text-muted-foreground">
                  No rows. Go back and run extraction.
                </td></tr>
              )}
              {items.map((it, row) => (
                <tr key={it.id ?? row} className="border-t border-white/5 hover:bg-white/[0.03] group">
                  {COLS.map((c) => {
                    const isEditing = editing?.row === row && editing.col === c.key;
                    const raw = c.key === "confidenceScore" ? Math.round(it.confidenceScore * 100) : (it as any)[c.key];
                    return (
                      <td
                        key={c.key}
                        onDoubleClick={() => setEditing({ row, col: c.key })}
                        className={`px-5 py-3 ${c.align === "right" ? "text-right" : ""} align-middle`}>
                        {isEditing ? (
                          <input
                            autoFocus
                            type={c.type === "number" ? "number" : "text"}
                            defaultValue={raw}
                            onBlur={(e) => { updateCell(row, c.key, e.target.value); setEditing(null); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { updateCell(row, c.key, (e.target as HTMLInputElement).value); setEditing(null); }
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className={`w-full bg-black/40 border border-primary/50 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40 ${c.align === "right" ? "text-right" : ""}`}
                            dir="auto"
                          />
                        ) : c.key === "confidenceScore" ? (
                          <ConfidenceBadge score={it.confidenceScore} />
                        ) : c.key === "englishItemName" ? (
                          <span className="font-semibold tracking-wide uppercase">{it.englishItemName}</span>
                        ) : c.key === "originalUrduText" ? (
                          <span dir="auto" className="text-foreground/90">{it.originalUrduText}</span>
                        ) : c.key === "quantity" ? (
                          <span className="tabular-nums font-mono">{it.quantity}</span>
                        ) : (
                          <span className="text-muted-foreground">{it.unit}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => removeRow(row)}
                      className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-rose-500/20 hover:text-rose-300 border border-transparent hover:border-rose-400/30 transition-colors opacity-0 group-hover:opacity-100">
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
