import "@videojs/react/audio/minimal-skin.css";
import { createPlayer, audioFeatures } from "@videojs/react";
import { MinimalAudioSkin, Audio } from "@videojs/react/audio";
import { useEffect, useRef, useState } from "react";

const Player = createPlayer({ features: audioFeatures });

interface AudioPlayerProps {
  src: string;
  onLoad?: () => void;
}

const AudioVisualizer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    let pollInterval: any;
    const smoothedRef = { low: 0, mid: 0, high: 0 };

    const initContext = (el: HTMLAudioElement) => {
      if (contextRef.current) return;

      try {
        const context = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        const analyser = context.createAnalyser();
        const source = context.createMediaElementSource(el);

        source.connect(analyser);
        analyser.connect(context.destination);
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.95; // High smoothing for aurora

        analyserRef.current = analyser;
        contextRef.current = context;
      } catch (e) {
        console.warn("Failed to initialize aurora visualizer:", e);
      }
    };

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Raw averages
      const rawLow = dataArray.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
      const rawMid = dataArray.slice(20, 100).reduce((a, b) => a + b, 0) / 80;
      const rawHigh =
        dataArray.slice(100, 200).reduce((a, b) => a + b, 0) / 100;

      // Manual lerp for ultra-smoothness
      smoothedRef.low += (rawLow - smoothedRef.low) * 0.05;
      smoothedRef.mid += (rawMid - smoothedRef.mid) * 0.05;
      smoothedRef.high += (rawHigh - smoothedRef.high) * 0.05;

      const time = Date.now() * 0.001;

      ctx.globalCompositeOperation = "screen";

      const drawAuroraWave = (
        color: string,
        intensity: number,
        speed: number,
        yOffset: number,
        hMultiplier: number,
        direction: number = 1,
      ) => {
        const h = (intensity / 255) * height * hMultiplier;
        const gradient = ctx.createRadialGradient(
          width / 2,
          height / 2 + yOffset,
          10,
          width / 2,
          height / 2 + yOffset,
          width * 0.8,
        );
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.beginPath();

        // Create wavy shape
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 15) {
          const wave =
            Math.sin(x * 0.004 + time * speed * direction) *
            (intensity * 0.6 + 20);
          const noise =
            Math.cos(x * 0.0015 + time * speed * 0.7 * direction) *
            (intensity * 0.2 + 10);
          ctx.lineTo(x, height - (h + wave + noise + height * 0.3) + yOffset);
        }
        ctx.lineTo(width, height);
        ctx.fill();
      };

      drawAuroraWave("#ff8800", smoothedRef.low, 0.4, 0, 0.1, 1);

      drawAuroraWave("#ffcc00", smoothedRef.mid, 0.2, -50, 0.2, -1);

      drawAuroraWave("#fff700", smoothedRef.high, 0.05, -100, 0.4, 1);

      animationRef.current = requestAnimationFrame(draw);
    };

    const handlePlay = () => {
      if (audio) {
        if (contextRef.current?.state === "suspended") {
          contextRef.current.resume();
        }
      }
    };

    const pollAudio = () => {
      audio = document.querySelector("audio");
      if (audio) {
        audio.addEventListener("play", handlePlay);
        if (!audio.paused) handlePlay();
        clearInterval(pollInterval);
      }
    };

    pollInterval = setInterval(pollAudio, 500);
    pollAudio();
    if (audio) {
      initContext(audio);
    }
    draw();

    return () => {
      if (audio) audio.removeEventListener("play", handlePlay);
      clearInterval(pollInterval);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none scale-110">
      <div className="absolute w-full h-100 bottom-0 left-0 bg-linear-to-t from-black to-transparent z-10"></div>
      <canvas
        ref={canvasRef}
        width={1600}
        height={900}
        className="w-full h-full blur-xl"
      />
    </div>
  );
};

const AudioContainer = (props: { src: string; onLoad?: () => void }) => {
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
      <AudioVisualizer />
      <div
        role="button"
        tabIndex={0}
        aria-label="Play/Pause"
        className="absolute cursor-pointer inset-0 z-0 pointer-events-auto"
        onClick={() => (store.paused ? store.play() : store.pause())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            store.paused ? store.play() : store.pause();
          }
        }}
      ></div>
      <div className="relative size-full flex items-center justify-center p-20">
        <MinimalAudioSkin>
          <Audio
            src={props.src}
            crossOrigin="anonymous"
            onCanPlay={props.onLoad}
          />
        </MinimalAudioSkin>
      </div>
    </>
  );
};

export const AudioPlayer = ({ src, onLoad }: AudioPlayerProps) => {
  return (
    <Player.Provider>
      <AudioContainer src={src} onLoad={onLoad} />
    </Player.Provider>
  );
};
