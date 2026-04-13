import { CategoryDef, CategoryId } from "@/types/form";
import rawData from "./lcm_attributes.json";

const data = rawData as any;

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  text: {
    id: data.categories.text.id,
    label: data.categories.text.label,
    icon: data.categories.text.icon,
    description: data.categories.text.description,
    groups: data.categories.text.groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      attributes: g.attributes.map((a: any) => ({
        id: a.id,
        label: a.label,
        placeholder: a.placeholder,
      })),
    })),
  },
  symbol: {
    id: data.categories.symbol.id,
    label: data.categories.symbol.label,
    icon: data.categories.symbol.icon,
    description: data.categories.symbol.description,
    groups: data.categories.symbol.groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      attributes: g.attributes.map((a: any) => ({
        id: a.id,
        label: a.label,
        placeholder: a.placeholder,
      })),
    })),
  },
  barcode: {
    id: data.categories.barcode.id,
    label: data.categories.barcode.label,
    icon: data.categories.barcode.icon,
    description: data.categories.barcode.description,
    groups: data.categories.barcode.groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      attributes: g.attributes.map((a: any) => ({
        id: a.id,
        label: a.label,
        placeholder: a.placeholder,
      })),
    })),
  },
  datamatrix: {
    id: data.categories.datamatrix.id,
    label: data.categories.datamatrix.label,
    icon: data.categories.datamatrix.icon,
    description: data.categories.datamatrix.description,
    groups: data.categories.datamatrix.groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      attributes: g.attributes.map((a: any) => ({
        id: a.id,
        label: a.label,
        placeholder: a.placeholder,
      })),
    })),
  },
  image: {
    id: data.categories.image.id,
    label: data.categories.image.label,
    icon: data.categories.image.icon,
    description: data.categories.image.description,
    groups: data.categories.image.groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      attributes: g.attributes.map((a: any) => ({
        id: a.id,
        label: a.label,
        placeholder: a.placeholder,
      })),
    })),
  },
};

export const CATEGORY_ORDER: CategoryId[] = ["text", "symbol", "barcode", "datamatrix", "image"];

export const METADATA_FIELDS = data.form_meta.metadata_fields;

const categoryDisplayName: Record<string, "Text" | "Symbol" | "Barcode" | "Image"> = {
  text: "Text", symbol: "Symbol", barcode: "Barcode", datamatrix: "Barcode", image: "Image",
};

/** Flat lookup: attrId → { label, category } — used to resolve form change IDs in the report */
export const ATTRIBUTE_LOOKUP: Record<string, { label: string; category: "Text" | "Symbol" | "Barcode" | "Image" }> =
  CATEGORY_ORDER.reduce((acc, catId) => {
    for (const group of CATEGORIES[catId].groups) {
      for (const attr of group.attributes) {
        acc[attr.id] = { label: attr.label, category: categoryDisplayName[catId] };
      }
    }
    return acc;
  }, {} as Record<string, { label: string; category: "Text" | "Symbol" | "Barcode" | "Image" }>);
