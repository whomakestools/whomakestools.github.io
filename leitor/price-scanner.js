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
    min: 0.01,            // valor mínimo aceito
    max: 99999.99,        // valor máximo aceito
    autoScan: true,       // lê continuamente e confirma quando o valor se repete
    stableReads: 2,       // leituras iguais seguidas para aceitar no modo automático
    interval: 900,        // ms entre leituras automáticas
    locale: 'pt-BR',      // formato do valor em campos type="text"
    lang: 'eng',          // idioma do OCR (dígitos funcionam bem com 'eng')
    facing: 'environment',
    invertPass: true,     // também lê texto branco sobre fundo preto
    prefer: /varej/i,     // palavras que aumentam a prioridade de um preço (ex.: Varejo x Atacado)
    penalize: /kg|quilo|litro|\bpor\b|c\/|\bfd\b|\/\s?un/i, // linhas de preço por kg/litro/unidade (use null p/ desligar)
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

  // Todos os preços possíveis dentro de um texto de OCR.
  function extract(text, opts) {
    var d = opts.decimals, out = [];
    var t = String(text || '').replace(/R\$/gi, ' ')
      .replace(/[0-9OoIl|.,]+/g, function (k) {
        return /\d/.test(k) ? k.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1') : k;
      }).replace(/\s+/g, ' ');
    var ok = function (v) { return isFinite(v) && v >= opts.min && v <= opts.max; };
    var eat = function (re, fn) {
      t = t.replace(re, function (m) {
        var v = fn.apply(null, arguments); if (ok(v)) out.push(v);
        return ' '.repeat(m.length);
      });
    };
    if (d > 0) {
      // 12,99 | 1.299,90 | 12. 99
      eat(new RegExp('\\b(\\d{1,3}(?:\\.\\d{3})+|\\d+)[.,]\\s?(\\d{' + d + '})\\b', 'g'),
        function (m, a, b) { return parseFloat(a.replace(/\./g, '') + '.' + b); });
      // inteiro grande + centavos pequenos separados: "12 99"
      eat(new RegExp('\\b(\\d{1,4})\\s(\\d{' + d + '})\\b', 'g'),
        function (m, a, b) { return parseFloat(a + '.' + b); });
      // tudo grudado: 1299 -> 12,99 (ignora pedaços de código de barras 789...)
      eat(/\b\d{3,7}\b/g,
        function (m) { return (/^789/.test(m) && m.length >= 6) ? NaN : parseInt(m, 10) / Math.pow(10, d); });
    } else {
      eat(/\b\d{1,6}\b/g, function (m) { return parseInt(m, 10); });
    }
    return out;
  }

  // Primeiro preço encontrado em um texto (útil para testes).
  function parsePrice(text, opts) {
    var r = extract(text, Object.assign({}, DEFAULTS, opts || {}));
    return r.length ? r[0] : null;
  }

  // Ordena os candidatos: maior tamanho de letra = mais provável de ser o preço.
  // Bônus se houver "Varejo" na linha ou logo acima; penalidade para preço por kg/litro.
  function analyze(datas, o) {
    var lines = [];
    datas.forEach(function (d) {
      if (d.lines && d.lines.length) lines = lines.concat(d.lines);
      else if (d.text) lines.push({ text: d.text, words: [], bbox: null });
    });
    var out = {};
    lines.forEach(function (ln, i) {
      var vals = extract(ln.text, o);
      if (!vals.length) return;
      var h = 0;
      (ln.words || []).forEach(function (w) {
        if (/\d/.test(w.text)) h = Math.max(h, w.bbox.y1 - w.bbox.y0);
      });
      h = h || 1;
      var bb = ln.bbox, ctx = ln.text;
      if (bb) lines.forEach(function (p, j) {
        var pb = p.bbox;
        if (j !== i && pb && pb.y1 <= bb.y0 + h && bb.y0 - pb.y1 < 2 * h && pb.x0 < bb.x1 && pb.x1 > bb.x0)
          ctx = p.text + ' ' + ctx;
      });
      var s = h;
      if (o.prefer && o.prefer.test(ctx)) s *= 1.6;
      if (o.penalize && o.penalize.test(ln.text)) s *= 0.45;
      vals.forEach(function (v) { if (!(out[v] >= s)) out[v] = s; });
    });
    return Object.keys(out).map(function (k) { return { value: parseFloat(k), score: out[k] }; })
      .sort(function (x, y) { return y.score - x.score; });
  }

  // Tons de cinza + auto-contraste (+ inversão). Manual, pois ctx.filter não existe no Safari.
  function prep(src, inv) {
    var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var x = c.getContext('2d'); x.drawImage(src, 0, 0);
    var im = x.getImageData(0, 0, c.width, c.height), d = im.data, i, g, lo = 255, hi = 0;
    for (i = 0; i < d.length; i += 4) {
      g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = g;
      if (g < lo) lo = g; if (g > hi) hi = g;
    }
    var k = hi > lo ? 255 / (hi - lo) : 1;
    for (i = 0; i < d.length; i += 4) {
      g = (d[i] - lo) * k; if (inv) g = 255 - g;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    x.putImageData(im, 0, 0);
    return c;
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
          tessedit_pageseg_mode: '11',
          preserve_interword_spaces: '1'
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
      '.ps-chips .ps-btn{padding:6px 12px}' +
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
        '<div class="ps-row ps-chips" hidden></div>' +
        '<div class="ps-row ps-res" hidden>' +
        '<input class="ps-val" type="number" inputmode="decimal" step="any">' +
        '<button class="ps-btn main ps-use"></button>' +
        '<button class="ps-btn ps-retry"></button></div></div>';
      document.body.appendChild(ov);

      var $ = function (s) { return ov.querySelector(s); };
      var video = $('video'), status = $('.ps-status'), live = $('.ps-live'), res = $('.ps-res'), val = $('.ps-val'), chips = $('.ps-chips');
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

      function showResult(cands) {
        clearInterval(timer);
        live.hidden = true; res.hidden = false;
        var top = cands && cands[0];
        val.value = top ? top.value.toFixed(o.decimals) : '';
        status.textContent = top ? '' : T.notFound;
        chips.innerHTML = '';
        chips.hidden = !(cands && cands.length > 1);
        (cands || []).slice(0, 4).forEach(function (c) {
          var b = document.createElement('button');
          b.className = 'ps-btn'; b.textContent = c.value.toFixed(o.decimals);
          b.onclick = function () { val.value = c.value.toFixed(o.decimals); };
          chips.appendChild(b);
        });
        val.focus();
      }
      function backToLive() {
        res.hidden = true; chips.hidden = true; live.hidden = false; lastVal = null; same = 0;
        status.textContent = T.hint; startLoop();
      }

      // Recorta a moldura (coordenadas da tela -> pixels do vídeo, considerando object-fit: cover)
      function cropFrame() {
        var vr = video.getBoundingClientRect(), fr = $('.ps-frame').getBoundingClientRect();
        var vw = video.videoWidth, vh = video.videoHeight;
        var scale = Math.max(vr.width / vw, vr.height / vh);
        var offX = (vr.width - vw * scale) / 2, offY = (vr.height - vh * scale) / 2;
        var sx = Math.max(0, (fr.left - vr.left - offX) / scale);
        var sy = Math.max(0, (fr.top - vr.top - offY) / scale);
        var sw = Math.min(vw - sx, fr.width / scale), sh = Math.min(vh - sy, fr.height / scale);
        var k = Math.min(3, 1000 / sw); // ~1000px de largura para o OCR
        var c = document.createElement('canvas');
        c.width = Math.round(sw * k); c.height = Math.round(sh * k);
        c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
        return c;
      }

      // Lê a moldura (normal + invertida) e devolve candidatos [{value, score}] ou undefined se ocupado
      function scan() {
        if (busy || closed || !video.videoWidth) return Promise.resolve(undefined);
        busy = true; status.textContent = T.reading;
        var raw = cropFrame(), W, d1;
        return getWorker(o.lang).then(function (w) {
          W = w; return w.recognize(prep(raw, false));
        }).then(function (r1) {
          d1 = r1.data;
          return o.invertPass ? W.recognize(prep(raw, true)).then(function (r2) { return [d1, r2.data]; }) : [d1];
        }).then(function (datas) { busy = false; return analyze(datas, o); })
          .catch(function () { busy = false; return []; });
      }

      function tick() {
        scan().then(function (c) {
          if (closed || c === undefined) return;
          if (!c.length) { same = 0; lastVal = null; status.textContent = T.hint; return; }
          var v = c[0].value;
          same = v === lastVal ? same + 1 : 1; lastVal = v;
          status.textContent = v.toFixed(o.decimals);
          if (same >= o.stableReads) showResult(c);
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
