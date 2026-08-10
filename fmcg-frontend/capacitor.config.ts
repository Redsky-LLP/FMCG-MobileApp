import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fmcg.distribution',
  appName: 'FMCG Distribution',
  webDir: 'dist',
  // FIX: point the native app at the live server instead of bundling a static
  // copy of dist/ inside the APK. Without this, every frontend change required
  // a full rebuild + reinstall on every tablet, since the app had no way to
  // know the code had changed — it was just running whatever was baked in at
  // build time. With server.url set, the app behaves like a thin native shell
  // that always loads the current deployed build, the same way a browser tab
  // would — so a normal frontend deploy is now enough, no new APK needed.
  // cleartext: true is required because the server is currently served over
  // plain HTTP (see the "Not secure" warning in the admin panel) rather than
  // HTTPS — Android blocks cleartext (non-HTTPS) traffic by default.
  server: {
    url: 'http://141.148.211.66',
    cleartext: true,
  },
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