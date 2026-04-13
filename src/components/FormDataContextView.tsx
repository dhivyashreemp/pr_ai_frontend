import { Link } from "react-router-dom";
import { CATEGORIES } from "@/data/attributes";

interface ParsedChange {
  category: string;
  group: string;
  label: string;
  changeType: string;
  expectedValue: string;
}

export const FormDataContextView = ({ formData }: { formData: any }) => {
  const parsedChanges: ParsedChange[] = [];
  
  if (formData && formData.changes) {
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
              expectedValue: formData.changes[attr.id].expectedValue || "N/A",
            });
          }
        }
      }
    }
  }

  if (!formData) {
    return (
      <div className="bg-white p-6 rounded-lg text-center shadow-sm w-full">
        <p className="text-sm text-[#666666]">No form submission context found.</p>
        <Link to="/form?flow=to-split" className="text-[#D51900] text-sm hover:underline mt-2 inline-block">Go submit a form first</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-left">
      {/* Metadata */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-[#333333] mb-3 uppercase tracking-wider">Document Metadata</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[#666666] block text-xs">CR Number</span>
            <span className="font-medium">{formData.metadata?.cr_number || "N/A"}</span>
          </div>
          <div>
            <span className="text-[#666666] block text-xs">SKU</span>
            <span className="font-medium">{formData.metadata?.part_number || "N/A"}</span>
          </div>
          <div>
            <span className="text-[#666666] block text-xs">Label Version</span>
            <span className="font-medium">{formData.metadata?.label_version || "N/A"}</span>
          </div>
          <div>
            <span className="text-[#666666] block text-xs">Product Name</span>
            <span className="font-medium">{formData.metadata?.product_name || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Changes Extracted */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-[#333333] mb-4 uppercase tracking-wider flex items-center justify-between">
          <span>Structured Changes</span>
          <span className="bg-[#D51900] text-white text-xs px-2 py-0.5 rounded-full">{parsedChanges.length}</span>
        </h3>
        
        {parsedChanges.length === 0 ? (
          <p className="text-sm text-[#666666] italic">No attribute changes defined.</p>
        ) : (
          <div className="space-y-4 text-sm">
            {parsedChanges.map((change, idx) => (
              <div key={idx} className="border-l-4 border-[#D51900] pl-4 py-1 relative hover:bg-[#F4F4F4]/50 transition-colors rounded-r-md group">
                <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 text-[#D51900] opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-4 h-[2px] bg-[#D51900]"></div>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-[#666666] block mb-0.5">{change.category} / {change.group}</span>
                    <span className="font-medium text-[#333333]">{change.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="bg-[#fce8e6] text-[#D51900] text-xs px-2 py-1 rounded font-medium inline-block mb-1">{change.changeType}</span>
                    <div className="text-xs max-w-[150px] truncate text-[#666666]" title={change.expectedValue}>
                      Expected: <span className="text-[#333333] font-medium">{change.expectedValue}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
