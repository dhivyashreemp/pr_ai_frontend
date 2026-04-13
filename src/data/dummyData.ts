export interface DiscrepancyItem {
  id: string;
  category: "Text" | "Symbol" | "Barcode" | "Image";
  status: "Added" | "Deleted" | "Modified" | "Repositioned";
  value: string;
  oldText?: string;
  newText?: string;
  isValid?: boolean; // true = expected by form, false = unexpected change
}

export interface ProofRequestMissingItem {
  id: string;
  category: "Text" | "Symbol" | "Barcode" | "Image";
  label: string;
  expectedChange: string;
  expectedValue: string;
  actualValue?: string; // what was actually detected on the label
}

export interface FeatureItem {
  id: string;
  type: "Barcode" | "Logo" | "Text";
  value: string;
  location: string;
}

export const baseFeatures: FeatureItem[] = [
  { id: "b1", type: "Barcode", value: "GS1-128: (01)08714729000013", location: "Bottom-Right" },
  { id: "b2", type: "Barcode", value: "DataMatrix: LOT-2024-MX-0091", location: "Bottom-Left" },
  { id: "b3", type: "Text", value: "NDC 0078-0357-05", location: "Top-Right" },
  { id: "b4", type: "Text", value: "Sterile EO — Single Use Only", location: "Center-Left" },
  { id: "b5", type: "Text", value: "Rx Only — Federal law restricts", location: "Top-Left" },
  { id: "b6", type: "Logo", value: "CE Mark (CE 0123)", location: "Bottom-Center" },
  { id: "b7", type: "Logo", value: "Manufacturer Logo — Novartis AG", location: "Top-Center" },
  { id: "b8", type: "Text", value: "Store at 2°C–8°C (36°F–46°F)", location: "Center-Right" },
];

export const childFeatures: FeatureItem[] = [
  { id: "c1", type: "Barcode", value: "GS1-128: (01)08714729000013", location: "Bottom-Right" },
  { id: "c2", type: "Barcode", value: "DataMatrix: LOT-2025-MX-0114", location: "Top-Left" },
  { id: "c3", type: "Text", value: "NDC 0078-0357-05", location: "Top-Right" },
  { id: "c4", type: "Text", value: "Sterile EO — Single Use", location: "Center-Left" },
  { id: "c5", type: "Text", value: "Rx Only — Federal law restricts", location: "Top-Left" },
  { id: "c6", type: "Logo", value: "CE Mark (CE 0197)", location: "Bottom-Center" },
  { id: "c7", type: "Logo", value: "Manufacturer Logo — Novartis AG", location: "Top-Center" },
  { id: "c8", type: "Text", value: "Store at 2°C–8°C (36°F–46°F)", location: "Center-Right" },
  { id: "c9", type: "Logo", value: "UDI Symbol (ISO 15223-1)", location: "Bottom-Left" },
];

export const discrepancies: DiscrepancyItem[] = [
  { id: "d1", category: "Barcode", status: "Modified", value: "DataMatrix LOT changed: LOT-2024-MX-0091 → LOT-2025-MX-0114", oldText: "LOT-2024-MX-0091", newText: "LOT-2025-MX-0114", isValid: true },
  { id: "d2", category: "Barcode", status: "Repositioned", value: "DataMatrix relocated from Bottom-Left to Top-Left", isValid: false },
  { id: "d3", category: "Text", status: "Modified", value: "'Single Use Only' truncated to 'Single Use'", oldText: "Sterile EO — Single Use Only", newText: "Sterile EO — Single Use", isValid: false },
  { id: "d4", category: "Symbol", status: "Modified", value: "CE Notified Body ID changed: 0123 → 0197", oldText: "CE 0123", newText: "CE 0197", isValid: true },
  { id: "d5", category: "Symbol", status: "Added", value: "UDI Symbol (ISO 15223-1) added at Bottom-Left", isValid: true },
  { id: "d6", category: "Text", status: "Deleted", value: "Missing trailing text 'this device to sale by…' on Rx statement", isValid: false },
  { id: "d7", category: "Image", status: "Modified", value: "Manufacturer logo scale reduced by ~8%", oldText: "Scale: 100%", newText: "Scale: 92%", isValid: false },
  { id: "d8", category: "Text", status: "Repositioned", value: "Storage instructions shifted 12px right from baseline", isValid: false },
];

// Items the form expected to find but were NOT detected in the comparison
export const proofRequestMissingItems: ProofRequestMissingItem[] = [
  { id: "m1", category: "Text",    label: "Storage conditions", expectedChange: "Modified", expectedValue: "Add humidity range ≤75% RH" },
  { id: "m2", category: "Text",    label: "LOT number (text)",  expectedChange: "Modified", expectedValue: "LOT-YYYY-XX-NNNN format update" },
  { id: "m3", category: "Barcode", label: "GTIN encoded value", expectedChange: "Modified", expectedValue: "00840002600018" },
];

// Unified view of all 6 form changes — found vs not found — used in inspection details and report ExpectedChanges
export interface ProofRequestChangeItem {
  id: string;
  category: "Text" | "Symbol" | "Barcode" | "Image";
  label: string;
  changeType: string;
  expectedValue: string;
  actualValue: string;
  found: boolean;
}

export const proofRequestAllChanges: ProofRequestChangeItem[] = [
  { id: "storage_conditions", category: "Text",    label: "Storage conditions",             changeType: "Modified", expectedValue: "Add humidity range ≤75% RH",       actualValue: "— NOT FOUND —",            found: false },
  { id: "lot_number",         category: "Text",    label: "LOT number (text)",              changeType: "Modified", expectedValue: "LOT-YYYY-XX-NNNN format update",   actualValue: "— NOT FOUND —",            found: false },
  { id: "sym_ce_nb",          category: "Symbol",  label: "CE Mark — notified body number", changeType: "Modified", expectedValue: "0123 → 0197",                      actualValue: "0123 → 0197",              found: true  },
  { id: "sym_udi",            category: "Symbol",  label: "UDI symbol",                     changeType: "Added",    expectedValue: "UDI Symbol (ISO 15223-1)",          actualValue: "UDI Symbol (ISO 15223-1)", found: true  },
  { id: "bc_lot",             category: "Barcode", label: "LOT encoded value",              changeType: "Modified", expectedValue: "LOT-2025-MX-0114",                 actualValue: "LOT-2025-MX-0114",         found: true  },
  { id: "bc_gtin",            category: "Barcode", label: "GTIN encoded value",             changeType: "Modified", expectedValue: "00840002600018",                   actualValue: "— NOT FOUND —",            found: false },
];

// Pre-built dummy formData for Scene 2 demo (matches attribute IDs from lcm_attributes.json)
export const dummyFormDataScene2 = {
  metadata: {
    cr_number: "CR-2025-0042",
    part_number: "08714729-MX",
    label_version: "Rev B → Rev C",
    product_name: "Novartis AG — Injectable Solution",
    requested_by: "J. Smith",
    date: "2025-03-19",
  },
  changes: {
    bc_lot:            { changeType: "Modified",      expectedValue: "LOT-2025-MX-0114" },
    sym_ce_nb:         { changeType: "Modified",      expectedValue: "0123 → 0197" },
    sym_udi:           { changeType: "Added",          expectedValue: "UDI Symbol (ISO 15223-1)" },
    storage_conditions:{ changeType: "Modified",      expectedValue: "Add humidity range ≤75% RH" },
    lot_number:        { changeType: "Modified",      expectedValue: "LOT-YYYY-XX-NNNN format update" },
    bc_gtin:           { changeType: "Modified",      expectedValue: "00840002600018" },
  },
  customAttributes: {},
  totalChanges: 6,
};
