import { X, Copy, Download } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

interface OutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  jsonData: object;
  filename: string;
}

const OutputModal = ({ isOpen, onClose, jsonData, filename }: OutputModalProps) => {
  const preRef = useRef<HTMLPreElement>(null);

  if (!isOpen) return null;

  const jsonString = JSON.stringify(jsonData, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    toast.success("Copied to clipboard");
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Change request metadata</h2>
            <p className="text-sm text-muted-foreground">
              Copy this JSON to pass into the validation engine
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          <pre
            ref={preRef}
            className="rounded-md bg-primary p-4 text-xs text-primary-foreground overflow-auto font-mono leading-relaxed"
          >
            {jsonString}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Copy size={14} />
            Copy to clipboard
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-colors"
          >
            <Download size={14} />
            Download as JSON
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutputModal;
