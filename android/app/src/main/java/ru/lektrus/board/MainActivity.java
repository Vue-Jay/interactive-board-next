package ru.lektrus.board;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * WebView padding does not reliably move its HTML viewport on Android 15+.
 * Reserve actual physical space using WebView layout margins instead.
 * In the workspace, status bar is hidden and the top margin is released.
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
    public void onCreate(Bundle savedState) {
        registerPlugin(LektrusSystemUiPlugin.class);
        super.onCreate(savedState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        boardWebView = getBridge().getWebView();
        applyBars();
        ViewCompat.setOnApplyWindowInsetsListener(boardWebView, (view, insets) -> {
            Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            Insets navigation = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            Insets tappable = insets.getInsets(WindowInsetsCompat.Type.tappableElement());
            // Use ignoring-visibility inset: status can be temporarily hidden by
            // rotation/transition even though home screens require the space.
            Insets status = insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.statusBars());
            int top = boardMode ? 0 : Math.max(status.top, cutout.top);
            int bottom = tappable.bottom > 0 ? Math.max(navigation.bottom, tappable.bottom) : 0;
            bottom = Math.max(bottom, cutout.bottom);

            // On landscape boards the entire canvas fills the screen. Cutout
            // protection belongs to floating controls, not to the WebView
            // itself (which otherwise leaves a blank stripe along the edge).
            int horizontalLeft = boardMode ? 0 : cutout.left;
            int horizontalRight = boardMode ? 0 : cutout.right;
            ViewGroup.LayoutParams original = view.getLayoutParams();
            if (original instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams margins = (ViewGroup.MarginLayoutParams) original;
                if (margins.topMargin != top || margins.bottomMargin != bottom ||
                    margins.leftMargin != horizontalLeft || margins.rightMargin != horizontalRight) {
                    margins.setMargins(horizontalLeft, top, horizontalRight, bottom);
                    view.setLayoutParams(margins);
                }
            }
            // Never pad the WebView: its viewport origin can remain at y=0.
            if (view.getPaddingTop() != 0 || view.getPaddingBottom() != 0 ||
                view.getPaddingLeft() != 0 || view.getPaddingRight() != 0) {
                view.setPadding(0, 0, 0, 0);
            }
            return insets;
        });
        ViewCompat.requestApplyInsets(boardWebView);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (boardWebView != null) boardWebView.evaluateJavascript(
                    "window.dispatchEvent(new Event('lektrus:native-back'))", null);
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) {
            applyBars();
            if (boardWebView != null) ViewCompat.requestApplyInsets(boardWebView);
        }
    }
}
