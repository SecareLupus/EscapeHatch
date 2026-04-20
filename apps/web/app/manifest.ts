import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skerry Chat',
    short_name: 'Skerry',
    description: 'Skerry Collective Matrix hub',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a202c',
    theme_color: '#2d3748',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
