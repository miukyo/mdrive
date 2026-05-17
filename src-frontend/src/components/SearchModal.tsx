import React, { useState, useEffect, useCallback } from "react";
import { Modal, TextField, InputGroup, Spinner, Surface } from "@heroui/react";
import {
  IconSearch,
  IconFileDescription,
  IconFolder,
  IconPhoto,
  IconVideo,
  IconMusic,
} from "@tabler/icons-react";
import { useIndexStore } from "../stores/Index.store";
import { usePreviewStore } from "../stores/Preview.store";
import { useLocation } from "wouter";
import { formatSize, getFileIcon } from "./file-browser/utils";

interface SearchModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SearchModal({
  isOpen,
  onOpenChange,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const {
    search,
    setCurrentFolderId,
    setSelectedKeys,
    setNavigatingFromSearch,
  } = useIndexStore();
  const { open: openPreview } = usePreviewStore();
  const [, navigate] = useLocation();

  const handleSearch = useCallback(
    async (q: string) => {
      setIsSearching(true);
      if (!q.trim()) {
        setResults([]);
        return;
      }
      const res = await search({ q }, false);
      if (res.success) {
        setResults(res.data || []);
      }
      setIsSearching(false);
    },
    [search],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const handleItemClick = (item: any) => {
    const isFolder = !item.mime_type;

    setNavigatingFromSearch(true);
    if (isFolder) {
      setCurrentFolderId(item.parent_id || 0);
      setSelectedKeys(new Set([item.id]));
    } else {
      setCurrentFolderId(item.folder_id || 0);
      setSelectedKeys(new Set([item.id]));
    }

    navigate("/explorer");
    onOpenChange(false);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[600px] bg-surface shadow-overlay overflow-hidden rounded-3xl p-0 transition-all duration-300 ease-in-out">
          <div className="flex flex-col w-full max-h-[80vh] transition-all duration-300 ease-in-out">
            <div
              className={`p-4 ${
                results.length > 0 ? "border-b border-border" : ""
              }`}
            >
              <TextField className="w-full">
                <InputGroup className="bg-transparent border-none shadow-none ring-0">
                  <InputGroup.Prefix>
                    <IconSearch className="size-6 text-muted" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    autoFocus
                    placeholder="Search files and folders..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="text-xl h-12 bg-transparent text-foreground placeholder:text-muted border-none focus:ring-0"
                  />
                </InputGroup>
              </TextField>
            </div>

            <div
              className={`${
                results.length > 0 ? "h-[300px]" : "h-0"
              } transition-[height] duration-500 ease-out-fluid overflow-y-auto`}
              style={{
                scrollbarGutter: "stable both-edges",
              }}
            >
              {results.length > 0 ? (
                <div className="flex flex-col gap-1 py-3">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-surface-tertiary text-left group cursor-pointer"
                    >
                      <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                        {item.mime_type ? (
                          getFileIcon(item.mime_type)
                        ) : (
                          <IconFolder className="size-5 text-blue-500" />
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-foreground/90 font-medium truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-muted uppercase tracking-widest font-bold">
                          {item.mime_type ? formatSize(item.size) : "Folder"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
