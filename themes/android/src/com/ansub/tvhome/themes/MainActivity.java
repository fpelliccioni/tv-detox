package com.ansub.tvhome.themes;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.media.tv.TvContract;
import android.media.tv.TvInputInfo;
import android.media.tv.TvInputManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.LruCache;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.TreeMap;

// The home screen is a web page (themes/web, built with React) in a WebView. This activity only
// does what a page can't: list and open apps, read the network state, serve app icons and your
// photos, and tell the page when something changed. The page is served from inside the APK at
// https://tvhome.local/ (intercepted, never fetched: the app has no INTERNET permission).
public class MainActivity extends Activity {
    private static final String HOST = "tvhome.local";
    private static final String ORIGIN = "https://" + HOST + "/";
    private static final List<String> NOT_APPS = Arrays.asList("com.android.tv.settings", "com.android.tv",
            "com.google.android.tvlauncher", "com.google.android.apps.tv.launcherx",
            "com.google.android.leanbacklauncher", "com.ansub.tvhome");
    private static final String INPUT_PLAYER = "com.google.android.tv.inputplayer";
    private static final String[][] LIVE_TV = {{"com.android.tv", "com.android.tv.MainActivity"},
            {"com.droidlogic.android.tv", "com.android.tv.TvActivity"}};

    private WebView web;
    private boolean ready; // the page has loaded and can take events
    private String pending; // settings passed with am start (--es apps/theme/quick), for the page to apply once
    private final LruCache<String, byte[]> icons = new LruCache<String, byte[]>(4 * 1024 * 1024) {
        @Override protected int sizeOf(String k, byte[] v) { return v.length; }
    };

    private final BroadcastReceiver packagesChanged = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            icons.evictAll();
            event("apps");
        }
    };
    private final ConnectivityManager.NetworkCallback networkChanged = new ConnectivityManager.NetworkCallback() {
        @Override public void onAvailable(Network n) { event("network"); }
        @Override public void onLost(Network n) { event("network"); }
        @Override public void onCapabilitiesChanged(Network n, NetworkCapabilities c) { event("network"); }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        pending = extras(getIntent());
        if (getIntent().getBooleanExtra("debug", false)) WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // the page keeps its settings in localStorage
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100); // the TV's font scale would break the layout, which is sized to the screen
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return serve(r.getUrl());
            }
            // Nothing leaves the page: links to anywhere else are ignored.
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !HOST.equals(r.getUrl().getHost());
            }
            @Override public void onPageFinished(WebView v, String url) {
                ready = true;
            }
        });
        setContentView(web);
        web.loadUrl(ORIGIN + "index.html");

        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_PACKAGE_ADDED);
        f.addAction(Intent.ACTION_PACKAGE_REMOVED);
        f.addAction(Intent.ACTION_PACKAGE_CHANGED);
        f.addDataScheme("package");
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(packagesChanged, f, Context.RECEIVER_EXPORTED);
        else registerReceiver(packagesChanged, f);
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) try { cm.registerDefaultNetworkCallback(networkChanged); } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(packagesChanged);
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) try { cm.unregisterNetworkCallback(networkChanged); } catch (Exception ignored) {}
        web.destroy();
        super.onDestroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String e = extras(intent);
        if (e != null) {
            pending = e;
            event("config");
        }
    }

    // Animations stop while an app is in front: the page is told, and the WebView pauses timers.
    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
        event("resume");
    }

    @Override
    protected void onPause() {
        event("pause");
        web.onPause();
        web.pauseTimers();
        super.onPause();
    }

    // Back and Menu go to the page (to close a menu, or open the app menu). A home screen has
    // nothing to go back to, so Back never leaves it.
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (k == KeyEvent.KEYCODE_BACK || k == KeyEvent.KEYCODE_MENU) {
            if (e.getAction() == KeyEvent.ACTION_UP) event(k == KeyEvent.KEYCODE_BACK ? "back" : "menu");
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    private void event(String name) {
        if (!ready) return;
        runOnUiThread(() -> web.evaluateJavascript("window.tvhomeEvent && window.tvhomeEvent('" + name + "')", null));
    }

    private static String extras(Intent i) {
        if (i == null) return null;
        JSONObject o = new JSONObject();
        try {
            for (String k : new String[] {"apps", "quick", "theme", "stamp", "wallpaper"}) {
                String v = i.getStringExtra(k);
                if (v != null) o.put(k, v.trim());
            }
        } catch (JSONException ignored) {}
        return o.length() == 0 ? null : o.toString();
    }

    // ---- What the page fetches from https://tvhome.local/ ----

    private WebResourceResponse serve(Uri u) {
        if (!HOST.equals(u.getHost())) return blocked();
        String path = u.getPath() == null ? "/" : u.getPath();
        try {
            if (path.startsWith("/icon/")) {
                byte[] png = icon(path.substring(6), "1".equals(u.getQueryParameter("banner")));
                return png == null ? missing() : response("image/png", new ByteArrayInputStream(png));
            }
            if (path.startsWith("/photo/")) {
                File f = photo(path.substring(7));
                return f == null ? missing() : response(mime(f.getName()), new FileInputStream(f));
            }
            if (path.equals("/")) path = "/index.html";
            return response(mime(path), getAssets().open("web" + path));
        } catch (Exception e) {
            return missing();
        }
    }

    private static WebResourceResponse response(String mime, InputStream in) {
        WebResourceResponse r = new WebResourceResponse(mime, null, in);
        java.util.Map<String, String> h = new java.util.HashMap<>();
        h.put("Cache-Control", "no-cache");
        r.setResponseHeaders(h);
        return r;
    }

    private static WebResourceResponse missing() {
        WebResourceResponse r = new WebResourceResponse("text/plain", null, new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(404, "Not found");
        return r;
    }

    // Anything not on tvhome.local gets an empty answer, so a theme can't reach the internet.
    private static WebResourceResponse blocked() {
        WebResourceResponse r = new WebResourceResponse("text/plain", null, new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(403, "Blocked");
        return r;
    }

    private static String mime(String p) {
        p = p.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".json")) return "application/json";
        return "image/jpeg";
    }

    // The app's TV banner (16:9), or its icon when it has none or the page asks for the icon.
    private byte[] icon(String pkg, boolean banner) {
        String key = pkg + (banner ? "#b" : "#i");
        byte[] cached = icons.get(key);
        if (cached != null) return cached;
        PackageManager pm = getPackageManager();
        Drawable d = null;
        try {
            if (banner) {
                Intent li = launchIntent(pm, pkg);
                if (li != null) d = pm.getActivityBanner(li);
                if (d == null) d = pm.getApplicationBanner(pkg);
            } else {
                d = pm.getApplicationIcon(pkg);
            }
        } catch (Exception ignored) {}
        if (d == null) return null;
        int w = banner ? 480 : 192, h = banner ? 270 : 192;
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        int iw = d.getIntrinsicWidth(), ih = d.getIntrinsicHeight();
        if (iw <= 0 || ih <= 0) { iw = w; ih = h; }
        float s = Math.max((float) w / iw, (float) h / ih);
        int dw = Math.round(iw * s), dh = Math.round(ih * s);
        d.setBounds((w - dw) / 2, (h - dh) / 2, (w - dw) / 2 + dw, (h - dh) / 2 + dh);
        try { d.draw(new Canvas(b)); } catch (Throwable t) { return null; }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.PNG, 100, out);
        b.recycle();
        byte[] png = out.toByteArray();
        icons.put(key, png);
        return png;
    }

    // Photos live in /sdcard/TVHome (fotos.sh puts them there), or in the app's own folder.
    private File[] photoDirs() {
        return new File[] {new File(Environment.getExternalStorageDirectory(), "TVHome"), getExternalFilesDir(null)};
    }

    private File photo(String rel) {
        if (rel.contains("..")) return null;
        for (File dir : photoDirs()) {
            if (dir == null) continue;
            File f = new File(dir, rel);
            if (f.isFile()) return f;
        }
        return null;
    }

    private static Intent launchIntent(PackageManager pm, String pkg) {
        Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
        return i != null ? i : pm.getLaunchIntentForPackage(pkg);
    }

    private void start(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(i); } catch (Exception ignored) {}
    }

    // ---- What the page can ask for: window.Android.<method>() ----

    private final class Bridge {
        // Every app that can be opened: package, name, whether it has a TV banner, whether you installed it.
        @JavascriptInterface public String apps() {
            PackageManager pm = getPackageManager();
            TreeMap<String, JSONObject> byName = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
            for (String cat : new String[] {Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER})
                for (ResolveInfo ri : pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(cat), 0)) {
                    String pkg = ri.activityInfo.packageName;
                    if (pkg.equals(getPackageName()) || NOT_APPS.contains(pkg)) continue;
                    try {
                        String label = ri.loadLabel(pm).toString();
                        if (byName.containsKey(label) && byName.get(label).getString("pkg").equals(pkg)) continue;
                        JSONObject o = new JSONObject();
                        o.put("pkg", pkg);
                        o.put("label", label);
                        Intent li = launchIntent(pm, pkg);
                        boolean banner = li != null && (pm.getActivityBanner(li) != null || pm.getApplicationBanner(pkg) != null);
                        o.put("banner", banner);
                        int fl = ri.activityInfo.applicationInfo.flags;
                        o.put("user", (fl & ApplicationInfo.FLAG_SYSTEM) == 0 || (fl & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0);
                        o.put("tv", cat.equals(Intent.CATEGORY_LEANBACK_LAUNCHER));
                        byName.put(label, o);
                    } catch (Exception ignored) {}
                }
            return new JSONArray(byName.values()).toString();
        }

        @JavascriptInterface public String config() {
            String c = pending;
            pending = null;
            return c;
        }

        @JavascriptInterface public void open(String pkg) {
            Intent i = launchIntent(getPackageManager(), pkg);
            if (i != null) start(i);
        }

        @JavascriptInterface public void settings(String which) {
            String a;
            switch (which) {
                case "network": a = Settings.ACTION_WIFI_SETTINGS; break;
                case "bluetooth": a = Settings.ACTION_BLUETOOTH_SETTINGS; break;
                case "sound": a = Settings.ACTION_SOUND_SETTINGS; break;
                case "picture": a = Settings.ACTION_DISPLAY_SETTINGS; break;
                default: a = Settings.ACTION_SETTINGS;
            }
            start(new Intent(a));
        }

        @JavascriptInterface public void uninstall(String pkg) {
            start(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg)));
        }

        @JavascriptInterface public void appInfo(String pkg) {
            start(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
        }

        // The TV's own HDMI inputs, in order.
        @JavascriptInterface public String inputs() {
            JSONArray out = new JSONArray();
            TvInputManager tim = (TvInputManager) getSystemService(Context.TV_INPUT_SERVICE);
            if (tim == null) return out.toString();
            try {
                for (TvInputInfo in : tim.getTvInputList()) {
                    if (in.getType() != TvInputInfo.TYPE_HDMI || in.getParentId() != null || in.isHidden(MainActivity.this)) continue;
                    CharSequence l = in.loadCustomLabel(MainActivity.this);
                    if (l == null) l = in.loadLabel(MainActivity.this);
                    JSONObject o = new JSONObject();
                    o.put("id", in.getId());
                    o.put("label", l == null ? "HDMI" : l.toString());
                    out.put(o);
                }
            } catch (Exception ignored) {}
            return out.toString();
        }

        @JavascriptInterface public void openInput(String id) {
            Intent view = new Intent(Intent.ACTION_VIEW, TvContract.buildChannelUriForPassthroughInput(id));
            List<Intent> tries = new ArrayList<>();
            ResolveInfo def = getPackageManager().resolveActivity(view, PackageManager.MATCH_DEFAULT_ONLY);
            if (def != null && def.activityInfo != null && INPUT_PLAYER.equals(def.activityInfo.packageName))
                tries.add(new Intent(view).setClassName(INPUT_PLAYER, def.activityInfo.name));
            for (String[] live : LIVE_TV) {
                Intent t = new Intent(view).setClassName(live[0], live[1]);
                if (t.resolveActivity(getPackageManager()) != null) tries.add(t);
            }
            tries.add(view);
            for (Intent t : tries) {
                t.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { startActivity(t); return; } catch (Exception ignored) {}
            }
        }

        // "offline", "ethernet", or "wifi" with 1 to 3 bars.
        @JavascriptInterface public String network() {
            JSONObject o = new JSONObject();
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkCapabilities nc = cm == null ? null : cm.getNetworkCapabilities(cm.getActiveNetwork());
                if (nc == null) o.put("type", "offline");
                else if (nc.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) o.put("type", "ethernet");
                else {
                    o.put("type", "wifi");
                    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    int rssi = wm == null ? -60 : wm.getConnectionInfo().getRssi();
                    o.put("bars", rssi >= -60 ? 3 : rssi >= -72 ? 2 : 1);
                }
            } catch (Exception e) {
                try { o.put("type", "wifi").put("bars", 3); } catch (JSONException ignored) {}
            }
            return o.toString();
        }

        // Photo file names in a folder of /sdcard/TVHome ("" for the folder itself), for /photo/<folder>/<name>.
        @JavascriptInterface public String photos(String folder) {
            JSONArray out = new JSONArray();
            if (folder.contains("..")) return out.toString();
            for (File dir : photoDirs()) {
                File d = dir == null ? null : new File(dir, folder);
                File[] all = d == null ? null : d.listFiles();
                if (all == null) continue;
                Arrays.sort(all);
                for (File f : all) {
                    String n = f.getName().toLowerCase(Locale.ROOT);
                    if (f.isFile() && (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp")))
                        out.put(f.getName());
                }
                if (out.length() > 0) break;
            }
            return out.toString();
        }

        // For the Terminal theme's neofetch.
        @JavascriptInterface public String device() {
            JSONObject o = new JSONObject();
            try {
                android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo();
                if (am != null) am.getMemoryInfo(mi);
                o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
                o.put("device", Build.DEVICE);
                o.put("android", Build.VERSION.RELEASE);
                o.put("sdk", Build.VERSION.SDK_INT);
                o.put("cpu", Build.HARDWARE + " " + Build.SUPPORTED_ABIS[0]);
                o.put("ramUsed", (mi.totalMem - mi.availMem) / 1048576);
                o.put("ramTotal", mi.totalMem / 1048576);
                o.put("uptime", SystemClock.elapsedRealtime());
            } catch (Exception ignored) {}
            return o.toString();
        }
    }
}
