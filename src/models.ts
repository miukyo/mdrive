export interface FileMetadata {
  id: number;
  folder_id: number | null;
  name: string;
  size: number;
  mime_type: string | null;
  file_ext: string | null;
  created_at: string;
  icon_type: string;
}

export interface FolderMetadata {
  id: number;
  parent_id: number | null;
  name: string;
}
