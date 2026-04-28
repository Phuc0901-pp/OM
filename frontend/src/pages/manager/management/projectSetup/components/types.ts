export interface Asset { id: string; name: string; parent_id?: string; sub_assets?: Asset[]; }
export interface Work { id: string; name: string; }
export interface SubWork { id: string; name: string; id_work: string; id_process?: string[]; }
export interface Process { id: string; name: string; }
export interface Config {
 id: string;
 id_asset: string;
 id_sub_work: string;
 image_count?: number;
 status_set_image_count?: boolean;
 guide_text?: string;
 guide_images?: string[];
 asset?: Asset;
 sub_work?: SubWork & { work?: Work; id_process?: string[] };
}

export interface Template {
 id: string;
 name: string;
 id_project?: string;
 id_model_project?: string;
 id_config?: string[] | string;
}

export type Tab = 'work' | 'asset' | 'config' | 'template';

export interface Props {
 isOpen: boolean;
 onClose: () => void;
 onChange: () => void;
 projectId?: string;
}