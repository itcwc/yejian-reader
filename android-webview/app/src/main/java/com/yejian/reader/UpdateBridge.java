package com.yejian.reader;

import android.webkit.JavascriptInterface;

/**
 * 供设置页「检查更新」调用的原生桥：
 * 复用启动时的 update.json 检查逻辑，发现新版本后在应用内下载并调起系统安装器。
 */
public class UpdateBridge {

    private final MainActivity activity;

    UpdateBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void check() {
        activity.checkForUpdatesManually();
    }
}
