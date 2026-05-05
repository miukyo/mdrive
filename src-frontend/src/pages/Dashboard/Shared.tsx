import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Surface,
  Button,
  toast,
  Switch,
  Spinner,
  Tooltip,
  Virtualizer,
  TableLayout,
  Modal,
} from "@heroui/react";
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

export default function Shared() {
  const { getShares, deleteShare, toggleShare } = useShareStore();
  const { files, fetchData: fetchFiles } = useIndexStore();
  const { folders, fetchFolders } = useFolderStore();
  const { open: openPreview } = usePreviewStore();

  const getFileIcon = (mimeType: string, className = "size-4 shrink-0") => {
    if (mimeType?.includes("image"))
      return <IconPhotoFilled className={`${className} text-blue-500`} />;
    if (mimeType?.includes("video"))
      return <IconVideoFilled className={`${className} text-purple-500`} />;
    if (mimeType?.includes("audio"))
      return <IconMusic className={`${className} text-emerald-500`} />;
    return (
      <IconFileDescriptionFilled className={`${className} text-amber-500`} />
    );
  };

  const [shares, setShares] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState<any>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const refreshShares = async () => {
    setIsLoading(true);
    const res = await getShares();
    if (res.success) {
      setShares(res.data);
    } else {
      toast.danger(res.message || "Failed to fetch shares");
    }
    setIsLoading(false);
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
    setSelectedShare(share);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedShare) return;
    setIsActionLoading(true);
    const res = await deleteShare(selectedShare.token);
    setIsActionLoading(false);
    if (res.success) {
      toast.success("Share deleted");
      setIsDeleteOpen(false);
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
    <div className="flex flex-col gap-6 p-4 md:p-8 h-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Shared Links</h1>
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
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
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
          <Virtualizer
            layout={TableLayout}
            layoutOptions={{
              headingHeight: 42,
              rowHeight: 52,
            }}
          >
            <Table aria-label="Shared links table" className="flex-1">
              <Table.ScrollContainer>
                <Table.Content className="min-w-[700px]">
                  <Table.Header>
                    <Table.Column id="name" minWidth={300} isRowHeader>
                      Name
                    </Table.Column>
                    <Table.Column id="type" width={100}>
                      Type
                    </Table.Column>
                    <Table.Column id="date" width={150}>
                      Shared at
                    </Table.Column>
                    <Table.Column id="status" width={150}>
                      Status
                    </Table.Column>
                    <Table.Column id="actions" width={100}>
                      Actions
                    </Table.Column>
                  </Table.Header>
                  <Table.Body items={shareData}>
                    {(item) => (
                      <Table.Row key={item.token}>
                        <Table.Cell
                          className="hover:underline cursor-pointer"
                          onClick={() => {
                            if (item.share_type === "file" && item.file) {
                              openPreview(item.file, [item.file]);
                            }
                          }}
                        >
                          <div className={`flex items-center gap-3`}>
                            <div className="p-2 rounded-xl bg-white/5">
                              {item.icon}
                            </div>
                            <span className="font-medium truncate">
                              {item.name}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="uppercase">
                          {item.share_type}
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-muted">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <Tooltip>
                            <Tooltip.Content>
                              <p>{item.is_active ? "Public" : "Private"}</p>
                            </Tooltip.Content>
                            <Tooltip.Trigger>
                              <span
                                className={` ${
                                  item.is_active
                                    ? "text-success"
                                    : "text-danger"
                                } cursor-pointer`}
                                onClick={() => handleToggle(item.token)}
                              >
                                {item.is_active ? <IconEye /> : <IconEyeOff />}
                              </span>
                            </Tooltip.Trigger>
                          </Tooltip>
                        </Table.Cell>
                        <Table.Cell className="p-0 flex items-center justify-center">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <Tooltip.Content>
                                <p>Copy Public Link</p>
                              </Tooltip.Content>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="tertiary"
                                className="size-8"
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
                                className="size-8 text-danger hover:bg-danger/10"
                                onPress={() => handleDelete(item)}
                              >
                                <IconTrash className="size-4" />
                              </Button>
                            </Tooltip>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Virtualizer>
        )}
      </div>

      {/* Delete Modal */}
      <Modal.Backdrop isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
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
              <Button variant="tertiary" onPress={() => setIsDeleteOpen(false)}>
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
