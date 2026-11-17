package com.yejian.reader;

import android.app.Activity;
import android.view.Window;
import android.webkit.JavascriptInterface;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * 阅读模式的沉浸控制：隐藏系统状态栏与导航栏，让正文占满屏幕。
 * 由网页根据路由调用 window.YeJianShell.setImmersive(true/false)。
 */
public class ImmersiveBridge {

    private final Activity activity;
    private boolean immersive = false;

    ImmersiveBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void setImmersive(boolean enabled) {
        immersive = enabled;
        activity.runOnUiThread(this::apply);
    }

    /** 从后台返回时重新隐藏系统栏，避免被系统恢复。 */
    void reapply() {
        activity.runOnUiThread(this::apply);
    }

    private void apply() {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        Window window = activity.getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, !immersive);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (immersive) {
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
    }
}
