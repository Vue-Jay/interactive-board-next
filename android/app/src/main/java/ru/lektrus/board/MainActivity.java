package ru.lektrus.board;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Real Android edge-to-edge insets, with the status bar normally hidden.
 * A swipe from the top reveals the Android notification shade transiently.
 * 3-button navigation has a protected bottom inset; gestures may use the
 * available screen up to the gesture handle.
 */
public class MainActivity extends BridgeActivity {
    private WebView boardWebView;
    private long lastExitPress;

    private void keepStatusBarHidden() {
        WindowInsetsControllerCompat bars = new WindowInsetsControllerCompat(
            getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.statusBars());
        bars.show(WindowInsetsCompat.Type.navigationBars());
        bars.setAppearanceLightNavigationBars(true);
    }

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        boardWebView = getBridge().getWebView();
        keepStatusBarHidden();

        // Avoid stacking native and CSS safe-area padding.
        ViewCompat.setOnApplyWindowInsetsListener(boardWebView, (view, insets) -> {
            Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            Insets navigation = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            Insets tappable = insets.getInsets(WindowInsetsCompat.Type.tappableElement());
            // A physical navigation button strip is tappable, the gesture handle isn't.
            boolean buttons = tappable.bottom > 0;
            int bottom = buttons ? Math.max(navigation.bottom, tappable.bottom) : 0;
            // While the notification shade is revealed, content remains in place.
            view.setPadding(cutout.left, cutout.top,
                cutout.right, Math.max(bottom, cutout.bottom));
            return insets;
        });
        ViewCompat.requestApplyInsets(boardWebView);

        // Android hardware button and system back gesture share this callback.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (boardWebView == null) return;
                boardWebView.evaluateJavascript(
                    "window.dispatchEvent(new Event('lektrus:native-back'))", null);
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) keepStatusBarHidden();
    }
}
