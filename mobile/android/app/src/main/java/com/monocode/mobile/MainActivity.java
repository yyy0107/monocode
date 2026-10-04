package com.monocode.mobile;

import android.os.Bundle;
import android.view.View;
import android.view.animation.Interpolator;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.List;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private String safeAreaScript;
    private String keyboardScript;
    private boolean imeAnimating;
    private int keyboardBottom;

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
            keyboardBottom = keyboardVisible ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;
            // Keep the WebView full screen on old and new Chromium versions;
            // only the keyboard resizes it. While the keyboard slides in, the
            // page lifts its bottom controls with the same curve and the
            // resize waits for the end, so layout changes once, not per frame.
            // A lowering keyboard resizes as soon as the page has measured
            // its transcript, and the page lowers the controls from there.
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
            // During a keyboard animation the safe area travels with the
            // keyboard event, so the page eases both on the same curve.
            if (!imeAnimating) {
                view.setPadding(0, 0, 0, keyboardBottom);
                sendKeyboard(view, 0, null);
            }
            // Consume bars explicitly so Chromium cannot add a second inset.
            // The keyboard too: a WebView that sees it pans the page to reveal
            // the focused field while the page already lifts its controls,
            // throwing the composer toward the top until the resize lands.
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime(),
                    Insets.NONE
                )
                .build();
        });
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (safeAreaScript != null) view.evaluateJavascript(safeAreaScript, null);
                if (keyboardScript != null) view.evaluateJavascript(keyboardScript, null);
                ViewCompat.requestApplyInsets(decor);
            }
        });
        // Replaces the Keyboard plugin's callback on the same view; the web
        // layer reads these keyboard events instead of the plugin's. The
        // animation stops here so the WebView never follows the keyboard on
        // its own as well.
        ViewCompat.setWindowInsetsAnimationCallback(
            decor,
            new WindowInsetsAnimationCompat.Callback(WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_STOP) {
                @Override
                public void onPrepare(@NonNull WindowInsetsAnimationCompat animation) {
                    if (isIme(animation)) imeAnimating = true;
                }

                @NonNull
                @Override
                public WindowInsetsAnimationCompat.BoundsCompat onStart(
                    @NonNull WindowInsetsAnimationCompat animation,
                    @NonNull WindowInsetsAnimationCompat.BoundsCompat bounds
                ) {
                    // Insets were already applied with the end state.
                    if (isIme(animation)) sendKeyboard(decor, animation.getDurationMillis(), animation.getInterpolator());
                    return bounds;
                }

                @NonNull
                @Override
                public WindowInsetsCompat onProgress(
                    @NonNull WindowInsetsCompat insets,
                    @NonNull List<WindowInsetsAnimationCompat> runningAnimations
                ) {
                    return insets;
                }

                @Override
                public void onEnd(@NonNull WindowInsetsAnimationCompat animation) {
                    if (!isIme(animation)) return;
                    imeAnimating = false;
                    if (decor.getPaddingBottom() != keyboardBottom) decor.setPadding(0, 0, 0, keyboardBottom);
                }
            }
        );
        ViewCompat.requestApplyInsets(decor);
    }

    private static boolean isIme(WindowInsetsAnimationCompat animation) {
        return (animation.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0;
    }

    /** Tells the page where the keyboard is heading and how it moves. */
    private void sendKeyboard(View decor, long duration, Interpolator interpolator) {
        float density = getResources().getDisplayMetrics().density;
        String format =
            "window.dispatchEvent(new CustomEvent('monocode:keyboard',{detail:{height:%.2f,viewport:%.2f,duration:%d,easing:'%s'}}));";
        float height = keyboardBottom / density;
        float viewport = decor.getHeight() / density;
        // A reloaded page only needs the settled position.
        keyboardScript = String.format(Locale.US, format, height, viewport, 0, "linear");
        bridge.getWebView().evaluateJavascript(
            safeAreaScript + String.format(Locale.US, format, height, viewport, Math.max(0, duration), easing(interpolator)),
            result -> {
                if (keyboardBottom < decor.getPaddingBottom()) decor.setPadding(0, 0, 0, keyboardBottom);
            }
        );
    }

    /** Samples the keyboard's interpolator as a CSS linear() easing. */
    private static String easing(Interpolator interpolator) {
        if (interpolator == null) return "linear";
        StringBuilder css = new StringBuilder("linear(");
        int steps = 32;
        for (int i = 0; i <= steps; i++) {
            if (i > 0) css.append(',');
            css.append(String.format(Locale.US, "%.4f", interpolator.getInterpolation(i / (float) steps)));
        }
        return css.append(')').toString();
    }
}
