package ru.lektrus.board;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Workspace screens show a normal Android status bar.
 * Only the open board hides it, retaining swipe-to-show notification access.
 */
public class MainActivity extends BridgeActivity {
    private WebView boardWebView;
    private boolean boardMode = false;

    public void setBoardMode(boolean enabled) {
        runOnUiThread(() -> {
            boardMode = enabled;
            applyBars();
            if (boardWebView != null) ViewCompat.requestApplyInsets(boardWebView);
        });
    }

    private void applyBars() {
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(
            getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
        if (boardMode) controller.hide(WindowInsetsCompat.Type.statusBars());
        else controller.show(WindowInsetsCompat.Type.statusBars());
        controller.show(WindowInsetsCompat.Type.navigationBars());
    }

    @Override
    public void onCreate(Bundle state) {
        registerPlugin(LektrusSystemUiPlugin.class);
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        boardWebView = getBridge().getWebView();
        applyBars();
        ViewCompat.setOnApplyWindowInsetsListener(boardWebView, (view, insets) -> {
            Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            Insets navigation = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            Insets tappable = insets.getInsets(WindowInsetsCompat.Type.tappableElement());
            Insets status = insets.getInsets(WindowInsetsCompat.Type.statusBars());
            int bottom = tappable.bottom > 0 ? Math.max(navigation.bottom, tappable.bottom) : 0;
            // Outside a board, start exactly below the visible Android status bar.
            int top = boardMode ? cutout.top : Math.max(status.top, cutout.top);
            view.setPadding(cutout.left, top, cutout.right, Math.max(bottom, cutout.bottom));
            return insets;
        });
        ViewCompat.requestApplyInsets(boardWebView);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (boardWebView != null) {
                    boardWebView.evaluateJavascript(
                        "window.dispatchEvent(new Event('lektrus:native-back'))", null);
                }
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) applyBars();
    }
}
