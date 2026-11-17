package com.yejian.reader;

import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.IOException;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import java.security.SecureRandom;
import java.security.cert.X509Certificate;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLException;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.BufferedSink;

/**
 * WebDAV 原生传输桥。
 *
 * WebView 内直接 fetch 会被 CORS 拦截，这里用 OkHttp 在原生侧发起请求，
 * 结果以 base64 回传给页面（window.__yejianDavResolve）。
 */
public class WebDavBridge {

    private final WebView webView;
    private final ExecutorService executor = Executors.newFixedThreadPool(3);
    private final OkHttpClient client = new OkHttpClient.Builder()
            .followRedirects(true)
            .followSslRedirects(true)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build();
    /** 自签名证书场景的兜底客户端，仅在证书校验失败时重试一次。 */
    private final OkHttpClient insecureClient = buildInsecureClient();

    private OkHttpClient buildInsecureClient() {
        try {
            X509TrustManager manager = new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) {
                }

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) {
                }

                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
            };
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, new TrustManager[]{manager}, new SecureRandom());
            return client.newBuilder()
                    .sslSocketFactory(context.getSocketFactory(), manager)
                    .hostnameVerifier((hostname, session) -> true)
                    .build();
        } catch (Exception error) {
            return client;
        }
    }

    WebDavBridge(WebView webView) {
        this.webView = webView;
    }

    @JavascriptInterface
    public void request(String id, String method, String url, String headersJson, String bodyBase64) {
        executor.execute(() -> {
            String payload;
            String target = url;
            try {
                payload = execute(client, method, target, headersJson, bodyBase64, false);
            } catch (Exception error) {
                try {
                    if (isCertificateError(error)) {
                        // 自签名证书：放宽校验重试。
                        payload = execute(insecureClient, method, target, headersJson, bodyBase64, false);
                    } else if (isStreamClosed(error) && target.regionMatches(true, 0, "http://", 0, 7)) {
                        // 站点强制 HTTPS 时 http 会被直接断开，升级协议再试。
                        target = "https://" + target.substring(7);
                        try {
                            payload = execute(client, method, target, headersJson, bodyBase64, true);
                        } catch (Exception httpsError) {
                            payload = execute(insecureClient, method, target, headersJson, bodyBase64, true);
                        }
                    } else {
                        payload = execute(client, method, target, headersJson, bodyBase64, true);
                    }
                } catch (Exception retryError) {
                    payload = failure(retryError.getMessage());
                }
            }
            final String json = payload;
            webView.post(() -> webView.evaluateJavascript(
                    "window.__yejianDavResolve(" + JSONObject.quote(id) + "," + JSONObject.quote(json) + ")",
                    null));
        });
    }

    private boolean isCertificateError(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof SSLException) return true;
            String message = current.getMessage();
            if (message != null && message.matches("(?i).*(certificate|trust anchor|self signed|hostname).*")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String execute(OkHttpClient httpClient, String method, String url, String headersJson,
                           String bodyBase64, boolean closeConnection) throws Exception {
        RequestBody body = null;
        if (bodyBase64 != null && !bodyBase64.isEmpty()) {
            final byte[] bytes = Base64.decode(bodyBase64, Base64.DEFAULT);
            body = new RequestBody() {
                @Override
                public MediaType contentType() {
                    return null;
                }

                @Override
                public long contentLength() {
                    // 明确长度，避免 PROPFIND / MKCOL 走 chunked 被部分 WebDAV 服务端直接断开。
                    return bytes.length;
                }

                @Override
                public void writeTo(BufferedSink sink) throws IOException {
                    sink.write(bytes);
                }
            };
        }

        Request.Builder builder = new Request.Builder().url(url).method(method, body);
        if (closeConnection) {
            builder.header("Connection", "close");
        }
        if (headersJson != null && !headersJson.isEmpty()) {
            JSONObject headers = new JSONObject(headersJson);
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                builder.header(key, headers.optString(key));
            }
        }

        try (Response response = httpClient.newCall(builder.build()).execute()) {
            ResponseBody responseBody = response.body();
            String encoded = responseBody == null
                    ? ""
                    : Base64.encodeToString(responseBody.bytes(), Base64.NO_WRAP);

            JSONObject headerMap = new JSONObject();
            Headers responseHeaders = response.headers();
            for (String name : responseHeaders.names()) {
                headerMap.put(name, responseHeaders.get(name));
            }

            JSONObject payload = new JSONObject();
            payload.put("status", response.code());
            payload.put("statusText", response.message());
            payload.put("headers", headerMap);
            payload.put("bodyBase64", encoded);
            return payload.toString();
        }
    }

    private boolean isStreamClosed(Throwable error) {
        Throwable current = error;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.toLowerCase().contains("unexpected end of stream")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String failure(String message) {
        String detail = message == null || message.isEmpty() ? "网络请求失败" : message;
        if (detail.toLowerCase().contains("unexpected end of stream")) {
            detail = "服务器在返回数据前断开了连接，若站点强制使用 HTTPS，请把地址改为 https:// 后重试";
        }
        try {
            JSONObject payload = new JSONObject();
            payload.put("status", 0);
            payload.put("statusText", "");
            payload.put("headers", new JSONObject());
            payload.put("bodyBase64", "");
            payload.put("error", detail);
            return payload.toString();
        } catch (Exception ignored) {
            return "{\"status\":0,\"statusText\":\"\",\"headers\":{},\"bodyBase64\":\"\",\"error\":\"网络请求失败\"}";
        }
    }
}
