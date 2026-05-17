import React, { useState, useRef, useEffect } from "react";

interface ImagePlayerProps {
  src: string;
  alt?: string;
  onLoad?: () => void;
  onClose?: () => void;
}

export default function ImagePlayer({
  src,
  alt,
  onLoad,
  onClose,
}: ImagePlayerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.5), 10);

    // Zoom towards cursor could be implemented here, but let's keep it simple for now
    setScale(newScale);

    // Reset position if zoomed out to 1
    if (newScale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
    };
  }, [scale]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      className="group relative size-full overflow-hidden flex items-center justify-center bg-black/10"
      style={{
        cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (onClose) onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === containerRef.current && onClose) {
          onClose();
        }
      }}
    >
      <img
        src={src}
        alt={alt}
        onLoad={onLoad}
        draggable={false}
        className="max-w-full max-h-full object-contain select-none will-change-transform"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? "none" : "transform 0.1s ease-out",
        }}
      />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl text-[10px] font-medium text-white/90 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-widest">
        {Math.round(scale * 100)}% Zoom
      </div>
    </div>
  );
}
