import React from "react";
import { GridItem } from "./GridItem";
import { IconArchiveFilled } from "@tabler/icons-react";
import { Surface } from "@heroui/react";

interface GridViewProps {
  displayItems: any[];
  displayLimit: number;
  selectedKeys: any;
  setSelectedKeys: (keys: any) => void;
  handleItemClick: (e: React.MouseEvent, item: any) => void;
  handleCellClick: (file: any) => void;
  handleDownload: (item: any) => void;
  handleShare: (item: any) => void;
  handleRenameClick: (item: any) => void;
  handleDeleteClick: (item: any) => void;
  handleMoveSingleClick: (item: any) => void;
  sessionId: string | null;
  shareToken?: string;
  isAdmin: boolean;
  height: string;
}

export const GridView = React.memo(
  ({
    displayItems,
    displayLimit,
    selectedKeys,
    setSelectedKeys,
    handleItemClick,
    handleCellClick,
    handleDownload,
    handleShare,
    handleRenameClick,
    handleDeleteClick,
    handleMoveSingleClick,
    sessionId,
    shareToken,
    isAdmin,
    height,
  }: GridViewProps) => {
    return (
      <div
        className={`grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2 content-start ${height} overflow-y-scroll`}
      >
        {displayItems.slice(0, displayLimit).map((item: any) => (
          <GridItem
            key={item.isFolder ? `folder-${item.id}` : `file-${item.id}`}
            data-id={item.id}
            file={item}
            isFolder={item.isFolder}
            isBack={item.isBack}
            isSelected={
              selectedKeys === "all" ||
              (selectedKeys instanceof Set && selectedKeys.has(item.id))
            }
            selectedKeys={selectedKeys}
            setSelectedKeys={setSelectedKeys}
            onClick={(e: React.MouseEvent) => handleItemClick(e, item)}
            openPreview={handleCellClick}
            handleDownload={handleDownload}
            handleShare={handleShare}
            handleRenameClick={handleRenameClick}
            handleDeleteClick={handleDeleteClick}
            handleMoveSingleClick={handleMoveSingleClick}
            sessionId={sessionId}
            shareToken={shareToken}
            isAdmin={isAdmin}
          />
        ))}
        {displayItems.length === 0 && (
          <div className="col-span-full h-[20vw] flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Surface variant="tertiary" className="p-8 rounded-full bg-white/5">
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
    );
  },
);
