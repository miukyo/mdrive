"use client";

import "@videojs/react/video/minimal-skin.css";
import { createPlayer, videoFeatures } from "@videojs/react";
import { MinimalVideoSkin, Video } from "@videojs/react/video";
import { useEffect } from "react";

const Player = createPlayer({ features: videoFeatures });

interface VideoPlayerProps {
  src: string;
  onLoad?: () => void;
}

const VideoContainer = (props: { src: string; onLoad?: () => void }) => {
  const store = Player.usePlayer();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key.toLowerCase()) {
        // case " ":
        //   e.preventDefault();
        //   if (store.paused) {
        //     store.play();
        //   } else {
        //     store.pause();
        //   }
        //   break;
        case "f":
          store.toggleFullscreen();
          break;
        case "m":
          store.toggleMuted();
          break;
        case "arrowright":
          store.seek(store.currentTime + 10);
          break;
        case "arrowleft":
          store.seek(store.currentTime - 10);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Play/Pause"
        className="inset-0 absolute bottom-15 z-10 cursor-pointer select-none"
        onClick={() => (store.paused ? store.play() : store.pause())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            store.paused ? store.play() : store.pause();
          }
        }}
      />
      <MinimalVideoSkin>
        <Video src={props.src} playsInline onCanPlay={props.onLoad} />
      </MinimalVideoSkin>
    </>
  );
};

export const VideoPlayer = ({ src, onLoad }: VideoPlayerProps) => {
  return (
    <Player.Provider>
      <VideoContainer src={src} onLoad={onLoad} />
    </Player.Provider>
  );
};
