// import { useCallback, useRef, useState } from "react";
// import { UploadCloud, FileText, Image as ImageIcon, X, Sparkles, Loader2 } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";

// interface Props {
//   busy: boolean;
//   onAnalyze: (input: { file: File | null; text: string }) => void;
// }

// const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];

// export function UploadStep({ busy, onAnalyze }: Props) {
//   const [file, setFile] = useState<File | null>(null);
//   const [text, setText] = useState("");
//   const [drag, setDrag] = useState(false);
//   const inputRef = useRef<HTMLInputElement>(null);

//   const pick = (f: File | null) => {
//     if (!f) return;
//     if (!ACCEPT.includes(f.type)) return;
//     setFile(f);
//   };

//   const onDrop = useCallback((e: React.DragEvent) => {
//     e.preventDefault();
//     setDrag(false);
//     pick(e.dataTransfer.files?.[0] ?? null);
//   }, []);

//   const canAnalyze = !busy && (!!file || text.trim().length > 0);

//   return (
//     <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
//       <div className="text-center space-y-2">
//         <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
//           <span className="size-1.5 rounded-full bg-primary" /> Step 1 of 3
//         </div>
//         <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Upload or paste your stock data</h2>
//         <p className="text-sm text-muted-foreground max-w-xl mx-auto">
//           Drop an image or PDF of the inventory sheet, or paste raw Urdu / Roman-Urdu entries below.
//         </p>
//       </div>

//       <div
//         onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
//         onDragLeave={() => setDrag(false)}
//         onDrop={onDrop}
//         onClick={() => inputRef.current?.click()}
//         className={`glass-panel-strong rounded-2xl p-10 cursor-pointer transition-all duration-200
//           ${drag ? "ring-2 ring-primary/60 scale-[1.01] bg-primary/5" : "hover:bg-white/[0.03]"}`}
//       >
//         <input
//           ref={inputRef}
//           type="file"
//           accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
//           className="hidden"
//           onChange={(e) => pick(e.target.files?.[0] ?? null)}
//         />
//         {file ? (
//           <div className="flex items-center justify-between gap-4">
//             <div className="flex items-center gap-4 min-w-0">
//               <div className="size-12 rounded-xl grid place-items-center bg-primary/15 border border-primary/30 shrink-0">
//                 {file.type.startsWith("image/") ? <ImageIcon className="size-5 text-primary" /> : <FileText className="size-5 text-primary" />}
//               </div>
//               <div className="min-w-0">
//                 <p className="font-medium truncate">{file.name}</p>
//                 <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · {file.type || "file"}</p>
//               </div>
//             </div>
//             <button
//               onClick={(e) => { e.stopPropagation(); setFile(null); }}
//               className="size-9 rounded-full grid place-items-center bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 transition-colors">
//               <X className="size-4" />
//             </button>
//           </div>
//         ) : (
//           <div className="flex flex-col items-center text-center gap-4 py-4">
//             <div className="size-16 rounded-2xl grid place-items-center bg-gradient-to-br from-primary/20 to-violet-500/20 border border-white/10">
//               <UploadCloud className="size-7 text-primary" />
//             </div>
//             <div>
//               <p className="font-medium">Drag & drop a file here, or click to browse</p>
//               <p className="text-xs text-muted-foreground mt-1">Supports PNG, JPG, and PDF</p>
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
//         <span className="h-px flex-1 bg-white/10" /> Or paste text manually <span className="h-px flex-1 bg-white/10" />
//       </div>

//       <Textarea
//         value={text}
//         onChange={(e) => setText(e.target.value)}
//         disabled={busy}
//         placeholder={"e.g. Gandum ki 150 bori\nChawal 80 bori basmati\nCheeni 25 kg"}
//         className="min-h-[160px] resize-y bg-black/30 border-white/10 backdrop-blur-xl font-mono text-sm leading-relaxed placeholder:text-muted-foreground/60"
//         dir="auto"
//       />

//       <div className="flex justify-center">
//         <Button
//           onClick={() => onAnalyze({ file, text })}
//           disabled={!canAnalyze}
//           size="lg"
//           className="bg-gradient-to-r from-primary to-violet-500 hover:opacity-90 glow-indigo border-0 px-10 h-12 text-base">
//           {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
//           Analyze & Extract
//         </Button>
//       </div>
//     </div>
//   );
// }


import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, Image as ImageIcon, X, Sparkles, Loader2, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  busy: boolean;
  // Upgraded property definition type to accept an array of files natively!
  onAnalyze: (input: { files: File[]; text: string }) => void;
}

const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];

export function UploadStep({ busy, onAnalyze }: Props) {
  // 1. Turned file state into a clean Array array tracker
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to filter and add unique valid files to our tracking state list
  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    
    const incomingFiles = Array.from(fileList);
    const validFiles = incomingFiles.filter(f => ACCEPT.includes(f.type));
    
    if (validFiles.length === 0) return;

    // Append new selections onto existing documents already queued up
    setFiles((prev) => [...prev, ...validFiles]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (!busy) {
      addFiles(e.dataTransfer.files);
    }
  }, [busy]);

  // Remove a specific image document from the queue array grid if user clicks 'X'
  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Enable analysis if either text is added OR at least one sheet is present in queue
  const canAnalyze = !busy && (files.length > 0 || text.trim().length > 0);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" /> Step 1 of 3
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Upload or paste your stock data</h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Drop one or multiple images/PDFs of your inventory sheets, or paste raw entries below.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); !busy && setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={`glass-panel-strong rounded-2xl p-10 cursor-pointer transition-all duration-200
          ${drag ? "ring-2 ring-primary/60 scale-[1.01] bg-primary/5" : "hover:bg-white/[0.03]"}
          ${busy ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* ✅ Added the crucial multiple attribute flag right here! */}
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {files.length > 0 ? (
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <Files className="size-4 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                Queued Batch Bundle ({files.length} {files.length === 1 ? "document" : "documents"})
              </p>
            </div>
            
            {/* Displaying rows dynamically for all queued-up files */}
            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg grid place-items-center bg-primary/15 border border-primary/30 shrink-0">
                      {file.type.startsWith("image/") ? <ImageIcon className="size-4 text-primary" /> : <FileText className="size-4 text-primary" />}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="size-7 rounded-full grid place-items-center bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="text-center pt-2">
              <p className="text-xs text-primary/70 font-medium">+ Click or drag more files to append to batch</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="size-16 rounded-2xl grid place-items-center bg-gradient-to-br from-primary/20 to-violet-500/20 border border-white/10">
              <UploadCloud className="size-7 text-primary" />
            </div>
            <div>
              <p className="font-medium">Drag & drop files here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Select multiple PNG, JPG, or PDF vouchers up to 30 sheets at once</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-white/10" /> Or paste text manually <span className="h-px flex-1 bg-white/10" />
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        placeholder={"e.g. Gandum ki 150 bori\nChawal 80 bori basmati\nCheeni 25 kg"}
        className="min-h-[160px] resize-y bg-black/30 border-white/10 backdrop-blur-xl font-mono text-sm leading-relaxed placeholder:text-muted-foreground/60"
        dir="auto"
      >
      </Textarea>

      <div className="flex justify-center">
        <Button
          onClick={() => onAnalyze({ files, text })}
          disabled={!canAnalyze}
          size="lg"
          className="bg-gradient-to-r from-primary to-violet-500 hover:opacity-90 glow-indigo border-0 px-10 h-12 text-base"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Analyze & Extract Batch
        </Button>
      </div>
    </div>
  );
}