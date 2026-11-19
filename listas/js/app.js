'use strict'

const KEY = 'listas' // mesma chave de antes: os dados existentes continuam funcionando
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtdFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const $ = s => document.querySelector(s)

const geral = $('#geral')
const sheetNome = $('#sheetNome'), sheetItem = $('#sheetItem'), nomeInput = $('#nomeInput')
const f = { desc: $('#iDesc'), un: $('#iUn'), qtd: $('#iQtd'), preco: $('#iPreco') }

let dados = ler()
const abertos = new Set() // listas/grupos expandidos ("0", "0-1")
let aoSalvarNome = null, refItem = null

function ler() { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } }
const gravar = () => { localStorage.setItem(KEY, JSON.stringify(dados)); render() }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/* ---------- totais ---------- */
const totalItens = itens => itens.reduce((a, { preco, qtd }) => a + preco * qtd, 0)
const totalLista = l => l.grupos.reduce((a, g) => a + totalItens(g.itens), 0)

/* ---------- ícones e HTML ---------- */
const P = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14'
}
const iconBtn = (action, title, d, ref) =>
  `<button type="button" class="icon" data-action="${action}" ${ref} title="${title}" aria-label="${title}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></button>`

const itemHTML = (it, L, G, I) => `
  <li class="item">
    <div class="info"><span class="desc">${esc(it.descricao)}</span>
      <small>${qtdFmt.format(it.qtd)} ${esc(it.unidade)} × ${brl.format(it.preco)}</small></div>
    <strong>${brl.format(it.qtd * it.preco)}</strong>
    ${iconBtn('edit-item', 'Editar item', P.edit, `data-l="${L}" data-g="${G}" data-i="${I}"`)}
    ${iconBtn('del-item', 'Excluir item', P.trash, `data-l="${L}" data-g="${G}" data-i="${I}"`)}
  </li>`

const grupoHTML = (g, L, G) => {
  const k = `${L}-${G}`, r = `data-l="${L}" data-g="${G}"`
  return `<details class="grupo" data-k="${k}" ${abertos.has(k) ? 'open' : ''}>
    <summary><span class="nome">${esc(g.descricao)}</span><span class="total">${brl.format(totalItens(g.itens))}</span>
      <span class="acoes-hover">${iconBtn('novo-item', 'Novo item', P.plus, r)}${iconBtn('edit-grupo', 'Renomear grupo', P.edit, r)}${iconBtn('del-grupo', 'Excluir grupo', P.trash, r)}</span></summary>
    <ul class="itens">${g.itens.map((it, I) => itemHTML(it, L, G, I)).join('') || '<li class="vazio">Sem itens.</li>'}</ul>
  </details>`
}

const listaHTML = (l, L) => {
  const r = `data-l="${L}"`
  return `<details class="lista" data-k="${L}" ${abertos.has(String(L)) ? 'open' : ''}>
    <summary><span class="nome">${esc(l.descricao)}</span><strong class="total">${brl.format(totalLista(l))}</strong>
      <span class="acoes-hover">${iconBtn('novo-grupo', 'Novo grupo', P.plus, r)}${iconBtn('edit-lista', 'Renomear lista', P.edit, r)}${iconBtn('del-lista', 'Excluir lista', P.trash, r)}</span></summary>
    <div class="grupos">${l.grupos.map((g, G) => grupoHTML(g, L, G)).join('') || '<p class="vazio">Sem grupos. Use + para adicionar.</p>'}</div>
  </details>`
}

function render() {
  geral.innerHTML = dados.length
    ? dados.map(listaHTML).join('')
    : '<p class="vazio">Nenhuma lista ainda. Crie a primeira em “+ Nova lista”.</p>'
}

geral.addEventListener('toggle', e => {
  const k = e.target.dataset.k
  if (k) e.target.open ? abertos.add(k) : abertos.delete(k)
}, true)

/* ---------- formulários ---------- */
const fechar = () => { sheetNome.hidden = sheetItem.hidden = true }

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

const prev = () => { $('#prev').textContent = 'Total: ' + brl.format((+f.qtd.value || 0) * (+f.preco.value || 0)) }
;[f.qtd, f.preco].forEach(el => el.addEventListener('input', prev))

function abrirItem(L, G, I) {
  refItem = { L, G, I }
  const it = I >= 0 ? dados[L].grupos[G].itens[I] : { descricao: '', unidade: 'UN', qtd: 1, preco: '' }
  $('#itemTitulo').textContent = I >= 0 ? 'Editar item' : 'Novo item'
  f.desc.value = it.descricao; f.un.value = it.unidade; f.qtd.value = it.qtd; f.preco.value = it.preco
  prev()
  sheetItem.hidden = false
  f.desc.focus()
}

$('#formItem').addEventListener('submit', e => {
  e.preventDefault()
  const { L, G, I } = refItem
  const it = { descricao: f.desc.value.trim(), unidade: f.un.value, qtd: Number(f.qtd.value) || 0, preco: Number(f.preco.value) || 0 }
  if (!it.descricao) return
  const itens = dados[L].grupos[G].itens
  if (I >= 0) itens[I] = it; else itens.push(it)
  abertos.add(String(L)); abertos.add(`${L}-${G}`)
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
const excluir = (msg, fn) => { if (confirm(msg)) { fn(); abertos.clear(); gravar() } }

const acoes = {
  'nova-lista': () => abrirNome('Nova lista', '', v => { dados.push({ descricao: v, grupos: [] }); abertos.add(String(dados.length - 1)) }),
  'edit-lista': ({ L }) => abrirNome('Renomear lista', dados[L].descricao, v => { dados[L].descricao = v }),
  'del-lista': ({ L }) => excluir(`Excluir a lista “${dados[L].descricao}”?`, () => dados.splice(L, 1)),
  'novo-grupo': ({ L }) => abrirNome('Novo grupo', '', v => { dados[L].grupos.push({ descricao: v, itens: [] }); abertos.add(String(L)) }),
  'edit-grupo': ({ L, G }) => abrirNome('Renomear grupo', dados[L].grupos[G].descricao, v => { dados[L].grupos[G].descricao = v }),
  'del-grupo': ({ L, G }) => excluir(`Excluir o grupo “${dados[L].grupos[G].descricao}”?`, () => dados[L].grupos.splice(G, 1)),
  'novo-item': ({ L, G }) => abrirItem(L, G, -1),
  'edit-item': ({ L, G, I }) => abrirItem(L, G, I),
  'del-item': ({ L, G, I }) => excluir('Excluir este item?', () => dados[L].grupos[G].itens.splice(I, 1)),
  camera: lerPrecoCamera,
  fechar
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
})

render()
