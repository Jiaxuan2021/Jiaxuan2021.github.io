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
  const CLOUD_PRIMARY = '/img/cloud.png'; // optional user-provided
  // Soft cloud SVG fallback (blurred multi-circle)
  const CLOUD_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150" viewBox="0 0 260 150">\
      <defs>\
        <filter id="b" x="-20%" y="-20%" width="140%" height="140%">\
          <feGaussianBlur stdDeviation="6"/>\
        </filter>\
      </defs>\
      <g filter="url(#b)" fill="#fff" fill-opacity="0.98">\
        <circle cx="70" cy="78" r="42"/>\
        <circle cx="105" cy="60" r="52"/>\
        <circle cx="145" cy="80" r="46"/>\
        <circle cx="178" cy="72" r="36"/>\
        <ellipse cx="120" cy="96" rx="90" ry="30"/>\
      </g>\
    </svg>'
  );
  let cloudImageSrc = CLOUD_FALLBACK;

  // Try to use user-provided cloud image if available
  (function preloadCloud() {
    const test = new Image();
    test.onload = function () {
      if (test.naturalWidth > 0) {
        cloudImageSrc = CLOUD_PRIMARY;
        // If already on home and clouds exist, rebuild to use the image
        if (document.getElementById(CLOUD_LAYER_ID)) {
          setupCloudsForHome();
        }
      }
    };
    test.onerror = function () { /* keep fallback */ };
    test.src = CLOUD_PRIMARY;
  })();

  function isHome() {
    if (location.pathname === '/' || location.pathname === '') return true;
    if (document.body && (document.body.classList.contains('home') || document.body.classList.contains('index'))) return true;
    return false;
  }

  function removeClouds() {
    const layer = document.getElementById(CLOUD_LAYER_ID);
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
  }

  function spawnClouds() {
    const layer = document.createElement('div');
    layer.id = CLOUD_LAYER_ID;
    layer.className = 'clouds-layer';

    const cloudCount = 7;
    for (let i = 0; i < cloudCount; i++) {
      const c = document.createElement('div');
      c.className = 'cloud';

      // Randomize near the top band
      const topVh = 2 + Math.random() * 14;             // 2–16vh (near top)
      const widthPx = 120 + Math.random() * 200;        // 120–320px
      const heightPx = widthPx * 0.55;                  // aspect
      const duration = 50 + Math.random() * 70;         // 50–120s
      const delay = -Math.random() * duration;          // negative to stagger
      const opacity = 0.25 + Math.random() * 0.20;      // 0.25–0.45 (less transparent)

      c.style.top = topVh + 'vh';
      c.style.width = widthPx + 'px';
      c.style.height = heightPx + 'px';
      c.style.opacity = String(opacity);
      c.style.animationDuration = duration + 's';
      c.style.animationDelay = delay + 's';
      c.style.backgroundImage = 'url("' + cloudImageSrc + '")';

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
        if (e.button !== 0) return; // left only
        const interactive = e.target.closest('a, button, input, textarea, select, label, summary, details, code, pre, .no-duck');
        if (interactive) return;
        const sel = window.getSelection && String(window.getSelection()) || '';
        if (sel.trim()) return;

        const img = document.createElement('img');
        img.src = DUCK_SRC_PRIMARY;
        img.alt = 'duck';
        img.className = 'duck-drop';
        img.style.left = (e.clientX) + 'px';
        img.style.top = (e.clientY) + 'px';
        img.style.setProperty('--fall-rotate', ((Math.random() * 40) - 20) + 'deg');
        img.width = 32; // half size
        img.height = 32;
        img.onerror = function () { this.onerror = null; this.src = DUCK_SRC_FALLBACK; };

        document.body.appendChild(img);
        img.addEventListener('animationend', function () { img.remove(); });
      } catch (_) { /* ignore */ }
    }, false);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  onReady(function () {
    setupCloudsForHome();
    installDuckDropOnce();
  });
  document.addEventListener('pjax:complete', setupCloudsForHome);
})();
