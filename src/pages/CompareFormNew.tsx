import { useLocation, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ScanLine, RefreshCw, ZoomIn, ZoomOut, RotateCcw, ArrowRight, FileText } from "lucide-react";
import { FormDataContextView } from "@/components/FormDataContextView";
import { FormValidationSummary, FormValidationDetails } from "@/components/FormValidationSummary";
import Dropzone from "@/components/Dropzone";
import StepIndicator from "@/components/StepIndicator";
import ProfileDropdown from "@/components/ProfileDropdown";
import { useState, useRef, useCallback, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { PLACEHOLDER_LABEL_CHILD } from "@/components/VisualDiffViewer";

const CompareFormNew = () => {
  const location = useLocation();
  const formData = location.state?.formData;
  const navigate = useNavigate();
  const [childFile, setChildFile] = useState<File | null>(location.state?.childFile || null);
  const [analysisRun, setAnalysisRun] = useState(false);
  
  // Create a preview URL for the child file if it exists
  const [previewUrl, setPreviewUrl] = useState<string>("");
  
  useEffect(() => {
    if (childFile) {
      const url = URL.createObjectURL(childFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl("/LCN-187301111_1_Rev-E.png"); // Default fallback
    }
  }, [childFile]);

  const imageRef = useRef<any>(null);

  const handleZoomIn = useCallback(() => {
    imageRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    imageRef.current?.zoomOut();
  }, []);

  const handleReset = useCallback(() => {
    imageRef.current?.resetTransform();
  }, []);

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Navbar */}
      <nav className="bg-primary text-white px-6 py-0 flex items-center justify-between shadow-md sticky top-0 z-40" style={{ minHeight: 52 }}>
        <div className="flex items-center gap-4 h-[52px]">
          <Link to="/form-summary" state={{ formData }} className="flex items-center gap-1 border-r border-white/20 pr-4 h-full text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <ScanLine size={18} />
            <span className="text-sm font-bold tracking-tight uppercase">LabelIX Proofreading</span>
            <span className="text-white/30 mx-1">|</span>
            <span className="text-xs text-white/70 font-medium">Proofing Analysis</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <StepIndicator current={3} />
          </div>
          <ProfileDropdown />
        </div>
      </nav>
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between text-xs sticky top-[52px] z-30 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 mr-1.5 font-bold tracking-widest uppercase text-[10px]">CR Number</span>
            <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.cr_number || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 mr-1.5 font-bold tracking-widest uppercase text-[10px]">SKU</span>
            <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.part_number || "08714729-MX"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 mr-1.5 font-bold tracking-widest uppercase text-[10px]">Revision</span>
            <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.label_version || "—"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#94a3b8] font-bold tracking-widest uppercase text-[11px]">Requested By</span>
          <span className="text-[#334155] font-semibold text-[13px]">{formData.metadata.requested_by || "Athmika"}</span>
        </div>
      </div>
      <div className="flex w-full flex-1 min-h-0 bg-white shadow-sm z-0">
        {/* Left Panel: Document Viewer (Static) */}
        <div className="w-1/2 p-6 bg-slate-50 flex flex-col border-r border-gray-200">
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Toolbar */}
            <div className="flex items-center justify-between border border-[#e2e8f0] bg-[#fafafa] px-5 py-3 border-b-0 flex-shrink-0 shadow-sm rounded-t-sm">
              <span className="text-[13px] font-bold uppercase tracking-widest text-[#5e6e82]">
                New Version Label
              </span>
              <div className="flex items-center gap-2">
                <button onClick={handleZoomIn} className="p-[7px] hover:bg-slate-50 transition-colors border border-[#e2e8f0] bg-white shadow-sm rounded-sm" title="Zoom In">
                  <ZoomIn className="h-[15px] w-[15px] text-slate-600 stroke-[1.5]" />
                </button>
                <button onClick={handleZoomOut} className="p-[7px] hover:bg-slate-50 transition-colors border border-[#e2e8f0] bg-white shadow-sm rounded-sm" title="Zoom Out">
                  <ZoomOut className="h-[15px] w-[15px] text-slate-600 stroke-[1.5]" />
                </button>
                <button onClick={handleReset} className="p-[7px] hover:bg-slate-50 transition-colors border border-[#e2e8f0] bg-white shadow-sm rounded-sm" title="Reset">
                  <RotateCcw className="h-[15px] w-[15px] text-slate-600 stroke-[1.5]" />
                </button>
              </div>
            </div>
            {/* Image display with pan/zoom */}
            <div className="flex-1 border border-[#e2e8f0] shadow-inner flex items-center justify-center bg-[#f8fafc] relative overflow-hidden rounded-b-sm">
              <TransformWrapper ref={imageRef} minScale={0.5} maxScale={4} initialScale={1}>
                <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                   <img 
                    src={previewUrl} 
                    alt="New Version Label" 
                    className="max-w-full max-h-full object-contain pointer-events-none" 
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>
          </div>
        </div>

        {/* Right Panel: Scrollable Analysis Area */}
        <div className="w-1/2 bg-white flex flex-col h-full overflow-y-auto">
          {!analysisRun ? (
            <div className="p-8 bg-slate-50 min-h-full">
              <div className="bg-[#f0f7ff] border border-[#d6e8fc] p-6 w-full max-w-2xl mx-auto flex flex-col gap-6">
                <div className="flex items-start gap-4">
                  <div className="text-[#0066cc] shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  </div>
                  <div className="text-sm text-[#333333] leading-relaxed flex-1">
                    <span className="font-bold block mb-1.5 uppercase tracking-widest text-[#0066cc] text-[13px]">Ready for Analysis</span>
                    Your label has been successfully loaded into the viewer. Execute the proofing analysis to automatically validate its content against the submitted form requirements.
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <button
                    onClick={() => setAnalysisRun(true)}
                    className="flex items-center justify-center gap-2 px-8 py-3 text-[12px] font-bold uppercase tracking-widest transition-all shadow-sm bg-primary text-white hover:opacity-90 rounded-sm"
                  >
                    Run Proofing Analysis
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 pb-32 space-y-6 bg-slate-50 min-h-full">
              {/* Form Validation Summary — real data wired when Scenario 2 API is complete */}
              <div className="space-y-4">
                <FormValidationSummary items={[]} />
                <FormValidationDetails items={[]} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Action Footer */}
      {analysisRun && (
        <div className="bg-white border-t border-[#e2e8f0] px-8 py-2.5 flex items-center justify-between z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] shrink-0">
          <div className="font-mono text-xs text-slate-400 font-medium tracking-wide flex items-center gap-4">
            <span>Generated: {new Date().toISOString().split("T")[0]}</span>
            <span>Ref: {formData?.metadata?.crNumber || "CR-2025-0042"}</span>
          </div>
          <button
            onClick={() => navigate('/report', { state: { scenario: 'B', formData } })}
            className="flex items-center gap-2 bg-[#d51900] text-white px-8 py-3 text-[13px] font-bold uppercase tracking-widest hover:bg-[#b01300] transition-colors rounded-lg shadow-md"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      )}
    </div>
  );
};

export default CompareFormNew;
