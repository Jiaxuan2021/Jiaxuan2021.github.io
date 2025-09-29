'use strict';

/*
  Site Effects
  - Clouds on the homepage (blue banner background)
  - Click anywhere on empty area to drop a duck image that fades out

  Notes:
  - Requires CSS in /css/custom.css for .clouds-layer, .cloud, .duck-drop
  - Duck image expected at /img/miao.png; fallback to /img/yaziduck.png if missing
  - PJAX supported: re-init clouds after navigation
*/

(function () {
  const DUCK_SRC_PRIMARY = '/img/miao.png';
  const DUCK_SRC_FALLBACK = '/img/yaziduck.png';
  const CLOUD_LAYER_ID = 'clouds-layer';

  function isHome() {
    // Common checks for home route
    if (location.pathname === '/' || location.pathname === '') return true;
    if (document.body && (document.body.classList.contains('home') || document.body.classList.contains('index'))) return true;
    return false;
  }

  function removeClouds() {
    const layer = document.getElementById(CLOUD_LAYER_ID);
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
  }

  function spawnClouds() {
    // Create a fixed layer for clouds
    const layer = document.createElement('div');
    layer.id = CLOUD_LAYER_ID;
    layer.className = 'clouds-layer';

    const cloudCount = 7; // number of clouds
    for (let i = 0; i < cloudCount; i++) {
      const c = document.createElement('div');
      c.className = 'cloud';

      // Randomize vertical position, size, speed, opacity, and initial offset
      const topVh = 8 + Math.random() * 36;             // 8–44vh
      const widthPx = 160 + Math.random() * 240;        // 160–400px
      const heightPx = widthPx * 0.5;                   // keep aspect ratio
      const duration = 40 + Math.random() * 50;         // 40–90s
      const delay = -Math.random() * duration;          // negative to stagger
      const opacity = 0.18 + Math.random() * 0.2;       // 0.18–0.38

      c.style.top = topVh + 'vh';
      c.style.width = widthPx + 'px';
      c.style.height = heightPx + 'px';
      c.style.opacity = String(opacity);
      c.style.animationDuration = duration + 's';
      c.style.animationDelay = delay + 's';

      layer.appendChild(c);
    }

    document.body.appendChild(layer);
  }

  function setupCloudsForHome() {
    removeClouds();
    if (isHome()) spawnClouds();
  }

  function installDuckDropOnce() {
    if (window.__duckClickInstalled) return;
    window.__duckClickInstalled = true;

    document.addEventListener('click', function (e) {
      try {
        // Left button only
        if (e.button !== 0) return;

        // Ignore interactive elements
        const interactive = e.target.closest('a, button, input, textarea, select, label, summary, details, code, pre, .no-duck');
        if (interactive) return;

        // Ignore if selecting text
        const sel = window.getSelection && String(window.getSelection()) || '';
        if (sel.trim()) return;

        // Create duck image at click point
        const img = document.createElement('img');
        img.src = DUCK_SRC_PRIMARY;
        img.alt = 'duck';
        img.className = 'duck-drop';
        img.style.left = (e.clientX) + 'px';
        img.style.top = (e.clientY) + 'px';
        img.style.setProperty('--fall-rotate', ((Math.random() * 40) - 20) + 'deg');
        img.width = 64; // hint layout
        img.height = 64;
        img.onerror = function () { this.onerror = null; this.src = DUCK_SRC_FALLBACK; };

        document.body.appendChild(img);
        img.addEventListener('animationend', function () { img.remove(); });
      } catch (_) {
        // fail-safe: ignore
      }
    }, false);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  // Initial load
  onReady(function () {
    setupCloudsForHome();
    installDuckDropOnce();
  });

  // Re-run after PJAX navigation
  document.addEventListener('pjax:complete', setupCloudsForHome);
})();

