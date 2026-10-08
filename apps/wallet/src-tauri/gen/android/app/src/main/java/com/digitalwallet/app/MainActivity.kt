package com.digitalwallet.app

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  // "top,bottom" in CSS pixels: the space taken by the status bar / cutout and by
  // the navigation bar or keyboard.
  @Volatile private var insets = "0,0"

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  /**
   * The page is drawn edge to edge, so it needs the real system-bar sizes to keep
   * its content clear of them (see src/services/systemBars.ts). The WebView's own
   * safe-area values don't cover the status bar on every Android version.
   */
  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(SystemBars(), "AndroidSystemBars")
    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
      val bars = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
      val density = resources.displayMetrics.density
      val top = Math.round(bars.top / density)
      val bottom = Math.round(maxOf(bars.bottom, keyboard.bottom) / density)
      insets = "$top,$bottom"
      (view as WebView).evaluateJavascript(
        "window.__applySystemBars && window.__applySystemBars('$insets')", null
      )
      windowInsets
    }
  }

  inner class SystemBars {
    /** Read once at startup; later changes are pushed by the insets listener above. */
    @JavascriptInterface
    fun insets(): String = insets

    /** Dark icons for light screens, light icons for dark screens. */
    @JavascriptInterface
    fun setDarkIcons(dark: Boolean) {
      runOnUiThread {
        WindowCompat.getInsetsController(window, window.decorView).apply {
          isAppearanceLightStatusBars = dark
          isAppearanceLightNavigationBars = dark
        }
      }
    }
  }
}
