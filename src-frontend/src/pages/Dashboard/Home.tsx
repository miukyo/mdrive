import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../../stores/Auth.store";
import { useIndexStore } from "../../stores/Index.store";
import { Surface, Button } from "@heroui/react";
import { useLocation } from "wouter";
import {
  IconFileDescriptionFilled,
  IconMusic,
  IconPhotoFilled,
  IconVideoFilled,
  IconArchiveFilled,
  IconFolder,
} from "@tabler/icons-react";
import { formatSize, getFileIcon } from "../../components/file-browser/utils";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3002/api" : "/api";

const CATEGORY_COLORS: Record<string, string> = {
  images: "bg-blue-500",
  videos: "bg-purple-500",
  docs: "bg-amber-500",
  audio: "bg-emerald-500",
  others: "bg-slate-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  images: "Images",
  videos: "Videos",
  docs: "Docs",
  audio: "Audio",
  others: "Others",
};

export default function Home() {
  const { user, sessionId } = useAuthStore();
  const {
    stats,
    getStats,
    search,
    setCurrentFolderId,
    setSelectedKeys,
    setNavigatingFromSearch,
  } = useIndexStore();
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [, navigate] = useLocation();

  useEffect(() => {
    getStats();
    search({ limit: 8 }, false).then((res) => {
      if (res.success) setRecentFiles(res.data);
    });
  }, [getStats, search, user]);

  const handleRecentClick = (file?: any) => {
    if (!file) {
      setNavigatingFromSearch(true);
      setCurrentFolderId(0);
      setSelectedKeys(new Set());
      navigate("/explorer");
      return;
    }
    setNavigatingFromSearch(true);
    setCurrentFolderId(file.folder_id || 0);
    setSelectedKeys(new Set([file.id]));
    navigate("/explorer");
  };

  const totalSize = stats.reduce(
    (acc: number, item: any) => acc + (item.total_size || 0),
    0,
  );

  const totalFiles = stats.reduce(
    (acc: number, item: any) => acc + (item.count || 0),
    0,
  );
  const totalFolders = stats.length;

  return (
    <div className="flex-1 overflow-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {user.firstName}!
        </h1>
        <p className="text-muted text-sm font-medium">
          Here's what's happening with your drive today.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-4">
        <div className="lg:col-span-2">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Files</h2>
              <Button
                variant="tertiary"
                onClick={() => handleRecentClick(undefined)}
              >
                View all
              </Button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2">
              {recentFiles.map((file) => (
                <Surface
                  key={file.id}
                  variant="tertiary"
                  className="group relative flex flex-col p-3 rounded-3xl border transition-all hover:scale-[1.02] cursor-pointer"
                  onClick={() => handleRecentClick(file)}
                >
                  <div className="aspect-square rounded-2xl bg-white/5 overflow-hidden mb-3 flex items-center justify-center">
                    {file.mime_type?.includes("image") ||
                    file.mime_type?.includes("video") ? (
                      <img
                        src={`${API_BASE_URL}/thumbnail?message_id=${file.id}${file.folder_id ? `&folder_id=${file.folder_id}` : ""}${file.peer_id ? `&peer_id=${file.peer_id}` : ""}&session_id=${sessionId}`}
                        className="size-full object-cover"
                        alt={file.name}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                          const fallback = (e.target as HTMLElement)
                            .nextElementSibling as HTMLElement;
                          if (fallback) fallback.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={`${file.mime_type?.includes("image") || file.mime_type?.includes("video") ? "hidden" : "flex"} size-full items-center justify-center`}
                    >
                      {getFileIcon(file.mime_type, "size-10")}
                    </div>
                  </div>
                  <span className="text-xs font-medium truncate w-full text-center px-2">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-muted mt-1 text-center px-2">
                    {formatSize(file.size)}
                  </span>
                </Surface>
              ))}
            </div>
            {recentFiles.length === 0 && (
              <div className=" h-[62vh]! flex flex-col items-center justify-center gap-4 text-center">
                <Surface
                  variant="tertiary"
                  className="p-8 rounded-full bg-white/5"
                >
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
        </div>

        <div className="space-y-2">
          <Surface
            variant="tertiary"
            className="rounded-3xl border overflow-hidden"
          >
            <div className="p-6 bg-primary/5 border-b border-white/5">
              <p className="text-sm font-bold text-primary uppercase mb-1">
                Storage Overview
              </p>
              <p className="text-3xl font-black mt-1">
                {formatSize(totalSize)}
              </p>
              <div className="w-full bg-white/5 h-2 rounded-full mt-4 overflow-hidden flex">
                {stats.map((item: any) => (
                  <div
                    key={item.category}
                    className={`${CATEGORY_COLORS[item.category] || "bg-slate-400"} h-full transition-all duration-1000`}
                    style={{
                      width: `${totalSize > 0 ? (item.total_size / totalSize) * 100 : 0}%`,
                    }}
                    title={`${CATEGORY_LABELS[item.category] || item.category}: ${formatSize(item.total_size)}`}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted mt-2 font-bold uppercase">
                Total usage in Telegram
              </p>
            </div>
            <div className="p-4 space-y-1">
              {stats.map((item: any) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors cursor-default group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl bg-white/5 group-hover:bg-primary/20 transition-colors`}
                    >
                      <div
                        className={`size-2 rounded-full ${CATEGORY_COLORS[item.category] || "bg-slate-400"}`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize tracking-tight">
                        {CATEGORY_LABELS[item.category] ||
                          item.category ||
                          "Uncategorized"}
                      </p>
                      <p className="text-[10px] text-muted font-bold uppercase">
                        {item.count} files
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-black text-muted tabular-nums">
                    {formatSize(item.total_size)}
                  </p>
                </div>
              ))}
            </div>
          </Surface>

          <div className="grid grid-cols-2 gap-2">
            <Surface
              variant="tertiary"
              className="p-6 rounded-3xl flex items-center gap-4"
            >
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                <IconFileDescriptionFilled className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFiles}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Total Files
                </p>
              </div>
            </Surface>
            <Surface
              variant="tertiary"
              className="p-6 rounded-3xl flex items-center gap-4"
            >
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                <IconFolder className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFolders}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Total Folders
                </p>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}
