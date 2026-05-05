import React, { useEffect, useCallback, useState } from "react";
import { Modal, Surface, Button, Spinner } from "@heroui/react";
import {
  IconArchiveFilled,
  IconChevronLeft,
  IconChevronRight,
  IconFileUnknownFilled,
} from "@tabler/icons-react";
import { usePreviewStore } from "../stores/Preview.store";
import { useStreamStore } from "../stores/Stream.store";
import { useIndexStore } from "../stores/Index.store";
import ImagePlayer from "./player/ImagePlayer";
import { VideoPlayer } from "./player/VideoPlayer";
import { AudioPlayer } from "./player/AudioPlayer";

export default function GlobalPreview() {
  const {
    isOpen,
    setIsOpen,
    selectedFile,
    open: openFile,
    fileList,
  } = usePreviewStore();
  const { getStreamUrl } = useStreamStore();
  const { files: allFiles } = useIndexStore();

  const [isMediaLoading, setIsMediaLoading] = useState(true);

  const displayFiles = fileList.length > 0 ? fileList : allFiles;
  const currentIndex = displayFiles.findIndex((f) => f.id === selectedFile?.id);
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < displayFiles.length - 1 && currentIndex !== -1;

  const handlePrev = useCallback(() => {
    if (canPrev) {
      openFile(displayFiles[currentIndex - 1], fileList);
    }
  }, [canPrev, currentIndex, displayFiles, openFile, fileList]);

  const handleNext = useCallback(() => {
    if (canNext) {
      openFile(displayFiles[currentIndex + 1], fileList);
    }
  }, [canNext, currentIndex, displayFiles, openFile, fileList]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, setIsOpen]);

  useEffect(() => {
    setIsMediaLoading(true);
  }, [selectedFile]);

  if (!selectedFile && !isOpen) return null;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
      <Modal.Container size="cover" className={`px-20 py-10`}>
        <Modal.Dialog
          aria-label={selectedFile?.name}
          className="p-0 overflow-hidden bg-black rounded-4xl "
        >
          {/* Navigation Controls */}
          {canPrev && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
              <Button
                isIconOnly
                variant="tertiary"
                className="size-12 rounded-full bg-black/40 backdrop-blur-xl text-white/90 border border-white/10 hover:bg-black/60 transition-all group"
                onPress={handlePrev}
              >
                <IconChevronLeft className="size-6 group-active:scale-90 transition-transform" />
              </Button>
            </div>
          )}

          {canNext && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50">
              <Button
                isIconOnly
                variant="tertiary"
                className="size-12 rounded-full bg-black/40 backdrop-blur-xl text-white/90 border border-white/10 hover:bg-black/60 transition-all group"
                onPress={handleNext}
              >
                <IconChevronRight className="size-6 group-active:scale-90 transition-transform" />
              </Button>
            </div>
          )}

          <Modal.CloseTrigger className="z-50 p-4 rounded-full bg-black/60 backdrop-blur-xl text-white/90 border border-white/10 " />

          {/* Loading Indicator */}
          {isMediaLoading &&
            (selectedFile?.mime_type?.includes("image") ||
              selectedFile?.mime_type?.includes("video") ||
              selectedFile?.mime_type?.includes("audio")) && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
                <div className="flex flex-col items-center gap-4">
                  <Spinner size="lg" />
                  <span className="text-white/60 text-[10px] font-medium tracking-widest uppercase">
                    Preparing Preview
                  </span>
                </div>
              </div>
            )}

          <div className="absolute left-4 top-4 rounded-4xl z-50 bg-black/60 backdrop-blur-xl text-white/90 border border-white/10 ">
            <div className="px-3 py-2 text-xs font-semibold truncate ">
              {selectedFile?.name}
            </div>
          </div>
          <Modal.Body className="p-0 size-full">
            <div className="size-full flex items-center justify-center bg-black/20">
              {selectedFile?.mime_type?.includes("image") ? (
                <ImagePlayer
                  src={getStreamUrl(selectedFile.id, selectedFile.folder_id)}
                  alt={selectedFile.name}
                  onLoad={() => setIsMediaLoading(false)}
                  onClose={() => setIsOpen(false)}
                />
              ) : selectedFile?.mime_type?.includes("video") ? (
                <div className="size-full rounded-4xl">
                  <VideoPlayer
                    src={getStreamUrl(selectedFile.id, selectedFile.folder_id)}
                    onLoad={() => setIsMediaLoading(false)}
                  />
                </div>
              ) : selectedFile?.mime_type?.includes("audio") ? (
                <div className="w-1/2 rounded-4xl self-end">
                  <AudioPlayer
                    src={getStreamUrl(selectedFile.id, selectedFile.folder_id)}
                    onLoad={() => setIsMediaLoading(false)}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <IconFileUnknownFilled className="size-20 text-white" />
                  <span className="text-white">
                    No preview available for this file type
                  </span>
                  <Button
                    variant="primary"
                    className="text-black bg-white"
                    onPress={() => {
                      if (!selectedFile) return;
                      const url = new URL(
                        getStreamUrl(selectedFile.id, selectedFile.folder_id),
                      );
                      url.searchParams.append("download", "1");
                      window.open(url.toString(), "_blank");
                    }}
                  >
                    Download
                  </Button>
                </div>
              )}
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
