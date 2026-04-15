import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ScanLine, ArrowLeft, ArrowRight, ChevronRight, Edit2, FileText, Upload, X, CheckCircle2, Hash, Package, Tag, User, Calendar, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { CATEGORIES } from "@/data/attributes";
import { FormMetadata } from "@/types/form";
import { useUser } from "@/context/UserContext";
import Dropzone from "@/components/Dropzone";
import ProfileDropdown from "@/components/ProfileDropdown";
import StepIndicator from "@/components/StepIndicator";

const MetaItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
    <div className="w-7 h-7 rounded bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
      <Icon className="h-3.5 w-3.5 text-gray-500" />
    </div>
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-gray-900 break-words">{value || <span className="text-gray-400 font-normal italic">Not specified</span>}</div>
    </div>
  </div>
);

const categoryColor: Record<string, string> = {
  Text: "bg-blue-50 text-blue-700 border-blue-200",
  Symbol: "bg-amber-50 text-amber-700 border-amber-200",
  Barcode: "bg-green-50 text-green-700 border-green-200",
  Image: "bg-purple-50 text-purple-700 border-purple-200",
};

const changeTypeColor: Record<string, string> = {
  Added: "bg-green-50 text-green-700 border-green-200",
  Add: "bg-green-50 text-green-700 border-green-200",
  Removed: "bg-red-50 text-red-700 border-red-200",
  Remove: "bg-red-50 text-red-700 border-red-200",
  Deleted: "bg-red-50 text-red-700 border-red-200",
  Modified: "bg-blue-50 text-blue-700 border-blue-200",
  Modify: "bg-blue-50 text-blue-700 border-blue-200",
  Repositioned: "bg-amber-50 text-amber-700 border-amber-200",
};

const changeTypeLabel: Record<string, string> = {
  Added: "Add", Add: "Add",
  Removed: "Remove", Remove: "Remove", Deleted: "Remove",
  Modified: "Modify", Modify: "Modify",
};

const FormSummaryPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const formData = location.state?.formData;
  const [searchParams] = useSearchParams();
  const flow = searchParams.get("flow") || "to-split";
  const [baseFile, setBaseFile] = useState<File[]>([]);
  const [childFile, setChildFile] = useState<File[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const metadata: FormMetadata = formData?.metadata ?? {};


  // Parse label revision display
  const labelVersion = metadata.label_version || "";
  const labelParts = labelVersion.includes("→")
    ? labelVersion.split("→").map((s: string) => s.trim())
    : [labelVersion, ""];

  // Collect all changes
  const parsedChanges: Array<{ category: string; group: string; label: string; changeType: string; expectedValue: string }> = [];
  if (formData?.changes) {
    for (const catId of Object.keys(CATEGORIES)) {
      const cat = CATEGORIES[catId as keyof typeof CATEGORIES];
      for (const group of cat.groups) {
        const allAttrs = [...group.attributes, ...(formData.customAttributes?.[group.id] || [])];
        for (const attr of allAttrs) {
          if (formData.changes[attr.id]?.changeType) {
            parsedChanges.push({
              category: cat.label,
              group: group.name,
              label: attr.label,
              changeType: formData.changes[attr.id].changeType,
              expectedValue: formData.changes[attr.id].expectedValue || "—",
            });
          }
        }
      }
    }
  }

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (childFile.length === 0) return;

    setSubmitting(true);

    // Save the LRF submission to the backend (non-blocking on failure)
    let submissionId: string | null = null;
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || "https://label-comparator.azurewebsites.net";
      const resp = await fetch(`${API_URL}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: formData?.metadata ?? {},
          changes: formData?.changes ?? {},
          customAttributes: formData?.customAttributes ?? {},
          user_name: user?.name,
          user_role: user?.role,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        submissionId = data.submission_id;
      }
    } catch (e) {
      console.error("Failed to save submission:", e);
      // Non-blocking — proceed with analysis even if DB save fails
    } finally {
      setSubmitting(false);
    }

    navigate("/compare", { state: { formData, submissionId, baseFile, childFile } });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Navbar */}
      <nav className="bg-primary text-white px-6 py-0 flex items-center justify-between shadow-md sticky top-0 z-40" style={{ minHeight: 52 }}>
        <div className="flex items-center gap-4 h-[52px]">
          <button
            onClick={() => navigate(`/form?flow=${flow}`, { state: { formData } })}
            className="flex items-center gap-1 border-r border-white/20 pr-4 h-full text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <ScanLine size={18} />
            <span className="text-sm font-bold tracking-tight uppercase">LabelX Proofreading</span>
            <span className="text-white/30 mx-1">|</span>
            <span className="text-xs text-white/70 font-medium">Review & Upload</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <StepIndicator current={2} />
          </div>
          <ProfileDropdown />
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Page title */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide">Review Submission</h1>
            <p className="text-sm text-gray-500 mt-1">Verify all details below before uploading the new label version and submitting for analysis.</p>
          </div>
          <button
            onClick={() => navigate(`/form?flow=${flow}`, { state: { formData } })}
            className="flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Form
          </button>
        </div>

        <div className="grid grid-cols-5 gap-6">
          {/* Left: Summary */}
          <div className="col-span-3 space-y-4">
            {/* Metadata card */}
            <div className="bg-white border border-gray-200 shadow-sm">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600">Document Metadata</span>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div className="px-5 divide-y divide-gray-50">
                {metadata.cr_number && (
                  <MetaItem icon={Hash} label="CR Number" value={metadata.cr_number} />
                )}
                <MetaItem icon={Package} label="SKU" value={metadata.part_number} />
                {/* Label Revision with two-box display */}
                <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                  <div className="w-7 h-7 rounded bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Label Revision</div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1 border border-gray-300 bg-gray-50 text-sm font-semibold text-gray-700 min-w-[80px] justify-center">
                        {labelParts[0] || "—"}
                      </span>
                      <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                      <span className="inline-flex items-center px-3 py-1 border border-primary/40 bg-primary/5 text-sm font-semibold text-primary min-w-[80px] justify-center">
                        {labelParts[1] || "—"}
                      </span>
                    </div>
                  </div>
                </div>
                {metadata.product_name && (
                  <MetaItem icon={Tag} label="Product Name" value={metadata.product_name} />
                )}
                <MetaItem icon={User} label="Requested By" value={metadata.requested_by} />
                {metadata.date && (
                  <MetaItem icon={Calendar} label="Date" value={metadata.date} />
                )}
              </div>
            </div>

            {/* Changes table */}
            <div className="bg-white border border-gray-200 shadow-sm">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600">Required Changes</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
                  {parsedChanges.length} item{parsedChanges.length !== 1 ? "s" : ""}
                </span>
              </div>
              {parsedChanges.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400 italic">No attribute changes defined.</div>
              ) : (
                <div className="overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50/50 w-[28%]">Attribute</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50/50 w-[16%]">Category</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50/50 w-[16%]">Change Type</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50/50">Expected Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedChanges.map((change, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-gray-900">{change.label}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{change.group}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${categoryColor[change.category] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                              {change.category}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${changeTypeColor[change.changeType] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                              {changeTypeLabel[change.changeType] ?? change.changeType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600 font-mono max-w-[180px]">
                            <span className="block truncate" title={change.expectedValue}>{change.expectedValue}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100 text-left">
                <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5e6e82]">
                  {flow === "to-compare" ? "Upload Labels" : "Upload New Version"}
                </span>
              </div>
              <div className="px-6 py-6 space-y-6">
                <p className="text-[14px] text-[#64748b] leading-relaxed">
                  {flow === "to-compare"
                    ? "Upload the new version label (required). Optionally upload the current version to enable a side-by-side comparison."
                    : "Upload the new label version to be inspected against the expected changes defined in the form."}
                </p>

                {flow === "to-compare" ? (
                  <div className="grid grid-cols-1 gap-6">
                    <Dropzone
                      label="New Version Label (required)"
                      files={childFile}
                      onFilesSelect={setChildFile}
                      multiple={false}
                    />
                    <Dropzone
                      label="Current Version Label (optional — enables side-by-side diff)"
                      files={baseFile}
                      onFilesSelect={setBaseFile}
                      multiple={false}
                    />
                  </div>
                ) : (
                  <Dropzone
                    label="New Version Label"
                    files={childFile}
                    onFilesSelect={setChildFile}
                    multiple={false}
                  />
                )}

                {submitAttempted && childFile.length === 0 && (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <X className="h-3 w-3" />
                    New version label is required to proceed
                  </p>
                )}
                {childFile.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-green-700 font-semibold bg-green-50 border border-green-200 px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {baseFile.length > 0 ? "Both files ready — full diff comparison will run" : "New version ready — LRF validation will run"}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="bg-white border border-gray-200 shadow-sm px-6 py-5 space-y-5 text-left">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#94a3b8] mb-1">Actions</div>
              <button
                onClick={handleSubmit}
                disabled={submitting || childFile.length === 0}
                className={`w-full flex items-center justify-center gap-3 py-3.5 text-[14px] font-bold uppercase tracking-widest transition-all ${(!submitting && childFile.length > 0)
                  ? "bg-primary text-white hover:opacity-90 shadow-sm"
                  : "bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed"
                  }`}
              >
                {submitting ? "Saving…" : "Submit for Analysis"}
                <ArrowRight className="h-4 w-4" />
              </button>
              {childFile.length === 0 && (
                <p className="text-[13px] text-[#94a3b8] text-center">
                  Upload the new version label to enable submission
                </p>
              )}
              <button
                onClick={() => navigate(`/form?flow=${flow}`, { state: { formData } })}
                className="w-full flex items-center justify-center gap-3 py-3.5 text-[14px] font-bold uppercase tracking-[0.05em] border border-[#e2e8f0] text-[#0f172a] hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Form
              </button>
            </div>

            {/* Info card */}
            <div className="bg-blue-50 border border-blue-200 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">What happens next?</div>
              <ul className="text-xs text-blue-700 space-y-1 leading-relaxed">
                <li>• The uploaded label is analysed against the {parsedChanges.length} required change{parsedChanges.length !== 1 ? "s" : ""}.</li>
                <li>• A validation summary and inspection detail report are generated.</li>
                <li>• You can then generate a full PDF report.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSummaryPage;
