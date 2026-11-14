/**
 * Turns a user-agent string into a rough { browser, os } for the joke
 * surveillance readout. Pure string matching: no network, no storage.
 */
export function describeUserAgent(ua: string): { browser: string; os: string } {
  return { browser: detectBrowser(ua), os: detectOs(ua) };
}

function detectBrowser(ua: string): string {
  // In-app browsers first: they also contain Safari/Chrome tokens.
  if (/Twitter|TwitterAndroid|\bX\/\d/i.test(ua)) return 'X In-App Browser';
  if (/Telegram/i.test(ua)) return 'Telegram In-App Browser';
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Facebook In-App Browser';
  if (/Instagram/.test(ua)) return 'Instagram In-App Browser';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera|OPiOS\//.test(ua)) return 'Opera';
  if (/CriOS\//.test(ua)) return 'Chrome (iOS)';
  if (/FxiOS\//.test(ua)) return 'Firefox (iOS)';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\/|Chromium\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  if (/AppleWebKit/.test(ua) && /iPhone|iPad|iPod/.test(ua)) return 'iOS WebView';
  return 'Unknown Browser';
}

function detectOs(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows NT|Windows Phone|Win64|Win32|Windows/.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return 'Unknown OS';
}
