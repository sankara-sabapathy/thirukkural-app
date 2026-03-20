(function () {
  var TOTAL_KURALS = 1330;
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var DAILY_EPOCH_UTC = Date.UTC(2024, 0, 1);
  var params = new URLSearchParams(window.location.search);
  var widgetId = params.get('widgetId') || '';
  var theme = normalizeTheme(params.get('theme'));
  var accent = normalizeAccent(params.get('accent'));
  var requestedKural = parseKuralId(params.get('kural'));
  var root = document.getElementById('widget-root');

  if (!root) {
    return;
  }

  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.setProperty('--widget-accent', accent);
  document.documentElement.style.setProperty('--widget-accent-soft', hexToSoftRgba(accent));

  window.addEventListener('load', postHeight);
  window.addEventListener('resize', postHeight);

  loadKural().catch(function () {
    renderError();
  });

  async function loadKural() {
    var kuralId = requestedKural || getDailyKuralId();
    var chunkId = getChunkId(kuralId);
    var response = await fetch('/data/thirukkural/' + chunkId + '.json');

    if (!response.ok) {
      throw new Error('Failed to load Kural chunk');
    }

    var chunk = await response.json();
    var kural = chunk.find(function (item) { return item.number === kuralId; });

    if (!kural) {
      throw new Error('Kural not found');
    }

    renderKural(kural);
  }

  function renderKural(kural) {
    var detailUrl = 'https://thirukkural.site/kural/' + kural.number + '?utm_source=daily_widget&utm_medium=embed';

    root.className = 'widget-card';
    root.innerHTML =
      '<div class="widget-inner">' +
        '<div class="widget-eyebrow">Daily Thirukkural</div>' +
        '<h1 class="widget-title">Thirukkural ' + escapeHtml(String(kural.number)) + '</h1>' +
        '<p class="widget-meta">' + escapeHtml(kural.adikaram_tr) + ' - ' + escapeHtml(kural.pal_tr) + '</p>' +
        '<div class="widget-lines">' +
          '<p>' + escapeHtml(kural.line1) + '</p>' +
          '<p>' + escapeHtml(kural.line2) + '</p>' +
        '</div>' +
        '<p class="widget-translation">' + escapeHtml(kural.translation) + '</p>' +
        '<div class="widget-tags">' +
          '<span class="widget-tag">' + escapeHtml(kural.pal_tr) + '</span>' +
          '<span class="widget-tag">' + escapeHtml(kural.iyal_tr) + '</span>' +
          '<span class="widget-tag">Adhigaram ' + escapeHtml(String(Math.floor((kural.number - 1) / 10) + 1)) + '</span>' +
        '</div>' +
        '<div class="widget-actions">' +
          '<a class="widget-link" href="' + detailUrl + '" target="_blank" rel="noopener noreferrer">Read full meaning</a>' +
          '<div class="widget-brand">Powered by <a href="https://thirukkural.site/?utm_source=daily_widget&utm_medium=embed" target="_blank" rel="noopener noreferrer">Thirukkural Daily</a></div>' +
        '</div>' +
      '</div>';

    postHeight();
  }

  function renderError() {
    root.className = 'widget-error';
    root.innerHTML = 'Unable to load today&apos;s Thirukkural right now.';
    postHeight();
  }

  function postHeight() {
    if (!widgetId || !window.parent || window.parent === window) {
      return;
    }

    window.parent.postMessage({
      source: 'thirukkural-widget',
      widgetId: widgetId,
      height: document.documentElement.scrollHeight
    }, '*');
  }

  function getDailyKuralId() {
    var todayUtc = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    );
    var daysSinceEpoch = Math.floor((todayUtc - DAILY_EPOCH_UTC) / MS_PER_DAY);
    var normalized = ((daysSinceEpoch % TOTAL_KURALS) + TOTAL_KURALS) % TOTAL_KURALS;
    return normalized + 1;
  }

  function getChunkId(kuralId) {
    var start = Math.floor((kuralId - 1) / 100) * 100 + 1;
    var end = Math.min(start + 99, TOTAL_KURALS);
    return start + '-' + end;
  }

  function parseKuralId(value) {
    if (!value || !/^\d+$/.test(value)) {
      return null;
    }

    var parsed = parseInt(value, 10);
    return parsed >= 1 && parsed <= TOTAL_KURALS ? parsed : null;
  }

  function normalizeTheme(value) {
    if (value === 'dark' || value === 'light') {
      return value;
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function normalizeAccent(value) {
    if (value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
      return value;
    }

    return '#2563eb';
  }

  function hexToSoftRgba(hex) {
    var normalized = hex.replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized.split('').map(function (char) { return char + char; }).join('');
    }

    var red = parseInt(normalized.slice(0, 2), 16);
    var green = parseInt(normalized.slice(2, 4), 16);
    var blue = parseInt(normalized.slice(4, 6), 16);

    return 'rgba(' + red + ', ' + green + ', ' + blue + ', 0.12)';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
