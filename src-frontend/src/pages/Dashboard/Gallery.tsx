import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useAuthStore } from "../../stores/Auth.store";
import { useIndexStore } from "../../stores/Index.store";
import { usePreviewStore } from "../../stores/Preview.store";
import { useStreamStore } from "../../stores/Stream.store";
import {
  Surface,
  Button,
  Dropdown,
  Separator,
  Header,
  Label,
  toast,
} from "@heroui/react";
import {
  IconPhotoFilled,
  IconVideoFilled,
  IconDotsVertical,
  IconDownload,
  IconShare,
  IconTrash,
  IconArchiveFilled,
  IconEdit,
} from "@tabler/icons-react";
import { useFilesStore } from "../../stores/Files.store";
import { FileActionModals } from "../../components/FileActionModals";

const useMedia = (
  queries: string[],
  values: number[],
  defaultValue: number,
): number => {
  const get = () =>
    values[queries.findIndex((q) => matchMedia(q).matches)] ?? defaultValue;
  const [value, setValue] = useState<number>(get);

  useEffect(() => {
    const handler = () => setValue(get);
    queries.forEach((q) => matchMedia(q).addEventListener("change", handler));
    return () =>
      queries.forEach((q) =>
        matchMedia(q).removeEventListener("change", handler),
      );
  }, [queries]);

  return value;
};

const useMeasure = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
};

interface Item {
  id: string;
  img: string;
  file: any;
  defaultHeight: number;
}

interface GridItem extends Item {
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
}

const GalleryItem = React.memo(
  ({
    item,
    playlist,
    handleImageLoad,
    openPreview,
    handleDownload,
    handleShare,
    handleRename,
    handleDelete,
  }: any) => {
    const imgRef = useRef<HTMLImageElement>(null);

    // Check if image is already cached on mount
    useLayoutEffect(() => {
      if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
        handleImageLoad(
          item.id,
          imgRef.current.naturalWidth,
          imgRef.current.naturalHeight,
        );
      }
    }, [item.id, handleImageLoad]);

    return (
      <div
        className="absolute"
        style={{
          transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
          width: item.w,
          height: item.h,
        }}
      >
        <Surface
          variant="tertiary"
          className="group relative w-full h-full overflow-hidden rounded-2xl hover:border-primary/50 transition-all cursor-pointer shadow-xl bg-surface-variant"
          onClick={() => openPreview(item.file, playlist)}
        >
          <img
            ref={imgRef}
            src={item.img}
            alt={item.file.name}
            loading="lazy"
            className="w-full h-full group-hover:scale-105 transition-transform duration-700 ease-out"
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.naturalWidth > 0) {
                handleImageLoad(item.id, img.naturalWidth, img.naturalHeight);
              }
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
              const fallback = (e.target as HTMLElement)
                .nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove("hidden");
            }}
          />

          {/* Fallback Icon */}
          <div className="hidden absolute inset-0 items-center justify-center bg-surface-variant">
            {item.file.mime_type?.includes("video") ? (
              <IconVideoFilled className="size-12 text-purple-500/50" />
            ) : (
              <IconPhotoFilled className="size-12 text-blue-500/50" />
            )}
          </div>

          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 flex items-center justify-between pointer-events-none">
            <div className="flex flex-col gap-0.5 truncate pr-8">
              <span className="text-[10px] font-bold text-white/90 truncate tracking-wider">
                {item.file.name}
              </span>
              <span className="text-[9px] font-medium text-white/60">
                {item.file.mime_type?.includes("video") ? "Video" : "Photo"}
              </span>
            </div>
          </div>

          {/* Media Type Badge */}
          {/* <div className="absolute top-3 left-3 p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white/90">
          {item.file.mime_type?.includes("video") ? (
            <IconVideoFilled className="size-3.5" />
          ) : (
            <IconPhotoFilled className="size-3.5" />
          )}
        </div> */}

          <div
            role="button"
            tabIndex={0}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
              }
            }}
          >
            <Dropdown>
              <Button
                isIconOnly
                size="sm"
                variant="tertiary"
                className="size-8 rounded-full bg-black/40 border border-white/10 text-white/90 hover:bg-black/60"
              >
                <IconDotsVertical className="size-4" />
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  onAction={(key) => {
                    if (key === "download") handleDownload(item.file);
                    if (key === "share") handleShare(item.file);
                    if (key === "rename") handleRename(item.file);
                    if (key === "delete") handleDelete(item.file);
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
        </Surface>
      </div>
    );
  },
);

export default function Gallery() {
  const { files, fetchData } = useIndexStore();
  const { sessionId } = useAuthStore();
  const { open: openPreview } = usePreviewStore();
  const { shareFile, deleteFiles, renameFile } = useFilesStore();
  const { getStreamUrl } = useStreamStore();

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});

  const API_BASE_URL = import.meta.env.DEV
    ? "http://localhost:3002/api"
    : "/api";

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImageLoad = useCallback(
    (id: string, width: number, height: number) => {
      if (!width || !height) return;
      setAspectRatios((prev) => {
        if (prev[id] === width / height) return prev;
        return { ...prev, [id]: width / height };
      });
    },
    [],
  );

  const mediaFiles = useMemo(() => {
    return files.reduce((acc: any[], f) => {
      if (f.mime_type?.includes("image") || f.mime_type?.includes("video")) {
        const hash = f.id
          .toString()
          .split("")
          .reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
        const defaultHeight = 250 + (hash % 100);

        acc.push({
          id: f.id.toString(),
          img: `${API_BASE_URL}/thumbnail?message_id=${f.id}${f.folder_id ? `&folder_id=${f.folder_id}` : ""}${f.peer_id ? `&peer_id=${f.peer_id}` : ""}&session_id=${sessionId}`,
          file: f,
          defaultHeight,
        });
      }
      return acc;
    }, []);
  }, [files, sessionId, API_BASE_URL]);

  const playlist = useMemo(() => mediaFiles.map((m) => m.file), [mediaFiles]);

  const columns = useMedia(
    [
      "(min-width:1500px)",
      "(min-width:1200px)",
      "(min-width:900px)",
      "(min-width:600px)",
    ],
    [5, 4, 3, 2],
    1,
  );

  const [containerRef, { width }] = useMeasure<HTMLDivElement>();

  const grid = useMemo<GridItem[]>(() => {
    if (!width) return [];
    const colHeights = new Array(columns).fill(0);
    const gap = 20;
    const totalGaps = (columns - 1) * gap;
    const columnWidth = (width - totalGaps) / columns;

    return mediaFiles.map((child) => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = col * (columnWidth + gap);
      const y = colHeights[col];

      const ar = aspectRatios[child.id];
      const h = ar ? columnWidth / ar : child.defaultHeight;

      colHeights[col] += h + gap;
      return { ...child, x, y, w: columnWidth, h, height: h };
    });
  }, [columns, mediaFiles, width, aspectRatios]);

  const handleDownload = useCallback(
    (file: any) => {
      const url = `${API_BASE_URL}/stream?message_id=${file.id}${file.folder_id ? `&folder_id=${file.folder_id}` : ""}&download=1&session_id=${sessionId}`;
      window.open(url, "_blank");
    },
    [sessionId, API_BASE_URL],
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

  const handleRename = useCallback((file: any) => {
    setSelectedFile(file);
    setIsRenameOpen(true);
  }, []);

  const handleDelete = useCallback((file: any) => {
    setSelectedFile(file);
    setIsDeleteOpen(true);
  }, []);

  const totalHeight = Math.max(0, ...grid.map((i) => i.y + i.h));

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Gallery</h1>
        <p className="text-muted text-sm font-medium">
          Browse your media collection
        </p>
      </div>

      {mediaFiles.length === 0 ? (
        <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-center py-20">
          <Surface variant="tertiary" className="p-8 rounded-full bg-white/5">
            <IconArchiveFilled className="size-12 text-muted/20" />
          </Surface>
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-foreground/80">
              No Media Found
            </span>
            <span className="text-sm text-muted">
              Upload some photos or videos to see them here
            </span>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative w-full"
          style={{ height: totalHeight }}
        >
          {grid.map((item) => (
            <GalleryItem
              key={item.id}
              item={item}
              playlist={playlist}
              handleImageLoad={handleImageLoad}
              openPreview={openPreview}
              handleDownload={handleDownload}
              handleShare={handleShare}
              handleRename={handleRename}
              handleDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <FileActionModals
        key={selectedFile?.id}
        selectedFile={selectedFile}
        isRenameOpen={isRenameOpen}
        setIsRenameOpen={setIsRenameOpen}
        isDeleteOpen={isDeleteOpen}
        setIsDeleteOpen={setIsDeleteOpen}
        onRename={renameFile}
        onDelete={deleteFiles}
      />
    </div>
  );
}
