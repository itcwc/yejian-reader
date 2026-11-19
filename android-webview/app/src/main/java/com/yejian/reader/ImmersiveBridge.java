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
    private int statusBarHeight;
    private boolean immersive = false;
    private int shellColor = Color.parseColor("#F2EFE6");

    ImmersiveBridge(Activity activity, FrameLayout readerWindow, WebView webView) {
        this.activity = activity;
        this.readerWindow = readerWindow;
        this.webView = webView;
        ViewCompat.setOnApplyWindowInsetsListener(readerWindow, (view, insets) -> {
            WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(view);
            if (rootInsets != null) {
                statusBarHeight = rootInsets.getInsetsIgnoringVisibility(
                        WindowInsetsCompat.Type.statusBars()
                                | WindowInsetsCompat.Type.displayCutout()).top;
                updateTopPadding();
            }
            return insets;
        });
    }

    private void updateTopPadding() {
        int top = immersive ? statusBarHeight : 0;
        if (readerWindow.getPaddingTop() != top) readerWindow.setPadding(0, top, 0, 0);
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

        // 关键：始终保持“内容位于系统栏下方”的普通布局，不要进入 edge-to-edge。
        // 一旦 setDecorFitsSystemWindows(false)，系统会把状态栏改为透明并接管绘制，
        // window.setStatusBarColor() 不再决定栏的最终颜色；部分 ROM 在沉浸隐藏失败时
        // 会直接把状态栏画成黑色（首页没进 edge-to-edge，所以颜色一直正常）。
        WindowCompat.setDecorFitsSystemWindows(window, true);

        readerWindow.setBackgroundColor(shellColor);
        webView.setBackgroundColor(shellColor);
        updateTopPadding();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(
                WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                        | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.setBackgroundDrawable(new ColorDrawable(shellColor));
        window.getDecorView().setBackgroundColor(shellColor);
        // 系统栏可见时使用当前主题色。
        window.setStatusBarColor(shellColor);
        window.setNavigationBarColor(shellColor);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.setNavigationBarDividerColor(shellColor);
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
        window.getDecorView().requestApplyInsets();
    }

    private static boolean isLight(int color) {
        double luminance =
                0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color);
        return luminance > 160;
    }
}
