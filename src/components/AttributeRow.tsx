import { useState } from "react";
import { CHANGE_TYPES, SYMBOL_CHANGE_TYPES, IMAGE_CHANGE_TYPES, CategoryId } from "@/types/form";
import { X, Upload, ChevronRight } from "lucide-react";

interface AttributeRowProps {
  id: string;
  label: string;
  placeholder: string;
  changeType: string;
  expectedValue: string;
  isCustom?: boolean;
  isEven: boolean;
  categoryId: CategoryId;
  onChangeType: (value: string) => void;
  onExpectedValue: (value: string) => void;
  onClear: () => void;
}

const AttributeRow = ({
  label,
  placeholder,
  changeType,
  expectedValue,
  isCustom,
  isEven,
  categoryId,
  onChangeType,
  onExpectedValue,
  onClear,
}: AttributeRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSymbol      = categoryId === "symbol";
  const isImage       = categoryId === "image";
  const isBarcode     = categoryId === "barcode";
  const isDataMatrix  = categoryId === "datamatrix";
  const isDeleted     = changeType === "Remove";
  const showUpload = !isDeleted && ((isSymbol && changeType === "Add") ||
                     (isImage && (changeType === "Add" || changeType === "Modify")));
  const hideExpectedValue = isSymbol || isImage || isBarcode || isDataMatrix || isDeleted;

  const changeTypes = isSymbol ? SYMBOL_CHANGE_TYPES : isImage ? IMAGE_CHANGE_TYPES : CHANGE_TYPES;
  const hasDefined = changeType !== "";

  return (
    <div className="bg-white border-b border-gray-100 last:border-b-0">
      {/* Attribute name row - clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 pl-8 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ChevronRight
            size={14}
            className={`text-[#999999] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          />
          <span className={`text-[13px] ${isCustom ? "italic text-badge-blue-foreground" : "text-[#555555]"}`}>
            {label}
            {isCustom && <span className="text-badge-blue-foreground"> *</span>}
          </span>
        </div>
        <div className="flex items-center pr-2">
          {hasDefined && (
            <span className="text-[12px] font-bold text-[#333333]">
              {changeType}
            </span>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 ml-8 mr-4 space-y-3 border-l-2 border-primary/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Change type */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Change type</label>
              <select
                value={changeType}
                onChange={(e) => onChangeType(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— select —</option>
                {changeTypes.map((ct) => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>

            {/* Expected value / Upload */}
            {!hideExpectedValue && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Expected value</label>
                <input
                  type="text"
                  value={expectedValue}
                  onChange={(e) => onExpectedValue(e.target.value)}
                  placeholder={placeholder}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {showUpload && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Upload</label>
                <label className="flex items-center gap-2 h-9 rounded-md border border-dashed border-input bg-card px-3 text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-foreground transition-colors">
                  <Upload size={14} />
                  <span>{expectedValue || (isSymbol ? "Upload symbol" : "Upload image")}</span>
                  <input
                    type="file"
                    accept="image/*,.svg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onExpectedValue(file.name);
                    }}
                  />
                </label>
              </div>
            )}

            {/* Clear button */}
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Clear"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttributeRow;