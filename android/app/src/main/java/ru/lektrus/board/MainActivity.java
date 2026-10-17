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

            ViewGroup.LayoutParams original = view.getLayoutParams();
            if (original instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams margins = (ViewGroup.MarginLayoutParams) original;
                if (margins.topMargin != top || margins.bottomMargin != bottom ||
                    margins.leftMargin != (boardMode ? 0 : cutout.left) ||
                    margins.rightMargin != (boardMode ? 0 : cutout.right)) {
                    margins.setMargins(boardMode ? 0 : cutout.left, top,
                        boardMode ? 0 : cutout.right, bottom);
                    view.setLayoutParams(margins);
                }
            }
            // Never pad the WebView: its viewport origin can remain at y=0.
            if (view.getPaddingTop() != 0 || view.getPaddingBottom() != 0 ||
                view.getPaddingLeft() != 0 || view.getPaddingRight() != 0) {
                view.setPadding(0, 0, 0, 0);
            }
            // Publish physical cutout sizes as CSS pixels for landscape UI.
            // The board canvas fills the screen, while controls stay in safe zones.
            float density = getResources().getDisplayMetrics().density;
            int safeLeft = Math.round(cutout.left / density);
            int safeRight = Math.round(cutout.right / density);
            int safeTop = Math.round(cutout.top / density);
            int safeBottom = Math.round(cutout.bottom / density);
            boardWebView.evaluateJavascript(
                "(function(){var s=document.documentElement.style;" +
                "s.setProperty('--lektrus-cutout-left','" + safeLeft + "px');" +
                "s.setProperty('--lektrus-cutout-right','" + safeRight + "px');" +
                "s.setProperty('--lektrus-cutout-top','" + safeTop + "px');" +
                "s.setProperty('--lektrus-cutout-bottom','" + safeBottom + "px')})()", null);
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
