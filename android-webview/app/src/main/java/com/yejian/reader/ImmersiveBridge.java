package com.yejian.reader;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * 为系统栏同步当前页面的主题背景。阅读时保留顶部状态栏，隐藏底部导航栏。
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

        if (webView != null) webView.setBackgroundColor(shellColor);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(
                WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                        | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.setBackgroundDrawable(new ColorDrawable(shellColor));
        window.getDecorView().setBackgroundColor(shellColor);
        // 系统栏使用当前纸面色或应用背景色。
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
            // 关键：阅读页必须让状态栏保持可见。
            // 状态栏一旦被 hide()，gesture/顶栏下滑唤出的是 SystemUI 自己绘制的
            // 半透明黑色遮罩（不是应用窗口里的 ColorView），setStatusBarColor 与
            // 图标明暗都对它无效，所以三种阅读主题下都会显示成黑条。
            // 这里只隐藏底部导航栏，状态栏保持可见并持续使用阅读主题纸面色。
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.show(WindowInsetsCompat.Type.statusBars());
            controller.hide(WindowInsetsCompat.Type.navigationBars());
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
