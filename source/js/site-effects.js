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
  try { window.__siteEffectsVersion = '20250929-2'; console.log('site-effects loaded', window.__siteEffectsVersion); } catch(_){}
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

    // Attach to banner if present so clouds don't float over posts on scroll
    const banner = document.querySelector('#banner') || document.querySelector('#page-header') || document.querySelector('.cover') || document.querySelector('.index-banner');
    if (banner) {
      layer.style.position = 'absolute';
      layer.style.inset = '0';
      layer.style.pointerEvents = 'none';
      layer.style.overflow = 'hidden';
      banner.style.position = banner.style.position || 'relative';
      banner.appendChild(layer);
    } else {
      // Fallback to top-fixed limited height
      layer.style.position = 'fixed';
      layer.style.top = '0';
      layer.style.left = '0';
      layer.style.right = '0';
      layer.style.height = '40vh';
      layer.style.pointerEvents = 'none';
      layer.style.overflow = 'hidden';
      document.body.appendChild(layer);
    }

    const cloudCount = 5; // reduce density
    const usedBands = [];
    const minGapVh = 8; // avoid vertical overlaps
    for (let i = 0; i < cloudCount; i++) {
      const c = document.createElement('div');
      c.className = 'cloud';

      // Randomize near the top band
      let attempts = 0;
      let topVh = 2 + Math.random() * 14;             // 2–16vh (near top)
      while (attempts < 12 && usedBands.some(v => Math.abs(v - topVh) < minGapVh)) {
        topVh = 2 + Math.random() * 14;
        attempts++;
      }
      usedBands.push(topVh);
      const widthPx = 120 + Math.random() * 200;        // 120–320px
      const heightPx = widthPx * 0.55;                  // aspect
      const duration = 60 + Math.random() * 90;         // 60–150s
      const delay = -Math.random() * duration;          // negative to stagger
      const opacity = 0.4 + Math.random() * 0.3;        // 0.4–0.7 (less transparent overall)

      c.style.top = topVh + 'vh';
      c.style.width = widthPx + 'px';
      c.style.height = heightPx + 'px';
      c.style.opacity = String(opacity);
      c.style.animationDuration = duration + 's';
      c.style.animationDelay = delay + 's';
      c.style.backgroundImage = 'url("' + cloudImageSrc + '")';

      layer.appendChild(c);
    }
    // layer appended above
  }

  function setupCloudsForHome() {
    removeClouds();
    if (isHome()) spawnClouds();
  }

  // Footer walking duck loop
  function spawnFooterDuckOnce(container) {
    const img = document.createElement('img');
    img.className = 'footer-duck';
    img.src = DUCK_SRC_PRIMARY;
    img.alt = 'duck';
    img.onerror = function () { this.onerror = null; this.src = DUCK_SRC_FALLBACK; };
    // Randomize a slight duration variance per loop to feel organic
    const base = 22; // seconds
    const jitter = Math.random() * 4 - 2; // -2..+2s
    img.style.setProperty('--footer-duck-duration', (base + jitter).toFixed(1) + 's');
    container.appendChild(img);
    img.addEventListener('animationend', function () {
      img.remove();
      // Immediately start next loop without waiting
      spawnFooterDuckOnce(container);
    });
  }

  function setupFooterDuck() {
    const footer = document.getElementById('footer') || document.querySelector('.footer-other') || document.querySelector('.footer');
    if (!footer) return;
    let layer = footer.querySelector('.footer-duck-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'footer-duck-layer';
      layer.style.position = 'absolute';
      layer.style.inset = '0';
      layer.style.pointerEvents = 'none';
      footer.appendChild(layer);
    } else {
      layer.innerHTML = '';
    }
    spawnFooterDuckOnce(layer);
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
    setupFooterDuck();
  });
  document.addEventListener('pjax:complete', function(){
    setupCloudsForHome();
    setupFooterDuck();
  });
})();
