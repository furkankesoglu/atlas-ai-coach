"use client";

import { useEffect, useRef } from "react";

export default function AtlasDragonVideoLayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      void video.play().catch(() => {
        // Autoplay can be blocked briefly while the tab is inactive.
      });
    };

    tryPlay();
    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("focus", tryPlay);

    return () => {
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("focus", tryPlay);
    };
  }, []);

  return (
    <div className="atlas-dragon-video-layer" aria-hidden="true">
      <div className="atlas-dragon-video-flight">
        <video
          ref={videoRef}
          className="atlas-dragon-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
        >
          <source src="/videos/atlas-dragon.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="atlas-dragon-video-vignette" />
    </div>
  );
}
