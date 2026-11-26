'use strict'

const KEY = 'listas' // mesma chave de antes: os dados existentes continuam funcionando
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtdFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const $ = s => document.querySelector(s)

const geral = $('#geral')
const sheetNome = $('#sheetNome'), sheetItem = $('#sheetItem'), nomeInput = $('#nomeInput')
const sheetConfirm = $('#sheetConfirm'), sheetResumo = $('#sheetResumo'), sheetOrc = $('#sheetOrc')
const f = { desc: $('#iDesc'), un: $('#iUn'), qtd: $('#iQtd'), preco: $('#iPreco') }

let dados = ler()
const abertos = new Set() // listas/grupos expandidos ("0", "0-1")
let aoSalvarNome = null, refItem = null, resolveConf = null
let listaAberta = null // quando há uma lista aberta, só ela é exibida

function ler() { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } }
const gravar = () => { localStorage.setItem(KEY, JSON.stringify(dados)); render() }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/* ---------- totais ---------- */
const totalItens = itens => itens.reduce((a, { preco, qtd }) => a + preco * qtd, 0)
const totalLista = l => l.grupos.reduce((a, g) => a + totalItens(g.itens), 0)

// Itens sem preço aparecem primeiro; os com preço (verdes) vão para o fim. A ordem original é mantida em cada bloco.
const temPreco = it => it.preco > 0
const itensOrdenados = g => g.itens.map((it, I) => ({ it, I })).sort((a, b) => temPreco(a.it) - temPreco(b.it))

/* ---------- ícones e HTML ---------- */
const P = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  doc: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  undo: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7V6a2 2 0 0 1 2-2h12M16 14h2',
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
  return `<details class="grupo" data-k="${k}" ${abertos.has(k) ? 'open' : ''}>
    <summary><span class="nome">${esc(g.descricao)}</span><span class="total">${brl.format(totalItens(g.itens))}</span>
      <span class="acoes-hover">${iconBtn('novo-item', 'Novo item', P.plus, r)}${iconBtn('edit-grupo', 'Renomear grupo', P.edit, r)}${iconBtn('del-grupo', 'Excluir grupo', P.trash, r)}</span></summary>
    <ul class="itens">${itensOrdenados(g).map(({ it, I }) => itemHTML(it, L, G, I)).join('') || '<li class="vazio">Sem itens.</li>'}</ul>
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

const listaHTML = (l, L) => {
  const r = `data-l="${L}"`
  return `<details class="lista" data-k="${L}" ${L === listaAberta ? 'open' : ''}>
    <summary><span class="nome">${esc(l.descricao)}${saldoHTML(l)}</span><strong class="total">${brl.format(totalLista(l))}</strong>
      <span class="acoes-hover">${iconBtn('novo-grupo', 'Novo grupo', P.plus, r)}${iconBtn('edit-orc', 'Valor para gastar', P.wallet, r)}${iconBtn('resumo', 'Resumo da lista', P.doc, r)}${iconBtn('zerar-lista', 'Zerar preços da lista', P.undo, r)}${iconBtn('edit-lista', 'Renomear lista', P.edit, r)}${iconBtn('del-lista', 'Excluir lista', P.trash, r)}</span></summary>
    ${orcHTML(l, L)}<div class="grupos">${l.grupos.map((g, G) => grupoHTML(g, L, G)).join('') || '<p class="vazio">Sem grupos. Use + para adicionar.</p>'}</div>
  </details>`
}

function render() {
  if (listaAberta != null && !dados[listaAberta]) listaAberta = null
  geral.innerHTML = dados.length
    ? dados.map((l, L) => (listaAberta == null || L === listaAberta) ? listaHTML(l, L) : '').join('')
    : '<p class="vazio">Nenhuma lista ainda. Crie a primeira em “+ Nova lista”.</p>'
}

geral.addEventListener('toggle', e => {
  const el = e.target, k = el.dataset.k
  if (!k) return
  if (el.classList.contains('lista')) { // abrir uma lista oculta as outras; fechar (setinha) volta para todas
    const L = Number(k)
    if (el.open && listaAberta !== L) { listaAberta = L; render(); scrollTo({ top: 0 }) }
    else if (!el.open && listaAberta === L) { listaAberta = null; render() }
    return
  }
  el.open ? abertos.add(k) : abertos.delete(k)
}, true)

/* ---------- formulários ---------- */
const fechar = () => {
  ;[sheetNome, sheetItem, sheetResumo, sheetConfirm, sheetOrc].forEach(sh => { if (sh) sh.hidden = true })
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

function abrirNome(titulo, valor, cb) {
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
  aoSalvarNome(v); gravar(); fechar()
})

let refOrc = null
function abrirOrc(L) {
  refOrc = L
  $('#oVal').value = orc(dados[L]) > 0 ? orc(dados[L]) : ''
  sheetOrc.hidden = false
  if (!matchMedia('(pointer: coarse)').matches) $('#oVal').focus()
}
$('#formOrc').addEventListener('submit', e => {
  e.preventDefault()
  const v = Number($('#oVal').value) || 0
  dados[refOrc].orcamento = v > 0 ? v : 0
  gravar(); fechar()
})

const prev = () => { $('#prev').textContent = 'Total: ' + brl.format((+f.qtd.value || 0) * (+f.preco.value || 0)) }
;[f.qtd, f.preco].forEach(el => el.addEventListener('input', prev))

function abrirItem(L, G, I) {
  refItem = { L, G, I }
  const it = I >= 0 ? dados[L].grupos[G].itens[I] : { descricao: '', unidade: 'UN', qtd: 1, preco: '' }
  $('#itemTitulo').textContent = I >= 0 ? 'Editar item' : 'Novo item'
  f.desc.value = it.descricao; f.un.value = it.unidade; f.qtd.value = it.qtd; f.preco.value = it.preco
  prev()
  sheetItem.hidden = false
  if (!matchMedia('(pointer: coarse)').matches) f.desc.focus() // no celular o teclado só abre quando o campo é tocado
}

$('#formItem').addEventListener('submit', e => {
  e.preventDefault()
  const { L, G, I } = refItem
  const it = { descricao: f.desc.value.trim(), unidade: f.un.value, qtd: Number(f.qtd.value) || 0, preco: Number(f.preco.value) || 0 }
  if (!it.descricao) return
  const itens = dados[L].grupos[G].itens
  if (I >= 0) itens[I] = it; else itens.push(it)
  listaAberta = L; abertos.add(`${L}-${G}`)
  gravar(); fechar()
})

/* ---------- leitura de preço pela câmera (price-scanner) ---------- */
async function lerPrecoCamera() {
  if (!window.PriceScanner) return alert('Leitor de preço indisponível. Verifique a conexão.')
  const r = await PriceScanner.open({ decimals: 2 })
  if (r) { f.preco.value = r.value.toFixed(2); prev() }
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
    out.push(`#${g.descricao} — ${brl.format(totalItens(g.itens))}`, '')
    const rows = g.itens.map(it => ({
      d: it.descricao + ':', q: qtdTxt(it.qtd), u: it.unidade,
      p: temPreco(it) ? num(it.preco) : null, t: temPreco(it) ? num(it.qtd * it.preco) : null
    }))
    const w = k => Math.max(0, ...rows.filter(r => r[k] != null).map(r => r[k].length))
    const [wd, wq, wu, wp, wt] = ['d', 'q', 'u', 'p', 't'].map(w)
    rows.forEach(r => out.push(`${r.d.padEnd(wd)} ${r.q.padStart(wq)} ${r.u.padEnd(wu)}` +
      (r.p == null ? ' × sem preço' : ` × R$ ${r.p.padStart(wp)} = R$ ${r.t.padStart(wt)}`)))
    if (rows.length) out.push('')
  })
  out.push(`## TOTAL: ${brl.format(totalLista(l))}`)
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

const acoes = {
  'nova-lista': () => abrirNome('Nova lista', '', v => { dados.push({ descricao: v, grupos: [] }); listaAberta = dados.length - 1 }),
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

iconeTema()
render()
