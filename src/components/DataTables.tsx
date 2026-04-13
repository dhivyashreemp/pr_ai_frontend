import DiscrepancyDashboard from "@/components/DiscrepancyDashboard";

const DataTables = ({ formData, discrepancies, missingItems, satisfiedItems }: { formData?: any, discrepancies?: any[], missingItems?: any[], satisfiedItems?: any[] }) => (
  <DiscrepancyDashboard formData={formData} passedDiscrepancies={discrepancies} missingItems={missingItems} satisfiedItems={satisfiedItems} />
);

export default DataTables;
