import { create } from "zustand";

type PreviewState = {
  isOpen: boolean;
  selectedFile: any | null;
  fileList: any[];
  open: (file: any, list?: any[]) => void;
  close: () => void;
  setIsOpen: (open: boolean) => void;
};

export const usePreviewStore = create<PreviewState>()((set) => ({
  isOpen: false,
  selectedFile: null,
  fileList: [],
  open: (file, list = []) => set({ isOpen: true, selectedFile: file, fileList: list }),
  close: () => set({ isOpen: false, selectedFile: null, fileList: [] }),
  setIsOpen: (open) => set({ isOpen: open }),
}));
