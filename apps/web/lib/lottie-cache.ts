"use client";

/**
 * A simple cache for Lottie animation data to avoid redundant fetches
 * and multiple copies of the same data in memory.
 */
const lottieCache = new Map<string, any>();
const pendingRequests = new Map<string, Promise<any>>();

export async function fetchLottieData(url: string, signal?: AbortSignal): Promise<any> {
    if (lottieCache.has(url)) {
        return lottieCache.get(url);
    }

    if (pendingRequests.has(url)) {
        return pendingRequests.get(url);
    }

    const request = (async () => {
        try {
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            lottieCache.set(url, data);
            return data;
        } finally {
            pendingRequests.delete(url);
        }
    })();

    pendingRequests.set(url, request);
    return request;
}

export function getCachedLottieData(url: string): any | null {
    return lottieCache.get(url) || null;
}
