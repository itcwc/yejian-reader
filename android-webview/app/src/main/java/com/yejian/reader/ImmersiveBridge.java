package com.yejian.reader;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * 阅读模式的沉浸控制：隐藏系统状态栏与导航栏，让正文占满屏幕。
 * 由网页根据路由调用 window.YeJianShell.setImmersive(true/false)，
 * 并通过 setShellColor 同步当前主题底色，避免系统栏区域露出黑色底。
 */
public class ImmersiveBridge {

    private final Activity activity;
    private final WebView webView;
    private boolean immersive = false;
    private int shellColor = Color.parseColor("#F2EFE6");

    ImmersiveBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void setImmersive(boolean enabled) {
        immersive = enabled;
        activity.runOnUiThread(this::apply);
    }

    /** 网页主题变化时同步窗口底色（阅读页传纸面颜色，其它页面传应用背景色）。 */
    @JavascriptInterface
    public void setShellColor(String color) {
        try {
            shellColor = Color.parseColor(color);
        } catch (IllegalArgumentException ignored) {
            return;
        }
        activity.runOnUiThread(this::apply);
    }

    /** 从后台返回时重新隐藏系统栏，避免被系统恢复。 */
    void reapply() {
        activity.runOnUiThread(this::apply);
    }

    private void apply() {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        Window window = activity.getWindow();

        if (webView != null) webView.setBackgroundColor(shellColor);
        window.setBackgroundDrawable(new ColorDrawable(shellColor));
        window.getDecorView().setBackgroundColor(shellColor);
        // 沉浸时系统栏透明，露出与纸面一致的窗口底色；普通页面使用主题背景色。
        window.setStatusBarColor(immersive ? Color.TRANSPARENT : shellColor);
        window.setNavigationBarColor(immersive ? Color.TRANSPARENT : shellColor);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        WindowCompat.setDecorFitsSystemWindows(window, !immersive);
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
    }

    private static boolean isLight(int color) {
        double luminance =
                0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color);
        return luminance > 160;
    }
}
