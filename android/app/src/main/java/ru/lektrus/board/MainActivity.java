package ru.lektrus.board;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Use a real WebView viewport within system gestures/buttons, not CSS padding.
 * Hide only the status bar; Android will transiently reveal it on a top-edge
 * swipe, and may dismiss it automatically after a short period.
 */
public class MainActivity extends BridgeActivity {
    private int dp(float n) {
        return Math.round(n * getResources().getDisplayMetrics().density);
    }

    private void hideStatusBar() {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.statusBars());
        controller.setAppearanceLightNavigationBars(true);
    }

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideStatusBar();

        WebView webView = getBridge().getWebView();
        webView.setPadding(0, 0, 0, 0);
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
            Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            Insets nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            Insets taps = insets.getInsets(WindowInsetsCompat.Type.tappableElement());
            // 3-button navbar has a tappable bottom zone; edge gestures do not.
            boolean buttons = nav.bottom > dp(18) &&
                taps.bottom >= Math.max(dp(18), nav.bottom / 2);
            int bottom = buttons ? nav.bottom : Math.min(nav.bottom, dp(4));

            ViewGroup.LayoutParams raw = view.getLayoutParams();
            if (raw instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) raw;
                if (params.topMargin != cutout.top || params.leftMargin != cutout.left ||
                    params.rightMargin != cutout.right || params.bottomMargin != bottom) {
                    params.setMargins(cutout.left, cutout.top, cutout.right, bottom);
                    view.setLayoutParams(params);
                }
            }
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    @Override
    public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) hideStatusBar();
    }
}
