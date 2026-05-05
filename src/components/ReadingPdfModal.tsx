import { FileText } from "lucide-react";

interface ReadingPdfModalProps {
  isOpen: boolean;
}

const ReadingPdfModal = ({ isOpen }: ReadingPdfModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-8 w-[360px] flex flex-col items-center">
        <FileText className="h-8 w-8 text-[#d51900] animate-pulse mb-4" />
        <div className="text-lg font-semibold text-gray-800">Reading PDF</div>
        <div className="text-xs text-gray-400 mt-1">Converting pages for analysis...</div>
        <div className="flex gap-1 mt-5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-[#d51900] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReadingPdfModal;
