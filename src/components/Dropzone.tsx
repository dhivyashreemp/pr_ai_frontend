import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";

interface DropzoneProps {
  label: string;
  files: File[];
  onFilesSelect: (files: File[]) => void;
  multiple?: boolean;
  alwaysShowUploadBox?: boolean;
}

const Dropzone = ({ label, files, onFilesSelect, multiple = false, alwaysShowUploadBox = false }: DropzoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        if (multiple) {
          onFilesSelect([...files, ...droppedFiles]);
        } else {
          onFilesSelect([droppedFiles[0]]);
        }
      }
    },
    [onFilesSelect, multiple, files]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      if (multiple) {
        onFilesSelect([...files, ...selectedFiles]);
      } else {
        onFilesSelect([selectedFiles[0]]);
      }
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onFilesSelect(newFiles);
  };

  const clearFiles = () => {
    onFilesSelect([]);
  };

  return (
    <div className="flex-1">
      <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </label>

      {/* Show single file view if non-multiple and has a file, and not forced to show upload box */}
      {files.length > 0 && !multiple && !alwaysShowUploadBox ? (
        <div className="border border-[#e2e8f0] bg-white p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-4 w-4 text-[#d51900] shrink-0" />
            <div className="min-w-0 flex flex-col">
              <span className="text-[13px] font-semibold text-slate-700 truncate">{files[0].name}</span>
              <span className="text-[10px] text-slate-400 font-medium">
                {(files[0].size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
          <button
            onClick={clearFiles}
            className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-red-500 transition-colors rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${isDragOver
              ? "border-primary bg-primary/5 shadow-inner scale-[0.99]"
              : "border-slate-200 hover:border-primary/40 bg-white hover:bg-slate-50/50"
              }`}
          >
            <Upload className={`h-6 w-6 text-muted-foreground mb-2 ${isDragOver ? 'text-primary' : ''}`} />
            <span className="text-sm text-muted-foreground">
              {multiple && files.length > 0 ? "Add more files" : <>Drag & drop or <span className="underline">browse</span></>}
            </span>
            <span className="text-xs text-muted-foreground mt-1">PDF / PNG / JPEG / TIFF</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
              onChange={handleChange}
              multiple={multiple}
              className="hidden"
            />
          </label>
          
          {/* List of files for single-file mode with alwaysShowUploadBox */}
          {!multiple && alwaysShowUploadBox && files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, idx) => (
                <div key={`${f.name}-${idx}`} className="border border-[#e2e8f0] bg-white p-3 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-[#d51900] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-slate-700 truncate">{f.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{(f.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-red-500 transition-colors rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* List of files for multiple mode */}
          {multiple && files.length > 0 && (
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
              {files.map((f, idx) => (
                <div key={`${f.name}-${idx}`} className="border border-[#e2e8f0] bg-white p-3 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-[#d51900] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-slate-700 truncate">{f.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{(f.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 hover:bg-slate-50 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dropzone;
