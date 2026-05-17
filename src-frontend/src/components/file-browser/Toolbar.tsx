import React from "react";
import { Breadcrumbs, Button, ButtonGroup } from "@heroui/react";
import {
  IconFolder,
  IconFolderSymlink,
  IconTrash,
  IconList,
  IconLayoutGrid,
  IconRefresh,
  IconPlus,
  IconX,
  IconPointer,
  IconHandFinger,
  IconFolderPlus,
} from "@tabler/icons-react";

interface ToolbarProps {
  breadcrumbs: { id: number; name: string }[];
  selectedKeys: any;
  viewMode: "table" | "grid";
  setViewMode: (mode: "table" | "grid") => void;
  handleFolderClick: (id: number) => void;
  handleBulkMove: () => void;
  handleBulkDelete: () => void;
  setSelectedKeys: (keys: any) => void;
  handleRefreshIndex: () => void;
  setIsNewFolderOpen: (open: boolean) => void;
  isAdmin: boolean;
  isActionLoading: boolean;
  isLoading: boolean;
}

export const Toolbar = React.memo(
  ({
    breadcrumbs,
    selectedKeys,
    viewMode,
    setViewMode,
    handleFolderClick,
    handleBulkMove,
    handleBulkDelete,
    setSelectedKeys,
    handleRefreshIndex,
    setIsNewFolderOpen,
    isAdmin,
    isActionLoading,
    isLoading,
  }: ToolbarProps) => {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Breadcrumbs onAction={(key) => handleFolderClick(Number(key))}>
            {breadcrumbs.map((b, i) => (
              <Breadcrumbs.Item key={b.id} id={b.id.toString()}>
                {i === 0 && <IconFolder className="size-4 mr-2 inline" />}
                {b.name}
              </Breadcrumbs.Item>
            ))}
          </Breadcrumbs>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end overflow-x-auto no-scrollbar py-0.5">
          {selectedKeys !== "all" && selectedKeys.size > 0 && (
            <>
              <Button variant="tertiary">
                <IconHandFinger />
                {selectedKeys.size} Selected
              </Button>
              <ButtonGroup>
                <Button
                  variant="tertiary"
                  className="text-success"
                  onPress={handleBulkMove}
                >
                  <IconFolderSymlink />
                  Move
                </Button>
                <Button
                  variant="tertiary"
                  className="text-danger"
                  onPress={handleBulkDelete}
                >
                  <ButtonGroup.Separator className="text-foreground" />
                  <IconTrash />
                  Delete
                </Button>
                <Button
                  variant="tertiary"
                  onPress={() => setSelectedKeys(new Set())}
                >
                  <ButtonGroup.Separator className="text-foreground" />
                  <IconX />
                  Clear
                </Button>
              </ButtonGroup>
            </>
          )}
          <ButtonGroup>
            <Button
              variant="tertiary"
              className={viewMode === "table" ? "text-accent" : ""}
              onPress={() => setViewMode("table")}
            >
              <IconList className="size-4" />
              Table
            </Button>
            <Button
              variant="tertiary"
              className={viewMode === "grid" ? "text-accent" : ""}
              onPress={() => setViewMode("grid")}
            >
              <ButtonGroup.Separator className="text-foreground" />
              <IconLayoutGrid className="size-4" />
              Grid
            </Button>
          </ButtonGroup>
          {isAdmin && (
            <>
              <Button
                isIconOnly
                size="lg"
                variant="tertiary"
                className="shrink-0"
                onPress={handleRefreshIndex}
                isDisabled={isActionLoading || isLoading}
              >
                <IconRefresh className="size-4" />
              </Button>
              <Button
                isIconOnly
                size="lg"
                variant="tertiary"
                className="shrink-0"
                onPress={() => setIsNewFolderOpen(true)}
              >
                <IconFolderPlus className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  },
);
