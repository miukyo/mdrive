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
  IconArchiveFilled,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFolder,
  IconFolderSymlink,
  IconShare,
  IconTrash,
} from "@tabler/icons-react";
import { formatSize, getFileIcon } from "./utils";

interface TableViewProps {
  displayItems: any[];
  displayLimit: number;
  selectedKeys: any;
  setSelectedKeys: (keys: any) => void;
  handleItemClick: (e: React.MouseEvent, item: any) => void;
  handleFolderClick: (id: number) => void;
  handleCellClick: (file: any) => void;
  handleDownload: (item: any) => void;
  handleShare: (item: any) => void;
  handleRenameClick: (item: any) => void;
  handleDeleteClick: (item: any) => void;
  handleMoveSingleClick: (item: any) => void;
  isAdmin: boolean;
}

export const TableView = React.memo(
  ({
    displayItems,
    displayLimit,
    selectedKeys,
    setSelectedKeys,
    handleItemClick,
    handleFolderClick,
    handleCellClick,
    handleDownload,
    handleShare,
    handleRenameClick,
    handleDeleteClick,
    handleMoveSingleClick,
    isAdmin,
  }: TableViewProps) => {
    return (
      <div className="file-table h-full flex flex-col border border-white/5 rounded-3xl overflow-hidden bg-surface/50 backdrop-blur-md">
        <div className="overflow-x-auto w-full flex-1 no-scrollbar">
          <div className="min-w-[700px] h-full flex flex-col">
            <div className="file-table-header shrink-0">
              <div>Name</div>
              <div>Type</div>
              <div>Size</div>
              <div>Uploaded at</div>
              <div className="text-center"></div>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="flex flex-col">
                {displayItems.slice(0, displayLimit).map((item: any) => {
                  const isSelected =
                    selectedKeys === "all" ||
                    (selectedKeys instanceof Set && selectedKeys.has(item.id));
                  const itemKey = item.isFolder
                    ? `folder-${item.id}`
                    : `file-${item.id}`;

                  return (
                    <div
                      key={itemKey}
                      data-id={item.id}
                      role="button"
                      tabIndex={0}
                      className={`file-table-row group/row ${isSelected ? "is-selected" : ""}`}
                      onClick={(e) => handleItemClick(e, item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          if (item.isFolder) {
                            handleFolderClick(item.id);
                          } else {
                            handleCellClick(item);
                          }
                        }
                      }}
                    >
                      <div className="file-table-cell name">
                        {isAdmin && !item.isBack && (
                          <div
                            className={`stop-propagation mr-2 shrink-0 cursor-pointer flex items-center justify-center transition-opacity duration-150 ${
                              isSelected ? "opacity-100" : "opacity-100"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newKeys = new Set(
                                selectedKeys === "all"
                                  ? []
                                  : (selectedKeys as Set<any>),
                              );
                              if (newKeys.has(item.id)) {
                                newKeys.delete(item.id);
                              } else {
                                newKeys.add(item.id);
                              }
                              setSelectedKeys(newKeys);
                            }}
                          >
                            <div
                              className={`size-5 rounded-full border flex items-center justify-center transition-all ${
                                isSelected
                                  ? "border-foreground/20 bg-foreground/5 text-foreground"
                                  : "border-foreground/20 bg-foreground/5 hover:border-white/40"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="size-2.5 fill-current"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                                </svg>
                              )}
                            </div>
                          </div>
                        )}
                        <div
                          className={`p-2 rounded-xl bg-white/5 shrink-0 ${item.isBack ? "ml-10" : ""}`}
                        >
                          {item.isFolder ? (
                            <IconFolder className="size-4 text-blue-500 shrink-0" />
                          ) : (
                            getFileIcon(item.mime_type)
                          )}
                        </div>
                        <span className="truncate">{item.name}</span>
                      </div>
                      <div className="file-table-cell type uppercase font-bold tracking-tight">
                        {item.isFolder
                          ? "Folder"
                          : item.name.split(".").pop() || "FILE"}
                      </div>
                      <div className="file-table-cell size">
                        {item.isFolder ? "--" : formatSize(item.size)}
                      </div>
                      <div
                        className="file-table-cell date"
                        suppressHydrationWarning
                      >
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString()
                          : "--"}
                      </div>
                      <div className="file-table-cell actions stop-propagation">
                        {!item.isBack && (
                          <Dropdown>
                            <Button
                              isIconOnly
                              size="sm"
                              aria-label="Menu"
                              variant="tertiary"
                              className="size-8"
                            >
                              <IconDotsVertical className="size-4" />
                            </Button>
                            <Dropdown.Popover>
                              <Dropdown.Menu
                                onAction={(key) => {
                                  if (key === "download") handleDownload(item);
                                  if (key === "share") handleShare(item);
                                  if (key === "rename") handleRenameClick(item);
                                  if (key === "move")
                                    handleMoveSingleClick(item);
                                  if (key === "delete") handleDeleteClick(item);
                                }}
                              >
                                <Dropdown.Section>
                                  <Header>Actions</Header>
                                  <Dropdown.Item
                                    id="download"
                                    textValue="Download"
                                  >
                                    <IconDownload className="size-4" />
                                    <Label>
                                      {item.isFolder
                                        ? "Download ZIP"
                                        : "Download"}
                                    </Label>
                                  </Dropdown.Item>
                                  {isAdmin && (
                                    <>
                                      <Dropdown.Item
                                        id="share"
                                        textValue="Share"
                                      >
                                        <IconShare className="size-4" />
                                        <Label>Share</Label>
                                      </Dropdown.Item>
                                      <Dropdown.Item
                                        id="rename"
                                        textValue="Rename"
                                      >
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
                        )}
                      </div>
                    </div>
                  );
                })}
                {displayItems.length === 0 && (
                  <div className=" h-[62vh]! flex flex-col items-center justify-center gap-4 text-center">
                    <Surface
                      variant="tertiary"
                      className="p-8 rounded-full bg-white/5"
                    >
                      <IconArchiveFilled className="size-12 text-muted/20" />
                    </Surface>
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-semibold text-foreground/80">
                        No Items Found
                      </span>
                      <span className="text-sm text-muted">
                        Upload some files to see them here
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
