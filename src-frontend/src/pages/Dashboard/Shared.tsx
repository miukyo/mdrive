import { useEffect, useReducer, useMemo } from "react";
import { Button, toast, Spinner, Tooltip, Modal } from "@heroui/react";
import {
  IconEye,
  IconEyeOff,
  IconPhotoFilled,
  IconVideoFilled,
  IconMusic,
  IconFileDescriptionFilled,
  IconTrash,
  IconCopy,
  IconShare,
  IconFolder,
  IconFileDescription,
} from "@tabler/icons-react";
import { useShareStore } from "../../stores/Share.store";
import { useIndexStore } from "../../stores/Index.store";
import { useFolderStore } from "../../stores/Folder.store";
import { usePreviewStore } from "../../stores/Preview.store";
import { getFileIcon } from "../../components/file-browser/utils";

type State = {
  shares: any[];
  isLoading: boolean;
  isDeleteOpen: boolean;
  selectedShare: any;
  isActionLoading: boolean;
};

type Action =
  | { type: "SET_SHARES"; payload: any[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "OPEN_DELETE"; payload: any }
  | { type: "CLOSE_DELETE" }
  | { type: "SET_ACTION_LOADING"; payload: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_SHARES":
      return { ...state, shares: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "OPEN_DELETE":
      return { ...state, isDeleteOpen: true, selectedShare: action.payload };
    case "CLOSE_DELETE":
      return { ...state, isDeleteOpen: false, selectedShare: null };
    case "SET_ACTION_LOADING":
      return { ...state, isActionLoading: action.payload };
    default:
      return state;
  }
}

export default function Shared() {
  const { getShares, deleteShare, toggleShare } = useShareStore();
  const { files, fetchData: fetchFiles } = useIndexStore();
  const { folders, fetchFolders } = useFolderStore();
  const { open: openPreview } = usePreviewStore();

  const [state, dispatch] = useReducer(reducer, {
    shares: [],
    isLoading: true,
    isDeleteOpen: false,
    selectedShare: null,
    isActionLoading: false,
  });

  const { shares, isLoading, isDeleteOpen, selectedShare, isActionLoading } =
    state;

  const refreshShares = async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    const res = await getShares();
    if (res.success) {
      dispatch({ type: "SET_SHARES", payload: res.data });
    } else {
      toast.danger(res.message || "Failed to fetch shares");
    }
    dispatch({ type: "SET_LOADING", payload: false });
  };

  useEffect(() => {
    refreshShares();
    fetchFiles();
    fetchFolders();
  }, []);

  const shareData = useMemo(() => {
    return shares.map((share) => {
      let name = "Unknown";
      let icon = <IconFileDescription className="size-4" />;
      const publicUrl = `${window.location.origin}/share/${share.token}`;

      if (share.share_type === "folder") {
        const folder = folders.find((f) => f.id === share.folder_id);
        name = folder ? folder.name : `Folder #${share.folder_id}`;
        icon = <IconFolder className="size-4 text-blue-500" />;
      } else {
        const file = files.find((f) => f.id === share.message_id);
        name = file ? file.name : `File #${share.message_id}`;
        icon = getFileIcon(file?.mime_type);
        return {
          ...share,
          id: share.token,
          name,
          icon,
          publicUrl,
          file,
        };
      }

      return {
        ...share,
        id: share.token,
        name,
        icon,
        publicUrl,
      };
    });
  }, [shares, files, folders]);

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const handleDelete = (share: any) => {
    dispatch({ type: "OPEN_DELETE", payload: share });
  };

  const confirmDelete = async () => {
    if (!selectedShare) return;
    dispatch({ type: "SET_ACTION_LOADING", payload: true });
    const res = await deleteShare(selectedShare.token);
    dispatch({ type: "SET_ACTION_LOADING", payload: false });
    if (res.success) {
      toast.success("Share deleted");
      dispatch({ type: "CLOSE_DELETE" });
      refreshShares();
    } else {
      toast.danger(res.message || "Failed to delete share");
    }
  };

  const handleToggle = async (token: string) => {
    const res = await toggleShare(token);
    if (res.success) {
      toast.success("Share status updated");
      refreshShares();
    } else {
      toast.danger(res.message || "Failed to update share");
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Shared Links</h1>
        <p className="text-muted text-sm font-medium">
          Manage your public share links
        </p>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : shareData.length === 0 ? (
          <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-8 rounded-full bg-white/5">
              <IconShare className="size-12 text-muted/20" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold text-foreground/80">
                No Shared Links
              </span>
              <span className="text-sm text-muted">
                You haven't created any public links yet
              </span>
            </div>
          </div>
        ) : (
          <div className="file-table flex flex-col border border-white/5 rounded-3xl overflow-hidden bg-surface/50 backdrop-blur-md">
            <div className="shared-table-header min-w-[700px] shrink-0">
              <div>Name</div>
              <div>Type</div>
              <div>Shared at</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="overflow-y-auto h-[calc(100vh-205px)] min-w-[700px]">
              <div className="flex flex-col">
                {shareData.map((item: any) => (
                  <div
                    key={item.token}
                    role="button"
                    tabIndex={0}
                    className="shared-table-row"
                    onClick={(e) => {
                      if (
                        (e.target as HTMLElement).closest(".stop-propagation")
                      )
                        return;
                      if (item.share_type === "file" && item.file) {
                        openPreview(item.file, [item.file]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        if (item.share_type === "file" && item.file) {
                          openPreview(item.file, [item.file]);
                        }
                      }
                    }}
                  >
                    <div className="shared-table-cell font-medium text-foreground">
                      <div className="p-2 rounded-xl bg-white/5 shrink-0">
                        {item.icon}
                      </div>
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="shared-table-cell uppercase text-xs font-bold text-muted tracking-tight">
                      {item.share_type}
                    </div>
                    <div
                      className="shared-table-cell text-muted"
                      suppressHydrationWarning
                    >
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                    <div className="shared-table-cell">
                      <Tooltip>
                        <Tooltip.Content>
                          <p>{item.is_active ? "Public" : "Private"}</p>
                        </Tooltip.Content>
                        <Tooltip.Trigger>
                          <span
                            role="button"
                            tabIndex={0}
                            className={`stop-propagation flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              item.is_active
                                ? "bg-success/10 text-success hover:bg-success/20"
                                : "bg-danger/10 text-danger hover:bg-danger/20"
                            } cursor-pointer`}
                            onClick={() => handleToggle(item.token)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                handleToggle(item.token);
                              }
                            }}
                          >
                            {item.is_active ? (
                              <>
                                <IconEye className="size-3.5" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <IconEyeOff className="size-3.5" />
                                <span>Private</span>
                              </>
                            )}
                          </span>
                        </Tooltip.Trigger>
                      </Tooltip>
                    </div>
                    <div className="shared-table-cell actions stop-propagation">
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <Tooltip.Content>
                            <p>Copy Public Link</p>
                          </Tooltip.Content>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="tertiary"
                            className="size-8 rounded-lg"
                            onPress={() => handleCopyLink(item.publicUrl)}
                          >
                            <IconCopy className="size-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip>
                          <Tooltip.Content>
                            <p>Delete Share</p>
                          </Tooltip.Content>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="tertiary"
                            className="size-8 rounded-lg text-danger hover:bg-danger/10"
                            onPress={() => handleDelete(item)}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      <Modal.Backdrop
        isOpen={isDeleteOpen}
        onOpenChange={(open) => !open && dispatch({ type: "CLOSE_DELETE" })}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-danger/10 text-danger">
                <IconTrash className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Are you sure?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex items-start gap-4 py-2">
                <p className="text-sm text-muted leading-relaxed">
                  This will permanently delete the share link for{" "}
                  <span className="font-medium text-foreground">
                    "{selectedShare?.name}"
                  </span>
                  . It will stop working immediately. This action cannot be
                  undone.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="tertiary"
                onPress={() => dispatch({ type: "CLOSE_DELETE" })}
              >
                Cancel
              </Button>
              <Button
                isPending={isActionLoading}
                variant="danger"
                onPress={confirmDelete}
              >
                Delete Link
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
