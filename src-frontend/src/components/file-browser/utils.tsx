import React from "react";
import {
  IconPhotoFilled,
  IconVideoFilled,
  IconMusic,
  IconFileDescriptionFilled,
} from "@tabler/icons-react";

export const formatSize = (bytes: number) => {
  if (bytes === -1 || bytes === undefined) return "Unknown";
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getFileIcon = (mimeType: string, className = "size-4 shrink-0") => {
  if (mimeType?.includes("image"))
    return <IconPhotoFilled className={`${className} text-blue-500`} />;
  if (mimeType?.includes("video"))
    return <IconVideoFilled className={`${className} text-purple-500`} />;
  if (mimeType?.includes("audio"))
    return <IconMusic className={`${className} text-emerald-500`} />;
  return (
    <IconFileDescriptionFilled
      className={`${className} text-amber-500`}
    />
  );
};
