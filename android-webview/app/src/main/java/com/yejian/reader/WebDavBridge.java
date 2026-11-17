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
            try {
                payload = execute(client, method, url, headersJson, bodyBase64);
            } catch (Exception error) {
                if (isCertificateError(error)) {
                    try {
                        payload = execute(insecureClient, method, url, headersJson, bodyBase64);
                    } catch (Exception retryError) {
                        payload = failure(retryError.getMessage());
                    }
                } else {
                    payload = failure(error.getMessage());
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

    private String execute(OkHttpClient httpClient, String method, String url, String headersJson, String bodyBase64) throws Exception {
        RequestBody body = null;
        if (bodyBase64 != null && !bodyBase64.isEmpty()) {
            final byte[] bytes = Base64.decode(bodyBase64, Base64.DEFAULT);
            body = new RequestBody() {
                @Override
                public MediaType contentType() {
                    return null;
                }

                @Override
                public void writeTo(BufferedSink sink) throws IOException {
                    sink.write(bytes);
                }
            };
        }

        Request.Builder builder = new Request.Builder().url(url).method(method, body);
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

    private String failure(String message) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("status", 0);
            payload.put("statusText", "");
            payload.put("headers", new JSONObject());
            payload.put("bodyBase64", "");
            payload.put("error", message == null || message.isEmpty() ? "网络请求失败" : message);
            return payload.toString();
        } catch (Exception ignored) {
            return "{\"status\":0,\"statusText\":\"\",\"headers\":{},\"bodyBase64\":\"\",\"error\":\"网络请求失败\"}";
        }
    }
}
