import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { ScanLine, Save, ArrowLeft, ArrowRight, Lock, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { CategoryId, AttributeDef, FormMetadata } from "@/types/form";
import { CATEGORIES, CATEGORY_ORDER, METADATA_FIELDS } from "@/data/attributes";
import { useUser } from "@/context/UserContext";
import CategoryTabs from "./CategoryTabs";
import AttributeGroup from "./AttributeGroup";
import SummaryBar from "./SummaryBar";
import ProfileDropdown from "./ProfileDropdown";
import StepIndicator from "./StepIndicator";

interface ChangeData {
  changeType: string;
  expectedValue: string;
}

const STORAGE_KEY = "lcm_cr_draft";

const emptyMetadata: FormMetadata = {
  cr_number: "",
  rev: "",
  part_number: "",
  label_version: "",
  product_name: "",
  requested_by: "",
  date: "",
};

/** Parse "Rev B → Rev C" into { from: "Rev B", to: "Rev C" } */
const parseLabelVersion = (v: string): { from: string; to: string } => {
  const idx = v.indexOf("→");
  if (idx === -1) return { from: v.trim(), to: "" };
  return { from: v.slice(0, idx).trim(), to: v.slice(idx + 1).trim() };
};



const ChangeRequestForm = () => {
  const { user } = useUser();
  const location = useLocation();
  // When navigating back from FormSummaryPage the formData is passed in state so we can restore the form
  const restored = location.state?.formData;

  const _initialLabelVersion = restored?.metadata?.label_version || "";
  const _initialParsed = parseLabelVersion(_initialLabelVersion);

  const [metadata, setMetadata] = useState<FormMetadata>(
    restored?.metadata
      ? { ...restored.metadata, requested_by: user.name || restored.metadata.requested_by }
      : { ...emptyMetadata, requested_by: user.name }
  );
  const [labelFrom, setLabelFrom] = useState(_initialParsed.from);
  const [labelTo, setLabelTo] = useState(_initialParsed.to);
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>("text");
  const [changes, setChanges] = useState<Record<string, ChangeData>>(restored?.changes ?? {});
  const [customAttributes, setCustomAttributes] = useState<Record<string, AttributeDef[]>>(restored?.customAttributes ?? {});
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const attributePanelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flow = searchParams.get("flow");

  // Sync label version boxes → metadata
  useEffect(() => {
    const combined = labelFrom || labelTo ? `${labelFrom} → ${labelTo}` : "";
    setMetadata(prev => ({ ...prev, label_version: combined }));
    if (validationErrors.label_version && (labelFrom || labelTo)) {
      setValidationErrors(prev => ({ ...prev, label_version: false }));
    }
  }, [labelFrom, labelTo]);

  // Sync user name → requested_by when user changes
  useEffect(() => {
    if (user.name) {
      setMetadata(prev => ({ ...prev, requested_by: user.name }));
    }
  }, [user.name]);

  useEffect(() => {
    const draft = localStorage.getItem(STORAGE_KEY);
    if (draft) {
      setShowDraftBanner(true);
    }
  }, [flow]);

  const restoreDraft = () => {
    try {
      const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (draft.metadata) {
        setMetadata({ ...draft.metadata, requested_by: user.name || draft.metadata.requested_by });
        const parsed = parseLabelVersion(draft.metadata.label_version || "");
        setLabelFrom(parsed.from);
        setLabelTo(parsed.to);
      }
      if (draft.changes) setChanges(draft.changes);
      if (draft.customAttributes) setCustomAttributes(draft.customAttributes);
      if (draft.activeCategory) setActiveCategory(draft.activeCategory);
      setShowDraftBanner(false);
      toast.success("Draft restored");
    } catch {
      toast.error("Failed to restore draft");
    }
  };

  const dismissDraft = () => setShowDraftBanner(false);

  const saveDraft = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ metadata, changes, customAttributes, activeCategory }));
    toast.success("Draft saved");
  };

  const getChangesForCategory = useCallback(
    (catId: CategoryId) => {
      const cat = CATEGORIES[catId];
      let count = 0;
      for (const group of cat.groups) {
        const allAttrs = [...group.attributes, ...(customAttributes[group.id] || [])];
        for (const attr of allAttrs) {
          if (changes[attr.id]?.changeType) count++;
        }
      }
      return count;
    },
    [changes, customAttributes]
  );

  const changeCounts: Record<CategoryId, number> = {
    text:        getChangesForCategory("text"),
    symbol:      getChangesForCategory("symbol"),
    barcode:     getChangesForCategory("barcode"),
    datamatrix:  getChangesForCategory("datamatrix"),
    image:       getChangesForCategory("image"),
  };

  const totalChanges = Object.values(changeCounts).reduce((a, b) => a + b, 0);

  const handleCategorySelect = (cat: CategoryId) => {
    const newCategory = cat === activeCategory ? null : cat;
    setActiveCategory(newCategory);
    if (newCategory) {
      setTimeout(() => {
        attributePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  const handleChangeType = (attrId: string, value: string) => {
    setChanges(prev => ({
      ...prev,
      [attrId]: { ...prev[attrId], changeType: value, expectedValue: prev[attrId]?.expectedValue || "" },
    }));
  };

  const handleExpectedValue = (attrId: string, value: string) => {
    setChanges(prev => ({
      ...prev,
      [attrId]: { ...prev[attrId], expectedValue: value, changeType: prev[attrId]?.changeType || "" },
    }));
  };

  const handleClear = (attrId: string, isCustom: boolean) => {
    if (isCustom) {
      setCustomAttributes(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = next[key].filter(a => a.id !== attrId);
        }
        return next;
      });
      setChanges(prev => {
        const next = { ...prev };
        delete next[attrId];
        return next;
      });
    } else {
      setChanges(prev => ({ ...prev, [attrId]: { changeType: "", expectedValue: "" } }));
    }
  };

  const handleAddCustom = (groupId: string, name: string, changeType: string, expectedValue: string) => {
    const id = `custom_${groupId}_${Date.now()}`;
    setCustomAttributes(prev => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), { id, label: name, placeholder: "Custom parameter", isCustom: true }],
    }));
    if (changeType) {
      setChanges(prev => ({ ...prev, [id]: { changeType, expectedValue } }));
    }
  };

  const handleMetadataChange = (field: string, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleGenerate = () => {
    const errors: Record<string, boolean> = {};
    if (!metadata.part_number.trim()) errors.part_number = true;

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    const formData = { metadata, changes, customAttributes, totalChanges };
    navigate(`/form-summary?flow=${flow}`, { state: { formData } });
  };

  const activeCat = activeCategory ? CATEGORIES[activeCategory] : null;

  // Fields to render generically (skip label_version and requested_by — handled separately)
  const genericFields = METADATA_FIELDS.filter(
    (f: any) => f.id !== "label_version" && f.id !== "requested_by"
  );

  return (
    <div className="flex flex-col bg-[#f5f5f5]" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Navbar */}
      <nav className="bg-primary text-primary-foreground px-6 py-0 flex items-center justify-between shadow-md shrink-0 z-40" style={{ minHeight: 52 }}>
        <div className="flex items-center gap-4 h-[52px]">
          <Link to="/" className="text-primary-foreground hover:text-white/80 transition-colors flex items-center gap-1 border-r border-white/20 pr-4 h-full">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <ScanLine size={18} />
            <span className="text-sm font-bold tracking-tight uppercase">LabelX Proofreading</span>
            <span className="text-white/30 mx-1">|</span>
            <span className="text-xs text-primary-foreground/70 font-medium">Proofing Request</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {flow && (
            <div className="hidden md:block">
              <StepIndicator current={1} total={3} labels={["Request Form", "Review & Upload", "Analysis"]} />
            </div>
          )}
          <ProfileDropdown />
        </div>
      </nav>

      {/* Draft banner */}
      {showDraftBanner && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center justify-between">
          <span className="text-sm text-blue-800 font-medium">
            A saved draft was found. Would you like to restore it?
          </span>
          <div className="flex gap-2">
            <button onClick={restoreDraft} className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity">
              Restore Draft
            </button>
            <button onClick={dismissDraft} className="rounded border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-5">
        {/* Header Card */}
        <div className="bg-white border border-gray-200 shadow-sm">
          {/* Card header strip */}
          <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50">
            <div>
              <h1 className="text-base font-bold text-gray-900 uppercase tracking-wider">Proofing Request Form</h1>
              <p className="text-xs text-gray-500 mt-0.5">Define required changes to be validated against comparator output</p>
            </div>
            {totalChanges > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                {totalChanges} change{totalChanges !== 1 ? "s" : ""} defined
              </span>
            )}
          </div>

          <div className="px-6 py-5">
            {/* Section label */}
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Document Metadata</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              {/* Generic metadata fields (cr_number, part_number, product_name, date) */}
              {genericFields.map((field: any) => (
                <div key={field.id}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-primary ml-1">*</span>}
                  </label>
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    value={(metadata as any)[field.id] || ""}
                    onChange={e => handleMetadataChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className={`h-9 w-full border px-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all ${
                      validationErrors[field.id] ? "border-red-400 ring-1 ring-red-300" : "border-gray-300 hover:border-gray-400"
                    }`}
                  />
                  {validationErrors[field.id] && (
                    <p className="mt-1 text-xs text-red-600 font-medium">This field is required</p>
                  )}
                </div>
              ))}

              {/* Label Revision — two boxes with arrow */}
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Label Revision
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={labelFrom}
                    onChange={e => setLabelFrom(e.target.value)}
                    placeholder="Current rev. e.g. Rev B"
                    className="h-9 flex-1 border px-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all border-gray-300 hover:border-gray-400"
                  />
                  <div className="flex items-center justify-center w-10 h-9 bg-gray-50 border border-gray-200 shrink-0">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                  <input
                    type="text"
                    value={labelTo}
                    onChange={e => setLabelTo(e.target.value)}
                    placeholder="New rev. e.g. Rev C"
                    className="h-9 flex-1 border px-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all border-gray-300 hover:border-gray-400"
                  />
                </div>
              </div>

              {/* Requested By — auto-populated, read-only */}
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
                  Requested By
                  <Lock className="h-2.5 w-2.5 text-gray-400" />
                  <span className="text-[10px] font-normal normal-case text-gray-400 ml-1">Auto-filled from your profile</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={metadata.requested_by}
                    readOnly
                    className="h-9 w-full border border-gray-200 px-3 text-sm text-gray-600 bg-gray-50 cursor-default select-none"
                  />
                  {user.role && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-medium">
                      {user.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Selection - Sticky Tabs */}
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden sticky top-0 z-30">
          <CategoryTabs activeCategory={activeCategory} changeCounts={changeCounts} onSelect={handleCategorySelect} />

          {activeCat && activeCategory && (
            <div className="bg-gray-50 flex items-center justify-between px-5 py-2.5 border-t border-gray-200">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">{activeCat.label} Attributes</span>
              <span className="text-xs text-gray-400">Select an attribute to define its expected change</span>
            </div>
          )}
        </div>

        {/* Category Attributes Content */}
        {activeCat && activeCategory && (
          <div 
            ref={attributePanelRef} 
            className={`bg-white border border-gray-200 shadow-sm -mt-5 ${activeCategory === "text" ? "" : "max-h-[450px] overflow-y-auto scrollbar-thin"}`}
          >
            <div className="border-t-2 border-primary">
              {activeCat.groups.map(group => (
                <AttributeGroup
                  key={group.id}
                  groupId={group.id}
                  name={group.name}
                  attributes={group.attributes}
                  changes={changes}
                  customAttributes={customAttributes[group.id] || []}
                  categoryId={activeCategory}
                  onChangeType={handleChangeType}
                  onExpectedValue={handleExpectedValue}
                  onClear={handleClear}
                  onAddCustom={handleAddCustom}
                />
              ))}
            </div>
          </div>
        )}

        <SummaryBar counts={changeCounts} />
      </div>
    </div>

      {/* Static Footer Actions */}
      <div className="shrink-0 border-t border-[#e2e8f0] bg-white px-8 py-2.5 flex items-center justify-end gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <button
          onClick={saveDraft}
          className="flex items-center gap-2 border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors uppercase tracking-wider rounded-lg shadow-sm"
        >
          <Save size={14} />
          Save Draft
        </button>
        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 bg-primary px-8 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity uppercase tracking-wider rounded-lg shadow-md"
        >
          Next: Review & Upload
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default ChangeRequestForm;
