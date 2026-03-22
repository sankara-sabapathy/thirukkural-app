(function () {
  var TOTAL_KURALS = 1330;
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var DAILY_EPOCH_UTC = Date.UTC(2024, 0, 1);
  var params = new URLSearchParams(window.location.search);
  var widgetId = params.get('widgetId') || '';
  var requestedKural = parseKuralId(params.get('kural'));
  var mode = normalizeMode(params.get('mode'), requestedKural);
  var theme = resolveTheme(params.get('theme'));
  var layout = normalizeChoice(params.get('layout'), ['spotlight', 'compact', 'minimal', 'banner', 'square', 'ticker']) || 'spotlight';
  var language = normalizeChoice(params.get('language'), ['bilingual', 'tamil', 'english']) || 'bilingual';
  var meaning = normalizeChoice(params.get('meaning'), ['translation', 'couplet', 'explanation']) || 'translation';
  var align = normalizeChoice(params.get('align'), ['left', 'center']) || 'left';
  var accent = normalizeAccent(params.get('accent'));
  var radius = normalizeNumber(params.get('radius'), 0, 32, 22);
  var shadow = normalizeChoice(params.get('shadow'), ['none', 'soft', 'strong']) || 'soft';
  var fontScale = normalizeFloat(params.get('fontScale'), 0.9, 1.2, 1);
  var speed = normalizeChoice(params.get('speed'), ['slow', 'normal', 'fast']) || 'normal';
  var scrollDirection = normalizeChoice(params.get('scrollDirection'), ['rtl', 'ltr']) || 'rtl';
  var pauseOnHover = normalizeBoolean(params.get('pauseOnHover'), true);
  var showMeta = normalizeBoolean(params.get('showMeta'), true);
  var showTags = normalizeBoolean(params.get('showTags'), layout !== 'minimal');
  var showRefresh = mode === 'random' && normalizeBoolean(params.get('showRefresh'), layout !== 'ticker');
  var ctaText = normalizeText(params.get('ctaText'), 48);
  var parentOrigin = resolveParentOrigin();
  var root = document.getElementById('widget-root');
  var resizeObserver = null;
  var currentKuralNumber = null;

  if (!root) {
    return;
  }

  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-layout', layout);
  document.documentElement.setAttribute('data-align', align);
  document.documentElement.setAttribute('data-shadow', shadow);
  document.documentElement.setAttribute('data-scroll-direction', scrollDirection);
  document.documentElement.setAttribute('data-pause-hover', pauseOnHover ? 'true' : 'false');
  document.documentElement.style.setProperty('--widget-accent', accent);
  document.documentElement.style.setProperty('--widget-accent-soft', hexToSoftRgba(accent, 0.16));
  document.documentElement.style.setProperty('--widget-accent-outline', hexToSoftRgba(accent, 0.24));
  document.documentElement.style.setProperty('--widget-radius', radius + 'px');
  document.documentElement.style.setProperty('--widget-font-scale', String(fontScale));
  document.documentElement.style.setProperty('--widget-ticker-duration', getTickerDuration(speed));

  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(postHeight);
    resizeObserver.observe(document.body);
    resizeObserver.observe(document.documentElement);
  } else {
    window.addEventListener('resize', postHeight);
  }

  window.addEventListener('load', postHeight);

  renderLoading();
  loadKural(false).catch(renderError);

  async function loadKural(forceNewRandom) {
    var kuralId = resolveKuralId(forceNewRandom);
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

    currentKuralNumber = kural.number;
    renderKural(kural);
  }

  function resolveKuralId(forceNewRandom) {
    if (mode === 'fixed' && requestedKural) {
      return requestedKural;
    }

    if (mode === 'daily') {
      return getDailyKuralId();
    }

    return getRandomKuralId(forceNewRandom ? currentKuralNumber : null);
  }

  function renderLoading() {
    root.className = 'widget-state widget-loading';
    root.innerHTML =
      '<div class="widget-state-inner">' +
        '<div class="widget-spinner" aria-hidden="true"></div>' +
        '<p>Loading a Thirukkural...</p>' +
      '</div>';
    postHeight();
  }

  function renderKural(kural) {
    var chapterId = Math.floor((kural.number - 1) / 10) + 1;
    var detailUrl = buildDetailUrl(kural.number);
    var homeUrl = buildHomeUrl();
    var meaningText = pickMeaning(kural);
    var eyebrowLabel = mode === 'daily'
      ? 'Today\'s Thirukkural'
      : mode === 'fixed'
        ? 'Featured Thirukkural'
        : 'Random Thirukkural';

    root.className = 'widget-ready';
    if (layout === 'ticker') {
      root.innerHTML = buildTickerCard(kural, meaningText, detailUrl, eyebrowLabel);
      bindActions();
      postHeight();
      return;
    }

    root.innerHTML =
      '<article class="widget-card" data-layout="' + escapeHtml(layout) + '">' +
        '<div class="widget-inner">' +
          '<div class="widget-head">' +
            '<div class="widget-title-wrap">' +
              '<div class="widget-eyebrow">' + escapeHtml(eyebrowLabel) + '</div>' +
              '<h1 class="widget-title">Thirukkural ' + escapeHtml(String(kural.number)) + '</h1>' +
              (showMeta ? '<p class="widget-meta">' + escapeHtml(kural.adikaram_tr) + ' - ' + escapeHtml(kural.iyal_tr) + ' - ' + escapeHtml(kural.pal_tr) + '</p>' : '') +
            '</div>' +
            (showRefresh ? '<button class="widget-refresh" type="button" data-action="refresh">Show another</button>' : '') +
          '</div>' +
          buildBody(kural, meaningText) +
          (showTags ? buildTags(kural, chapterId) : '') +
          '<div class="widget-actions">' +
            '<div class="widget-action-group">' +
              '<a class="widget-link" href="' + escapeHtml(detailUrl) + '" target="_blank" rel="nofollow noopener noreferrer">' +
                escapeHtml(ctaText || ('Read Thirukkural ' + kural.number)) +
              '</a>' +
            '</div>' +
            '<div class="widget-brand">' +
              'Powered by <a href="' + escapeHtml(homeUrl) + '" target="_blank" rel="nofollow noopener noreferrer">Thirukkural Daily</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';

    bindActions();
    postHeight();
  }

  function buildTickerCard(kural, meaningText, detailUrl, eyebrowLabel) {
    var tickerText = buildTickerText(kural, meaningText);
    var chapterId = Math.floor((kural.number - 1) / 10) + 1;
    var defaultCta = mode === 'fixed' ? 'Open Kural' : 'Read ' + kural.number;

    return (
      '<article class="widget-card" data-layout="ticker">' +
        '<div class="widget-ticker-shell">' +
          '<div class="widget-ticker-badge">' +
            '<span class="widget-ticker-badge-title">Thirukkural Daily</span>' +
            '<span class="widget-ticker-badge-mode">' + escapeHtml(eyebrowLabel) + '</span>' +
          '</div>' +
          '<div class="widget-ticker-viewport" aria-label="Scrolling Thirukkural ticker">' +
            '<div class="widget-ticker-track">' +
              buildTickerRun(kural, chapterId, tickerText, false) +
              buildTickerRun(kural, chapterId, tickerText, true) +
            '</div>' +
          '</div>' +
          '<div class="widget-ticker-tools">' +
            (showRefresh ? '<button class="widget-refresh widget-control-inline" type="button" data-action="refresh">Next</button>' : '') +
            '<a class="widget-link widget-control-inline" href="' + escapeHtml(detailUrl) + '" target="_blank" rel="nofollow noopener noreferrer">' +
              escapeHtml(ctaText || defaultCta) +
            '</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function buildTickerRun(kural, chapterId, tickerText, isDuplicate) {
    return (
      '<div class="widget-ticker-run"' + (isDuplicate ? ' aria-hidden="true"' : '') + '>' +
        '<span class="widget-ticker-token widget-ticker-kural">Thirukkural ' + escapeHtml(String(kural.number)) + '</span>' +
        '<span class="widget-ticker-separator">&bull;</span>' +
        '<span class="widget-ticker-copy">' + escapeHtml(tickerText) + '</span>' +
        '<span class="widget-ticker-separator">&bull;</span>' +
        '<span class="widget-ticker-token">' + escapeHtml(kural.adikaram_tr) + '</span>' +
        '<span class="widget-ticker-separator">&bull;</span>' +
        '<span class="widget-ticker-token">Adhigaram ' + escapeHtml(String(chapterId)) + '</span>' +
      '</div>'
    );
  }

  function buildTickerText(kural, meaningText) {
    if (language === 'tamil') {
      return kural.line1 + ' ' + kural.line2;
    }

    if (language === 'english') {
      return meaningText;
    }

    return kural.line1 + ' ' + kural.line2 + ' - ' + meaningText;
  }

  function buildBody(kural, meaningText) {
    var linesHtml = '';
    var meaningHtml = '';

    if (language !== 'english') {
      linesHtml =
        '<div class="widget-lines">' +
          '<p>' + escapeHtml(kural.line1) + '</p>' +
          '<p>' + escapeHtml(kural.line2) + '</p>' +
        '</div>';
    }

    if (language !== 'tamil') {
      meaningHtml = '<p class="widget-meaning">' + escapeHtml(meaningText) + '</p>';
    }

    if (layout === 'minimal') {
      return '<div class="widget-body widget-body-minimal">' + linesHtml + meaningHtml + '</div>';
    }

    if (layout === 'banner') {
      return '<div class="widget-body widget-body-banner">' + linesHtml + meaningHtml + '</div>';
    }

    if (layout === 'square') {
      return '<div class="widget-body widget-body-square">' + linesHtml + meaningHtml + '</div>';
    }

    if (layout === 'compact') {
      return '<div class="widget-body widget-body-compact">' + linesHtml + meaningHtml + '</div>';
    }

    return '<div class="widget-body widget-body-spotlight">' + linesHtml + meaningHtml + '</div>';
  }

  function buildTags(kural, chapterId) {
    return (
      '<div class="widget-tags">' +
        '<span class="widget-tag">' + escapeHtml(kural.pal_tr) + '</span>' +
        '<span class="widget-tag">' + escapeHtml(kural.iyal_tr) + '</span>' +
        '<span class="widget-tag">Adhigaram ' + escapeHtml(String(chapterId)) + '</span>' +
      '</div>'
    );
  }

  function bindActions() {
    var refreshButton = root.querySelector('[data-action="refresh"]');
    if (!refreshButton) {
      return;
    }

    refreshButton.addEventListener('click', function () {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Loading...';
      loadKural(true).catch(renderError);
    });
  }

  function renderError() {
    root.className = 'widget-state widget-error';
    root.innerHTML =
      '<div class="widget-state-inner">' +
        '<p>Unable to load a Thirukkural right now.</p>' +
        '<button class="widget-refresh" type="button" data-action="retry">Try again</button>' +
      '</div>';

    var retry = root.querySelector('[data-action="retry"]');
    if (retry) {
      retry.addEventListener('click', function () {
        renderLoading();
        loadKural(true).catch(renderError);
      });
    }

    postHeight();
  }

  function postHeight() {
    if (!widgetId || !window.parent || window.parent === window) {
      return;
    }

    var targetOrigin = parentOrigin || '*';
    window.parent.postMessage({
      source: 'thirukkural-widget',
      widgetId: widgetId,
      height: document.documentElement.scrollHeight
    }, targetOrigin);
  }

  function resolveParentOrigin() {
    if (!document.referrer) {
      return '';
    }

    try {
      return new URL(document.referrer).origin;
    } catch (error) {
      return '';
    }
  }

  function buildDetailUrl(kuralNumber) {
    return '/kural/' + kuralNumber + '?utm_source=thirukkural_widget&utm_medium=embed';
  }

  function buildHomeUrl() {
    return '/?utm_source=thirukkural_widget&utm_medium=embed';
  }

  function pickMeaning(kural) {
    if (meaning === 'couplet' && kural.couplet) {
      return kural.couplet;
    }

    if (meaning === 'explanation' && kural.explanation) {
      return kural.explanation;
    }

    return kural.translation || kural.couplet || kural.explanation || '';
  }

  function getDailyKuralId() {
    var now = new Date();
    var todayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    var daysSinceEpoch = Math.floor((todayUtc - DAILY_EPOCH_UTC) / MS_PER_DAY);
    var normalized = ((daysSinceEpoch % TOTAL_KURALS) + TOTAL_KURALS) % TOTAL_KURALS;
    return normalized + 1;
  }

  function getRandomKuralId(previousKuralNumber) {
    var candidate = previousKuralNumber;

    while (candidate === previousKuralNumber || !candidate) {
      if (window.crypto && window.crypto.getRandomValues) {
        var bytes = new Uint32Array(1);
        window.crypto.getRandomValues(bytes);
        candidate = (bytes[0] % TOTAL_KURALS) + 1;
      } else {
        candidate = Math.floor(Math.random() * TOTAL_KURALS) + 1;
      }
    }

    return candidate;
  }

  function getChunkId(kuralId) {
    var start = Math.floor((kuralId - 1) / 100) * 100 + 1;
    var end = Math.min(start + 99, TOTAL_KURALS);
    return start + '-' + end;
  }

  function parseKuralId(value) {
    if (!value || !/^\d+$/.test(String(value))) {
      return null;
    }

    var parsed = parseInt(value, 10);
    return parsed >= 1 && parsed <= TOTAL_KURALS ? parsed : null;
  }

  function normalizeMode(value, kuralId) {
    var normalized = normalizeChoice(value, ['random', 'daily', 'fixed']);
    if (normalized) {
      return normalized === 'fixed' && !kuralId ? 'random' : normalized;
    }

    return kuralId ? 'fixed' : 'random';
  }

  function resolveTheme(value) {
    var normalized = normalizeChoice(value, ['light', 'dark', 'auto']) || 'auto';
    if (normalized === 'light' || normalized === 'dark') {
      return normalized;
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function normalizeChoice(value, allowed) {
    if (!value) {
      return '';
    }

    var normalized = String(value).trim().toLowerCase();
    return allowed.indexOf(normalized) >= 0 ? normalized : '';
  }

  function normalizeAccent(value) {
    if (value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value).trim())) {
      return String(value).trim();
    }

    return '#2563eb';
  }

  function normalizeBoolean(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    var normalized = String(value).trim().toLowerCase();
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }

    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }

    return fallback;
  }

  function normalizeNumber(value, min, max, fallback) {
    if (!value) {
      return fallback;
    }

    var parsed = parseInt(String(value).trim(), 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, parsed));
  }

  function normalizeFloat(value, min, max, fallback) {
    if (!value) {
      return fallback;
    }

    var parsed = parseFloat(String(value).trim());
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, parsed));
  }

  function normalizeText(value, maxLength) {
    if (!value) {
      return '';
    }

    return String(value).trim().slice(0, maxLength);
  }

  function getTickerDuration(value) {
    if (value === 'slow') {
      return '34s';
    }

    if (value === 'fast') {
      return '18s';
    }

    return '24s';
  }

  function hexToSoftRgba(hex, alpha) {
    var normalized = hex.replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized.split('').map(function (char) { return char + char; }).join('');
    }

    var red = parseInt(normalized.slice(0, 2), 16);
    var green = parseInt(normalized.slice(2, 4), 16);
    var blue = parseInt(normalized.slice(4, 6), 16);

    return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + alpha + ')';
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
