package ru.lektrus.board;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LektrusSystemUi")
public class LektrusSystemUiPlugin extends Plugin {
    @PluginMethod
    public void openAndroidUpdate(PluginCall call) {
        String version = call.getString("version", "");
        if (!version.matches("(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})\\.(0|[1-9][0-9]{0,8})")) {
            call.reject("Invalid update version");
            return;
        }
        // Never accept an arbitrary URL from the WebView: only the fixed,
        // official APK release path. The system installer verifies the signer.
        Uri url = Uri.parse("https://github.com/Vue-Jay/interactive-board-next/releases/download/android-v" + version + "/Lektrus-Android.apk");
        openReleaseUri(call, url);
    }
    @PluginMethod
    public void openAndroidReleasePage(PluginCall call) {
        openReleaseUri(call, Uri.parse("https://github.com/Vue-Jay/interactive-board-next/releases/latest"));
    }
    private void openReleaseUri(PluginCall call, Uri url) {
        getBridge().executeOnMainThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE));
                call.resolve();
            } catch (Exception error) {
                call.reject("Не удалось открыть загрузку обновления", error);
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
