import React, { useState } from "react";
import { Modal, Button, toast, InputGroup } from "@heroui/react";
import { IconEdit, IconFolderPlus, IconTrash } from "@tabler/icons-react";

interface FileActionModalsProps {
  selectedFile: any;
  isRenameOpen: boolean;
  setIsRenameOpen: (open: boolean) => void;
  isDeleteOpen: boolean;
  setIsDeleteOpen: (open: boolean) => void;
  isNewFolderOpen?: boolean;
  setIsNewFolderOpen?: (open: boolean) => void;
  isBulkDeleteOpen?: boolean;
  setIsBulkDeleteOpen?: (open: boolean) => void;
  onRename: (
    id: number,
    newName: string,
    folderId?: number,
  ) => Promise<{ success: boolean; message?: string }>;
  onDelete: (ids: number[]) => Promise<{ success: boolean; message?: string }>;
  onNewFolder?: (
    name: string,
  ) => Promise<{ success: boolean; message?: string }>;
  onBulkDelete?: () => Promise<void>;
  isActionLoading?: boolean;
}

export const FileActionModals = ({
  selectedFile,
  isRenameOpen,
  setIsRenameOpen,
  isDeleteOpen,
  setIsDeleteOpen,
  isNewFolderOpen = false,
  setIsNewFolderOpen = () => {},
  isBulkDeleteOpen = false,
  setIsBulkDeleteOpen = () => {},
  onRename,
  onDelete,
  onNewFolder,
  onBulkDelete,
  isActionLoading: externalLoading = false,
}: FileActionModalsProps) => {
  const [newName, setNewName] = useState("");
  const [extension, setExtension] = useState("");
  const [folderName, setFolderName] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  React.useEffect(() => {
    if (isRenameOpen && selectedFile) {
      if (selectedFile.isFolder) {
        setNewName(selectedFile.name);
        setExtension("");
      } else {
        const lastDot = selectedFile.name.lastIndexOf(".");
        if (lastDot > 0 && lastDot < selectedFile.name.length - 1) {
          setNewName(selectedFile.name.substring(0, lastDot));
          setExtension(selectedFile.name.substring(lastDot));
        } else {
          setNewName(selectedFile.name);
          setExtension("");
        }
      }
    }
  }, [isRenameOpen, selectedFile]);

  const isLoading = isActionLoading || externalLoading;

  const confirmRename = async () => {
    if (!selectedFile || !newName) {
      setIsRenameOpen(false);
      return;
    }
    const finalName = newName + extension;
    if (finalName === selectedFile.name) {
      setIsRenameOpen(false);
      return;
    }
    setIsActionLoading(true);
    const res = await onRename(
      selectedFile.id,
      finalName,
      selectedFile.folder_id,
    );
    setIsActionLoading(false);
    if (res.success) {
      toast.success("File renamed successfully");
      setIsRenameOpen(false);
    } else {
      toast.danger(res.message || "Failed to rename file");
    }
  };

  const confirmDelete = async () => {
    if (!selectedFile) return;
    setIsActionLoading(true);
    const res = await onDelete([selectedFile.id]);
    setIsActionLoading(false);
    if (res.success) {
      toast.danger("File deleted");
      setIsDeleteOpen(false);
    } else {
      toast.danger(res.message || "Failed to delete file");
    }
  };

  const confirmNewFolder = async () => {
    if (!folderName.trim() || !onNewFolder) return;
    setIsActionLoading(true);
    const res = await onNewFolder(folderName);
    setIsActionLoading(false);
    if (res.success) {
      setFolderName("");
      setIsNewFolderOpen(false);
    }
  };

  return (
    <>
      {/* Rename Modal */}
      <Modal.Backdrop isOpen={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent/10 text-primary">
                <IconEdit className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Rename File</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-4 p-1">
                <InputGroup variant="secondary">
                  <InputGroup.Input
                    placeholder="Enter new file name..."
                    className="w-full"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename();
                    }}
                  />
                  {extension && (
                    <InputGroup.Suffix>{extension}</InputGroup.Suffix>
                  )}
                </InputGroup>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setIsRenameOpen(false)}>
                Cancel
              </Button>
              <Button isPending={isLoading} onPress={confirmRename}>
                Save Changes
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

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
                  This will permanently delete{" "}
                  <span className="font-medium text-foreground">
                    "{selectedFile?.name}"
                  </span>{" "}
                  from your drive. This action cannot be undone.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                isPending={isLoading}
                variant="danger"
                onPress={confirmDelete}
              >
                Delete
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* New Folder Modal */}
      <Modal.Backdrop
        isOpen={isNewFolderOpen}
        onOpenChange={setIsNewFolderOpen}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent/10 text-primary">
                <IconFolderPlus className="size-5" />
              </Modal.Icon>
              <Modal.Heading>New Folder</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-4 p-1">
                <InputGroup variant="secondary">
                  <InputGroup.Input
                    placeholder="Enter folder name..."
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmNewFolder();
                    }}
                  />
                </InputGroup>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="tertiary"
                onPress={() => setIsNewFolderOpen(false)}
              >
                Cancel
              </Button>
              <Button isPending={isLoading} onPress={confirmNewFolder}>
                Create Folder
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Bulk Delete Modal */}
      <Modal.Backdrop
        isOpen={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-danger/10 text-danger">
                <IconTrash className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Bulk Delete</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-2">
                <p className="text-sm">
                  Are you sure you want to delete these items?
                </p>
                <p className="text-xs text-muted">
                  This will permanently remove them from your drive and
                  Telegram.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="tertiary"
                onPress={() => setIsBulkDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                isPending={isLoading}
                variant="danger"
                onPress={onBulkDelete}
              >
                Delete Items
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
};
