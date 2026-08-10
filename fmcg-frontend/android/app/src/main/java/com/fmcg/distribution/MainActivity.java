package com.fmcg.distribution;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // FIX: targetSdkVersion 36 (variables.gradle) is well past API 35, where
    // edge-to-edge display became MANDATORY — Android forces the app to draw
    // behind the system status bar and navigation bar regardless of what
    // styles.xml's android:navigationBarColor/statusBarColor say (those are
    // silently ignored once edge-to-edge is forced). With nothing telling
    // Android where the real safe boundaries are, the WebView had no reliable
    // way to know the system bars' actual size — which is exactly why CSS
    // env(safe-area-inset-top/bottom) kept resolving unreliably no matter how
    // many padding/z-index adjustments were tried on the web side. This was
    // never fixable purely in CSS.
    //
    // Fix: capture the real system bar insets natively and apply them as
    // padding on the root view that hosts the WebView. This makes the WebView
    // occupy exactly the space between the status bar and navigation bar —
    // the same effect the old (pre-edge-to-edge) behavior gave us for free —
    // so the hamburger button, bottom nav labels, etc. can no longer be
    // covered by the system bars, independent of anything in the CSS/JS side.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View rootView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}