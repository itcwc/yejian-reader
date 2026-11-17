package com.yejian.reader;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 页间安卓壳：通过 WebViewAssetLoader 以 https 源加载本地离线书库，
 * 保证 ES Module、IndexedDB 与 PDF worker 正常工作。
 * 启动后检查 update.json，有新版本时在应用内下载并调起系统安装器。
 */
public class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + APP_HOST + "/assets/hybrid/html/index.html";
    private static final String UPDATE_MANIFEST =
            "https://github.com/itcwc/yejian-reader/releases/latest/download/update.json";
    private static final String UPDATE_PREFIX =
            "https://github.com/itcwc/yejian-reader/releases/download/";
    private static final int PICK_WEB_FILE = 4101;
    private static final int CREATE_BACKUP = 4102;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private DownloadManager downloadManager;
    private long downloadId = -1;
    private String pendingVersion = "";
    private String pendingUrl = "";
    private String pendingSha256 = "";
    private boolean receiverRegistered = false;
    private ValueCallback<Uri[]> filePicker;
    private final BackupWriter backupWriter = new BackupWriter();

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id == downloadId) {
                installDownloadedApk();
            }
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#F2EFE6"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // 允许 http 自建 WebDAV；同时仍需服务端允许 CORS。
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // WebDAV 走原生 OkHttp，不受站点 CORS 限制。
        webView.addJavascriptInterface(new WebDavBridge(webView), "YeJianBridge");
        webView.addJavascriptInterface(backupWriter, "YeJianBackup");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePicker != null) filePicker.onReceiveValue(null);
                filePicker = callback;
                try {
                    Intent picker = params.createIntent();
                    picker.setAction(Intent.ACTION_OPEN_DOCUMENT);
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(picker, PICK_WEB_FILE);
                } catch (Exception error) {
                    filePicker = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (APP_HOST.equals(uri.getHost())) {
                    return false;
                }
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
        });

        downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        registerDownloadReceiver();

        setContentView(webView);
        webView.loadUrl(APP_URL);
        webView.postDelayed(this::checkForUpdates, 3500);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_WEB_FILE && filePicker != null) {
            ValueCallback<Uri[]> callback = filePicker;
            filePicker = null;
            Uri[] files = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData selected = data.getClipData();
                if (selected != null) {
                    files = new Uri[selected.getItemCount()];
                    for (int i = 0; i < files.length; i++) files[i] = selected.getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    files = new Uri[] { data.getData() };
                }
            }
            if (files != null) {
                for (Uri uri : files) {
                    if (uri == null || !"content".equals(uri.getScheme())
                            || (getPackageName() + ".fileprovider").equals(uri.getAuthority())) {
                        files = null;
                        break;
                    }
                }
            }
            callback.onReceiveValue(files);
        } else if (requestCode == CREATE_BACKUP) {
            Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
            backupWriter.chosen(uri);
        }
    }

    private final class BackupWriter {
        private Uri target;
        private OutputStream stream;
        private boolean choosing;

        @JavascriptInterface
        public void choose(String name) {
            runOnUiThread(() -> {
                synchronized (this) {
                    if (choosing || target != null) return;
                    choosing = true;
                }
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/octet-stream");
                intent.putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(intent, CREATE_BACKUP);
                } catch (Exception error) {
                    synchronized (this) { choosing = false; }
                    notifyResult("error");
                }
            });
        }

        private synchronized void chosen(Uri uri) {
            choosing = false;
            if (uri == null) {
                notifyResult("cancelled");
            } else if (!"content".equals(uri.getScheme())) {
                notifyResult("error");
            } else {
                target = uri;
                notifyResult("ready");
            }
        }

        private void notifyResult(String status) {
            webView.evaluateJavascript(
                    "window.__yejianBackupChosen?.(" + JSONObject.quote(status) + ")", null);
        }

        @JavascriptInterface
        public synchronized boolean write(String base64) {
            if (target == null || base64.length() > 350000) return false;
            try {
                if (stream == null) stream = getContentResolver().openOutputStream(target, "w");
                if (stream == null) return false;
                stream.write(Base64.decode(base64, Base64.DEFAULT));
                return true;
            } catch (Exception error) {
                return false;
            }
        }

        @JavascriptInterface
        public synchronized boolean finish() {
            if (stream == null) return false;
            try {
                stream.close();
                stream = null;
                target = null;
                return true;
            } catch (Exception error) {
                return false;
            }
        }

        @JavascriptInterface
        public synchronized void cancel() {
            if (stream != null) {
                try { stream.close(); } catch (Exception ignored) {}
                stream = null;
            }
            if (target != null) {
                try { DocumentsContract.deleteDocument(getContentResolver(), target); }
                catch (Exception ignored) {}
                target = null;
            }
        }
    }

    private void registerDownloadReceiver() {
        if (receiverRegistered) return;
        ContextCompat.registerReceiver(
                this,
                downloadReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_NOT_EXPORTED);
        receiverRegistered = true;
    }

    private String currentVersion() {
        try {
            String version = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            return version == null ? "0.0.0" : version;
        } catch (Exception error) {
            return "0.0.0";
        }
    }

    private void checkForUpdates() {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(UPDATE_MANIFEST).openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "Yejian-Android/" + currentVersion());
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return;

                StringBuilder text = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) text.append(line);
                }

                JSONObject root = new JSONObject(text.toString());
                String version = root.optString("version", "");
                JSONObject android = root.optJSONObject("android");
                if (android == null || version.isEmpty()) return;

                String url = android.optString("url", "");
                String sha256 = android.optString("sha256", "");
                if (!url.startsWith(UPDATE_PREFIX)) return;
                if (!isNewer(version, currentVersion())) return;

                runOnUiThread(() -> showUpdateDialog(version, url, sha256));
            } catch (Exception ignored) {
                // 网络不可用时静默跳过，不影响阅读。
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private boolean isNewer(String remote, String local) {
        String[] remoteParts = remote.split("\\.");
        String[] localParts = local.split("\\.");
        int length = Math.max(remoteParts.length, localParts.length);
        for (int index = 0; index < length; index += 1) {
            int next = index < remoteParts.length ? parsePart(remoteParts[index]) : 0;
            int current = index < localParts.length ? parsePart(localParts[index]) : 0;
            if (next != current) return next > current;
        }
        return false;
    }

    private int parsePart(String value) {
        String digits = value.replaceAll("[^0-9].*$", "");
        try {
            return digits.isEmpty() ? 0 : Integer.parseInt(digits);
        } catch (NumberFormatException error) {
            return 0;
        }
    }

    private void showUpdateDialog(String version, String url, String sha256) {
        new AlertDialog.Builder(this)
                .setTitle("发现新版本 v" + version)
                .setMessage("是否下载并安装？更新不会影响本地书架与阅读进度。")
                .setPositiveButton("下载更新", (dialog, which) -> startUpdate(version, url, sha256))
                .setNegativeButton("稍后", null)
                .show();
    }

    private void startUpdate(String version, String url, String sha256) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getPackageManager().canRequestPackageInstalls()) {
            pendingVersion = version;
            pendingUrl = url;
            pendingSha256 = sha256;
            new AlertDialog.Builder(this)
                    .setTitle("需要安装权限")
                    .setMessage("请允许页间安装应用，返回后会自动继续下载。")
                    .setPositiveButton("去设置", (dialog, which) -> {
                        Intent intent = new Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                    })
                    .setNegativeButton("取消", null)
                    .show();
            return;
        }

        File directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) {
            Toast.makeText(this, "无法创建下载目录", Toast.LENGTH_SHORT).show();
            return;
        }

        String safeVersion = version.replaceAll("[^0-9A-Za-z._-]", "_");
        String fileName = "yejian-update-" + safeVersion + ".apk";
        File target = new File(directory, fileName);
        if (target.exists() && !target.delete()) {
            Toast.makeText(this, "无法覆盖旧安装包", Toast.LENGTH_SHORT).show();
            return;
        }

        pendingVersion = safeVersion;
        pendingUrl = "";
        pendingSha256 = sha256 == null ? "" : sha256;

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("页间 v" + version);
        request.setDescription("正在下载更新包");
        request.setMimeType("application/vnd.android.package-archive");
        request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, fileName);

        try {
            downloadId = downloadManager.enqueue(request);
            Toast.makeText(this, "已开始下载更新", Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Toast.makeText(this, "下载失败，请稍后重试", Toast.LENGTH_SHORT).show();
        }
    }

    private void installDownloadedApk() {
        File directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null || pendingVersion.isEmpty()) return;

        File apk = new File(directory, "yejian-update-" + pendingVersion + ".apk");
        if (!apk.exists()) return;

        if (!pendingSha256.isEmpty() && !pendingSha256.equalsIgnoreCase(sha256(apk))) {
            Toast.makeText(this, "更新包校验失败，请重试", Toast.LENGTH_LONG).show();
            return;
        }

        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (Exception error) {
            Toast.makeText(this, "无法打开安装器", Toast.LENGTH_SHORT).show();
        }
    }

    private String sha256(File file) {
        try (InputStream input = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            StringBuilder result = new StringBuilder();
            for (byte value : digest.digest()) {
                result.append(String.format("%02x", value & 0xff));
            }
            return result.toString();
        } catch (Exception error) {
            return "";
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!pendingUrl.isEmpty()
                && (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getPackageManager().canRequestPackageInstalls())) {
            String url = pendingUrl;
            pendingUrl = "";
            startUpdate(pendingVersion, url, pendingSha256);
        }
    }

    @Override
    protected void onDestroy() {
        if (filePicker != null) {
            filePicker.onReceiveValue(null);
            filePicker = null;
        }
        backupWriter.cancel();
        if (receiverRegistered) {
            try {
                unregisterReceiver(downloadReceiver);
            } catch (Exception ignored) {
                // 接收器可能已由系统注销。
            }
            receiverRegistered = false;
        }
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
