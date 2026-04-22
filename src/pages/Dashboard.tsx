import { FileText, FileSearch, ScanLine, User, ChevronRight, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import ProfileDropdown from "@/components/ProfileDropdown";

const workflows = [
  {
    id: 1,
    icon: FileSearch,
    title: "Existing + Master",
    subtitle: "Direct Comparison",
    description: "Upload a Current Version and a New Version to run the comparator analysis directly without a proof request form.",
    route: "/compare",
    badge: "1-Step",
    steps: ["Direct Comparison"]
  },
  {
    id: 3,
    icon: FileText,
    title: "Full Comparison",
    subtitle: "Form + Comparison View",
    description: "Submit a proof request form, then proceed to the standard comparison view for a complete side-by-side analysis.",
    route: "/form?flow=to-compare",
    badge: "3-Step",
    steps: ["Form", "Review and Upload", "Analysis"]
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  return (
    <div className="h-screen flex flex-col bg-[#f5f5f5] overflow-hidden">
      {/* Top navigation bar */}
      <header className="bg-primary text-white shadow-md px-6 py-0 flex items-center justify-between sticky top-0 z-40 shrink-0" style={{ minHeight: 52 }}>
        <div className="flex items-center gap-3 h-[52px]">
          <ScanLine className="h-5 w-5" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold uppercase tracking-widest">LabelIX Proofreading</span>
          </div>
          <span className="hidden sm:block text-white/30 mx-2">|</span>
          <span className="hidden sm:block text-xs text-white/60 font-medium">Regulatory Affairs · Document Control</span>
        </div>
        <ProfileDropdown />
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-12 pb-2 flex flex-col gap-6 overflow-y-auto no-scrollbar">
        {/* Welcome section */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-1 bg-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Workflow Selection</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              {user.name ? `Welcome, ${user.name.split(" ")[0]}` : "LabelIX Proofreading"}
            </h1>
            <p className="text-gray-500 mt-2 text-sm max-w-xl leading-relaxed">
              Select a workflow to begin validating label changes against comparator inspection output.
              Each workflow is optimised for a different proofing scenario.
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-2 border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Controlled Environment</span>
          </div>
        </div>

        {/* Workflow cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workflows.map(({ id, icon: Icon, title, subtitle, description, route, badge, steps }) => (
            <button
              key={id}
              onClick={() => navigate(route)}
              className="group bg-white border border-gray-200 text-left shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {/* Card top accent */}
              <div className="h-1 w-full bg-gray-100 group-hover:bg-primary transition-colors duration-200" />

              <div className="p-6 flex flex-col h-full gap-4">
                {/* Icon + badge row */}
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  {badge && (
                    <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border border-primary/30 bg-primary/5 text-primary">
                      {badge}
                    </span>
                  )}
                </div>

                {/* Text */}
                <div className="mb-2 flex-grow">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{subtitle}</div>
                  <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
                  <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
                </div>

                {/* Steps Section */}
                <div className="mt-auto pt-4 flex flex-col gap-2 border-t border-gray-50 overflow-hidden">
                  <div className="flex items-center gap-1.5 flex-nowrap">
                    {steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-1 shrink-1 min-w-0">
                         <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center text-[8px] font-bold text-white leading-none">
                           {idx + 1}
                         </span>
                         <span className="text-[11px] text-gray-500 font-normal whitespace-nowrap truncate">
                           {step}
                         </span>
                         {idx < steps.length - 1 && (
                           <ChevronRight className="h-2.5 w-2.5 text-slate-300 mx-0 shrink-0" />
                         )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA row */}
                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary pt-3 border-t border-gray-100 group-hover:border-primary/10 transition-colors">
                  Launch Workflow
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Info strip */}
        <div className="bg-white border border-gray-200 px-5 py-4 flex flex-wrap items-center gap-6 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 shrink-0">System Info</div>
          <div className="h-4 w-px bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-700">130+</span> label attributes across 4 categories
          </div>
          <div className="h-4 w-px bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2 text-xs text-gray-600">
            Supports <span className="font-semibold text-gray-700">PDF / PNG / JPEG / TIFF</span> formats
          </div>
          <div className="h-4 w-px bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2 text-xs text-gray-600">
            PDF report generation included
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 z-40 border-t border-[#e2e8f0] bg-white px-8 py-2.5 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.05)] shrink-0">
        <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider font-medium">
          LabelIX Proofreading · Internal Use Only
        </span>
        <span className="text-[10px] text-gray-400 font-mono font-medium">
          v1.0 · {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
};

export default Dashboard;
