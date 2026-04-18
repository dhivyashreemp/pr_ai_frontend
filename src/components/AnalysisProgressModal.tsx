import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";

interface AnalysisProgressModalProps {
  isOpen: boolean;
}

const STEPS: Array<{ until: number; label: string }> = [
  { until: 5,  label: "Uploading label files..." },
  { until: 20, label: "Extracting text & field data..." },
  { until: 35, label: "Comparing regulatory symbols..." },
  { until: 45, label: "Validating barcodes & DataMatrix..." },
  { until: 55, label: "Detecting visual differences..." },
  { until: Infinity, label: "Almost there..." },
];

const PATIENCE_MESSAGES = [
  "Large or complex labels may take a little longer...",
  "Our AI is carefully reviewing every detail...",
  "Regulatory-grade analysis takes precision...",
];

function getProgress(elapsed: number): number {
  if (elapsed < 5)  return (elapsed / 5) * 9;
  if (elapsed < 20) return 9  + ((elapsed - 5)  / 15) * 31;
  if (elapsed < 35) return 40 + ((elapsed - 20) / 15) * 25;
  if (elapsed < 45) return 65 + ((elapsed - 35) / 10) * 15;
  if (elapsed < 55) return 80 + ((elapsed - 45) / 10) * 15;
  return 95;
}

function getStep(elapsed: number): string {
  return STEPS.find((s) => elapsed < s.until)!.label;
}

const AnalysisProgressModal = ({ isOpen }: AnalysisProgressModalProps) => {
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setElapsed(0);
      setVisible(false);
      const start = Date.now();
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 100);
      // small delay so the modal mounts before fading in patience text
      const visTimer = setTimeout(() => setVisible(true), 50);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        clearTimeout(visTimer);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const progress = Math.round(getProgress(elapsed));
  const stepText = getStep(elapsed);

  const patienceText =
    elapsed >= 90
      ? "Thank you for your patience."
      : elapsed >= 60
      ? PATIENCE_MESSAGES[Math.floor((elapsed - 60) / 15) % PATIENCE_MESSAGES.length]
      : null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-8 w-[360px] flex flex-col items-center">
        {/* Icon */}
        <Activity className="h-8 w-8 text-[#d51900] animate-pulse mb-4" />

        {/* Title */}
        <div className="text-lg font-semibold text-gray-800">Comparing Labels</div>

        {/* Estimated time */}
        <div className="text-xs text-gray-400 mt-1">Usually takes 30–60 seconds</div>

        {/* Step text */}
        <div className="text-sm text-gray-500 mt-4 text-center">{stepText}</div>

        {/* Progress bar */}
        <div className="w-full mt-3 h-1.5 rounded-full bg-gray-200">
          <div
            className="h-1.5 rounded-full bg-[#d51900] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Percentage */}
        <div className="text-xs text-gray-400 mt-1 text-right w-full">{progress}%</div>

        {/* Patience message */}
        <div
          className={`text-xs italic text-gray-400 mt-3 text-center min-h-[16px] transition-opacity duration-700 ${
            patienceText && visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {patienceText ?? ""}
        </div>
      </div>
    </div>
  );
};

export default AnalysisProgressModal;
