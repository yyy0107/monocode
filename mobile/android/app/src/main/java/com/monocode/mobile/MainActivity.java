package com.monocode.mobile;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private String safeAreaScript;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MonoCodeCredentialsPlugin.class);
        registerPlugin(MonoCodeUpdatesPlugin.class);
        registerPlugin(MonoCodeNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        installEdgeToEdgeInsets();
    }

    private void installEdgeToEdgeInsets() {
        View decor = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, (view, insets) -> {
            Insets safe = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            int keyboardBottom = keyboardVisible ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;
            // Keep the WebView full screen on old and new Chromium versions;
            // only the keyboard resizes it. CSS protects controls from the bars.
            view.setPadding(0, 0, 0, keyboardBottom);
            float density = getResources().getDisplayMetrics().density;
            safeAreaScript = String.format(
                Locale.US,
                "document.documentElement.style.setProperty('--safe-area-inset-top', '%.2fpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-right', '%.2fpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%.2fpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-left', '%.2fpx');",
                safe.top / density,
                safe.right / density,
                (keyboardVisible ? 0 : safe.bottom) / density,
                safe.left / density
            );
            bridge.getWebView().evaluateJavascript(safeAreaScript, null);
            // Consume bars explicitly so Chromium cannot add a second inset.
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                .build();
        });
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (safeAreaScript != null) view.evaluateJavascript(safeAreaScript, null);
                ViewCompat.requestApplyInsets(decor);
            }
        });
        ViewCompat.requestApplyInsets(decor);
    }
}
