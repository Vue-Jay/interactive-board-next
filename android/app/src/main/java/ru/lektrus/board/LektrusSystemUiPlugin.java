package ru.lektrus.board;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "LektrusSystemUi")
public class LektrusSystemUiPlugin extends Plugin {
    private static final String BASE = "https://lektrus.ru/api/v1/mobile/android-apk/";
    private static final String APK = "Lektrus-Android.apk";
    private static final long MAX_APK = 100L * 1024 * 1024;
    private static final Pattern VERSION = Pattern.compile("(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})");
    private static final Pattern CHECKSUM = Pattern.compile("([a-fA-F0-9]{64})[ \\t]+\\*?Lektrus-Android\\.apk\\s*");
    private final AtomicBoolean downloading = new AtomicBoolean(false);

    private HttpsURLConnection connect(String version, String name) throws Exception {
        HttpsURLConnection conn = (HttpsURLConnection) new URL(BASE + version + "/" + name).openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(60000);
        conn.setRequestProperty("Accept-Encoding", "identity");
        try {
            if (conn.getResponseCode() != 200) throw new IllegalStateException("APK server unavailable");
            return conn;
        } catch (Exception e) {
            conn.disconnect();
            throw e;
        }
    }

    private String expectedHash(String version) throws Exception {
        HttpsURLConnection conn = connect(version, APK + ".sha256");
        try (InputStream input = conn.getInputStream()) {
            byte[] bytes = new byte[1025];
            int count = 0;
            while (count < bytes.length) {
                int n = input.read(bytes, count, bytes.length - count);
                if (n < 0) break;
                count += n;
            }
            if (count > 1024) throw new IllegalStateException("Invalid checksum");
            Matcher matcher = CHECKSUM.matcher(new String(bytes, 0, count, StandardCharsets.US_ASCII).trim());
            if (!matcher.matches()) throw new IllegalStateException("Invalid checksum");
            return matcher.group(1).toLowerCase(Locale.ROOT);
        } finally { conn.disconnect(); }
    }

    private String hex(byte[] value) {
        StringBuilder result = new StringBuilder();
        for (byte b : value) result.append(String.format(Locale.ROOT, "%02x", b & 255));
        return result.toString();
    }

    private String fileHash(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[65536];
            int n;
            while ((n = input.read(buffer)) != -1) digest.update(buffer, 0, n);
        }
        return hex(digest.digest());
    }

    // Verify package identity, version, and the installed release certificate
    // before handing an APK to the OS. Android independently verifies it again.
    @SuppressWarnings("deprecation")
    private void verifyPackage(File file, String version) throws Exception {
        PackageManager manager = getContext().getPackageManager();
        String packageName = getContext().getPackageName();
        PackageInfo installed = manager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
        PackageInfo candidate = manager.getPackageArchiveInfo(file.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        if (candidate == null || !packageName.equals(candidate.packageName) || !version.equals(candidate.versionName)
                || candidate.signatures == null || installed.signatures == null
                || !Arrays.equals(candidate.signatures, installed.signatures)) {
            throw new IllegalStateException("APK identity or signature mismatch");
        }
        long oldCode = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
        long newCode = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
        if (newCode <= oldCode) throw new IllegalStateException("APK is not newer");
    }

    private void progress(long count, long total) {
        JSObject data = new JSObject();
        data.put("received", count);
        data.put("total", total);
        getBridge().executeOnMainThread(() -> notifyListeners("androidUpdateProgress", data));
    }

    private File obtainApk(String version, long size) throws Exception {
        File dir = new File(getContext().getCacheDir(), "android-updates");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("Cannot create APK cache");
        File apk = new File(dir, version + ".apk");
        String expected = expectedHash(version);
        if (apk.isFile() && apk.length() == size && expected.equals(fileHash(apk))) {
            verifyPackage(apk, version);
            progress(size, size);
            return apk;
        }
        File part = new File(dir, version + ".part");
        HttpsURLConnection conn = connect(version, APK);
        try {
            long length = conn.getContentLengthLong();
            if (length > 0 && length != size) throw new IllegalStateException("Unexpected APK length");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long count = 0, last = 0;
            try (InputStream input = conn.getInputStream(); FileOutputStream output = new FileOutputStream(part)) {
                byte[] buffer = new byte[65536];
                int n;
                while ((n = input.read(buffer)) != -1) {
                    count += n;
                    if (count > size || count > MAX_APK) throw new IllegalStateException("Unexpected APK length");
                    digest.update(buffer, 0, n);
                    output.write(buffer, 0, n);
                    if (count - last >= 256 * 1024 || count == size) {
                        progress(count, size);
                        last = count;
                    }
                }
            }
            if (count != size || !expected.equals(hex(digest.digest()))) throw new IllegalStateException("APK checksum mismatch");
            // Android's archive parser requires the .apk filename.
            if (apk.exists() && !apk.delete()) throw new IllegalStateException("Cannot replace cached APK");
            if (!part.renameTo(apk)) throw new IllegalStateException("Cannot finalize APK");
            try { verifyPackage(apk, version); }
            catch (Exception error) { apk.delete(); throw error; }
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) if (!f.equals(apk)) f.delete();
            return apk;
        } finally {
            conn.disconnect();
            part.delete();
        }
    }

    @PluginMethod
    public void openAndroidUpdate(PluginCall call) {
        String version = call.getString("version", "");
        Integer size = call.getInt("sizeBytes");
        if (!VERSION.matcher(version).matches() || size == null || size <= 0 || size > MAX_APK) {
            call.reject("Invalid update metadata");
            return;
        }
        if (!downloading.compareAndSet(false, true)) {
            call.reject("Update download already running");
            return;
        }
        new Thread(() -> {
            try {
                File apk = obtainApk(version, size);
                getBridge().executeOnMainThread(() -> {
                    try {
                        JSObject result = new JSObject();
                        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + getContext().getPackageName())));
                            result.put("state", "permission");
                        } else {
                            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                            Intent intent = new Intent(Intent.ACTION_VIEW);
                            intent.setDataAndType(uri, "application/vnd.android.package-archive");
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            getActivity().startActivity(intent);
                            result.put("state", "installer");
                        }
                        call.resolve(result);
                    } catch (Exception error) {
                        call.reject("Не удалось открыть установщик Android", error);
                    } finally { downloading.set(false); }
                });
            } catch (Exception error) {
                downloading.set(false);
                getBridge().executeOnMainThread(() -> call.reject("Не удалось загрузить или проверить APK", error));
            }
        }, "lektrus-apk-download").start();
    }

    @PluginMethod
    public void openAndroidReleasePage(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://lektrus.ru/#download")).addCategory(Intent.CATEGORY_BROWSABLE));
                call.resolve();
            } catch (Exception error) {
                call.reject("Не удалось открыть страницу загрузки", error);
            }
        });
    }

    @PluginMethod
    public void setBoardMode(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("Missing board-mode flag");
            return;
        }
        ((MainActivity) getActivity()).setBoardMode(enabled);
        call.resolve();
    }
}
