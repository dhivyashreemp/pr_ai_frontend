import { useState } from "react";
import { CHANGE_TYPES, SYMBOL_CHANGE_TYPES, IMAGE_CHANGE_TYPES, CategoryId } from "@/types/form";
import { Plus } from "lucide-react";

interface AddParameterFormProps {
  categoryId: CategoryId;
  onAdd: (name: string, changeType: string, expectedValue: string) => void;
}

const AddParameterForm = ({ categoryId, onAdd }: AddParameterFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [changeType, setChangeType] = useState("");
  const [expectedValue, setExpectedValue] = useState("");

  const isSymbol = categoryId === "symbol";
  const isImage = categoryId === "image";
  const changeTypes = isSymbol ? SYMBOL_CHANGE_TYPES : isImage ? IMAGE_CHANGE_TYPES : CHANGE_TYPES;

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), changeType, expectedValue);
    setName("");
    setChangeType("");
    setExpectedValue("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 text-sm text-badge-blue-foreground hover:text-foreground transition-colors"
      >
        <Plus size={14} />
        Add parameter
      </button>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(200px,1.2fr)_180px_1fr_40px] gap-3 items-center px-4 py-2.5 bg-badge-blue/30">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Parameter name"
        className="h-9 rounded-md border border-input bg-card px-3 text-sm italic text-badge-blue-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        autoFocus
      />
      <select
        value={changeType}
        onChange={(e) => setChangeType(e.target.value)}
        className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">— select —</option>
        {changeTypes.map((ct) => (
          <option key={ct} value={ct}>
            {ct}
          </option>
        ))}
      </select>
      {!isSymbol && (
        <input
          type="text"
          value={expectedValue}
          onChange={(e) => setExpectedValue(e.target.value)}
          placeholder="Expected value"
          className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
      {isSymbol && <div />}
      <div className="flex gap-1">
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-colors text-xs font-semibold"
          title="Add"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default AddParameterForm;
