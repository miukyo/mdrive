import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/Auth.store";
import { useIndexStore } from "../../stores/Index.store";
import {
  Button,
  EmptyState,
  Surface,
  Table,
  TableLayout,
  Virtualizer,
} from "@heroui/react";
import {
  IconArchiveFilled,
  IconCategoryFilled,
  IconFileDescriptionFilled,
  IconFolderOpenFilled,
  IconMusic,
  IconPhotoFilled,
  IconVideoFilled,
} from "@tabler/icons-react";

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
  const { getStats, search } = useIndexStore();
  const [stats, setStats] = useState<any[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    getStats().then((res) => {
      if (res.success && res.data) {
        setStats(res.data);
        const total = res.data.reduce(
          (acc: number, item: any) => acc + (item.total_size || 0),
          0,
        );
        setTotalSize(total);
      }
    });
  }, [getStats, user]);

  useEffect(() => {
    search().then((res) => {
      if (res.success && res.data) {
        setFiles(res.data);
      }
    });
  }, [search, user]);

  return (
    <div className="p-4">
      <div className="">
        <p className="text-4xl font-semibold tracking-tighter">
          Welcome back, {user?.firstName || ""}!
        </p>
        <p className="text-muted text-lg tracking-tight">
          Here's what's happening with your drive today.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Surface
          variant="tertiary"
          className="rounded-3xl border border-white/5"
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
        <div className="grid grid-cols-2 grid-rows-2 gap-4">
          <Button
            variant="tertiary"
            className="size-full overflow-hidden bg-surface-tertiary"
          >
            <IconFolderOpenFilled className="size-40 absolute -left-6 top-0 opacity-5" />
            <IconPhotoFilled className="size-8" />
            <div className="flex flex-col justify-start items-start">
              <span className="font-semibold text-foreground/80">Images</span>
              <span className="text-xs text-muted leading-tight">
                {stats.filter((s) => s.category === "images")[0]?.count || 0}{" "}
                files
              </span>
            </div>
          </Button>
          <Button
            variant="tertiary"
            className="size-full overflow-hidden bg-surface-tertiary"
          >
            <IconFolderOpenFilled className="size-40 absolute -left-6 top-0 opacity-5" />
            <IconVideoFilled className="size-8" />
            <div className="flex flex-col justify-start items-start">
              <span className="font-semibold text-foreground/80">Videos</span>
              <span className="text-xs text-muted leading-tight">
                {stats.filter((s) => s.category === "videos")[0]?.count || 0}{" "}
                files
              </span>
            </div>
          </Button>
          <Button
            variant="tertiary"
            className="size-full overflow-hidden bg-surface-tertiary"
          >
            <IconFolderOpenFilled className="size-40 absolute -left-6 top-0 opacity-5" />
            <IconFileDescriptionFilled className="size-8" />
            <div className="flex flex-col justify-start items-start">
              <span className="font-semibold text-foreground/80">Docs</span>
              <span className="text-xs text-muted leading-tight">
                {stats.filter((s) => s.category === "docs")[0]?.count || 0}{" "}
                files
              </span>
            </div>
          </Button>
          <Button
            variant="tertiary"
            className="size-full overflow-hidden bg-surface-tertiary"
          >
            <IconFolderOpenFilled className="size-40 absolute -left-6 top-0 opacity-5" />
            <IconMusic className="size-8" />
            <div className="flex flex-col justify-start items-start">
              <span className="font-semibold text-foreground/80">Audio</span>
              <span className="text-xs text-muted leading-tight">
                {stats.filter((s) => s.category === "audio")[0]?.count || 0}{" "}
                files
              </span>
            </div>
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <Virtualizer
          layout={TableLayout}
          layoutOptions={{
            headingHeight: 42,
            rowHeight: 42,
          }}
        >
          <Table>
            <Table.ScrollContainer>
              <Table.Content className="h-[500px] min-w-[700px] overflow-auto">
                <Table.Header className="h-full w-full">
                  <Table.Column isRowHeader id="name" minWidth={240}>
                    Name
                  </Table.Column>
                  <Table.Column id="size" width={240}>
                    Size
                  </Table.Column>
                  <Table.Column id="date" width={300}>
                    Date
                  </Table.Column>
                </Table.Header>
                <Table.Body
                  items={files}
                  renderEmptyState={() => (
                    <EmptyState className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                      <IconArchiveFilled className="size-10" />
                      <span className="text-sm text-muted">No files found</span>
                    </EmptyState>
                  )}
                >
                  {(file) => (
                    <Table.Row
                      className="[&_.table\_\_cell]:bg-surface-tertiary!"
                      key={file.id}
                    >
                      <Table.Cell className="flex items-center gap-2">
                        {file.mime_type?.includes("image") ? (
                          <IconPhotoFilled className="size-4" />
                        ) : file.mime_type?.includes("video") ? (
                          <IconVideoFilled className="size-4" />
                        ) : file.mime_type?.includes("audio") ? (
                          <IconMusic className="size-4" />
                        ) : (
                          <IconFileDescriptionFilled className="size-4" />
                        )}
                        {file.name}
                      </Table.Cell>
                      <Table.Cell>{formatSize(file.size)}</Table.Cell>
                      <Table.Cell>
                        {new Date(file.created_at).toLocaleString()}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Virtualizer>
      </div>
    </div>
  );
}
