"use client";

import React, { useState } from "react";

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

    if (useVideo) {
        return (
            <video
                src={src}
                className={className}
                style={{ ...style, display: "block", objectFit: "contain" }}
                autoPlay
                loop
                muted
                playsInline
                onClick={onClick}
                onError={() => {
                    console.error("GifPlayer: Both image and video failed to load", src);
                }}
            />
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
