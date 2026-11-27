'use strict'

const KEY = 'listas' // mesma chave de antes: os dados existentes continuam funcionando
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtdFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const $ = s => document.querySelector(s)

const geral = $('#geral')
const sheetNome = $('#sheetNome'), sheetItem = $('#sheetItem'), nomeInput = $('#nomeInput')
const sheetConfirm = $('#sheetConfirm'), sheetResumo = $('#sheetResumo'), sheetOrc = $('#sheetOrc'), sheetQR = $('#sheetQR'), sheetScan = $('#sheetScan')
const f = { desc: $('#iDesc'), un: $('#iUn'), qtd: $('#iQtd'), preco: $('#iPreco') }

let dados = ler()
dados.forEach(l => { if (l.semGrupo && !l.grupos.length) l.grupos.push({ descricao: '', itens: [] }) })
let filtro = '' // texto do filtro: listas (tela principal) ou itens (lista aberta)
const filtroEl = $('#filtro')
const limparFiltro = () => { filtro = ''; filtroEl.value = '' }
filtroEl.addEventListener('input', () => { filtro = filtroEl.value.trim(); render() })
const abertos = new Set() // listas/grupos expandidos ("0", "0-1")
let aoSalvarNome = null, refItem = null, resolveConf = null
let listaAberta = null // quando há uma lista aberta, só ela é exibida

function ler() { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } }
const gravar = () => { localStorage.setItem(KEY, JSON.stringify(dados)); render() }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const moedaFmt = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const lerMoeda = el => Number(el.value.replace(/\./g, '').replace(',', '.')) || 0
const poeMoeda = (el, n) => { el.value = n > 0 ? moedaFmt(n) : '' }
// máscara com 2 casas decimais: digita só números (1999 vira 19,99)
const mascara = el => el.addEventListener('input', () => {
  const d = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10)
  el.value = d ? moedaFmt(Number(d) / 100) : ''
})

/* ---------- totais ---------- */
const totalItens = itens => itens.reduce((a, { preco, qtd }) => a + preco * qtd, 0)
const totalLista = l => l.grupos.reduce((a, g) => a + totalItens(g.itens), 0)

// Itens sem preço aparecem primeiro; os com preço (verdes) vão para o fim. A ordem original é mantida em cada bloco.
const temPreco = it => it.preco > 0
const itensOrdenados = g => g.itens.map((it, I) => ({ it, I })).sort((a, b) => temPreco(a.it) - temPreco(b.it))

// quantos itens a lista tem, quantos já têm preço e quantos faltam
const contagem = l => {
  let t = 0, c = 0
  l.grupos.forEach(g => g.itens.forEach(it => { t++; if (temPreco(it)) c++ }))
  return { t, c, f: t - c }
}
const casa = it => !filtro || norm(it.descricao).includes(norm(filtro))

/* ---------- ícones e HTML ---------- */
const P = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  doc: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  undo: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7V6a2 2 0 0 1 2-2h12M16 14h2',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1'
}
const svgIcon = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`
const iconBtn = (action, title, d, ref) =>
  `<button type="button" class="icon" data-action="${action}" ${ref} title="${title}" aria-label="${title}">${svgIcon(d)}</button>`

const itemHTML = (it, L, G, I) => {
  const ok = temPreco(it), ref = `data-l="${L}" data-g="${G}" data-i="${I}"`
  return `
  <li class="item ${ok ? 'ok' : 'pend'}" data-action="edit-item" ${ref} tabindex="0" title="Abrir item">
    <div class="info"><span class="desc">${esc(it.descricao)}</span>
      <small>${qtdFmt.format(it.qtd)} ${esc(it.unidade)} ${ok ? '× ' + brl.format(it.preco) : '· sem preço'}</small></div>
    <strong>${ok ? brl.format(it.qtd * it.preco) : '—'}</strong>
    ${iconBtn('del-item', 'Excluir item', P.trash, ref)}
  </li>`
}

const grupoHTML = (g, L, G) => {
  const k = `${L}-${G}`, r = `data-l="${L}" data-g="${G}"`
  return `<details class="grupo" data-k="${k}" ${abertos.has(k) || filtro ? 'open' : ''}>
    <summary><span class="nome">${esc(g.descricao)}</span><span class="total">${brl.format(totalItens(g.itens))}</span>
      <span class="acoes-hover">${iconBtn('novo-item', 'Novo item', P.plus, r)}${iconBtn('edit-grupo', 'Renomear grupo', P.edit, r)}${iconBtn('del-grupo', 'Excluir grupo', P.trash, r)}</span></summary>
    <ul class="itens">${itensOrdenados(g).filter(({ it }) => casa(it)).map(({ it, I }) => itemHTML(it, L, G, I)).join('') || '<li class="vazio">Sem itens.</li>'}</ul>
  </details>`
}

const orc = l => Number(l.orcamento) || 0 // valor para gastar da lista

const saldoHTML = l => {
  if (!(orc(l) > 0)) return ''
  const saldo = orc(l) - totalLista(l)
  return `<small class="saldo${saldo < 0 ? ' neg' : ''}">Para gastar ${brl.format(orc(l))} · ${saldo < 0 ? 'estourou ' + brl.format(-saldo) : 'saldo ' + brl.format(saldo)}</small>`
}

const orcHTML = (l, L) => {
  if (!(orc(l) > 0)) return ''
  const gasto = totalLista(l), pct = gasto / orc(l) * 100
  const nivel = pct > 100 ? 'estouro' : pct >= 80 ? 'alerta' : 'ok'
  return `<div class="orc ${nivel}" data-action="edit-orc" data-l="${L}" tabindex="0" title="Alterar valor para gastar">
    <div class="orc-txt"><span>Gasto ${brl.format(gasto)}</span><span>de ${brl.format(orc(l))} · ${Math.round(pct)}%</span></div>
    <div class="orc-bar"><i style="width:${Math.min(100, pct)}%"></i></div></div>`
}

const contHTML = l => {
  const { t, c, f } = contagem(l)
  if (!t) return ''
  return `<small class="cont">${c} de ${t} ${t > 1 ? 'itens com preço' : 'item com preço'} · ${f ? 'faltam ' + f : 'todos com preço ✓'}</small>`
}

// lista "sem grupos": os itens ficam direto na lista (guardados no único grupo interno, sem nome)
const corpoLista = (l, L) => {
  if (l.semGrupo) {
    const itens = itensOrdenados(l.grupos[0]).filter(({ it }) => casa(it))
    return `<ul class="itens itens-lista">${itens.map(({ it, I }) => itemHTML(it, L, 0, I)).join('') ||
      `<li class="vazio">${filtro ? 'Nenhum item encontrado.' : 'Sem itens. Use + para adicionar.'}</li>`}</ul>`
  }
  const grupos = l.grupos.map((g, G) => ({ g, G })).filter(({ g }) => !filtro || g.itens.some(casa))
  return `<div class="grupos">${grupos.map(({ g, G }) => grupoHTML(g, L, G)).join('') ||
    `<p class="vazio">${filtro ? 'Nenhum item encontrado.' : 'Sem grupos. Use + para adicionar.'}</p>`}</div>`
}

const listaHTML = (l, L) => {
  const r = `data-l="${L}"`
  const add = l.semGrupo ? iconBtn('novo-item', 'Novo item', P.plus, `${r} data-g="0"`) : iconBtn('novo-grupo', 'Novo grupo', P.plus, r)
  return `<details class="lista" data-k="${L}" ${L === listaAberta ? 'open' : ''}>
    <summary><span class="nome">${esc(l.descricao)}${contHTML(l)}${saldoHTML(l)}</span><strong class="total">${brl.format(totalLista(l))}</strong>
      <span class="acoes-hover">${add}${iconBtn('edit-orc', 'Valor para gastar', P.wallet, r)}${iconBtn('compartilhar', 'Compartilhar lista (QR Code)', P.qr, r)}${iconBtn('resumo', 'Resumo da lista', P.doc, r)}${iconBtn('zerar-lista', 'Zerar preços da lista', P.undo, r)}${iconBtn('edit-lista', 'Renomear lista', P.edit, r)}${iconBtn('del-lista', 'Excluir lista', P.trash, r)}</span></summary>
    ${orcHTML(l, L)}${corpoLista(l, L)}
  </details>`
}

function render() {
  if (listaAberta != null && !dados[listaAberta]) listaAberta = null
  const visiveis = dados.map((l, L) => ({ l, L })).filter(({ l, L }) =>
    listaAberta == null ? (!filtro || norm(l.descricao).includes(norm(filtro))) : L === listaAberta)
  geral.innerHTML = visiveis.map(({ l, L }) => listaHTML(l, L)).join('') ||
    (dados.length ? '<p class="vazio">Nenhuma lista encontrada.</p>' : '<p class="vazio">Nenhuma lista ainda. Crie a primeira em “+ Nova lista”.</p>')
  filtroEl.placeholder = listaAberta == null ? 'Filtrar listas pelo nome…' : 'Filtrar itens pela descrição…'
}

geral.addEventListener('toggle', e => {
  const el = e.target, k = el.dataset.k
  if (!k) return
  if (el.classList.contains('lista')) { // abrir uma lista oculta as outras; fechar (setinha) volta para todas
    const L = Number(k)
    if (el.open && listaAberta !== L) { listaAberta = L; limparFiltro(); render(); scrollTo({ top: 0 }) }
    else if (!el.open && listaAberta === L) { listaAberta = null; limparFiltro(); render() }
    return
  }
  if (!filtro) el.open ? abertos.add(k) : abertos.delete(k)
}, true)

/* ---------- formulários ---------- */
const fechar = () => {
  ;[sheetNome, sheetItem, sheetResumo, sheetConfirm, sheetOrc, sheetQR, sheetScan].forEach(sh => { if (sh) sh.hidden = true })
  pararCamera(); qrAtual = null; qrFull = false; $('#qrBox').classList.remove('full')
  if (resolveConf) { resolveConf(false); resolveConf = null }
}

// Modal de confirmação do app (substitui o confirm() do navegador). Retorna Promise<boolean>.
function confirmar(msg, label = 'Excluir') {
  if (!sheetConfirm) return Promise.resolve(window.confirm(msg)) // index.html antigo, sem o modal
  return new Promise(res => {
    resolveConf = res
    $('#confMsg').textContent = msg
    $('#confSim').textContent = label
    sheetConfirm.hidden = false
    $('#confSim').focus()
  })
}

function abrirNome(titulo, valor, cb, opcaoGrupos = false) {
  $('#chkGrupos').hidden = !opcaoGrupos
  $('#usarGrupos').checked = false // padrão: lista sem grupos
  $('#nomeTitulo').textContent = titulo
  nomeInput.value = valor
  aoSalvarNome = cb
  sheetNome.hidden = false
  nomeInput.focus(); nomeInput.select()
}

$('#formNome').addEventListener('submit', e => {
  e.preventDefault()
  const v = nomeInput.value.trim()
  if (!v) return
  aoSalvarNome(v, $('#usarGrupos').checked); gravar(); fechar()
})

let refOrc = null
function abrirOrc(L) {
  refOrc = L
  poeMoeda($('#oVal'), orc(dados[L]))
  sheetOrc.hidden = false
  if (!matchMedia('(pointer: coarse)').matches) $('#oVal').focus()
}
$('#formOrc').addEventListener('submit', e => {
  e.preventDefault()
  const v = lerMoeda($('#oVal'))
  dados[refOrc].orcamento = v > 0 ? v : 0
  gravar(); fechar()
})

const prev = () => { $('#prev').textContent = 'Total: ' + brl.format((+f.qtd.value || 0) * lerMoeda(f.preco)) }
mascara(f.preco)
mascara($('#oVal'))
;[f.qtd, f.preco].forEach(el => el.addEventListener('input', prev))

function abrirItem(L, G, I) {
  refItem = { L, G, I }
  const it = I >= 0 ? dados[L].grupos[G].itens[I] : { descricao: '', unidade: 'UN', qtd: 1, preco: '' }
  $('#itemTitulo').textContent = I >= 0 ? 'Editar item' : 'Novo item'
  f.desc.value = it.descricao; f.un.value = it.unidade; f.qtd.value = it.qtd; poeMoeda(f.preco, it.preco)
  prev()
  sheetItem.hidden = false
  if (!matchMedia('(pointer: coarse)').matches) f.desc.focus() // no celular o teclado só abre quando o campo é tocado
}

$('#formItem').addEventListener('submit', e => {
  e.preventDefault()
  const { L, G, I } = refItem
  const it = { descricao: f.desc.value.trim(), unidade: f.un.value, qtd: Number(f.qtd.value) || 0, preco: lerMoeda(f.preco) }
  if (!it.descricao) return
  const itens = dados[L].grupos[G].itens
  if (I >= 0) itens[I] = it; else itens.push(it)
  listaAberta = L; abertos.add(`${L}-${G}`)
  gravar(); fechar()
})

/* ---------- leitura de preço pela câmera (price-scanner) ---------- */
async function lerPrecoCamera() {
  if (!window.PriceScanner) return alert('Leitor de preço indisponível. Verifique a conexão.')
  const r = await PriceScanner.open({ decimals: 2, autoScan: false }) // começa no modo manual (o usuário pode ligar o automático)
  if (r) { poeMoeda(f.preco, r.value); prev() }
}
if (!window.PriceScanner) $('#btnCam').hidden = true

/* ---------- ações ---------- */
const executar = async (msg, label, fn, limpaAbertos = true) => {
  if (!(await confirmar(msg, label))) return
  fn()
  if (limpaAbertos) abertos.clear()
  gravar()
}
const excluir = (msg, fn) => executar(msg, 'Excluir', fn)

const num = (n, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const qtdTxt = n => Number.isInteger(n) ? String(n) : num(n, 3)

function resumoTexto(l) {
  const out = [`## ${l.descricao}`, '']
  l.grupos.forEach(g => {
    if (!l.semGrupo) out.push(`#${g.descricao} — ${brl.format(totalItens(g.itens))}`, '')
    const rows = g.itens.map(it => ({
      d: it.descricao + ':', q: qtdTxt(it.qtd), u: it.unidade,
      p: temPreco(it) ? num(it.preco) : null, t: temPreco(it) ? num(it.qtd * it.preco) : null
    }))
    const w = k => Math.max(0, ...rows.filter(r => r[k] != null).map(r => r[k].length))
    const [wd, wq, wu, wp, wt] = ['d', 'q', 'u', 'p', 't'].map(w)
    rows.forEach(r => out.push((`${r.d.padEnd(wd)} ${r.q.padStart(wq)} ${r.u.padEnd(wu)}` +
      (r.p == null ? '' : ` × R$ ${r.p.padStart(wp)} = R$ ${r.t.padStart(wt)}`)).trimEnd()))
    if (rows.length) out.push('')
  })
  out.push(`## TOTAL: ${brl.format(totalLista(l))}`)
  if (orc(l) > 0) {
    const saldo = orc(l) - totalLista(l)
    out.push(`## PARA GASTAR: ${brl.format(orc(l))}`, saldo < 0 ? `## ESTOUROU: ${brl.format(-saldo)}` : `## SALDO: ${brl.format(saldo)}`)
  }
  const sem = l.grupos.reduce((a, g) => a + g.itens.filter(it => !temPreco(it)).length, 0)
  if (sem) out.push(`(${sem} ${sem > 1 ? 'itens sem preço' : 'item sem preço'})`)
  return out.join('\n').replace(/\u00a0/g, ' ')
}

async function copiar() {
  const txt = $('#resumoTexto').textContent
  try { await navigator.clipboard.writeText(txt) } catch {
    const ta = document.createElement('textarea')
    ta.value = txt; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); ta.remove()
  }
  const b = $('#btnCopiar'); b.textContent = 'Copiado!'
  setTimeout(() => { b.textContent = 'Copiar' }, 1500)
}

/* ---------- compartilhar / importar por QR Code ----------
   Texto do QR Code:  ###id##valor para gastar (opcional)#descrição|tipo|quantidade#descrição|tipo|quantidade...
   Exemplo:           ###efa81cb888e5##1500,00#batata|kg|2,566#leite em pó|pc|2#macarrão|un|2
   Os caracteres % # | dentro da descrição são escapados (%25 %23 %7C). Preços não vão no QR Code. */
const QR_MAX = 2953 // bytes: capacidade máxima de um QR Code (versão 40, correção de erro L)
const UNIDADES = ['UN', 'KG', 'LT', 'PÇ', 'PC', 'DZ', 'CX']
let qrAtual = null, qrFull = false, camStream = null, camTimer = null, camBusy = false
const scanCanvas = document.createElement('canvas')

const scriptsCarregados = {}
const carregar = src => scriptsCarregados[src] || (scriptsCarregados[src] = new Promise((ok, erro) => {
  const el = document.createElement('script')
  el.src = src; el.onload = ok
  el.onerror = () => { delete scriptsCarregados[src]; erro(new Error('Falha ao carregar ' + src)) }
  document.head.appendChild(el)
}))

const novoId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('')
const escTxt = t => t.replace(/[%#|]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const unescTxt = t => t.replace(/%(25|23|7C)/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
const numTxt = n => Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace('.', ',')
const numLer = (t, padrao) => { const x = String(t ?? '').trim().replace(',', '.'); const n = Number(x); return x !== '' && isFinite(n) ? n : padrao }

function textoExportacao(l) {
  let t = '###' + l.id
  if (orc(l) > 0) t += '##' + orc(l).toFixed(2).replace('.', ',')
  l.grupos.forEach(g => g.itens.forEach(it => {
    t += '#' + escTxt(it.descricao.trim()) + '|' + it.unidade.toLowerCase() + '|' + numTxt(it.qtd)
  }))
  return t
}

function parseLista(txt) {
  txt = String(txt || '').trim()
  if (!txt.startsWith('###')) return null
  let resto = txt.slice(3), i = resto.indexOf('#')
  const id = i < 0 ? resto : resto.slice(0, i)
  resto = i < 0 ? '' : resto.slice(i)
  if (!/^[\w-]{4,40}$/.test(id)) return null
  let orcamento = null
  if (resto.startsWith('##')) {
    resto = resto.slice(2); i = resto.indexOf('#')
    orcamento = numLer(i < 0 ? resto : resto.slice(0, i), null)
    resto = i < 0 ? '' : resto.slice(i)
  }
  const itens = resto.split('#').filter(Boolean).map(p => {
    const [d = '', u = '', q = ''] = p.split('|')
    const un = u.trim().toUpperCase()
    return { descricao: unescTxt(d).trim(), unidade: UNIDADES.includes(un) ? un : 'UN', qtd: numLer(q, 1) }
  }).filter(it => it.descricao)
  return { id, orcamento, itens }
}

let toastT
function aviso(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true }, 3500)
}

/* compartilhar: gera o QR Code (versão automática, no máximo a 40, correção de erro L = maior capacidade) */
async function mostrarQR(L) {
  const l = dados[L], info = $('#qrInfo'), box = $('#qrBox')
  if (!l.id) { l.id = novoId(); localStorage.setItem(KEY, JSON.stringify(dados)) }
  $('#qrTitulo').textContent = `Compartilhar “${l.descricao}”`
  info.textContent = 'Gerando QR Code…'; box.hidden = false; qrAtual = null
  sheetQR.hidden = false
  try { await carregar('./js/vendor/qrcode.min.js') } catch { box.hidden = true; info.textContent = 'Não foi possível carregar o gerador de QR Code.'; return }
  if (sheetQR.hidden) return
  const bin = Array.from(new TextEncoder().encode(textoExportacao(l)), b => String.fromCharCode(b)).join('') // UTF-8 como bytes
  if (bin.length > QR_MAX) {
    box.hidden = true
    info.textContent = `Lista grande demais para um QR Code: ${bin.length} bytes (máximo ${QR_MAX}). Divida a lista em duas.`
    return
  }
  const qr = qrcode(0, 'L'); qr.addData(bin, 'Byte'); qr.make()
  qrAtual = qr
  const n = l.grupos.reduce((a, g) => a + g.itens.length, 0)
  info.textContent = `${n} ${n === 1 ? 'item' : 'itens'} · ${bin.length} de ${QR_MAX} bytes · QR versão ${(qr.getModuleCount() - 17) / 4}. Toque no QR Code para ampliar.`
  desenhaQR()
}

// desenha o mais grande possível, com módulos de tamanho inteiro (nítido) e fundo branco em qualquer tema
function desenhaQR() {
  const qr = qrAtual
  if (!qr) return
  const n = qr.getModuleCount(), q = 3, total = n + q * 2, dpr = window.devicePixelRatio || 1
  const css = qrFull ? Math.min(innerWidth, innerHeight) : Math.min(520, $('#qrBox').clientWidth - 16)
  const escala = Math.max(2, Math.floor(css * dpr / total))
  const c = $('#qrCanvas')
  c.width = c.height = total * escala
  c.style.width = c.style.height = (c.width / dpr) + 'px'
  const x = c.getContext('2d')
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000'
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect((k + q) * escala, (r + q) * escala, escala, escala)
}

/* importar: lê o QR Code pela câmera */
function pararCamera() {
  clearInterval(camTimer); camTimer = null
  if (camStream) camStream.getTracks().forEach(t => t.stop())
  camStream = null
}

async function abrirScanner() {
  const msg = $('#scanMsg')
  msg.textContent = 'Abrindo a câmera…'; sheetScan.hidden = false
  try {
    await carregar('./js/vendor/jsQR.min.js')
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
  } catch { msg.textContent = 'Não foi possível acessar a câmera.'; return }
  if (sheetScan.hidden) { pararCamera(); return } // fechou enquanto abria
  const trk = camStream.getVideoTracks()[0], caps = trk.getCapabilities ? trk.getCapabilities() : {}
  if (caps.focusMode && caps.focusMode.includes('continuous')) trk.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => { })
  const v = $('#scanVideo'); v.srcObject = camStream; v.play().catch(() => { })
  msg.textContent = 'Aponte para o QR Code da lista'
  clearInterval(camTimer); camTimer = setInterval(lerQuadro, 200)
}

function lerQuadro() {
  const v = $('#scanVideo')
  if (camBusy || !v.videoWidth || !window.jsQR) return
  camBusy = true
  try {
    const w = v.videoWidth, h = v.videoHeight
    scanCanvas.width = w; scanCanvas.height = h
    const x = scanCanvas.getContext('2d', { willReadFrequently: true })
    x.drawImage(v, 0, 0, w, h)
    const r = jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
    if (r && r.binaryData) {
      const imp = parseLista(new TextDecoder('utf-8').decode(Uint8Array.from(r.binaryData)))
      if (imp) { pararCamera(); sheetScan.hidden = true; processarImportacao(imp) }
      else $('#scanMsg').textContent = 'Este QR Code não é de uma lista.'
    }
  } finally { camBusy = false }
}

// mesmo id: atualiza os itens (mantém o preço dos itens que já existiam); id novo: pede o nome e cria a lista
function processarImportacao(imp) {
  const total = `${imp.itens.length} ${imp.itens.length === 1 ? 'item' : 'itens'}`
  const L = dados.findIndex(l => l.id === imp.id)
  if (L >= 0) {
    aplicarImportacao(dados[L], imp)
    listaAberta = L; limparFiltro(); gravar(); scrollTo({ top: 0 })
    aviso(`Lista “${dados[L].descricao}” atualizada: ${total}`)
    return
  }
  abrirNome('Nome da lista importada', '', v => {
    const nova = { id: imp.id, descricao: v, semGrupo: true, grupos: [{ descricao: '', itens: imp.itens.map(i => ({ ...i, preco: 0 })) }] }
    if (imp.orcamento > 0) nova.orcamento = imp.orcamento
    dados.push(nova); listaAberta = dados.length - 1; limparFiltro()
    aviso(`Lista “${v}” importada: ${total}`)
  })
}

function aplicarImportacao(l, imp) {
  const antigos = l.grupos.flatMap(g => g.itens.map(it => ({ g, it })))
  l.grupos.forEach(g => { g.itens = [] })
  let destino = l.grupos[l.grupos.length - 1]
  if (!destino) { destino = { descricao: 'Itens', itens: [] }; l.grupos.push(destino) }
  imp.itens.forEach(n => {
    const k = antigos.findIndex(a => norm(a.it.descricao) === norm(n.descricao))
    if (k >= 0) { const a = antigos.splice(k, 1)[0]; a.g.itens.push({ ...a.it, descricao: n.descricao, unidade: n.unidade, qtd: n.qtd }) }
    else destino.itens.push({ descricao: n.descricao, unidade: n.unidade, qtd: n.qtd, preco: 0 })
  })
  if (imp.orcamento > 0) l.orcamento = imp.orcamento
}

const acoes = {
  'nova-lista': () => abrirNome('Nova lista', '', (v, comGrupos) => {
    const nova = { descricao: v, grupos: [] }
    if (!comGrupos) { nova.semGrupo = true; nova.grupos.push({ descricao: '', itens: [] }) }
    dados.push(nova); listaAberta = dados.length - 1; limparFiltro()
  }, true),
  'edit-orc': ({ L }) => abrirOrc(L),
  'edit-lista': ({ L }) => abrirNome('Renomear lista', dados[L].descricao, v => { dados[L].descricao = v }),
  'del-lista': ({ L }) => excluir(`Excluir a lista “${dados[L].descricao}”?`, () => { dados.splice(L, 1); listaAberta = null }),
  'novo-grupo': ({ L }) => abrirNome('Novo grupo', '', v => { dados[L].grupos.push({ descricao: v, itens: [] }); listaAberta = L }),
  'edit-grupo': ({ L, G }) => abrirNome('Renomear grupo', dados[L].grupos[G].descricao, v => { dados[L].grupos[G].descricao = v }),
  'del-grupo': ({ L, G }) => excluir(`Excluir o grupo “${dados[L].grupos[G].descricao}”?`, () => dados[L].grupos.splice(G, 1)),
  'novo-item': ({ L, G }) => abrirItem(L, G, -1),
  'edit-item': ({ L, G, I }) => abrirItem(L, G, I),
  'del-item': ({ L, G, I }) => excluir('Excluir este item?', () => dados[L].grupos[G].itens.splice(I, 1)),
  'zerar-lista': ({ L }) => executar(`Zerar os preços dos itens e o valor para gastar da lista “${dados[L].descricao}”?`, 'Zerar preços',
    () => { dados[L].orcamento = 0; dados[L].grupos.forEach(g => g.itens.forEach(it => { it.preco = 0 })) }, false),
  resumo: ({ L }) => { $('#resumoTexto').textContent = resumoTexto(dados[L]); $('#btnCopiar').textContent = 'Copiar'; sheetResumo.hidden = false },
  copiar,
  compartilhar: ({ L }) => mostrarQR(L),
  importar: abrirScanner,
  'conf-sim': () => { const r = resolveConf; resolveConf = null; sheetConfirm.hidden = true; r?.(true) },
  'conf-nao': () => fechar(),
  tema: () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = t
    try { localStorage.setItem('listas-tema', t) } catch { }
    iconeTema()
  },
  camera: lerPrecoCamera,
  fechar
}

function iconeTema() {
  const dark = document.documentElement.dataset.theme === 'dark'
  $('#btnTema').innerHTML = svgIcon(dark ? P.sun : P.moon)
  $('#btnTema').title = dark ? 'Modo claro' : 'Modo escuro'
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('sheet')) return fechar()
  const b = e.target.closest('[data-action]')
  if (!b) return
  e.preventDefault() // evita abrir/fechar o <details> ao clicar nos ícones do cabeçalho
  const { action, l, g, i } = b.dataset
  acoes[action]?.({ L: +l, G: +g, I: +i })
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.querySelector('.ps-ov')) fechar()
  if (e.key === 'Enter' && e.target.matches?.('[data-action][tabindex="0"]')) e.target.click()
})

$('#qrBox').addEventListener('click', () => { qrFull = !qrFull; $('#qrBox').classList.toggle('full', qrFull); desenhaQR() })
addEventListener('resize', () => { if (qrAtual) desenhaQR() })

iconeTema()
render()
