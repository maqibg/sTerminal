const ua = navigator.userAgent;
export const isMacOS = ua.includes('Macintosh');
export const isWindows = ua.includes('Windows');
export const isLinux = ua.includes('Linux') && !ua.includes('Android');
