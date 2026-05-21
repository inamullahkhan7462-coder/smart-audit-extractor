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

// 🔍 Locate this function block inside your parent routing file (e.g., index.tsx)
function Dashboard() {
  const [step, setStep] = useState<Step>("upload");
  // Change the state definition parameter to 'any[]' temporarily 
  // to prevent strict types from filtering dynamic data keys out!
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const handleAnalyze = async ({ files, text }: { files: File[]; text: string }) => {
    setBusy(true);
    try {
      console.log("Submitting file assets to API wrapper...", files);
      const result = files.length > 0
        ? await auditApi.extractFile(files)
        : await auditApi.extractText(text);
      
      console.log("Raw array returned to parent view state engine:", result);

      // Verify that we received an array before updating the state grid
      if (result && result.length > 0) {
        setItems(result);
        setStep("review");
        toast.success(`Loaded dynamic horizontal table matrix!`);
      } else {
        toast.error("AI completed processing but returned an empty dataset container.");
      }
    } catch (e) {
      console.error("Extraction error in parent dashboard processor:", e);
      toast.error("Extraction failed. Check API connection lines.");
    } finally {
      setBusy(false);
    }
  };

  return (
    // ... your current header return markup stay exactly the same!
    <main className="relative">
      <div key={step} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {step === "upload" ? (
          <UploadStep busy={busy} onAnalyze={handleAnalyze} />
        ) : (
          // ✅ Double-check that items and setItems are passed cleanly down here
          <ReviewStep items={items} setItems={setItems} onBack={() => setStep("upload")} />
        )}
      </div>
    </main>
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