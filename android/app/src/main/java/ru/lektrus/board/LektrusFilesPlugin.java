package ru.lektrus.board;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Stages bounded chunks in private cache, then lets Android choose the destination. */
@CapacitorPlugin(name = "LektrusFiles")
public class LektrusFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 512 * 1024 * 1024;
    private static final int CHUNK_BYTES = 256 * 1024;
    private String token, name, mime;
    private File staged;
    private int size, written;
    private boolean picking;

    private boolean owns(PluginCall call) {
        return token != null && token.equals(call.getString("token"));
    }

    private void clear() {
        if (staged != null) staged.delete();
        staged = null;
        token = null;
        picking = false;
        written = 0;
    }

    @PluginMethod
    public synchronized void begin(PluginCall call) {
        if (token != null) { call.reject("Дождитесь завершения текущего сохранения"); return; }
        String requestedName = call.getString("name", "");
        String requestedMime = call.getString("mime", "application/octet-stream");
        Integer requestedSize = call.getInt("size");
        if (requestedName.isEmpty() || requestedName.length() > 180 || requestedName.startsWith(".") ||
                requestedName.getBytes(StandardCharsets.UTF_8).length > 240 ||
                requestedName.chars().anyMatch(c -> Character.isISOControl(c) || "\\/:*?\"<>|".indexOf(c) >= 0) ||
                requestedSize == null || requestedSize < 0 || requestedSize > MAX_BYTES) {
            call.reject("Некорректные параметры файла"); return;
        }
        try {
            staged = File.createTempFile("lektrus-export-", ".tmp", getContext().getCacheDir());
            token = UUID.randomUUID().toString();
            name = requestedName;
            mime = requestedMime.matches("[\\w.+-]+/[\\w.+-]+") ? requestedMime : "application/octet-stream";
            size = requestedSize;
            written = 0;
            JSObject response = new JSObject(); response.put("token", token); call.resolve(response);
        } catch (IOException e) { clear(); call.reject("Не удалось подготовить файл", e); }
    }

    @PluginMethod
    public synchronized void append(PluginCall call) {
        Integer offset = call.getInt("offset");
        String encoded = call.getString("data", "");
        if (!owns(call) || picking || offset == null || offset != written || encoded.length() > ((CHUNK_BYTES + 2) / 3) * 4) {
            call.reject("Некорректная часть файла"); return;
        }
        try {
            byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
            if (bytes.length == 0 || bytes.length > CHUNK_BYTES || written + bytes.length > size) {
                call.reject("Некорректный размер части файла"); return;
            }
            try (FileOutputStream stream = new FileOutputStream(staged, true)) { stream.write(bytes); }
            written += bytes.length;
            call.resolve();
        } catch (Exception e) { clear(); call.reject("Не удалось записать файл", e); }
    }

    @PluginMethod
    public synchronized void finish(PluginCall call) {
        if (!owns(call) || picking || written != size) { call.reject("Файл ещё не готов"); return; }
        picking = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        getBridge().executeOnMainThread(() -> {
            try { startActivityForResult(call, intent, "onDestinationChosen"); }
            catch (Exception e) { synchronized (this) { clear(); } call.reject("Не удалось открыть сохранение файла", e); }
        });
    }

    @ActivityCallback
    private void onDestinationChosen(PluginCall call, ActivityResult result) {
        if (call == null) { synchronized (this) { clear(); } return; }
        Uri destination = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || destination == null) {
            synchronized (this) { clear(); }
            JSObject response = new JSObject(); response.put("saved", false); call.resolve(response); return;
        }
        getBridge().execute(() -> {
            synchronized (this) {
                try (FileInputStream input = new FileInputStream(staged);
                     OutputStream output = getContext().getContentResolver().openOutputStream(destination, "w")) {
                    if (output == null) throw new IOException("Destination unavailable");
                    if (staged.length() != size) throw new IOException("Staged file size mismatch");
                    byte[] buffer = new byte[64 * 1024];
                    long copied = 0;
                    for (int count; (count = input.read(buffer)) != -1;) {
                        output.write(buffer, 0, count);
                        copied += count;
                    }
                    if (copied != size) throw new IOException("Copied file size mismatch");
                    output.flush();
                } catch (Exception e) { clear(); call.reject("Не удалось сохранить файл", e); return; }
                clear();
                JSObject response = new JSObject(); response.put("saved", true); call.resolve(response);
            }
        });
    }

    @PluginMethod
    public synchronized void cancel(PluginCall call) {
        if (owns(call) && !picking) clear();
        call.resolve();
    }
}
