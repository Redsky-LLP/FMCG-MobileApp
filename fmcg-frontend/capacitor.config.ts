import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fmcg.distribution',
  appName: 'FMCG Distribution',
  webDir: 'dist',
  plugins: {
    // FIX: without this, the Android status bar overlays the app's content
    // instead of pushing it down — CSS env(safe-area-inset-top) can't
    // reliably compensate for that on its own inside a native Capacitor
    // WebView (unlike a plain installed PWA in Chrome, which handles this
    // automatically). overlaysWebView: false tells Android to reserve the
    // status bar's own space, so the app's header (hamburger button, clock
    // row) is never covered by the time/wifi/battery icons.
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0a0e1a',
    },
    // FIX: makes the on-screen keyboard resize/shrink the page content to
    // fit above it, instead of floating on top of everything — this is
    // what was causing the floating/overlapping keyboard behavior on
    // tablets reported earlier.
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;