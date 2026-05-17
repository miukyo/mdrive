import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Selection, toast, Spinner } from "@heroui/react";
import { IconFolderSymlink, IconPlus, IconFolder } from "@tabler/icons-react";
import { useAuthStore } from "../stores/Auth.store";
import { useFilesStore } from "../stores/Files.store";
import { useIndexStore } from "../stores/Index.store";
import { usePreviewStore } from "../stores/Preview.store";
import { useFolderStore } from "../stores/Folder.store";
import { FileActionModals } from "./FileActionModals";

// Sub-components
import { Toolbar } from "./file-browser/Toolbar";
import { GridView } from "./file-browser/GridView";
import { TableView } from "./file-browser/TableView";

interface FileBrowserProps {
  files?: any[];
  folders?: any[];
  mode?: "admin" | "readonly";
  shareToken?: string;
  onFolderClick?: (id: number) => void;
  onFileClick?: (file: any) => void;
  isLoading?: boolean;
  isRoot?: boolean;
  height?: string;
}

const FileBrowser = React.memo(
  ({
    files: propsFiles,
    folders: propsFolders,
    mode = "admin",
    shareToken,
    onFolderClick,
    onFileClick,
    isLoading: propsIsLoading,
    isRoot = true,
    height = "100%",
  }: FileBrowserProps) => {
    const [viewMode, setViewMode] = useState<"table" | "grid">(
      mode === "admin" ? "grid" : "table",
    );
    const isAdmin = mode === "admin";

    // Stores (only used in admin mode)
    const filesStore = useFilesStore();
    const indexStore = useIndexStore();
    const authStore = useAuthStore();
    const folderStore = useFolderStore();
    const previewStore = usePreviewStore();

    const [localFolderId, setLocalFolderId] = useState<number>(0);
    const [localSelectedKeys, setLocalSelectedKeys] = useState<Selection>(
      new Set(),
    );

    const currentFolderId = isAdmin
      ? indexStore.currentFolderId
      : localFolderId;
    const setCurrentFolderId = isAdmin
      ? indexStore.setCurrentFolderId
      : setLocalFolderId;

    const selectedKeys = isAdmin ? indexStore.selectedKeys : localSelectedKeys;
    const setSelectedKeys = isAdmin
      ? indexStore.setSelectedKeys
      : setLocalSelectedKeys;

    const sessionId = isAdmin ? authStore.sessionId : null;

    const folders = isAdmin ? folderStore.folders : propsFolders || [];
    const allFiles = isAdmin ? indexStore.files : propsFiles || [];
    const isLoading = isAdmin ? indexStore.isLoading : propsIsLoading;

    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const lastSelectedId = useRef<any>(null);
    const [selectedFile, setSelectedFile] = useState<any>(null);
    const [displayLimit, setDisplayLimit] = useState(24);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);
    const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [movingItems, setMovingItems] = useState<number[]>([]);
    const [isPending, startTransition] = React.useTransition();
    const isFirstLoad = useRef(true);

    const onDragEnter = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const onDrop = useCallback(
      async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          if (!isAdmin) {
            toast.warning("Upload is disabled in readonly mode");
            return;
          }
          // toast.info(`Uploading ${files.length} files...`);
          const res = await filesStore.uploadFiles(
            files,
            currentFolderId || undefined,
          );
          if (!res.success) {
            toast.danger(res.message || "Upload failed");
          }
        }
      },
      [currentFolderId, filesStore, isAdmin],
    );

    useEffect(() => {
      if (isAdmin) {
        folderStore.fetchFolders();
      }
    }, [isAdmin]);

    useEffect(() => {
      if (isAdmin) {
        startTransition(() => {
          indexStore.fetchFolderContents(currentFolderId).then(() => {
            isFirstLoad.current = false;
          });
        });
      }
    }, [currentFolderId, isAdmin]);

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

    const confirmBulkMoveRef = useRef<() => void>(undefined);
    const cancelMoveRef = useRef<() => void>(undefined);

    useEffect(() => {
      confirmBulkMoveRef.current = confirmBulkMove;
      cancelMoveRef.current = cancelMove;
    });

    useEffect(() => {
      if (isMoving && movingItems.length > 0) {
        toast("Moving items", {
          actionProps: {
            children: "Move Here",
            onPress: () => {
              confirmBulkMoveRef.current?.();
              toast.clear();
            },
            variant: "primary",
          },
          description: `Navigate to target folder to move ${movingItems.length} items`,
          indicator: <IconFolderSymlink className="size-4" />,
          variant: "default",
          onClose: () => {
            cancelMoveRef.current?.();
          },
          timeout: 0,
        });
      }
    }, [isMoving, movingItems.length]);

    const API_BASE_URL = import.meta.env.DEV
      ? "http://localhost:3000/api"
      : "/api";

    const handleDownload = useCallback(
      async (item: any) => {
        if (item.isFolder) {
          if (isAdmin) {
            const zipUrl = `${API_BASE_URL}/stream/zip?folder_id=${item.id}&session_id=${sessionId}`;
            window.open(zipUrl, "_blank");
          } else if (shareToken) {
            const zipUrl = `${API_BASE_URL}/stream/zip?share_token=${shareToken}&folder_id=${item.id}`;
            window.open(zipUrl, "_blank");
          }
        } else {
          let url = "";
          if (isAdmin) {
            url = `${API_BASE_URL}/stream?message_id=${item.id}${item.folder_id ? `&folder_id=${item.folder_id}` : ""}&download=1&session_id=${sessionId}`;
          } else if (shareToken) {
            url = `${API_BASE_URL}/stream?share_token=${shareToken}&message_id=${item.id}${item.folder_id ? `&folder_id=${item.folder_id}` : ""}&download=1`;
          }
          if (url) window.open(url, "_blank");
        }
      },
      [sessionId, isAdmin, shareToken, API_BASE_URL, filesStore],
    );

    const handleShare = useCallback(
      async (item: any) => {
        if (!isAdmin) return;
        const res = item.isFolder
          ? await filesStore.shareFile(0, item.id)
          : await filesStore.shareFile(item.id, item.folder_id);

        if (res.success && res.url) {
          navigator.clipboard.writeText(res.url);
          toast.success("Share link copied to clipboard!");
        } else {
          toast.danger(res.message || "Failed to create share link");
        }
      },
      [isAdmin, filesStore],
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
        if (!isAdmin && onFileClick) {
          onFileClick(file);
          return;
        }
        previewStore.open(file, allFiles);
      },
      [previewStore, allFiles, isAdmin, onFileClick],
    );

    const handleFolderClick = useCallback(
      (folderId: number) => {
        setSelectedKeys(new Set()); // Clear selection when changing folders
        if (!isAdmin) {
          onFolderClick?.(folderId);
          return;
        }

        if (folderId === -1) {
          const currentFolder = folders.find((f) => f.id === currentFolderId);
          setCurrentFolderId(currentFolder?.parent_id || 0);
        } else {
          setCurrentFolderId(folderId);
        }
      },
      [folders, currentFolderId, isAdmin, onFolderClick, setCurrentFolderId],
    );

    const currentFolders = useMemo(() => {
      if (!isAdmin) return folders.map((f) => ({ ...f, isFolder: true }));
      return folders.filter((f) => (f.parent_id || 0) === currentFolderId);
    }, [folders, currentFolderId, isAdmin]);

    const currentFiles = useMemo(() => {
      if (!isAdmin) return allFiles.map((f) => ({ ...f, isFolder: false }));
      return allFiles.filter(
        (f) => (f.folder_id || 0) === (currentFolderId || 0),
      );
    }, [allFiles, currentFolderId, isAdmin]);

    const displayItems = useMemo(() => {
      const items = [
        ...currentFolders.map((f) => ({ ...f, isFolder: true })),
        ...currentFiles.map((f) => ({ ...f, isFolder: false })),
      ];

      if (isAdmin ? currentFolderId !== 0 : !isRoot) {
        items.unshift({
          id: -1,
          name: "..",
          isFolder: true,
          isBack: true,
        } as any);
      }

      return items;
    }, [currentFolders, currentFiles, currentFolderId, isAdmin, isRoot]);

    const handleItemClick = useCallback(
      (e: React.MouseEvent, item: any) => {
        if ((e.target as HTMLElement).closest(".stop-propagation")) return;

        const hasModifier = e.shiftKey || e.ctrlKey || e.metaKey;
        if (hasModifier && !isAdmin) return; // Don't open or select in readonly if modifier is held
        if (isAdmin && e.shiftKey) {
          if (lastSelectedId.current === null) {
            // No anchor yet, just select this item and make it the anchor
            const newKeys = new Set(
              selectedKeys === "all" ? [] : (selectedKeys as Set<any>),
            );
            newKeys.add(item.id);
            setSelectedKeys(newKeys);
            lastSelectedId.current = item.id;
            return;
          }

          const currentIndex = displayItems.findIndex(
            (i: any) => i.id === item.id,
          );
          const lastIndex = displayItems.findIndex(
            (i: any) => i.id === lastSelectedId.current,
          );

          if (currentIndex !== -1 && lastIndex !== -1) {
            const start = Math.min(currentIndex, lastIndex);
            const end = Math.max(currentIndex, lastIndex);
            const rangeIds = displayItems
              .slice(start, end + 1)
              .map((i: any) => i.id);

            const newKeys = new Set(
              selectedKeys === "all" ? [] : (selectedKeys as Set<any>),
            );
            const currentSelected =
              selectedKeys instanceof Set ? selectedKeys : new Set();
            const isUnselecting = currentSelected.has(item.id);

            rangeIds.forEach((id) => {
              if (id === -1) return;
              if (isUnselecting) {
                newKeys.delete(id);
              } else {
                newKeys.add(id);
              }
            });
            setSelectedKeys(newKeys);
            lastSelectedId.current = item.id;
            return;
          }
        }

        if (isAdmin && (e.ctrlKey || e.metaKey)) {
          const newKeys = new Set(
            selectedKeys === "all" ? [] : (selectedKeys as Set<any>),
          );
          if (newKeys.has(item.id)) {
            newKeys.delete(item.id);
          } else {
            newKeys.add(item.id);
            lastSelectedId.current = item.id;
          }
          setSelectedKeys(newKeys);
          return;
        }

        // Single Click (no modifiers or in readonly): Open
        if (hasModifier) return; // Final safeguard: don't open if any modifier is held

        if (item.isFolder || item.isBack) {
          handleFolderClick(item.id);
        } else {
          handleCellClick(item);
        }
        // Update last selected for potential shift-click next
        lastSelectedId.current = item.id;
      },
      [
        isAdmin,
        selectedKeys,
        displayItems,
        handleFolderClick,
        handleCellClick,
        setSelectedKeys,
      ],
    );

    const breadcrumbs = useMemo(() => {
      const path = [{ id: 0, name: "All Files" }];
      if (currentFolderId === 0) return path;

      const stack = [];
      let curr = folders.find((f) => f.id === currentFolderId);
      while (curr) {
        stack.unshift({ id: curr.id, name: curr.name });
        if (!curr.parent_id || curr.parent_id === 0) break;
        curr = folders.find((f) => f.id === curr.parent_id);
      }
      return [...path, ...stack];
    }, [folders, currentFolderId]);

    useEffect(() => {
      if (
        indexStore.isNavigatingFromSearch &&
        selectedKeys instanceof Set &&
        selectedKeys.size === 1
      ) {
        const id = Array.from(selectedKeys)[0];
        const timer = setTimeout(() => {
          const element = document.querySelector(`[data-id="${id}"]`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            indexStore.setNavigatingFromSearch(false);
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [selectedKeys, indexStore.isNavigatingFromSearch]);

    useEffect(() => {
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === "Shift") {
          lastSelectedId.current = null;
        }
      };
      window.addEventListener("keyup", handleKeyUp);
      return () => window.removeEventListener("keyup", handleKeyUp);
    }, []);

    const handleBulkDelete = useCallback(() => {
      setIsBulkDeleteOpen(true);
    }, []);

    const executeBulkDelete = async () => {
      let ids: number[] = [];
      if (selectedKeys === "all") {
        ids = displayItems.reduce((acc: number[], i: any) => {
          if (!i.isBack) acc.push(i.id);
          return acc;
        }, []);
      } else {
        ids = Array.from(selectedKeys as Set<number>);
      }

      if (ids.length === 0) return;

      setIsActionLoading(true);
      let successCount = 0;

      try {
        const foldersToDelete = displayItems.filter(
          (i: any) => ids.includes(i.id) && i.isFolder,
        );
        const filesToDelete = displayItems.filter(
          (i: any) => ids.includes(i.id) && !i.isFolder,
        );

        // Delete folders concurrently
        await Promise.all(
          foldersToDelete.map((folder: any) =>
            folderStore.deleteFolder(folder.id),
          ),
        );
        successCount += foldersToDelete.length;

        // Delete all selected files in a single batch call
        if (filesToDelete.length > 0) {
          const fileIds = filesToDelete.map((f: any) => f.id);
          const res = await filesStore.deleteFiles(fileIds);
          if (res.success) successCount += fileIds.length;
        }

        toast.danger(`Deleted ${successCount} items`);
        setSelectedKeys(new Set());
        setIsBulkDeleteOpen(false);
      } catch (error) {
        console.error("Bulk delete error:", error);
        toast.danger("An error occurred during bulk deletion");
      } finally {
        setIsActionLoading(false);
      }
    };

    const handleBulkMove = useCallback(() => {
      let ids: number[] = [];
      if (selectedKeys === "all") {
        ids = displayItems.reduce((acc: number[], i: any) => {
          if (!i.isBack) acc.push(i.id);
          return acc;
        }, []);
      } else {
        ids = Array.from(selectedKeys as Set<number>);
      }

      if (ids.length === 0) return;
      setMovingItems(ids);
      setIsMoving(true);
      setSelectedKeys(new Set());
    }, [selectedKeys, displayItems, setSelectedKeys]);

    const handleMoveSingleClick = useCallback(
      (item: any) => {
        setMovingItems([item.id]);
        setIsMoving(true);
        setSelectedKeys(new Set());
      },
      [setSelectedKeys],
    );

    const confirmBulkMove = async () => {
      setIsActionLoading(true);
      toast.info("Moving items...");
      const res = await filesStore.moveFiles(movingItems, currentFolderId);
      setIsActionLoading(false);
      if (res.success) {
        toast.success(`Moved ${movingItems.length} items`);
        setIsMoving(false);
        setMovingItems([]);
        folderStore.fetchFolders();
        indexStore.fetchData();
      } else {
        toast.danger(res.message || "Failed to move items");
      }
    };

    const cancelMove = () => {
      setIsMoving(false);
      setMovingItems([]);
    };

    const handleRefreshIndex = async () => {
      setIsActionLoading(true);
      toast.info("Refreshing index from Telegram...");
      const res = await indexStore.refreshIndex();
      if (res.success) {
        toast.success("Index refreshed successfully");
        await Promise.all([indexStore.fetchData(), folderStore.fetchFolders()]);
      } else {
        toast.danger(res.message || "Failed to refresh index");
      }
      setIsActionLoading(false);
    };

    return (
      <div
        className={`flex flex-col gap-4 relative select-none ${height}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isAdmin && isDragging && (
          <div className="absolute pointer-events-none inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl animate-in fade-in duration-200">
            <div className="bg-primary/10 p-6 rounded-full mb-4">
              <IconPlus className="size-12 text-primary animate-bounce" />
            </div>
            <h3 className="text-xl font-semibold">Drop files to upload</h3>
            <p className="text-muted text-sm mt-2">
              They will be uploaded to the current folder
            </p>
          </div>
        )}

        {isAdmin && (
          <Toolbar
            breadcrumbs={breadcrumbs}
            selectedKeys={selectedKeys}
            viewMode={viewMode}
            setViewMode={setViewMode}
            handleFolderClick={handleFolderClick}
            handleBulkMove={handleBulkMove}
            handleBulkDelete={handleBulkDelete}
            setSelectedKeys={setSelectedKeys}
            handleRefreshIndex={handleRefreshIndex}
            setIsNewFolderOpen={setIsNewFolderOpen}
            isAdmin={isAdmin}
            isActionLoading={isActionLoading}
            isLoading={isLoading || false}
          />
        )}

        {isLoading || (isPending && isFirstLoad.current) ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4">
            <Spinner size="lg" />
            <span className="text-sm text-muted animate-pulse">
              Loading your files&hellip;
            </span>
          </div>
        ) : viewMode === "table" ? (
          <TableView
            displayItems={displayItems}
            displayLimit={displayLimit}
            selectedKeys={selectedKeys}
            setSelectedKeys={setSelectedKeys}
            handleItemClick={handleItemClick}
            handleFolderClick={handleFolderClick}
            handleCellClick={handleCellClick}
            handleDownload={handleDownload}
            handleShare={handleShare}
            handleRenameClick={handleRenameClick}
            handleDeleteClick={handleDeleteClick}
            handleMoveSingleClick={handleMoveSingleClick}
            isAdmin={isAdmin}
          />
        ) : (
          <GridView
            displayItems={displayItems}
            displayLimit={displayLimit}
            selectedKeys={selectedKeys}
            setSelectedKeys={setSelectedKeys}
            handleItemClick={handleItemClick}
            handleCellClick={handleCellClick}
            handleDownload={handleDownload}
            handleShare={handleShare}
            handleRenameClick={handleRenameClick}
            handleDeleteClick={handleDeleteClick}
            handleMoveSingleClick={handleMoveSingleClick}
            sessionId={sessionId}
            shareToken={shareToken}
            isAdmin={isAdmin}
            height={height}
          />
        )}

        {isAdmin && (
          <FileActionModals
            selectedFile={selectedFile}
            isRenameOpen={isRenameOpen}
            setIsRenameOpen={setIsRenameOpen}
            isDeleteOpen={isDeleteOpen}
            setIsDeleteOpen={setIsDeleteOpen}
            isNewFolderOpen={isNewFolderOpen}
            setIsNewFolderOpen={setIsNewFolderOpen}
            isBulkDeleteOpen={isBulkDeleteOpen}
            setIsBulkDeleteOpen={setIsBulkDeleteOpen}
            isActionLoading={isActionLoading}
            onRename={async (id, name) => {
              if (selectedFile?.isFolder) {
                const res = await folderStore.renameFolder(
                  selectedFile.id,
                  name,
                );
                return res;
              }
              const res = await filesStore.renameFile(
                id,
                name,
                currentFolderId,
              );
              return res;
            }}
            onDelete={async (ids) => {
              if (selectedFile?.isFolder) {
                const res = await folderStore.deleteFolder(selectedFile.id);
                return res;
              }
              const res = await filesStore.deleteFiles(ids);
              return res;
            }}
            onNewFolder={async (name) => {
              const res = await folderStore.createFolder(
                name,
                currentFolderId === 0 ? undefined : currentFolderId,
              );
              if (res.success) {
                toast.success("Folder created");
                folderStore.fetchFolders();
              } else {
                toast.danger(res.message || "Failed to create folder");
              }
              return res;
            }}
            onBulkDelete={executeBulkDelete}
          />
        )}
      </div>
    );
  },
);

export default FileBrowser;
