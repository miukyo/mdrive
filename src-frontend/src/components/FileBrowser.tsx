import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Description,
  Dropdown,
  EmptyState,
  Header,
  Label,
  Modal,
  Separator,
  Surface,
  Virtualizer,
  type Selection,
  Checkbox,
  TextField,
  InputGroup,
  Table,
  TableLayout,
  toast,
  Spinner,
} from "@heroui/react";
import {
  IconArchiveFilled,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFileDescriptionFilled,
  IconLayoutGrid,
  IconList,
  IconMusic,
  IconPhotoFilled,
  IconVideoFilled,
  IconFolderPlus,
  IconFolder,
  IconPlus,
  IconShare,
  IconTrash,
} from "@tabler/icons-react";
import { useAuthStore } from "../stores/Auth.store";
import { useFilesStore } from "../stores/Files.store";
import { useIndexStore } from "../stores/Index.store";
import { usePreviewStore } from "../stores/Preview.store";
import { useFolderStore } from "../stores/Folder.store";
import { FileActionModals } from "./FileActionModals";

interface FileBrowserProps {
  files: any[];
}

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const GridItem = React.memo(
  ({
    file,
    openPreview,
    handleDownload,
    handleShare,
    handleRenameClick,
    handleDeleteClick,
    formatSize,
    getFileIcon,
    sessionId,
    isFolder,
    isBack,
    onClick,
  }: any) => {
    const API_BASE_URL = import.meta.env.DEV
      ? "http://localhost:3000/api"
      : "/api";

    return (
      <Surface
        variant="tertiary"
        className="group relative flex flex-col justify-center p-2 rounded-3xl border border-white/5 hover:border-primary/50 transition-all cursor-pointer overflow-hidden"
        onClick={onClick}
      >
        <div className="relative mb-3 aspect-16/12 w-full rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center">
          {isFolder ? (
            <IconFolder className="size-10 text-blue-500" />
          ) : file.mime_type?.includes("image") ||
            file.mime_type?.includes("video") ? (
            <>
              <img
                src={`${API_BASE_URL}/thumbnail?message_id=${file.id}${file.folder_id ? `&folder_id=${file.folder_id}` : ""}&session_id=${sessionId}`}
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
                {getFileIcon(file.mime_type, "size-10")}
              </div>
            </>
          ) : (
            getFileIcon(file.mime_type, "size-10")
          )}
        </div>
        <span className="text-xs font-medium truncate w-full text-center px-2">
          {file.name}
        </span>
        <span className="text-[10px] text-muted mt-1 text-center px-2 mb-2">
          {isFolder ? "Folder" : formatSize(file.size)}
        </span>

        {!isBack && !isFolder && (
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    if (key === "delete") handleDeleteClick(file);
                  }}
                >
                  <Dropdown.Section>
                    <Header>Actions</Header>
                    <Dropdown.Item id="download" textValue="Download">
                      <IconDownload className="size-4" />
                      <Label>Download</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="share" textValue="Share">
                      <IconShare className="size-4" />
                      <Label>Share</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="rename" textValue="Rename">
                      <IconEdit className="size-4" />
                      <Label>Rename</Label>
                    </Dropdown.Item>
                  </Dropdown.Section>
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
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        )}
      </Surface>
    );
  },
);

export const FileBrowser = React.memo(
  ({ files: allFiles }: FileBrowserProps) => {
    const [viewMode, setViewMode] = useState<"table" | "grid">("grid");
    const [currentFolderId, setCurrentFolderId] = useState<number>(0);
    const { open: openPreview } = usePreviewStore();
    const { deleteFiles, renameFile, shareFile } = useFilesStore();
    const { fetchData, fetchFolderContents } = useIndexStore();
    const { sessionId } = useAuthStore();
    const { folders, fetchFolders, createFolder } = useFolderStore();

    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<any>(null);
    const [displayLimit, setDisplayLimit] = useState(24);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
    const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [isFolderLoading, setIsFolderLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const isFirstLoad = useRef(true);

    useEffect(() => {
      fetchFolders();
    }, []);

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        const startTime = Date.now();
        await fetchFolderContents(currentFolderId);
        const endTime = Date.now();
        const duration = endTime - startTime;
        const minDelay = isFirstLoad.current ? 300 : 0; // Only delay on first mount
        if (duration < minDelay) {
          await new Promise((resolve) =>
            setTimeout(resolve, minDelay - duration),
          );
        }
        setIsLoading(false);
        isFirstLoad.current = false;
      };
      load();
    }, [currentFolderId, fetchFolderContents]);

    useEffect(() => {
      if (viewMode === "grid" && allFiles.length > displayLimit) {
        const timer = setTimeout(() => {
          setDisplayLimit(allFiles.length);
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [viewMode, allFiles.length, displayLimit]);

    useEffect(() => {
      setDisplayLimit(24);
    }, [allFiles.length]);

    const handleDownload = useCallback(
      (file: any) => {
        const url = `/stream?message_id=${file.id}${file.folder_id ? `&folder_id=${file.folder_id}` : ""}&download=1&session_id=${sessionId}`;
        window.open(url, "_blank");
      },
      [sessionId],
    );

    const handleShare = useCallback(
      async (file: any) => {
        const res = await shareFile(file.id, file.folder_id);
        if (res.success && res.url) {
          navigator.clipboard.writeText(res.url);
          toast.success("Share link copied to clipboard!");
        } else {
          toast.danger(res.message || "Failed to create share link");
        }
      },
      [shareFile],
    );

    const handleRenameClick = useCallback((file: any) => {
      setSelectedFile(file);
      setIsRenameOpen(true);
    }, []);

    const handleDeleteClick = useCallback((file: any) => {
      setSelectedFile(file);
      setIsDeleteOpen(true);
    }, []);

    const handleCellClick = useCallback(
      (file: any) => {
        openPreview(file, allFiles);
      },
      [openPreview, allFiles],
    );

    const getFileIcon = useCallback(
      (mimeType: string, className = "size-4 shrink-0") => {
        if (mimeType?.includes("image"))
          return <IconPhotoFilled className={`${className} text-blue-500`} />;
        if (mimeType?.includes("video"))
          return <IconVideoFilled className={`${className} text-purple-500`} />;
        if (mimeType?.includes("audio"))
          return <IconMusic className={`${className} text-emerald-500`} />;
        return (
          <IconFileDescriptionFilled
            className={`${className} text-amber-500`}
          />
        );
      },
      [],
    );

    const currentFolders = useMemo(() => {
      return folders.filter((f) => (f.parent_id || 0) === currentFolderId);
    }, [folders, currentFolderId]);

    const currentFiles = useMemo(() => {
      return allFiles; // Now already filtered by store
    }, [allFiles]);

    const displayItems = useMemo(() => {
      const items = [
        ...currentFolders.map((f) => ({ ...f, isFolder: true })),
        ...currentFiles.map((f) => ({ ...f, isFolder: false })),
      ];

      if (currentFolderId !== 0) {
        items.unshift({
          id: -1,
          name: "..",
          isFolder: true,
          isBack: true,
        } as any);
      }

      return items;
    }, [currentFolders, currentFiles, currentFolderId]);

    const handleFolderClick = (folderId: number) => {
      if (folderId === -1) {
        const currentFolder = folders.find((f) => f.id === currentFolderId);
        setCurrentFolderId(currentFolder?.parent_id || 0);
      } else {
        setCurrentFolderId(folderId);
      }
    };
    const handleNewFolder = async () => {
      if (!newFolderName.trim()) return;
      setIsFolderLoading(true);
      const res = await createFolder(
        newFolderName,
        currentFolderId === 0 ? undefined : currentFolderId,
      );
      setIsFolderLoading(false);
      if (res.success) {
        toast.success("Folder created");
        setIsNewFolderOpen(false);
        setNewFolderName("");
        fetchFolders();
      } else {
        toast.danger(res.message || "Failed to create folder");
      }
    };

    const handleBulkDelete = async () => {
      if (selectedKeys === "all") {
        toast.warning("Bulk delete for 'all' not implemented for safety");
        return;
      }
      const ids = Array.from(selectedKeys as Set<string | number>);
      if (ids.length === 0) return;

      if (confirm(`Delete ${ids.length} items?`)) {
        setIsActionLoading(true);
        let successCount = 0;
        for (const id of ids) {
          const file = allFiles.find((f) => f.id === id);
          if (file) {
            const res = await deleteFiles([file.id], file.folder_id);
            if (res.success) successCount++;
          }
        }
        setIsActionLoading(false);
        toast.success(`Deleted ${successCount} files`);
        setSelectedKeys(new Set());
        fetchData();
      }
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground/80">
              {currentFolderId === 0
                ? "All Files"
                : folders.find((f) => f.id === currentFolderId)?.name ||
                  "Folder"}
            </h3>
            {selectedKeys !== "all" && selectedKeys.size > 0 && (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-1">
                <Separator orientation="vertical" className="h-4 mx-2" />
                <Button
                  size="sm"
                  variant="danger"
                  className="h-8"
                  onPress={handleBulkDelete}
                >
                  <IconTrash className="size-4 mr-1" />
                  Delete {selectedKeys.size}
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  className="h-8"
                  onPress={() => setSelectedKeys(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-9"
              onPress={() => setIsNewFolderOpen(true)}
            >
              <IconPlus className="size-4 mr-2" />
              New Folder
            </Button>
            <div className="flex items-center gap-1 bg-surface-tertiary p-1 rounded-xl border border-white/5">
              <Button
                isIconOnly
                size="sm"
                variant={viewMode === "table" ? "primary" : "tertiary"}
                className="rounded-lg"
                onPress={() => setViewMode("table")}
              >
                <IconList className="size-4" />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant={viewMode === "grid" ? "primary" : "tertiary"}
                className="rounded-lg"
                onPress={() => setViewMode("grid")}
              >
                <IconLayoutGrid className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {isLoading && isFirstLoad.current ? (
          <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4">
            <Spinner size="lg" />
            <span className="text-sm text-muted animate-pulse">
              Loading your files...
            </span>
          </div>
        ) : viewMode === "table" ? (
          <Virtualizer
            layout={TableLayout}
            layoutOptions={{
              headingHeight: 42,
              rowHeight: 42,
            }}
          >
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Files list"
                  className="h-[500px] min-w-[700px] overflow-auto rounded-2xl"
                  selectedKeys={selectedKeys}
                  selectionMode="multiple"
                  onSelectionChange={setSelectedKeys}
                >
                  <Table.Header className="h-full w-full">
                    <Table.Column className="pr-0" width={40}>
                      <Checkbox aria-label="Select all" slot="selection">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox>
                    </Table.Column>
                    <Table.Column isRowHeader id="name" minWidth={240}>
                      Name
                    </Table.Column>
                    <Table.Column id="type" width={200}>
                      Type
                    </Table.Column>
                    <Table.Column id="size" width={200}>
                      Size
                    </Table.Column>
                    <Table.Column id="date" width={300}>
                      Uploaded at
                    </Table.Column>
                    <Table.Column id="actions" width={50}>
                      Actions
                    </Table.Column>
                  </Table.Header>
                  <Table.Body
                    items={displayItems.slice(0, displayLimit)}
                    renderEmptyState={() => (
                      <EmptyState className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                        <IconArchiveFilled className="size-10" />
                        <span className="text-sm text-muted">
                          No files found
                        </span>
                      </EmptyState>
                    )}
                  >
                    {(item: any) => (
                      <Table.Row
                        key={
                          item.isFolder
                            ? `folder-${item.id}`
                            : `file-${item.id}`
                        }
                        id={item.id}
                      >
                        <Table.Cell className="pr-0">
                          {!item.isBack && (
                            <Checkbox
                              aria-label={`Select ${item.name}`}
                              slot="selection"
                              variant="secondary"
                            >
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox>
                          )}
                        </Table.Cell>
                        <Table.Cell
                          className="flex items-center gap-2 hover:underline cursor-pointer"
                          onClick={() => {
                            if (item.isFolder) {
                              handleFolderClick(item.id);
                            } else {
                              handleCellClick(item);
                            }
                          }}
                        >
                          {item.isFolder ? (
                            <IconFolder className="size-4 text-blue-500 shrink-0" />
                          ) : (
                            getFileIcon(item.mime_type)
                          )}
                          <span className="truncate font-medium">
                            {item.name}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="uppercase text-muted text-[10px] font-bold">
                          {item.isFolder
                            ? "Folder"
                            : item.name.split(".").pop()}
                        </Table.Cell>
                        <Table.Cell className="text-muted">
                          {item.isFolder ? "--" : formatSize(item.size)}
                        </Table.Cell>
                        <Table.Cell className="text-muted">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString()
                            : "--"}
                        </Table.Cell>
                        <Table.Cell className="p-0 flex items-center justify-center">
                          {!item.isBack && !item.isFolder && (
                            <Dropdown>
                              <Button
                                isIconOnly
                                size="sm"
                                aria-label="Menu"
                                variant="tertiary"
                              >
                                <IconDotsVertical className="size-4" />
                              </Button>
                              <Dropdown.Popover>
                                <Dropdown.Menu
                                  onAction={(key) => {
                                    if (key === "download")
                                      handleDownload(item);
                                    if (key === "share") handleShare(item);
                                    if (key === "rename")
                                      handleRenameClick(item);
                                    if (key === "delete")
                                      handleDeleteClick(item);
                                  }}
                                >
                                  <Dropdown.Section>
                                    <Header>Actions</Header>
                                    <Dropdown.Item
                                      id="download"
                                      textValue="Download"
                                    >
                                      <IconDownload className="size-4" />
                                      <Label>Download</Label>
                                    </Dropdown.Item>
                                    <Dropdown.Item id="share" textValue="Share">
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
                                  </Dropdown.Section>
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
                                </Dropdown.Menu>
                              </Dropdown.Popover>
                            </Dropdown>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Virtualizer>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {displayItems.slice(0, displayLimit).map((item: any) => (
              <GridItem
                key={item.isFolder ? `folder-${item.id}` : `file-${item.id}`}
                file={item}
                isFolder={item.isFolder}
                isBack={item.isBack}
                onClick={() => {
                  if (item.isFolder) {
                    handleFolderClick(item.id);
                  } else {
                    handleCellClick(item);
                  }
                }}
                openPreview={(f: any) => openPreview(f, allFiles)}
                handleDownload={handleDownload}
                handleShare={handleShare}
                handleRenameClick={handleRenameClick}
                handleDeleteClick={handleDeleteClick}
                formatSize={formatSize}
                getFileIcon={getFileIcon}
                sessionId={sessionId}
              />
            ))}
            {displayItems.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-center">
                <IconArchiveFilled className="size-10 text-muted/20" />
                <span className="text-sm text-muted">No items found</span>
              </div>
            )}
          </div>
        )}

        <FileActionModals
          selectedFile={selectedFile}
          isRenameOpen={isRenameOpen}
          setIsRenameOpen={setIsRenameOpen}
          isDeleteOpen={isDeleteOpen}
          setIsDeleteOpen={setIsDeleteOpen}
          onRename={renameFile}
          onDelete={deleteFiles}
        />

        {/* New Folder Modal */}
        <Modal.Backdrop
          isOpen={isNewFolderOpen}
          onOpenChange={setIsNewFolderOpen}
        >
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[400px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-primary/10 text-primary">
                  <IconFolderPlus className="size-5" />
                </Modal.Icon>
                <Modal.Heading>New Folder</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-col gap-4 p-1">
                  <TextField className="w-full">
                    <Label>Folder Name</Label>
                    <InputGroup>
                      <InputGroup.Input
                        autoFocus
                        placeholder="Enter folder name..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleNewFolder();
                        }}
                      />
                    </InputGroup>
                  </TextField>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="tertiary"
                  onPress={() => setIsNewFolderOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  isPending={isFolderLoading}
                  variant="primary"
                  onPress={handleNewFolder}
                >
                  Create Folder
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </div>
    );
  },
);

export default FileBrowser;
