import { ChevronRight } from "lucide-react";

interface StepIndicatorProps {
  current: number;
  total?: number;
  labels?: string[];
}

const StepIndicator = ({ 
  current, 
  total = 3, 
  labels = ["Request Form", "Review & Upload", "Analysis"] 
}: StepIndicatorProps) => {
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isActive = step === current;
        return (
          <div key={step} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
              isActive
                ? "text-white border-b-2 border-white"
                : isDone
                ? "bg-white/15 text-white rounded"
                : "text-white/35"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                isActive
                  ? "bg-white text-primary border-white"
                  : isDone
                  ? "bg-white text-primary border-white"
                  : "bg-transparent text-white/35 border-white/25"
              }`}>
                {isDone ? "✓" : step}
              </span>
              {label}
            </div>
            {i < labels.length - 1 && <ChevronRight size={14} color="rgba(255,255,255,0.6)" className="mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
