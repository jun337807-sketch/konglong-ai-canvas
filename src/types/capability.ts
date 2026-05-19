import { MediaCapability, ApiType, MediaType } from './task';
import { UIControlDef } from '../config/uiControlSchema';

export interface RequiredInputDef {
  name: string;
  type: string;
  label: string;
}

export interface OptionalInputDef {
  name: string;
  type: string;
  label: string;
  defaultValue?: any;
  options?: string[]; // For dropdowns, etc.
}

export interface CapabilityRegistryEntry {
  id: MediaCapability;
  label: string;
  apiType: ApiType;
  mediaType: MediaType;
  description: string;
  requiredInputs: RequiredInputDef[];
  optionalInputs: OptionalInputDef[];
  maxImages: number;
  supportedReferenceRoles?: string[];
  defaultParams: Record<string, any>;
  uiControls: UIControlDef[];
}
