/*!
 * PriceScanner — lê preços de etiquetas de gôndola pela câmera e preenche um campo numérico.
 * Sem dependências para instalar: o OCR (Tesseract.js) é carregado sob demanda do CDN.
 * Requer HTTPS (ou localhost) para acessar a câmera.
 *
 * Uso rápido:
 *   <input id="preco" type="number" step="0.01">
 *   <script src="price-scanner.js"></script>
 *   <script>PriceScanner.attach('#preco');</script>
 *
 * Ou sem campo:  const r = await PriceScanner.open();  // {value: 12.99} | null
 * Ou por HTML:   <input data-price-scanner>   (ativado automaticamente)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PriceScanner = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  var DEFAULTS = {
    decimals: 2,          // casas decimais do preço
    min: 0,               // valor mínimo aceito
    max: 99999.99,        // valor máximo aceito
    autoScan: true,       // lê continuamente e confirma quando o valor se repete
    stableReads: 2,       // leituras iguais seguidas para aceitar no modo automático
    interval: 900,        // ms entre leituras automáticas
    locale: 'pt-BR',      // formato do valor em campos type="text"
    lang: 'eng',          // idioma do OCR (dígitos funcionam bem com 'eng')
    facing: 'environment',
    onResult: null,       // function(value, info)
    texts: {
      title: 'Aponte para o preço',
      hint: 'Enquadre o preço dentro da moldura',
      reading: 'Lendo…',
      loading: 'Carregando leitor…',
      notFound: 'Preço não encontrado — ajuste e tente de novo',
      use: 'Usar valor',
      retry: 'Ler de novo',
      auto: 'Automático',
      cameraError: 'Não foi possível acessar a câmera.'
    }
  };

  /* ---------- parsing ---------- */

  // Extrai o preço mais provável de um texto de OCR.
  function parsePrice(text, opts) {
    opts = Object.assign({}, DEFAULTS, opts || {});
    var d = opts.decimals;
    var t = String(text || '').replace(/R\$/gi, ' ').replace(/[Oo]/g, '0').replace(/\s+/g, ' ');
    var ok = function (v) { return isFinite(v) && v >= opts.min && v <= opts.max; };
    var m, v;

    if (d > 0) {
      var dec = '\\d{' + d + '}';
      // 1) com separador: 12,99 | 1.299,90 | 12. 99
      var re1 = new RegExp('\\b(\\d{1,3}(?:\\.\\d{3})+|\\d+)[.,]\\s?(' + dec + ')\\b', 'g');
      while ((m = re1.exec(t))) { v = parseFloat(m[1].replace(/\./g, '') + '.' + m[2]); if (ok(v)) return v; }
      // 2) inteiro grande + centavos pequenos separados por espaço: "12 99"
      var re2 = new RegExp('\\b(\\d{1,4})\\s(' + dec + ')\\b', 'g');
      while ((m = re2.exec(t))) { v = parseFloat(m[1] + '.' + m[2]); if (ok(v)) return v; }
      // 3) tudo grudado: 1299 -> 12,99
      var re3 = /\b(\d{3,7})\b/g;
      while ((m = re3.exec(t))) { v = parseInt(m[1], 10) / Math.pow(10, d); if (ok(v)) return v; }
    }
    // 4) inteiro simples
    var re4 = /\b(\d{1,6})\b/g;
    while ((m = re4.exec(t))) { v = parseInt(m[1], 10); if (ok(v)) return v; }
    return null;
  }

  /* ---------- helpers ---------- */

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[data-ps="' + src + '"]')) return res();
      var s = document.createElement('script');
      s.src = src; s.async = true; s.setAttribute('data-ps', src);
      s.onload = res; s.onerror = function () { rej(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  var workers = {};
  function getWorker(lang) {
    if (!workers[lang]) {
      workers[lang] = loadScript(TESS_URL).then(function () {
        return window.Tesseract.createWorker(lang);
      }).then(function (w) {
        return w.setParameters({
          tessedit_char_whitelist: '0123456789.,R$ ',
          tessedit_pageseg_mode: '6'
        }).then(function () { return w; });
      });
    }
    return workers[lang];
  }

  function setInputValue(input, value, o) {
    var str = input.type === 'number'
      ? value.toFixed(o.decimals)
      : value.toLocaleString(o.locale, { minimumFractionDigits: o.decimals, maximumFractionDigits: o.decimals, useGrouping: false });
    var setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
    setter.call(input, str); // compatível com React/Vue
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  var cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    var s = document.createElement('style');
    s.textContent =
      '.ps-ov{position:fixed;inset:0;z-index:99999;background:#000;color:#fff;font:16px system-ui,sans-serif;display:flex;flex-direction:column}' +
      '.ps-ov video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
      '.ps-top,.ps-bot{position:relative;z-index:2;padding:12px 16px;display:flex;align-items:center;gap:12px;background:linear-gradient(#000a,#0000)}' +
      '.ps-bot{margin-top:auto;flex-direction:column;background:linear-gradient(#0000,#000b);padding-bottom:max(20px,env(safe-area-inset-bottom))}' +
      '.ps-top{padding-top:max(12px,env(safe-area-inset-top))}' +
      '.ps-title{flex:1;font-weight:600}' +
      '.ps-btn{border:0;border-radius:10px;padding:10px 16px;font:inherit;font-weight:600;background:#ffffff26;color:#fff}' +
      '.ps-btn.main{background:#16a34a}' +
      '.ps-frame{position:absolute;left:50%;top:42%;width:82%;height:20%;transform:translate(-50%,-50%);border:3px solid #fff;border-radius:14px;box-shadow:0 0 0 100vmax #0000008c;z-index:1;pointer-events:none}' +
      '.ps-status{min-height:1.4em;text-align:center}' +
      '.ps-row{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}' +
      '.ps-shutter{width:68px;height:68px;border-radius:50%;border:4px solid #fff;background:#ffffff40}' +
      '.ps-val{width:9em;font-size:24px;text-align:center;padding:8px;border-radius:10px;border:0;color:#111}' +
      '.ps-btn-cam{margin-left:6px;border:1px solid #9994;border-radius:8px;background:#fff;padding:4px 8px;font-size:1.1em;cursor:pointer}' +
      '[hidden]{display:none!important}';
    document.head.appendChild(s);
  }

  /* ---------- scanner ---------- */

  function open(options) {
    var o = Object.assign({}, DEFAULTS, options || {});
    o.texts = Object.assign({}, DEFAULTS.texts, (options && options.texts) || {});
    var T = o.texts;
    injectCss();

    return new Promise(function (resolve) {
      var stream, timer, busy = false, closed = false, lastVal = null, same = 0, auto = o.autoScan;

      var ov = document.createElement('div');
      ov.className = 'ps-ov';
      ov.innerHTML =
        '<video playsinline muted autoplay></video>' +
        '<div class="ps-top"><div class="ps-title"></div>' +
        '<button class="ps-btn ps-torch" hidden>🔦</button>' +
        '<button class="ps-btn ps-close" aria-label="Fechar">✕</button></div>' +
        '<div class="ps-frame"></div>' +
        '<div class="ps-bot">' +
        '<div class="ps-status"></div>' +
        '<div class="ps-row ps-live">' +
        '<label><input type="checkbox" class="ps-auto"> <span class="ps-autolbl"></span></label>' +
        '<button class="ps-shutter" aria-label="Capturar"></button></div>' +
        '<div class="ps-row ps-res" hidden>' +
        '<input class="ps-val" type="number" inputmode="decimal" step="any">' +
        '<button class="ps-btn main ps-use"></button>' +
        '<button class="ps-btn ps-retry"></button></div></div>';
      document.body.appendChild(ov);

      var $ = function (s) { return ov.querySelector(s); };
      var video = $('video'), status = $('.ps-status'), live = $('.ps-live'), res = $('.ps-res'), val = $('.ps-val');
      $('.ps-title').textContent = T.title;
      $('.ps-autolbl').textContent = T.auto;
      $('.ps-use').textContent = T.use;
      $('.ps-retry').textContent = T.retry;
      $('.ps-auto').checked = auto;
      val.step = o.decimals > 0 ? Math.pow(10, -o.decimals) : 1;
      status.textContent = T.loading;

      function finish(value) {
        if (closed) return; closed = true;
        clearInterval(timer);
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        ov.remove();
        if (value != null && typeof o.onResult === 'function') o.onResult(value);
        resolve(value == null ? null : { value: value });
      }

      function showResult(v) {
        clearInterval(timer);
        live.hidden = true; res.hidden = false;
        val.value = v != null ? v.toFixed(o.decimals) : '';
        status.textContent = v != null ? '' : T.notFound;
        val.focus();
      }
      function backToLive() {
        res.hidden = true; live.hidden = false; lastVal = null; same = 0;
        status.textContent = T.hint; startLoop();
      }

      // Recorta a moldura (convertendo coordenadas da tela -> pixels do vídeo, considerando object-fit: cover)
      function cropFrame() {
        var vr = video.getBoundingClientRect(), fr = $('.ps-frame').getBoundingClientRect();
        var vw = video.videoWidth, vh = video.videoHeight;
        var scale = Math.max(vr.width / vw, vr.height / vh);
        var offX = (vr.width - vw * scale) / 2, offY = (vr.height - vh * scale) / 2;
        var sx = Math.max(0, (fr.left - vr.left - offX) / scale);
        var sy = Math.max(0, (fr.top - vr.top - offY) / scale);
        var sw = Math.min(vw - sx, fr.width / scale), sh = Math.min(vh - sy, fr.height / scale);
        var k = Math.min(2, 900 / sw); // amplia p/ ~900px de largura
        var c = document.createElement('canvas');
        c.width = Math.round(sw * k); c.height = Math.round(sh * k);
        var ctx = c.getContext('2d');
        ctx.filter = 'grayscale(1) contrast(1.6)';
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
        return c;
      }

      function scan() {
        if (busy || closed || !video.videoWidth) return Promise.resolve(undefined);
        busy = true; status.textContent = T.reading;
        return getWorker(o.lang).then(function (w) { return w.recognize(cropFrame()); })
          .then(function (r) { busy = false; return parsePrice(r.data.text, o); })
          .catch(function () { busy = false; return null; });
      }

      function tick() {
        scan().then(function (v) {
          if (closed || v === undefined) return;
          if (v == null) { same = 0; lastVal = null; status.textContent = T.hint; return; }
          same = v === lastVal ? same + 1 : 1; lastVal = v;
          status.textContent = v.toFixed(o.decimals);
          if (same >= o.stableReads) showResult(v);
        });
      }
      function startLoop() { clearInterval(timer); if (auto) timer = setInterval(tick, o.interval); }

      $('.ps-auto').onchange = function () { auto = this.checked; startLoop(); };
      $('.ps-shutter').onclick = function () {
        scan().then(function (v) { if (!closed && v !== undefined) showResult(v); });
      };
      $('.ps-close').onclick = function () { finish(null); };
      $('.ps-retry').onclick = backToLive;
      $('.ps-use').onclick = function () {
        var n = parseFloat(String(val.value).replace(',', '.'));
        if (isFinite(n)) finish(n);
      };
      val.onkeydown = function (e) { if (e.key === 'Enter') $('.ps-use').click(); };

      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: o.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
      }).then(function (s) {
        stream = s; video.srcObject = s;
        var track = s.getVideoTracks()[0], caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.torch) {
          var tb = $('.ps-torch'), on = false; tb.hidden = false;
          tb.onclick = function () { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }); };
        }
        if (caps.focusMode && caps.focusMode.indexOf('continuous') > -1)
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {});
        getWorker(o.lang).then(function () { if (!closed) { status.textContent = T.hint; startLoop(); } });
      }).catch(function () { status.textContent = T.cameraError; });
    });
  }

  /* ---------- integração com campos ---------- */

  // Adiciona um botão 📷 ao lado do campo; ao ler, preenche o campo e dispara input/change.
  function attach(target, options) {
    var input = typeof target === 'string' ? document.querySelector(target) : target;
    if (!input) throw new Error('PriceScanner: campo não encontrado');
    injectCss();
    var o = Object.assign({}, options || {});
    if (input.dataset.decimals && o.decimals == null) o.decimals = parseInt(input.dataset.decimals, 10);
    var full = Object.assign({}, DEFAULTS, o);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ps-btn-cam'; btn.textContent = '📷';
    btn.title = 'Ler preço pela câmera';
    btn.onclick = function () {
      open(o).then(function (r) { if (r) { setInputValue(input, r.value, full); input.focus(); } });
    };
    input.insertAdjacentElement('afterend', btn);
    return function detach() { btn.remove(); };
  }

  function attachAll(selector, options) {
    return Array.prototype.map.call(document.querySelectorAll(selector || '[data-price-scanner]'),
      function (el) { return attach(el, options); });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () { attachAll('[data-price-scanner]'); });
  }

  return { open: open, attach: attach, attachAll: attachAll, parsePrice: parsePrice, defaults: DEFAULTS };
});
