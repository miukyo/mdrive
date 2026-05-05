import React, { useEffect } from "react";
import { useAuthStore } from "../../stores/Auth.store";
import { useIndexStore } from "../../stores/Index.store";
import { Button, Surface } from "@heroui/react";
import {
  IconFileDescriptionFilled,
  IconMusic,
  IconPhotoFilled,
  IconVideoFilled,
} from "@tabler/icons-react";
import FileBrowser from "../../components/FileBrowser";

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

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
  const { user } = useAuthStore();
  const { files, stats, fetchData } = useIndexStore();

  const [showStats, setShowStats] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(false);
  const [showFiles, setShowFiles] = React.useState(false);

  useEffect(() => {
    fetchData();

    // Staggered loading to prevent UI freeze
    const t1 = setTimeout(() => setShowStats(true), 50);
    const t2 = setTimeout(() => setShowGrid(true), 150);
    const t3 = setTimeout(() => setShowFiles(true), 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [fetchData, user]);

  const totalSize = stats.reduce(
    (acc: number, item: any) => acc + (item.total_size || 0),
    0,
  );

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
      <div className="">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {user.username}!
          </h1>
          <p className="text-muted mt-1">
            Manage your files and storage effectively across Telegram.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {showStats ? (
            <Surface
              variant="tertiary"
              className="rounded-3xl animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-muted uppercase tracking-wider">
                      Storage Overview
                    </p>
                    <p className="text-2xl font-bold tracking-tight mt-1">
                      Unlimited
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-muted uppercase tracking-wider">
                      Total Used
                    </p>
                    <p className="text-2xl font-bold tracking-tight mt-1">
                      {formatSize(totalSize)}
                    </p>
                  </div>
                </div>

                <div className="relative w-full h-4 rounded-full overflow-hidden bg-white/5 flex">
                  {stats.map((item) => (
                    <div
                      key={item.category}
                      className={`h-full ${CATEGORY_COLORS[item.category] || "bg-slate-400"} transition-all duration-500`}
                      style={{
                        width: `${totalSize > 0 ? (item.total_size / totalSize) * 100 : 0}%`,
                      }}
                      title={`${CATEGORY_LABELS[item.category]}: ${formatSize(item.total_size)}`}
                    ></div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-y-3 gap-x-4 mt-6">
                  {Object.keys(CATEGORY_LABELS).map((cat) => {
                    const item = stats.find((s) => s.category === cat) || {
                      total_size: 0,
                    };
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <div
                          className={`size-2 rounded-full ${CATEGORY_COLORS[cat]}`}
                        ></div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground/80">
                            {CATEGORY_LABELS[cat]}
                          </span>
                          <span className="text-[10px] text-muted leading-tight">
                            {formatSize(item.total_size)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Surface>
          ) : (
            <div className="h-48" />
          )}

          {showGrid ? (
            <div className="grid grid-cols-2 grid-rows-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Surface
                variant="tertiary"
                className="size-full overflow-hidden bg-surface-tertiary rounded-3xl flex gap-2 items-center justify-center"
              >
                <IconPhotoFilled className="size-8 text-blue-500" />
                <div className="flex flex-col justify-start items-start">
                  <span className="font-semibold text-foreground/80">
                    Images
                  </span>
                  <span className="text-xs text-muted leading-tight">
                    {stats.filter((s) => s.category === "images")[0]?.count ||
                      0}{" "}
                    files
                  </span>
                </div>
              </Surface>
              <Surface
                variant="tertiary"
                className="size-full overflow-hidden bg-surface-tertiary rounded-3xl flex gap-2 items-center justify-center"
              >
                <IconVideoFilled className="size-8 text-purple-500" />
                <div className="flex flex-col justify-start items-start">
                  <span className="font-semibold text-foreground/80">
                    Videos
                  </span>
                  <span className="text-xs text-muted leading-tight">
                    {stats.filter((s) => s.category === "videos")[0]?.count ||
                      0}{" "}
                    files
                  </span>
                </div>
              </Surface>
              <Surface
                variant="tertiary"
                className="size-full overflow-hidden bg-surface-tertiary rounded-3xl flex gap-2 items-center justify-center"
              >
                <IconFileDescriptionFilled className="size-8 text-amber-500" />
                <div className="flex flex-col justify-start items-start">
                  <span className="font-semibold text-foreground/80">Docs</span>
                  <span className="text-xs text-muted leading-tight">
                    {stats.filter((s) => s.category === "docs")[0]?.count || 0}{" "}
                    files
                  </span>
                </div>
              </Surface>
              <Surface
                variant="tertiary"
                className="size-full overflow-hidden bg-surface-tertiary rounded-3xl flex gap-2 items-center justify-center"
              >
                <IconMusic className="size-8 text-emerald-500" />
                <div className="flex flex-col justify-start items-start">
                  <span className="font-semibold text-foreground/80">
                    Audio
                  </span>
                  <span className="text-xs text-muted leading-tight">
                    {stats.filter((s) => s.category === "audio")[0]?.count || 0}{" "}
                    files
                  </span>
                </div>
              </Surface>
            </div>
          ) : (
            <div className="h-48" />
          )}
        </div>

        <div className="mt-4">
          {showFiles && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
              <FileBrowser files={files} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
