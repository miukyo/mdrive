import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Label,
  toast,
  TextField,
  InputGroup,
  Description,
} from "@heroui/react";
import {
  IconEdit,
  IconTrash,
  IconAlertTriangleFilled,
} from "@tabler/icons-react";

interface FileActionModalsProps {
  selectedFile: any;
  isRenameOpen: boolean;
  setIsRenameOpen: (open: boolean) => void;
  isDeleteOpen: boolean;
  setIsDeleteOpen: (open: boolean) => void;
  onRename: (
    id: number,
    newName: string,
    folderId: number | null,
  ) => Promise<{ success: boolean; message?: string }>;
  onDelete: (
    ids: number[],
    folderId: number | null,
  ) => Promise<{ success: boolean; message?: string }>;
}

export const FileActionModals = ({
  selectedFile,
  isRenameOpen,
  setIsRenameOpen,
  isDeleteOpen,
  setIsDeleteOpen,
  onRename,
  onDelete,
}: FileActionModalsProps) => {
  const [newName, setNewName] = useState("");
  const [extension, setExtension] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (selectedFile) {
      const lastDot = selectedFile.name.lastIndexOf(".");
      if (lastDot > 0 && lastDot < selectedFile.name.length - 1) {
        setNewName(selectedFile.name.substring(0, lastDot));
        setExtension(selectedFile.name.substring(lastDot));
      } else {
        setNewName(selectedFile.name);
        setExtension("");
      }
    }
  }, [selectedFile]);

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
    const res = await onDelete([selectedFile.id], selectedFile.folder_id);
    setIsActionLoading(false);

    if (res.success) {
      toast.success("File deleted");
      setIsDeleteOpen(false);
    } else {
      toast.danger(res.message || "Failed to delete file");
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
                    autoFocus
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
              <Button isPending={isActionLoading} onPress={confirmRename}>
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
                isPending={isActionLoading}
                variant="danger"
                onPress={confirmDelete}
              >
                Delete
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
};
