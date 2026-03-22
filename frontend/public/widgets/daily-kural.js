(function () {
  var script = document.currentScript;
  var version = '2.0.0';
  var scriptOrigin = resolveOrigin(script);
  var defaultConfig = {
    mode: 'random',
    theme: 'auto',
    layout: 'spotlight',
    language: 'bilingual',
    meaning: 'translation',
    align: 'left',
    accent: '#2563eb',
    radius: '22',
    shadow: 'soft',
    fontScale: '1',
    loading: 'lazy',
    showMeta: 'true',
    showTags: 'true',
    showRefresh: 'true',
    maxWidth: '460px',
    minWidth: '280px'
  };

  window.ThirukkuralWidget = window.ThirukkuralWidget || {};
  window.ThirukkuralWidget.version = version;
  window.ThirukkuralWidget.mount = mountWidget;

  if (script) {
    mountFromScript(script);
  }

  function mountFromScript(scriptTag) {
    var config = buildConfig(scriptTag.dataset || {});
    var host = resolveHost(scriptTag, config.target);
    if (!host) {
      return null;
    }

    return renderIframe(host, config, scriptTag);
  }

  function mountWidget(target, options) {
    var host = resolveMountTarget(target);
    if (!host) {
      return null;
    }

    var config = buildConfig(options || {});
    return renderIframe(host, config, null);
  }

  function renderIframe(host, config, referenceNode) {
    var widgetId = createWidgetId();
    var iframe = document.createElement('iframe');
    var query = new URLSearchParams();
    var initialHeight = getInitialHeight(config.layout);

    query.set('widgetId', widgetId);
    query.set('mode', config.mode);
    query.set('theme', config.theme);
    query.set('layout', config.layout);
    query.set('language', config.language);
    query.set('meaning', config.meaning);
    query.set('align', config.align);
    query.set('accent', config.accent);
    query.set('radius', config.radius);
    query.set('shadow', config.shadow);
    query.set('fontScale', config.fontScale);
    query.set('showMeta', config.showMeta);
    query.set('showTags', config.showTags);
    query.set('showRefresh', config.showRefresh);

    if (config.kural) {
      query.set('kural', config.kural);
    }

    if (config.ctaText) {
      query.set('ctaText', config.ctaText);
    }

    iframe.src = scriptOrigin + '/widgets/daily-kural-frame.html?' + query.toString();
    iframe.title = buildIframeTitle(config.mode);
    iframe.loading = config.loading;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.scrolling = 'no';
    iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox';
    iframe.style.width = config.width || '100%';
    iframe.style.maxWidth = config.maxWidth;
    iframe.style.minWidth = config.minWidth;
    iframe.style.height = initialHeight + 'px';
    iframe.style.border = '0';
    iframe.style.overflow = 'hidden';
    iframe.style.background = 'transparent';
    iframe.style.display = 'block';
    iframe.style.borderRadius = config.radius + 'px';

    function onMessage(event) {
      if (event.origin !== scriptOrigin || event.source !== iframe.contentWindow) {
        return;
      }

      if (!event.data || event.data.source !== 'thirukkural-widget' || event.data.widgetId !== widgetId) {
        return;
      }

      if (typeof event.data.height !== 'number') {
        return;
      }

      iframe.style.height = Math.max(initialHeight, Math.ceil(event.data.height)) + 'px';
    }

    window.addEventListener('message', onMessage);

    if (referenceNode && referenceNode.parentNode === host) {
      host.insertBefore(iframe, referenceNode.nextSibling);
    } else {
      host.appendChild(iframe);
    }

    return {
      id: widgetId,
      iframe: iframe,
      destroy: function () {
        window.removeEventListener('message', onMessage);
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }
    };
  }

  function buildConfig(raw) {
    var requestedKural = normalizeKural(raw.kural);
    var requestedMode = normalizeChoice(raw.mode, ['random', 'daily', 'fixed']);
    var resolvedMode = requestedMode || (requestedKural ? 'fixed' : defaultConfig.mode);
    var finalMode = resolvedMode === 'fixed' && !requestedKural ? defaultConfig.mode : resolvedMode;
    var layout = normalizeChoice(raw.layout, ['spotlight', 'compact', 'minimal', 'banner', 'square']) || defaultConfig.layout;
    var widthDefaults = getWidthDefaults(layout);
    var showTagsDefault = layout === 'minimal' ? 'false' : defaultConfig.showTags;

    return {
      target: raw.target || '',
      mode: requestedKural && finalMode === 'fixed' ? 'fixed' : finalMode,
      kural: requestedKural,
      theme: normalizeChoice(raw.theme, ['light', 'dark', 'auto']) || defaultConfig.theme,
      layout: layout,
      language: normalizeChoice(raw.language, ['bilingual', 'tamil', 'english']) || defaultConfig.language,
      meaning: normalizeChoice(raw.meaning, ['translation', 'couplet', 'explanation']) || defaultConfig.meaning,
      align: normalizeChoice(raw.align, ['left', 'center']) || defaultConfig.align,
      accent: normalizeAccent(raw.accent) || defaultConfig.accent,
      radius: normalizeNumber(raw.radius, 0, 32, defaultConfig.radius),
      shadow: normalizeChoice(raw.shadow, ['none', 'soft', 'strong']) || defaultConfig.shadow,
      fontScale: normalizeFloat(raw.fontScale, 0.9, 1.2, defaultConfig.fontScale),
      loading: normalizeChoice(raw.loading, ['lazy', 'eager']) || defaultConfig.loading,
      showMeta: normalizeBoolean(raw.showMeta, defaultConfig.showMeta),
      showTags: normalizeBoolean(raw.showTags, showTagsDefault),
      showRefresh: normalizeBoolean(raw.showRefresh, finalMode === 'random' ? 'true' : 'false'),
      ctaText: normalizeText(raw.ctaText, 48),
      width: normalizeDimension(raw.width),
      maxWidth: normalizeDimension(raw.maxWidth) || widthDefaults.maxWidth,
      minWidth: normalizeDimension(raw.minWidth) || widthDefaults.minWidth
    };
  }

  function resolveHost(scriptTag, targetSelector) {
    if (targetSelector) {
      var target = document.querySelector(targetSelector);
      if (target) {
        return target;
      }
    }

    return scriptTag.parentNode;
  }

  function resolveMountTarget(target) {
    if (!target) {
      return null;
    }

    if (typeof target === 'string') {
      return document.querySelector(target);
    }

    if (target.nodeType === 1) {
      return target;
    }

    return null;
  }

  function createWidgetId() {
    return 'tkw-' + Math.random().toString(36).slice(2, 10);
  }

  function getInitialHeight(layout) {
    if (layout === 'banner') {
      return 240;
    }

    if (layout === 'square') {
      return 390;
    }

    if (layout === 'compact') {
      return 300;
    }

    if (layout === 'minimal') {
      return 250;
    }

    return 420;
  }

  function getWidthDefaults(layout) {
    if (layout === 'banner') {
      return {
        maxWidth: '100%',
        minWidth: '320px'
      };
    }

    if (layout === 'square') {
      return {
        maxWidth: '360px',
        minWidth: '280px'
      };
    }

    if (layout === 'minimal') {
      return {
        maxWidth: '380px',
        minWidth: defaultConfig.minWidth
      };
    }

    return {
      maxWidth: defaultConfig.maxWidth,
      minWidth: defaultConfig.minWidth
    };
  }

  function buildIframeTitle(mode) {
    if (mode === 'daily') {
      return "Today's Thirukkural widget";
    }

    if (mode === 'fixed') {
      return 'Featured Thirukkural widget';
    }

    return 'Random Thirukkural widget';
  }

  function normalizeKural(value) {
    if (!value || !/^\d+$/.test(String(value))) {
      return '';
    }

    var parsed = parseInt(value, 10);
    return parsed >= 1 && parsed <= 1330 ? String(parsed) : '';
  }

  function normalizeChoice(value, allowed) {
    if (!value) {
      return '';
    }

    var normalized = String(value).trim().toLowerCase();
    return allowed.indexOf(normalized) >= 0 ? normalized : '';
  }

  function normalizeBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    var normalized = String(value).trim().toLowerCase();
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return 'false';
    }

    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return 'true';
    }

    return fallback;
  }

  function normalizeAccent(value) {
    if (value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value).trim())) {
      return String(value).trim();
    }

    return '';
  }

  function normalizeNumber(value, min, max, fallback) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    var parsed = parseInt(String(value).trim(), 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return String(Math.max(min, Math.min(max, parsed)));
  }

  function normalizeFloat(value, min, max, fallback) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    var parsed = parseFloat(String(value).trim());
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return String(Math.max(min, Math.min(max, parsed)));
  }

  function normalizeDimension(value) {
    if (!value) {
      return '';
    }

    var normalized = String(value).trim();
    if (/^\d+(\.\d+)?(px|%|rem|vw|vh)$/.test(normalized)) {
      return normalized;
    }

    return '';
  }

  function normalizeText(value, maxLength) {
    if (!value) {
      return '';
    }

    return String(value).trim().slice(0, maxLength);
  }

  function resolveOrigin(node) {
    if (!node || !node.src) {
      return window.location.origin;
    }

    try {
      return new URL(node.src, window.location.href).origin;
    } catch (error) {
      return window.location.origin;
    }
  }
})();
