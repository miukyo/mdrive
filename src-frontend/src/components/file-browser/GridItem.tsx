import React from "react";
import {
  Button,
  Dropdown,
  Header,
  Label,
  Separator,
  Surface,
} from "@heroui/react";
import {
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFolder,
  IconFolderSymlink,
  IconShare,
  IconTrash,
} from "@tabler/icons-react";
import { formatSize, getFileIcon } from "./utils";

interface GridItemProps {
  file: any;
  openPreview: (file: any) => void;
  handleDownload: (file: any) => void;
  handleShare: (file: any) => void;
  handleRenameClick: (file: any) => void;
  handleDeleteClick: (file: any) => void;
  handleMoveSingleClick: (file: any) => void;
  sessionId: string | null;
  shareToken?: string;
  isFolder?: boolean;
  isBack?: boolean;
  isSelected?: boolean;
  selectedKeys?: any;
  setSelectedKeys?: (keys: any) => void;
  onClick: (e: React.MouseEvent) => void;
  isAdmin: boolean;
  "data-id"?: string | number;
}

export const GridItem = React.memo(
  ({
    file,
    openPreview,
    handleDownload,
    handleShare,
    handleRenameClick,
    handleDeleteClick,
    handleMoveSingleClick,
    sessionId,
    shareToken,
    isFolder,
    isBack,
    isSelected,
    selectedKeys,
    setSelectedKeys,
    onClick,
    isAdmin,
    "data-id": dataId,
  }: GridItemProps) => {
    const API_BASE_URL = import.meta.env.DEV
      ? "http://localhost:3002/api"
      : "/api";

    const isShare = !!shareToken;
    const thumbUrl = sessionId
      ? `${API_BASE_URL}/thumbnail?message_id=${file.id}${file.folder_id ? `&folder_id=${file.folder_id}` : ""}${file.peer_id ? `&peer_id=${file.peer_id}` : ""}&session_id=${sessionId}`
      : isShare
        ? `${API_BASE_URL}/thumbnail?share_token=${shareToken}&message_id=${file.id}${file.folder_id ? `&folder_id=${file.folder_id}` : ""}${file.peer_id ? `&peer_id=${file.peer_id}` : ""}`
        : null;

    const handleDoubleClick = (e: React.MouseEvent) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) return;
      if (isFolder || isBack) {
        // Handled by onClick/handleFolderClick
      } else {
        openPreview(file);
      }
    };

    return (
      <Surface
        data-id={dataId}
        variant="tertiary"
        className={`group relative flex flex-col justify-center p-2 max-sm:p-1.5 rounded-3xl max-sm:rounded-2xl border transition-all cursor-pointer overflow-hidden shrink-0 h-70 max-sm:h-44 ${
          isSelected ? "is-selected" : ""
        }`}
        onClick={onClick}
        onDoubleClick={handleDoubleClick}
      >
        {isAdmin && !isBack && setSelectedKeys && (
          <div
            className={`absolute top-4 left-4 max-sm:top-2 max-sm:left-2 transition-opacity stop-propagation z-10 ${
              isSelected ? "opacity-100" : "opacity-100"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              const newKeys = new Set(
                selectedKeys === "all" ? [] : (selectedKeys as Set<any>),
              );
              if (newKeys.has(file.id)) {
                newKeys.delete(file.id);
              } else {
                newKeys.add(file.id);
              }
              setSelectedKeys(newKeys);
            }}
          >
            <div
              className={`size-5 z-10 rounded-full border flex items-center justify-center transition-all ${
                isSelected
                  ? "border-muted/5 bg-background text-foreground"
                  : "border-muted/70 bg-muted/30"
              }`}
            >
              {isSelected && (
                <svg
                  className="size-2.5 max-sm:size-2 fill-current"
                  viewBox="0 0 20 20"
                >
                  <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                </svg>
              )}
            </div>
          </div>
        )}
        <div className="relative mb-3 max-sm:mb-1.5 size-full rounded-2xl max-sm:rounded-xl bg-white/5 overflow-hidden flex items-center justify-center">
          {isFolder ? (
            <IconFolder className="size-10 max-sm:size-7 text-blue-500" />
          ) : (file.mime_type?.includes("image") ||
              file.mime_type?.includes("video")) &&
            thumbUrl ? (
            <>
              <img
                src={thumbUrl}
                alt={file.name}
                loading="lazy"
                className="size-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  const fallback = (e.target as HTMLElement)
                    .nextElementSibling as HTMLElement;
                  if (fallback) {
                    fallback.classList.remove("hidden");
                    fallback.classList.add("flex");
                  }
                }}
              />
              <div className="hidden size-full items-center justify-center">
                {getFileIcon(file.mime_type, "size-10 max-sm:size-7")}
              </div>
            </>
          ) : (
            getFileIcon(file.mime_type, "size-10 max-sm:size-7")
          )}
        </div>
        <span className="text-xs max-sm:text-[11px] font-medium truncate w-full text-center px-2">
          {file.name}
        </span>
        <span className="text-[10px] max-sm:text-[9px] text-muted mt-1 max-sm:mt-0.5 text-center px-2 mb-2 max-sm:mb-1">
          {isFolder ? "Folder" : formatSize(file.size)}
        </span>

        {!isBack && (
          <div className="absolute top-4 right-4 max-sm:top-2 max-sm:right-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity stop-propagation">
            <Dropdown>
              <Button
                isIconOnly
                size="sm"
                aria-label="Menu"
                variant="tertiary"
                className="size-7"
              >
                <IconDotsVertical className="size-3.5" />
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  onAction={(key) => {
                    if (key === "download") handleDownload(file);
                    if (key === "share") handleShare(file);
                    if (key === "rename") handleRenameClick(file);
                    if (key === "move") handleMoveSingleClick(file);
                    if (key === "delete") handleDeleteClick(file);
                  }}
                >
                  <Dropdown.Section>
                    <Header>Actions</Header>
                    <Dropdown.Item id="download" textValue="Download">
                      <IconDownload className="size-4" />
                      <Label>{isFolder ? "Download ZIP" : "Download"}</Label>
                    </Dropdown.Item>
                    {isAdmin && (
                      <>
                        <Dropdown.Item id="share" textValue="Share">
                          <IconShare className="size-4" />
                          <Label>Share</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="rename" textValue="Rename">
                          <IconEdit className="size-4" />
                          <Label>Rename</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="move" textValue="Move">
                          <IconFolderSymlink className="size-4" />
                          <Label>Move</Label>
                        </Dropdown.Item>
                      </>
                    )}
                  </Dropdown.Section>
                  {isAdmin && (
                    <>
                      <Separator />
                      <Dropdown.Section>
                        <Header>Danger zone</Header>
                        <Dropdown.Item
                          id="delete"
                          textValue="Delete"
                          variant="danger"
                        >
                          <IconTrash className="size-4" />
                          <Label>Delete</Label>
                        </Dropdown.Item>
                      </Dropdown.Section>
                    </>
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        )}
      </Surface>
    );
  },
);
