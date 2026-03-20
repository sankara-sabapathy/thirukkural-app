(function () {
  var script = document.currentScript;
  if (!script) {
    return;
  }

  var origin = new URL(script.src, window.location.href).origin;
  var widgetId = 'tkd-' + Math.random().toString(36).slice(2, 10);
  var params = new URLSearchParams();
  var dataset = script.dataset || {};

  params.set('widgetId', widgetId);

  if (dataset.theme) {
    params.set('theme', dataset.theme);
  }

  if (dataset.accent) {
    params.set('accent', dataset.accent);
  }

  if (dataset.kural) {
    params.set('kural', dataset.kural);
  }

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/widgets/daily-kural-frame.html?' + params.toString();
  iframe.title = 'Daily Thirukkural widget';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.scrolling = 'no';
  iframe.style.width = dataset.width || '100%';
  iframe.style.maxWidth = dataset.maxWidth || '420px';
  iframe.style.minWidth = dataset.minWidth || '280px';
  iframe.style.height = '360px';
  iframe.style.border = '0';
  iframe.style.overflow = 'hidden';
  iframe.style.background = 'transparent';
  iframe.style.display = 'block';
  iframe.style.borderRadius = '20px';

  var host = script.parentNode;
  if (!host) {
    return;
  }

  if (dataset.target) {
    var target = document.querySelector(dataset.target);
    if (target) {
      host = target;
    }
  }

  host.insertBefore(iframe, script.nextSibling);

  function onMessage(event) {
    if (event.origin !== origin || !event.data || event.data.source !== 'thirukkural-widget') {
      return;
    }

    if (event.data.widgetId !== widgetId || typeof event.data.height !== 'number') {
      return;
    }

    iframe.style.height = Math.max(240, Math.ceil(event.data.height)) + 'px';
  }

  window.addEventListener('message', onMessage);
})();
