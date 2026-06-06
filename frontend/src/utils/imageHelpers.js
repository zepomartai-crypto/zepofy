/**
 * Helper to resolve image and media URLs
 * Handles both absolute URLs (e.g. from Cloudinary) 
 * and relative paths (e.g. from local uploads)
 */
export const getImageUrl = (url) => {
    if (!url) return null;

    // 1. If it's already an absolute URL (http/https), return as is
    if (typeof url === 'string' && url.startsWith('http')) {
        // Exception: Handle Meta Graph API URLs if they are passed as absolute URLs
        // Format: https://graph.facebook.com/v18.0/{mediaId}
        if (url.includes('graph.facebook.com')) {
            const parts = url.split('/');
            const mediaId = parts[parts.length - 1];
            if (mediaId && /^\d+$/.test(mediaId)) { // Meta IDs are always numeric
                const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
                const token = localStorage.getItem("token");
                return `${serverUrl}/api/inbox/media/${mediaId}${token ? `?token=${token}` : ''}`;
            }
        }
        return url;
    }

    // 2. If it's just a raw numeric ID (likely a Meta Media ID)
    if (typeof url === 'string' && /^\d+$/.test(url)) {
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
        const token = localStorage.getItem("token");
        return `${serverUrl}/api/inbox/media/${url}${token ? `?token=${token}` : ''}`;
    }

    // 3. For relative paths or local filenames, prepend the server URL
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

    // Ensure we don't have double slashes
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;

    // Check if it's potentially an uploaded file path (starts with uploads/)
    if (url.startsWith('uploads/')) {
        return `${serverUrl}${cleanUrl}`;
    }

    // Default: return it as a local path from server root
    return `${serverUrl}${cleanUrl}`;
};

