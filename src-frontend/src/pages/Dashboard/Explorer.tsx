import React from "react";
import FileBrowser from "../../components/FileBrowser";

export default function Explorer() {
  return (
    <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1 mb-4">
        <h1 className="text-3xl font-semibold tracking-tight">Explorer</h1>
        <p className="text-muted text-sm font-medium">
          Browse and manage your files
        </p>
      </div>
      <FileBrowser height="h-[calc(100vh-205px)] overflow-hidden rounded-2xl" />
    </div>
  );
}
