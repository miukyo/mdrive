import React, { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Surface, Button, Spinner, toast } from "@heroui/react";
import {
  IconDownload,
  IconFileUnknownFilled,
  IconFolder,
  IconArchiveFilled,
} from "@tabler/icons-react";
import ImagePlayer from "../components/player/ImagePlayer";
import { VideoPlayer } from "../components/player/VideoPlayer";
import { AudioPlayer } from "../components/player/AudioPlayer";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000/api" : "/api";

export default function Share() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/share/${token}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || "Failed to load share");
        }
        setData(json);
      } catch (err: any) {
        setError(err.message);
        // toast.danger(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white p-6 text-center">
        <IconFileUnknownFilled className="size-20 mb-4 text-red-500" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-white/60 max-w-md">{error}</p>
      </div>
    );
  }

  const streamUrl = `${API_BASE_URL}/share/${token}/stream`;
  const zipUrl = `${API_BASE_URL}/share/${token}/zip`;

  const handleDownload = () => {
    const url =
      data.share_type === "folder" ? zipUrl : `${streamUrl}?download=1`;
    window.open(url, "_blank");
  };

  const file = data.file;
  const folder = data.folder;

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* Header Info */}
      <div className="absolute top-0 left-0 right-0 z-50 p-6 flex items-center justify-between pointer-events-none">
        <div className="h-100 absolute top-0 bg-linear-to-b from-black/90 to-black/0 w-full"></div>
        <div className="flex flex-col gap-1 pointer-events-auto z-10">
          <div className="flex flex-col">
            <h1 className="text-white font-bold text-lg tracking-tight">
              {data.share_type === "folder" ? folder?.name : file?.name}
            </h1>
            <p className="text-white/40 text-[10px] font-medium tracking-widest">
              Shared with you • {new Date(data.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          className="z-10 pointer-events-auto h-12 px-6 rounded-2xl bg-white text-black font-bold border-none hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-2xl shadow-white/10"
          onPress={handleDownload}
        >
          <IconDownload className="size-5" />
          <span>
            {data.share_type === "folder" ? "Download ZIP" : "Download File"}
          </span>
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="size-full flex items-center justify-center">
        {/* Loading Indicator for Media */}
        {isMediaLoading && data.share_type === "file" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}

        {data.share_type === "folder" ? (
          <div className="flex flex-col items-center gap-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="p-10 rounded-full bg-blue-500/10 border border-blue-500/20">
              <IconFolder className="size-24 text-blue-500" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold text-white tracking-tight">
                {folder?.name}
              </h2>
              <p className="text-white/60">
                This folder contains {data.file_count} files
              </p>
            </div>
            <Button
              variant="tertiary"
              className="h-14 px-10 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all"
              onPress={handleDownload}
            >
              Download as ZIP
            </Button>
          </div>
        ) : (
          <div className="size-full flex items-center justify-center">
            {file?.mime_type?.includes("image") ? (
              <ImagePlayer
                src={streamUrl}
                alt={file.name}
                onLoad={() => setIsMediaLoading(false)}
              />
            ) : file?.mime_type?.includes("video") ? (
              <div className="size-full">
                <VideoPlayer
                  src={streamUrl}
                  onLoad={() => setIsMediaLoading(false)}
                />
              </div>
            ) : file?.mime_type?.includes("audio") ? (
              <div className="w-2/3 max-w-2xl">
                <AudioPlayer
                  src={streamUrl}
                  onLoad={() => setIsMediaLoading(false)}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="p-10 rounded-full bg-white/5 border border-white/10">
                  <IconFileUnknownFilled className="size-20 text-white/40" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-bold text-white">
                    {file?.name}
                  </h2>
                  <p className="text-white/40 text-sm">
                    No preview available for this file type
                  </p>
                </div>
                <Button
                  variant="primary"
                  className="h-12 px-8 rounded-xl bg-white text-black font-bold"
                  onPress={handleDownload}
                >
                  Download Now
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
