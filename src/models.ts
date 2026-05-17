export interface FileMetadata {
  id: number;
  folder_id: number | null;
  peer_id: number;
  name: string;
  size: number;
  mime_type: string | null;
  file_ext: string | null;
  created_at: string;
  icon_type: string;
  chunk_id?: string;
  chunk_index?: number;
  total_chunks?: number;
}

export interface FolderMetadata {
  id: number;
  parent_id: number | null;
  name: string;
}
