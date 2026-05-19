export interface Group {
  group_id: string;
  group_name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  user_id: string;
  group_id: string;
  display_name: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status: 'active' | 'disabled';
  joined_at: string;
}

export interface WorkspaceProject {
  project_id: string;
  group_id: string;
  project_name: string;
  project_type: string;
  description: string;
  canvas_ids: string[];
  script_id?: string;
  storyboard_id?: string;
  created_at: string;
  updated_at: string;
}

// Backward-compatible alias while the codebase is migrated gradually.
export type Project = WorkspaceProject;

export interface SharedAsset {
  asset_id: string;
  group_id: string;
  project_id?: string;
  type: string; // character_reference, scene_reference, prop_reference, etc.
  name: string;
  url: string;
  thumbnail_url?: string;
  tags: string[];
  linked_episode_ids: string[];
  linked_beat_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Episode {
  episode_id: string;
  project_id: string;
  episode_number: number;
  title: string;
  summary?: string;
  script_text?: string;
  storyboard_text?: string;
  required_asset_ids: string[];
  annotations: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Beat {
  beat_id: string;
  episode_id: string;
  beat_number: number;
  title: string;
  script_text?: string;
  storyboard_text?: string;
  required_asset_ids: string[];
  linked_canvas_node_ids: string[];
  annotations: string[];
  status: 'draft' | 'ready' | 'generating' | 'completed' | 'needs_fix' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface Annotation {
  annotation_id: string;
  group_id: string;
  project_id: string;
  target_type: 'episode' | 'beat' | 'asset' | 'canvas_node' | 'task';
  target_id: string;
  content: string;
  status: 'open' | 'resolved' | 'pinned' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
}
