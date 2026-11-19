package com.yejian.reader;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * 同步窗口主题。阅读时隐藏系统栏，并在顶部留出与纸面同色的区域。
 */
public class ImmersiveBridge {

    private final Activity activity;
    private final FrameLayout readerWindow;
    private final WebView webView;
    private Insets readerInsets = Insets.NONE;
    private boolean immersive = false;
    private int shellColor = Color.parseColor("#F2EFE6");

    ImmersiveBridge(Activity activity, FrameLayout readerWindow, WebView webView) {
        this.activity = activity;
        this.readerWindow = readerWindow;
        this.webView = webView;
        ViewCompat.setOnApplyWindowInsetsListener(readerWindow, (view, insets) -> {
            Insets cutout = insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.displayCutout());
            int statusTop = insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.statusBars()).top;
            readerInsets = Insets.of(cutout.left, Math.max(statusTop, cutout.top), cutout.right, cutout.bottom);
            updateContentPadding();
            return insets;
        });
    }

    private void updateContentPadding() {
        Insets padding = immersive ? readerInsets : Insets.NONE;
        readerWindow.setPadding(padding.left, padding.top, padding.right, padding.bottom);
    }

    @JavascriptInterface
    public void setSystemBars(boolean reading, String color) {
        final int parsedColor;
        try {
            parsedColor = Color.parseColor(color);
        } catch (IllegalArgumentException ignored) {
            return;
        }
        activity.runOnUiThread(() -> {
            immersive = reading;
            shellColor = parsedColor;
            apply();
        });
    }

    @JavascriptInterface
    public void setImmersive(boolean enabled) {
        activity.runOnUiThread(() -> {
            immersive = enabled;
            apply();
        });
    }

    /** 网页主题变化时同步窗口底色（阅读页传纸面颜色，其它页面传应用背景色）。 */
    @JavascriptInterface
    public void setShellColor(String color) {
        final int parsedColor;
        try {
            parsedColor = Color.parseColor(color);
        } catch (IllegalArgumentException ignored) {
            return;
        }
        activity.runOnUiThread(() -> {
            shellColor = parsedColor;
            apply();
        });
    }

    /** 从后台返回时恢复当前页面的系统栏设置。 */
    void reapply() {
        activity.runOnUiThread(this::apply);
    }

    private void apply() {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        Window window = activity.getWindow();

        // 阅读时让原生背景覆盖挖孔安全区，正文由容器内边距避开挖孔。
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            int cutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            if (immersive) {
                cutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                        ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                        : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            }
            if (attributes.layoutInDisplayCutoutMode != cutoutMode) {
                attributes.layoutInDisplayCutoutMode = cutoutMode;
                window.setAttributes(attributes);
            }
        }
        WindowCompat.setDecorFitsSystemWindows(window, !immersive);

        readerWindow.setBackgroundColor(shellColor);
        webView.setBackgroundColor(shellColor);
        updateContentPadding();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(
                WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                        | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.setBackgroundDrawable(new ColorDrawable(shellColor));
        window.getDecorView().setBackgroundColor(shellColor);
        int systemBarColor = immersive ? Color.TRANSPARENT : shellColor;
        window.setStatusBarColor(systemBarColor);
        window.setNavigationBarColor(systemBarColor);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.setNavigationBarDividerColor(systemBarColor);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        boolean lightBars = isLight(shellColor);
        controller.setAppearanceLightStatusBars(lightBars);
        controller.setAppearanceLightNavigationBars(lightBars);
        if (immersive) {
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
        ViewCompat.requestApplyInsets(readerWindow);
    }

    private static boolean isLight(int color) {
        double luminance =
                0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color);
        return luminance > 160;
    }
}
