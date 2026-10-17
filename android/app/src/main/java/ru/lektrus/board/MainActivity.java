package ru.lektrus.board;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/** Fit the entire editor inside Android 15/16 status/navigation bars and display cutouts. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);

        WebView webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            if (view.getPaddingLeft() != bars.left || view.getPaddingTop() != bars.top ||
                view.getPaddingRight() != bars.right || view.getPaddingBottom() != bars.bottom) {
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            }
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
