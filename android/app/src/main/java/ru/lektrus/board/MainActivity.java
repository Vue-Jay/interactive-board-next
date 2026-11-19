package ru.lektrus.board;

import android.os.Bundle;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.net.Uri;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

/**
 * WebView padding does not reliably move its HTML viewport on Android 15+.
 * Reserve actual physical space using WebView layout margins instead.
 * In the workspace, status bar is hidden and the top margin is released.
 */
public class MainActivity extends BridgeActivity {
    private WebView boardWebView;
    private boolean boardMode = false;
    private String lastCutoutInsets = "";
    private final Runnable ensureRouteOrientation = () -> {
        if (hasWindowFocus()) restoreRouteOrientation();
    };

    public void setBoardMode(boolean enabled) {
        runOnUiThread(() -> {
            boardMode = enabled;
            lastCutoutInsets = "";
            restoreRouteOrientation();
            scheduleRouteOrientationRestore();
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

    private void restoreRouteOrientation() {
        if (isInMultiWindowMode()) return;
        int requested = getRequestedOrientation();
        if (!boardMode) {
            // Authentication and every workspace page remain upright even
            // when the device is held sideways or returning from a board.
            if (requested != ActivityInfo.SCREEN_ORIENTATION_PORTRAIT ||
                    getResources().getConfiguration().orientation != Configuration.ORIENTATION_PORTRAIT) {
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            }
            return;
        }
        boolean landscape = getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        boolean landscapeRequested = requested == ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE ||
                requested == ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        if (!landscapeRequested || !landscape) {
            // Android 7/8 may already report the original requested value,
            // yet a late DocumentsUI configuration change rotates the display.
            // Reapply a different *landscape-only* request in that case.
            setRequestedOrientation(!landscape && requested == ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    : ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        }
    }

    private void scheduleRouteOrientationRestore() {
        android.view.View decor = getWindow().getDecorView();
        // The callback reads current boardMode, never the previous route.
        decor.removeCallbacks(ensureRouteOrientation);
        decor.postDelayed(ensureRouteOrientation, 300);
        decor.postDelayed(ensureRouteOrientation, 1200);
    }

    @Override
    public void onResume() {
        super.onResume();
        restoreRouteOrientation();
        scheduleRouteOrientationRestore();
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        int expected = boardMode ? Configuration.ORIENTATION_LANDSCAPE : Configuration.ORIENTATION_PORTRAIT;
        if (configuration.orientation != expected) {
            scheduleRouteOrientationRestore();
        }
    }

    @Override
    public void onCreate(Bundle savedState) {
        registerPlugin(LektrusSystemUiPlugin.class);
        registerPlugin(LektrusFilesPlugin.class);
        super.onCreate(savedState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        boardWebView = getBridge().getWebView();
        // QA instrumentation only: accessibility can omit the WebView during
        // rotation or IME transitions even though its native surface is alive.
        // Expose the measured screen rectangle, not a guessed density or a
        // synthetic DOM gesture. Signed release builds never install this hook.
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            boardWebView.addOnLayoutChangeListener((view, left, top, right, bottom,
                    oldLeft, oldTop, oldRight, oldBottom) -> {
                int[] location = new int[2];
                view.getLocationOnScreen(location);
                int width = view.getWidth();
                int height = view.getHeight();
                if (width > 0 && height > 0) {
                    boardWebView.evaluateJavascript("window.__lektrusQaNativeWebViewRect={x:"
                        + location[0] + ",y:" + location[1] + ",width:" + width
                        + ",height:" + height + "}", null);
                }
            });
        }
        applyBars();
        ViewCompat.setOnApplyWindowInsetsListener(boardWebView, (view, insets) -> {
            Insets cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            Insets navigation = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            Insets tappable = insets.getInsets(WindowInsetsCompat.Type.tappableElement());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            Insets status = insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.statusBars());
            int systemLeft = Math.max(status.left, Math.max(navigation.left, tappable.left));
            int systemRight = Math.max(status.right, Math.max(navigation.right, tappable.right));
            // DisplayCutout insets are physical pixels; export them to CSS in
            // CSS pixels after accounting for the WebView devicePixelRatio.
            // Unlike hard-coded offsets, this responds to each device,
            // display rotation, and camera/notch position.
            String cutoutInsets = cutout.left + "," + cutout.top + "," + cutout.right + "," + cutout.bottom
                + "," + systemLeft + "," + systemRight + "," + status.top;
            if (!cutoutInsets.equals(lastCutoutInsets)) {
                lastCutoutInsets = cutoutInsets;
                ((WebView) view).evaluateJavascript(
                    "(function(){var r=window.devicePixelRatio||1;var s=document.documentElement.style;" +
                    "s.setProperty('--lektrus-cutout-left',(" + cutout.left + "/r)+'px');" +
                    "s.setProperty('--lektrus-cutout-top',(" + cutout.top + "/r)+'px');" +
                    "s.setProperty('--lektrus-cutout-right',(" + cutout.right + "/r)+'px');" +
                    "s.setProperty('--lektrus-cutout-bottom',(" + cutout.bottom + "/r)+'px');" +
                    "s.setProperty('--lektrus-system-left',(" + systemLeft + "/r)+'px');" +
                    "s.setProperty('--lektrus-system-right',(" + systemRight + "/r)+'px');" +
                    "s.setProperty('--lektrus-system-top',(" + status.top + "/r)+'px');" +
                    // CSS max()/clamp() are unavailable on legacy WebView 69/74.
                    "s.setProperty('--lektrus-legacy-safe-left',(" + Math.max(cutout.left, systemLeft) + "/r)+'px');" +
                    "s.setProperty('--lektrus-legacy-safe-right',(" + Math.max(cutout.right, systemRight) + "/r)+'px');" +
                    "s.setProperty('--lektrus-legacy-safe-top',(" + Math.max(cutout.top, status.top) + "/r)+'px');" +
                    "s.setProperty('--lektrus-legacy-safe-bottom',(" + cutout.bottom + "/r)+'px');" +
                    "})();", null);
            }
            // Use ignoring-visibility inset: status can be temporarily hidden by
            // rotation/transition even though home screens require the space.
            int top = boardMode ? 0 : Math.max(status.top, cutout.top);
            int bottom = Math.max(navigation.bottom, tappable.bottom);
            bottom = Math.max(bottom, cutout.bottom);
            if (insets.isVisible(WindowInsetsCompat.Type.ime())) bottom = Math.max(bottom, ime.bottom);

            // On landscape boards the entire canvas fills the screen. Cutout
            // protection belongs to floating controls, not to the WebView
            // itself (which otherwise leaves a blank stripe along the edge).
            int horizontalLeft = boardMode ? 0 : Math.max(cutout.left, systemLeft);
            int horizontalRight = boardMode ? 0 : Math.max(cutout.right, systemRight);
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
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null) return;
        setIntent(intent);
        // Keep a reliable warm-launch handoff even when the Capacitor App
        // plugin's listener was registered after a lifecycle transition.
        Uri url = intent.getData();
        if (boardWebView == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || url == null ||
                !"ru.lektrus.board".equals(url.getScheme()) ||
                !("board".equals(url.getEncodedAuthority()) || "join".equals(url.getEncodedAuthority()))) return;
        String path = "/" + url.getHost() + url.getEncodedPath();
        if (url.getEncodedQuery() != null || url.getEncodedFragment() != null ||
                !path.matches("/(join/[a-f0-9]{64}|board/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})/?")) return;
        if (path.endsWith("/")) path = path.substring(0, path.length() - 1);
        // Use the same history/popstate navigation as the native Back button.
        // This does not require a ready React event listener and never loads
        // remote content; the normal board authorization still runs in App.
        String script = "(function(){var p=" + JSONObject.quote(path) +
                ";if(location.pathname!==p){history.replaceState(null,'',p);" +
                "window.dispatchEvent(new PopStateEvent('popstate'));}return location.pathname;})()";
        boardWebView.post(() -> boardWebView.evaluateJavascript(script, null));
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) {
            // System DocumentsUI is allowed to rotate independently. When
            // it exits, Android 7/8 can leave the board in portrait.
            restoreRouteOrientation();
            scheduleRouteOrientationRestore();
            applyBars();
            if (boardWebView != null) ViewCompat.requestApplyInsets(boardWebView);
        }
    }
}
