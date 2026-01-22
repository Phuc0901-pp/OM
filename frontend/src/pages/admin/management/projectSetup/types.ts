// Types for ProjectSetupPage module
// Centralized type definitions for better maintainability

export interface MainCategory {
    id: string;
    name: string;
    children?: ChildCategory[];
}

export interface ChildCategory {
    id: string;
    name: string;
    main_category_id: string;
    requires_inverter?: boolean;
    column_key?: string;
}

export interface Station {
    id: string;
    name: string;
    id_main_category: string;
    id_project: string;
    child_category_ids?: string[];
    child_configs?: StationChildConfig[];
}

export interface StationChildConfig {
    child_category_id: string;
    guide_text?: string;
    image_count?: number;
    process_ids?: string[];
    guide_images?: string[];
    project_classification_id?: string;
}

export interface ProjectClassification {
    id: string;
    name: string;
    description?: string;
}

export interface Project {
    project_id: string;
    project_name: string;
    location?: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Process {
    id: string;
    name: string;
    description?: string;
}

export interface ConfigFormState {
    process_ids: string[];
    characteristics: {
        guide_text: string;
        image_count: number;
        guide_images: string[];
        project_classification_id: string;
        [key: string]: any; // Allow additional dynamic fields
    };
}

// Constants
export const CONFIG_KEYS = {
    GUIDE_TEXT: 'guide_text',
    IMAGE_COUNT: 'image_count',
    GUIDE_IMAGES: 'guide_images',
    CLASSIFICATION_ID: 'project_classification_id',
    INVERTER: 'inverter',
    INVERTER_SUB_AREA_COUNT: 'inverter_sub_area_count',
    INVERTER_DETAILS: 'inverter_details',
    AREA_NAME: 'area_name'
} as const;

// Default values
export const DEFAULT_CONFIG_FORM: ConfigFormState = {
    process_ids: [],
    characteristics: {
        guide_text: '',
        image_count: 0,
        guide_images: [],
        project_classification_id: ''
    }
};

// Type guard helpers
export const isValidStation = (obj: any): obj is Station => {
    return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
};

export const isValidChildCategory = (obj: any): obj is ChildCategory => {
    return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
};
