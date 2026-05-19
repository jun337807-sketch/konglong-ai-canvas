export type UIControlType = 
  | 'prompt_textarea' 
  | 'image_upload' 
  | 'multi_image_upload' 
  | 'select' 
  | 'slider' 
  | 'number_input' 
  | 'text_input' 
  | 'reference_role_selector' 
  | 'generate_button';

export interface UIControlOption {
  label: string;
  value: string | number;
}

export interface UIControlCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: any;
}

export interface UIControlDef {
  id: string;
  type: UIControlType;
  label: string;
  paramKey: string;      // maps to task parameter keys
  required: boolean;
  defaultValue?: any;
  options?: UIControlOption[]; // For select, etc.
  visibleWhen?: UIControlCondition[]; // Dynamic visibility 
  helpText?: string;
  
  // Specific settings for numerical inputs
  min?: number;
  max?: number;
  step?: number;
  
  // For images
  maxImages?: number; 
}
