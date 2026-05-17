import { useEffect, useReducer, useState } from "react";
import { useParams } from "wouter";
import { Button, Spinner } from "@heroui/react";
import {
  IconDownload,
  IconFileDescriptionFilled,
  IconFileUnknownFilled,
  IconFolder,
  IconMusic,
  IconPhotoFilled,
  IconVideoFilled,
} from "@tabler/icons-react";
import ImagePlayer from "../components/player/ImagePlayer";
import { VideoPlayer } from "../components/player/VideoPlayer";
import { AudioPlayer } from "../components/player/AudioPlayer";
import FileBrowser from "../components/FileBrowser";

const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3002/api" : "/api";

type State = {
  data: any;
  isLoading: boolean;
  isMediaLoading: boolean;
  error: string | null;
};

type Action =
  | { type: "SET_DATA"; payload: any }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_MEDIA_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, data: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_MEDIA_LOADING":
      return { ...state, isMediaLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

export default function Share() {
  const { token } = useParams<{ token: string }>();
  const [state, dispatch] = useReducer(reducer, {
    data: null,
    isLoading: true,
    isMediaLoading: true,
    error: null,
  });
  const [folderHistory, setFolderHistory] = useState<number[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const { data, isLoading, isMediaLoading, error } = state;

  const fetchMetadata = async (fId?: number) => {
    try {
      const url = new URL(
        `${API_BASE_URL}/share/${token}`,
        window.location.origin,
      );
      if (fId) url.searchParams.append("folder_id", fId.toString());

      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to load share");
      }
      dispatch({ type: "SET_DATA", payload: json });
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [token]);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleFolderClick = (fId: number) => {
    if (fId === -1) {
      handleBackClick();
      return;
    }
    setFolderHistory([...folderHistory, data.folder.folder_id]);
    fetchMetadata(fId);
  };

  const handleBackClick = () => {
    const newHistory = [...folderHistory];
    const prevId = newHistory.pop();
    setFolderHistory(newHistory);
    fetchMetadata(prevId);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center">
        <IconFileUnknownFilled className="size-20 mb-4 text-red-500" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-white/60 max-w-md">
          Please contact the owner to access this share link.
        </p>
      </div>
    );
  }

  const streamUrl = `${API_BASE_URL}/stream?share_token=${token}`;
  const zipUrl = `${API_BASE_URL}/stream/zip?share_token=${token}`;

  const getFileStreamUrl = (f: any) => {
    return `${API_BASE_URL}/stream?share_token=${token}&message_id=${f.message_id}${f.folder_id ? `&folder_id=${f.folder_id}` : ""}`;
  };

  const handleDownload = () => {
    const url =
      data.share_type === "folder"
        ? selectedFile
          ? `${getFileStreamUrl(selectedFile)}&download=1`
          : zipUrl
        : `${streamUrl}&download=1`;
    window.open(url, "_blank");
  };

  const file = data.file;
  const folder = data.folder;
  const files = data.files || [];
  const subfolders = data.subfolders || [];

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header Info */}
      <div className="absolute top-0 left-0 right-0 z-50 p-6 flex items-center justify-between">
        {!(data.share_type == "folder") && (
          <div className="h-40 absolute top-0 left-0 right-0 bg-linear-to-b from-black/95 via-black/80 to-transparent -z-10 pointer-events-none"></div>
        )}
        <div className="flex flex-col gap-1 z-10">
          <div className="flex flex-col">
            <h1 className="text-white font-semibold text-lg tracking-tight">
              {selectedFile
                ? selectedFile.name
                : data.share_type === "folder"
                  ? folder?.name
                  : file?.name}
            </h1>
            <p
              className="text-white/40 text-[10px] font-medium tracking-widest uppercase"
              suppressHydrationWarning
            >
              {selectedFile
                ? "File Preview"
                : data.share_type === "folder"
                  ? "Shared Folder"
                  : "Shared File"}{" "}
              • {new Date(data.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          {selectedFile && (
            <Button
              variant="tertiary"
              className="h-11 px-6 rounded-2xl bg-white/5 text-white font-bold border border-white/10 hover:bg-white/10 transition-all"
              onPress={() => setSelectedFile(null)}
            >
              Back to Folder
            </Button>
          )}
          <Button
            variant="primary"
            className="h-11 px-6 rounded-2xl bg-white text-black font-bold border-none hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-2xl shadow-white/10"
            onPress={handleDownload}
          >
            <IconDownload className="size-5" />
            <span>
              {data.share_type === "folder" && !selectedFile
                ? "Download ZIP"
                : "Download File"}
            </span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="size-full flex flex-col items-center justify-start overflow-y-auto">
        {data.share_type === "folder" && !selectedFile ? (
          <div className="w-full flex flex-col gap-8 pt-32 px-4 xl:px-20">
            <FileBrowser
              mode="readonly"
              files={files.map((f: any) => ({ ...f, id: f.message_id }))}
              folders={subfolders.map((f: any) => ({ ...f, id: f.folder_id }))}
              shareToken={token}
              isRoot={data.is_root}
              isLoading={isLoading}
              onFolderClick={handleFolderClick}
              onFileClick={(f) => setSelectedFile(f)}
            />
          </div>
        ) : (
          <div className="size-full flex items-center justify-center">
            {/* Loading Indicator for Media */}
            {isMediaLoading &&
              ((selectedFile || file)?.mime_type?.includes("image") ||
                (selectedFile || file)?.mime_type?.includes("video") ||
                (selectedFile || file)?.mime_type?.includes("audio")) && (
                <div className="absolute inset-0 z-40 flex items-center justify-center">
                  <Spinner size="lg" />
                </div>
              )}
            {(selectedFile || file)?.mime_type?.includes("image") ? (
              <ImagePlayer
                src={selectedFile ? getFileStreamUrl(selectedFile) : streamUrl}
                alt={(selectedFile || file).name}
                onLoad={() =>
                  dispatch({ type: "SET_MEDIA_LOADING", payload: false })
                }
              />
            ) : (selectedFile || file)?.mime_type?.includes("video") ? (
              <div className="size-full flex items-center justify-center">
                <VideoPlayer
                  src={
                    selectedFile ? getFileStreamUrl(selectedFile) : streamUrl
                  }
                  onLoad={() =>
                    dispatch({ type: "SET_MEDIA_LOADING", payload: false })
                  }
                />
              </div>
            ) : (selectedFile || file)?.mime_type?.includes("audio") ? (
              <div className="w-full max-w-2xl px-6">
                <AudioPlayer
                  src={
                    selectedFile ? getFileStreamUrl(selectedFile) : streamUrl
                  }
                  onLoad={() =>
                    dispatch({ type: "SET_MEDIA_LOADING", payload: false })
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="p-10 rounded-full bg-white/5 border border-white/10">
                  <IconFileUnknownFilled className="size-20 text-white/40" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold text-white">
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
