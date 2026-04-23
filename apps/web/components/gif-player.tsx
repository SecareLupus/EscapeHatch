"use client";

import React, { useState, useEffect, useRef } from "react";
import { useIntersectionObserver } from "../hooks/use-intersection-observer";

interface GifPlayerProps {
    src: string;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

/**
 * A component that renders an image, but falls back to a video if the image fails.
 * This is useful for GIFs proxied from services like Tenor/Giphy which might return MP4.
 */
export function GifPlayer({ src, alt, className, style, onClick }: GifPlayerProps) {
    const [useVideo, setUseVideo] = useState(false);
    const [ref, isVisible] = useIntersectionObserver<HTMLDivElement>({ rootMargin: "200px" });
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (useVideo && videoRef.current) {
            if (isVisible) {
                console.log(`[GifPlayer] Resuming visible video: ${src.slice(-30)}`);
                void videoRef.current.play().catch(() => {
                    // Ignore autoplay blocks
                });
            } else {
                console.log(`[GifPlayer] Pausing off-screen video: ${src.slice(-30)}`);
                videoRef.current.pause();
            }
        }
    }, [isVisible, useVideo, src]);

    if (useVideo) {
        return (
            <div ref={ref} className={className} style={{ ...style, display: "contents" }}>
                <video
                    ref={videoRef}
                    src={src}
                    style={{ ...style, display: "block", objectFit: "contain", width: "100%", height: "100%" }}
                    loop
                    muted
                    playsInline
                    onClick={onClick}
                    onError={() => {
                        console.error("GifPlayer: Both image and video failed to load", src);
                    }}
                />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            style={style}
            onClick={onClick}
            onError={() => {
                console.log("GifPlayer: Image failed, trying video fallback", src);
                setUseVideo(true);
            }}
        />
    );
}
