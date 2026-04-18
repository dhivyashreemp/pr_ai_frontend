import DiscrepancyDashboard from "@/components/DiscrepancyDashboard";

const DataTables = ({ formData, discrepancies, missingItems, satisfiedItems, yoloReview, childFields }: { formData?: any, discrepancies?: any[], missingItems?: any[], satisfiedItems?: any[], yoloReview?: any[], childFields?: Record<string, string> }) => (
  <DiscrepancyDashboard formData={formData} passedDiscrepancies={discrepancies} missingItems={missingItems} satisfiedItems={satisfiedItems} yoloReview={yoloReview} childFields={childFields} />
);

export default DataTables;
