export interface AttributeDef {
  id: string;
  label: string;
  placeholder: string;
  isCustom?: boolean;
}

export interface GroupDef {
  id: string;
  name: string;
  attributes: AttributeDef[];
}

export interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  groups: GroupDef[];
}

export type CategoryId = "text" | "symbol" | "barcode" | "datamatrix" | "image";

export interface ChangeEntry {
  attribute_id: string;
  label: string;
  change_type: string;
  expected_value: string;
  isCustom?: boolean;
}

export interface FormMetadata {
  cr_number: string;
  rev: string;
  part_number: string;
  label_version: string;
  product_name: string;
  requested_by: string;
  date: string;
}

export interface FormState {
  metadata: FormMetadata;
  changes: Record<CategoryId, ChangeEntry[]>;
  customAttributes: Record<string, AttributeDef[]>; // keyed by group id
}

export const CHANGE_TYPES = [
  "Added",
  "Removed",
  "Modified",
] as const;

export const SYMBOL_CHANGE_TYPES = [
  "Added",
  "Deleted",
] as const;

export const IMAGE_CHANGE_TYPES = [
  "Added",
  "Deleted",
  "Modified",
] as const;

export type ChangeType = typeof CHANGE_TYPES[number];
