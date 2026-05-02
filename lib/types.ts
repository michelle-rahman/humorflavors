export interface HumorFlavor {
  id: number;
  slug: string;
  description: string;
  is_pinned: boolean;
  created_datetime_utc: string;
  modified_datetime_utc: string;
  created_by_user_id: string;
  modified_by_user_id: string;
}

export interface HumorFlavorStep {
  id: number;
  humor_flavor_id: number;
  order_by: number;
  llm_system_prompt: string;
  llm_user_prompt: string;
  description: string | null;
  llm_model_id: number;
  llm_input_type_id: number;
  llm_output_type_id: number;
  humor_flavor_step_type_id: number;
  llm_temperature: number | null;
  created_datetime_utc: string;
  modified_datetime_utc: string;
  created_by_user_id: string;
  modified_by_user_id: string;
}

export interface LLMModel {
  id: number;
  name: string;
  provider_model_id: string;
  is_temperature_supported: boolean;
  llm_provider_id: number;
}

export interface LLMInputType {
  id: number;
  description: string;
  slug: string;
}

export interface LLMOutputType {
  id: number;
  description: string;
  slug: string;
}

export interface HumorFlavorStepType {
  id: number;
  slug: string;
  description: string;
}

export interface Profile {
  id: string;
  is_superadmin: boolean;
  is_matrix_admin: boolean;
}

export interface Caption {
  id: string;
  content: string;
  humor_flavor_id: number;
  image_id: string;
  caption_request_id: number;
  is_public: boolean;
  profile_id: string;
  like_count: number;
  created_datetime_utc: string;
  modified_datetime_utc: string;
}

export interface ImageRecord {
  id: string;
  url: string;
  is_common_use: boolean;
  additional_context: string | null;
  image_description: string | null;
  profile_id: string;
  is_public: boolean;
}
