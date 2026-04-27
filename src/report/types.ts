export type ChangeType = 'Modified' | 'Added' | 'Deleted' | 'Misplaced' | 'Repositioned';
export type ElementType = 'Text' | 'Symbol' | 'Barcode' | 'DataMatrix' | 'Image';

export interface DrawnBox {
  id: string;
  type: 'Modified' | 'Added' | 'Deleted' | 'Misplaced';
  top: number;
  left: number;
  width: number;
  height: number;
  text?: string;
  elementType?: string;
  disposition?: 'Expected' | 'Unexpected';
  groupId?: string;
  linkedRowId?: string;
  rowNumber?: number;
}

export type RequirementStatus = 'Match' | 'Mismatch';

export interface Requirement {
  id: number;
  elementType: ElementType;
  changeType: ChangeType;
  description: string;
  expectedValue: string;
  actualValue: string;
  status: RequirementStatus;
}

export interface UnexpectedChange {
  id: number | string;
  elementType: string;
  changeType: string;
  /** Description of what was found / the observed difference */
  actual: string;
  linkedBoxIds?: string[];
  source?: 'ai' | 'reviewer';
}

export interface DiscrepancyItem {
  changeType: ChangeType;
  value: string;
}

export interface DiscrepancyCategory {
  title: string;
  items: DiscrepancyItem[];
}

export interface PairReportData {
  pairIndex:     number;
  baseUrl:       string;
  childUrl:      string;
  baseFileName:  string;
  childFileName: string;
  currentBoxes:  DrawnBox[];
  newBoxes:      DrawnBox[];
  requirements:  Requirement[];
  unexpectedChanges: UnexpectedChange[];
  discrepancyCategories: DiscrepancyCategory[];
}

export interface ReportData {
  reportId: string;
  crNumber: string;
  sku: string;
  currentRevision: string;
  newRevision: string;
  currentLabelName: string;
  newLabelName: string;
  currentLabelUrl?: string;
  newLabelUrl?: string;
  newLabelUrls?: string[];   // all new-version labels when multiple were uploaded
  newLabelNames?: string[];  // corresponding file names
  currentBoxes: DrawnBox[];
  newBoxes: DrawnBox[];
  requirements: Requirement[];
  unexpectedChanges: UnexpectedChange[];
  discrepancyCategories: DiscrepancyCategory[];
  pairs?: PairReportData[];  // populated when N label pairs were uploaded
}
