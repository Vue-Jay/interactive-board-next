package ru.lektrus.board;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LektrusSystemUi")
public class LektrusSystemUiPlugin extends Plugin {
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
