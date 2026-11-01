package com.doq.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Menu;
import android.view.MenuItem;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.util.Locale;

/**
 * Minimal Android WebView wrapper for the DOQ website.
 *
 * The server URL is configurable at runtime (first launch dialog + menu), so the
 * same APK works with:
 *   - a laptop on the same hotspot:  http://192.168.x.x:8080
 *   - an ngrok / Cloudflare tunnel:  https://xxxx.ngrok-free.app
 *   - a cloud deployment:            https://doq.fly.dev
 */
public class MainActivity extends Activity {

    private static final String PREFS_NAME = "doq_mobile";
    private static final String PREF_SERVER_URL = "server_url";
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooser;
    private String lastLoadedUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(webView);

        configureWebView();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            loadConfiguredServer();
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " DOQMobile/1.0");
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUri(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                lastLoadedUrl = url;
                super.onPageFinished(view, url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String failed = request.getUrl() != null ? request.getUrl().toString() : null;
                    showConnectionError(failed);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (pendingFileChooser != null) {
                    pendingFileChooser.onReceiveValue(null);
                }
                pendingFileChooser = filePathCallback;
                try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception e) {
                    pendingFileChooser = null;
                    return false;
                }
            }
        });
    }

    /** Keep http(s) inside the WebView; hand tel:/mailto:/whatsapp: to the system. */
    private boolean handleUri(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;
        if (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
            // No app installed to handle this scheme.
        }
        return true;
    }

    private String normalizeUrl(String raw) {
        String url = raw == null ? "" : raw.trim();
        if (url.isEmpty()) return "";
        String lower = url.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            url = "http://" + url;
        }
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    private void loadConfiguredServer() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String url = normalizeUrl(prefs.getString(PREF_SERVER_URL, ""));
        if (url.isEmpty()) {
            url = normalizeUrl(BuildConfig.DEFAULT_SERVER_URL);
        }
        if (url.isEmpty()) {
            showServerDialog(true);
            return;
        }
        loadUrl(url);
    }

    private void loadUrl(String url) {
        lastLoadedUrl = url;
        webView.loadUrl(url);
    }

    private void showServerDialog(final boolean firstRun) {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("http://192.168.1.10:8080");
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String current = prefs.getString(PREF_SERVER_URL, "");
        if (current.isEmpty()) current = BuildConfig.DEFAULT_SERVER_URL;
        input.setText(current);
        input.setSelectAllOnFocus(true);

        AlertDialog.Builder builder = new AlertDialog.Builder(this)
                .setTitle("رابط سيرفر دوق")
                .setMessage("ادخل رابط السيرفر:\nhttp://192.168.1.10:8080 (هوتسبوت)\nأو https://xxxx.ngrok-free.app")
                .setView(input)
                .setPositiveButton("حفظ وفتح", (dialog, which) -> {
                    String url = normalizeUrl(input.getText().toString());
                    if (url.isEmpty()) {
                        Toast.makeText(this, "من فضلك ادخل رابط صحيح", Toast.LENGTH_LONG).show();
                        return;
                    }
                    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                            .edit().putString(PREF_SERVER_URL, url).apply();
                    loadUrl(url);
                })
                .setNegativeButton("إلغاء", (dialog, which) -> {
                    if (firstRun) finish();
                });
        builder.setCancelable(!firstRun);
        builder.show();
    }

    private void showConnectionError(String failedUrl) {
        final String target = failedUrl != null ? failedUrl : lastLoadedUrl;
        new AlertDialog.Builder(this)
                .setTitle("تعذر الاتصال بالسيرفر")
                .setMessage("اتأكد إن السيرفر شغال على اللابتوب، والموبايل متصل بنفس الشبكة/الهوتسبوت.\n\n"
                        + "الرابط الحالي: " + (target == null ? "" : target))
                .setPositiveButton("إعادة المحاولة", (dialog, which) -> {
                    if (target != null) webView.loadUrl(target);
                })
                .setNeutralButton("تغيير الرابط", (dialog, which) -> showServerDialog(false))
                .setNegativeButton("إغلاق", null)
                .show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (pendingFileChooser != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    }
                }
                pendingFileChooser.onReceiveValue(results);
                pendingFileChooser = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "إعادة تحميل");
        menu.add(0, 2, 1, "الصفحة الرئيسية");
        menu.add(0, 3, 2, "تغيير رابط السيرفر");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        switch (item.getItemId()) {
            case 1:
                webView.reload();
                return true;
            case 2:
                loadConfiguredServer();
                return true;
            case 3:
                showServerDialog(false);
                return true;
            default:
                return super.onOptionsItemSelected(item);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
