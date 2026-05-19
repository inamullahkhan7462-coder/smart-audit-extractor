import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ScanLine } from "lucide-react";
import { UploadStep } from "@/components/audit/UploadStep";
import { ReviewStep } from "@/components/audit/ReviewStep";
import { auditApi, type InventoryItem } from "@/lib/audit-api";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Smart Audit & Inventory Extractor" },
      { name: "description", content: "Upload or paste stock entries, review, and export to Excel." },
    ],
  }),
});

type Step = "upload" | "review";

function Dashboard() {
  const [step, setStep] = useState<Step>("upload");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [busy, setBusy] = useState(false);

  // ✅ Updated the argument keys from 'file' to 'files' to align with our new multi-upload schema
  const handleAnalyze = async ({ files, text }: { files: File[]; text: string }) => {
    setBusy(true);
    try {
      const result = files.length > 0
        ? await auditApi.extractFile(files) // Passes the complete file array to the server
        : await auditApi.extractText(text);
      
      setItems(result);
      setStep("review");
      toast.success(`Extracted ${result.length} item${result.length === 1 ? "" : "s"} successfully!`);
    } catch (e) {
      console.warn(e);
      toast.error("Extraction failed. Check API connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full">
      <Toaster theme="dark" position="top-right" />
      <div className="mx-auto max-w-[1440px] px-6 py-8">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl grid place-items-center bg-gradient-to-br from-primary via-violet-500 to-accent glow-indigo">
              <ScanLine className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Smart Audit & Inventory Extractor</h1>
              <p className="text-xs text-muted-foreground">Upload → Review → Export</p>
            </div>
          </div>

          <Stepper step={step} />
        </header>

        <main className="relative">
          <div
            key={step}
            className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {step === "upload" ? (
              <UploadStep busy={busy} onAnalyze={handleAnalyze} />
            ) : (
              <ReviewStep items={items} setItems={setItems} onBack={() => setStep("upload")} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { id: "upload", label: "Upload" },
    { id: "review", label: "Review" },
    { id: "export", label: "Export" },
  ];
  const activeIdx = step === "upload" ? 0 : 1;
  return (
    <div className="hidden md:flex items-center gap-3 glass-panel rounded-full px-4 py-2">
      {steps.map((s, i) => {
        const active = i <= activeIdx;
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`size-6 rounded-full grid place-items-center text-xs font-semibold transition-colors
                ${active ? "bg-gradient-to-br from-primary to-violet-500 text-white" : "bg-white/5 text-muted-foreground border border-white/10"}`}>
                {i + 1}
              </span>
              <span className={`text-xs ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <span className="h-px w-6 bg-white/10" />}
          </div>
        );
      })}
    </div>
  );
}