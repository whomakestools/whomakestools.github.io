let dados = []

let state = { idLista: -1, idGrupo: -1 }

const gravaListasLocalStorage = () => localStorage.listas = JSON.stringify(dados)

const lerListasLocalStorge = () => dados = localStorage.listas ? JSON.parse(localStorage.listas) : []

const geral = document.querySelector("#geral")

const idForm = document.querySelector("#id")

const totalizaLista = lista => {
    return lista.grupos
        .reduce((ac, grupo) =>
            ac + grupo.itens
                .reduce((acc, { preco, qtd }) =>
                    acc + (preco * qtd)
                    , 0)
            , 0)
}

const totalizaGrupo = grupo => {
    return grupo.itens
        .reduce((acc, { preco, qtd }) =>
            acc + (preco * qtd)
            , 0).toFixed(2)
}

const inserirHeaderLista = (idxLista, lista) => {

    geral.innerHTML.clear

    const divListas = document.createElement('DIV')
    divListas.classList.add('lista')
    divListas.setAttribute('data-id', idxLista)

    const divHeaderLista = document.createElement('DIV')
    divHeaderLista.classList.add('headerLista')

    const div1 = document.createElement('DIV')
    const div2 = document.createElement('DIV')

    const h4El = document.createElement('H4')
    const h4El2 = document.createElement('H4')

    h4El.textContent = lista.descricao

    div1.append(h4El)
    div1.style.flex = 1

    div1.addEventListener('click', event => {
        clickLista(event.target, divListas)
    })

    divHeaderLista.append(div1)

    divListas.append(divHeaderLista)

    h4El2.textContent = '$ ' + totalizaLista(lista).toFixed(2)

    div2.append(h4El2)
    div2.classList.add('teste')

    const btnNovoGrupo = document.createElement('I')

    btnNovoGrupo.classList.add('fa')
    btnNovoGrupo.classList.add('fa-plus')
    btnNovoGrupo.classList.add('delete-btn')

    btnNovoGrupo.setAttribute('onclick', `addGrupo(${idxLista})`)
    btnNovoGrupo.style.color = '#fff'

    const bntDelete = document.createElement('I')

    bntDelete.classList.add('delete-btn')
    bntDelete.classList.add('fa')
    bntDelete.classList.add('fa-trash-o')

    bntDelete.setAttribute('onclick', `removeLista(${idxLista})`)
    bntDelete.style.color = '#fff'

    const bntEditar = document.createElement('BUTTON')
    bntEditar.classList.add('delete-btn')
    bntEditar.textContent = "#"

    divHeaderLista.append(div2)

    divHeaderLista.append(btnNovoGrupo)
    divHeaderLista.append(bntDelete)

    divListas.append(divHeaderLista)

    const divGrupos = document.createElement('DIV')
    divGrupos.classList.add('grupos')

    inserirHeaderGrupo(idxLista, divGrupos, lista.grupos)

    divListas.append(divGrupos)

    geral.append(divListas)
}

const inserirHeaderGrupo = (idxLista, divGrupos, grupos) => {

    grupos.forEach((grupo, index) => {

        const divGrupo = document.createElement('DIV')
        divGrupo.classList.add('grupo')

        const divHeaderGrupo = document.createElement('DIV')
        divHeaderGrupo.classList.add('headerGrupo')
        divHeaderGrupo.setAttribute('data-idlista', idxLista)
        divHeaderGrupo.setAttribute('data-idgrupo', index)


        const div1 = document.createElement('DIV')
        const div2 = document.createElement('DIV')

        const h4El = document.createElement('H4')
        h4El.textContent = grupo.descricao

        const h4El2 = document.createElement('H4')
        h4El2.textContent = '$ ' + totalizaGrupo(grupo)

        const bntDelete = document.createElement('I')

        bntDelete.classList.add('delete-btn')
        bntDelete.classList.add('fa')
        bntDelete.classList.add('fa-trash-o')

        bntDelete.setAttribute('onclick', `removeGrupo(${idxLista},${index})`)

        bntDelete.style.color = '#de4a4a'

        const bntNovoItem = document.createElement('I')

        bntNovoItem.classList.add('delete-btn')
        bntNovoItem.classList.add('fa')
        bntNovoItem.classList.add('fa-plus')

        bntNovoItem.setAttribute('onclick', `addItem(${idxLista},${index})`)
        bntNovoItem.style.color = '#de4a4a'

        const bntEditar = document.createElement('BUTTON')
        bntEditar.classList.add('delete-btn')
        bntEditar.textContent = "#"

        div1.append(h4El)

        div1.addEventListener('click', event => {

            clickGrupo(divHeaderGrupo)

        })

        div1.style.flex = 1

        div2.append(h4El2)
        div2.classList.add('teste')

        divHeaderGrupo.append(div1)
        divHeaderGrupo.append(div2)

        divHeaderGrupo.append(bntNovoItem)
        divHeaderGrupo.append(bntDelete)

        divHeaderGrupo.classList.add('content')
        divGrupo.append(divHeaderGrupo)

        inserirItemDOM(idxLista, index, divGrupo, grupo.itens)

        divGrupos.append(divGrupo)
    })
}

const inserirItemDOM = (idxLista, idxGrupo, divGrupo, itens) => {

    const divItens = document.createElement('DIV')

    itens.forEach((item, index) => {

        const divItem = document.createElement('DIV')
        divItem.classList.add('item')

        const divItem_1_1 = document.createElement('DIV')
        divItem_1_1.classList.add('item_1')
        const divItem_1_2 = document.createElement('DIV')
        divItem_1_2.classList.add('item_1')

        const spanQtdUn = document.createElement('SPAN')
        const spanPreco = document.createElement('SPAN')
        const spanTotalItem = document.createElement('SPAN')

        const bntEditar = document.createElement('I')
        bntEditar.classList.add('fa')
        bntEditar.classList.add('fa-pencil-square-o')
        bntEditar.classList.add('delete-btn')

        bntEditar.setAttribute('onclick', `editItem(${idxLista},${idxGrupo},${index})`)
        bntEditar.style.color = 'black'

        const bntDelete = document.createElement('I')
        bntDelete.classList.add('fa')
        bntDelete.classList.add('fa-trash-o')

        bntDelete.classList.add('delete-btn')
        bntDelete.setAttribute('onclick', `removeItem(${idxLista},${idxGrupo},${index})`)
        bntDelete.style.color = 'black'

        divItem_1_1.innerHTML += item.descricao

        spanQtdUn.textContent = item.qtd + ' ' + item.unidade
        spanPreco.textContent = '$ ' + item.preco.toFixed(2)
        spanTotalItem.textContent = '$ ' + (item.qtd * item.preco).toFixed(2)

        divItem_1_2.append(spanQtdUn)
        divItem_1_2.append(spanPreco)
        divItem_1_2.append(spanTotalItem)
        // divItem_1_2.append(bntEditar)
        // divItem_1_2.append(bntDelete)

        divItem.append(divItem_1_1)
        divItem.append(divItem_1_2)
        divItem.append(bntEditar)
        divItem.append(bntDelete)
        divItens.append(divItem)
    })
    divGrupo.append(divItens)
}

const editItem = (idxLista, idxGrupo, index) => {

    const item = dados[idxLista].grupos[idxGrupo].itens[index]

    form.style.display = "block"
    geral.style.display = "none"

    const descricaoEl = document.querySelector("#text")
    const unidadeEl = document.querySelector("#unidade")
    const qtdEl = document.querySelector("#qtd")
    const precoEl = document.querySelector("#preco")

    descricaoEl.value = item.descricao
    qtdEl.value = item.qtd
    unidadeEl.value = item.unidade
    precoEl.value = item.preco

    idForm.value = `{"idLista": ${idxLista},"idGrupo":${idxGrupo},"idItem":${index}}`

}

const addItem = (idxLista, idxGrupo, idxItem) => {
    geral.style.display = 'none'
    form.style.display = "block"
    idForm.value = `{"idLista": ${idxLista},"idGrupo":${idxGrupo},"idItem":-1}`
}

const zeraModal = () => {
    modal.innerHTML = ''
    modal.style.display = 'none'
}

const limpaForm2 = () => {
    iDescricao.value = ''
    form2.btnFrm2.value = ''

    form2.style.display = 'none'
    geral.style.display = "block"
}

form2.addEventListener('submit', event => {
    event.preventDefault()

    if (iDescricao.value.trim() === '') {
        modal.innerHTML += 'Informe todos os dados'
        modal.style.textAlign = 'center'
        modal.style.border = '1px solid red'
        modal.style.display = 'block'
        modal.style.padding = '5px'
        modal.style.background = '#ffc04e'
        return
    }

    if (btnFrm2.value === 'null') {

        const novo = {
            descricao: iDescricao.value,
            grupos: []
        }

        dados.push(novo)
        state.idLista = '-1'
        state.idGrupo = '-1'
    }
    else {
        const novo = { 'descricao': iDescricao.value, 'itens': [] }

        dados[btnFrm2.value].grupos.push(novo)
        state.idLista = btnFrm2.value
        
    }

    limpaForm2()
    gravaListasLocalStorage()

    renderizaLista()
})

form2.addEventListener('reset', event => {
    event.preventDefault()

    limpaForm2()

    zeraModal()
})

form.addEventListener('submit', event => {
    event.preventDefault()

    const descricaoEl = document.querySelector("#text")
    const unidadeEl = document.querySelector("#unidade")
    const qtdEl = document.querySelector("#qtd")
    const precoEl = document.querySelector("#preco")

    if (descricaoEl.value.trim().length < 1) {
        modal.innerHTML += 'Informe todos os dados'
        modal.style.textAlign = 'center'
        modal.style.border = '1px solid red'
        modal.style.display = 'block'
        modal.style.padding = '5px'
        modal.style.background = '#ffc04e'
        return
    }

    const f = JSON.parse(idForm.value)

    if (f.idItem > -1) {
        dados[f.idLista].grupos[f.idGrupo].itens[f.idItem].descricao = descricaoEl.value
        dados[f.idLista].grupos[f.idGrupo].itens[f.idItem].unidade = unidadeEl.value
        dados[f.idLista].grupos[f.idGrupo].itens[f.idItem].qtd = Number(qtdEl.value)
        dados[f.idLista].grupos[f.idGrupo].itens[f.idItem].preco = Number(precoEl.value)
    } else {

        const novoItem = {
            descricao: descricaoEl.value,
            qtd: Number(qtdEl.value),
            unidade: unidadeEl.value,
            preco: Number(precoEl.value)
        }

        dados[f.idLista].grupos[f.idGrupo].itens.push(novoItem)
    }
    gravaListasLocalStorage()

    renderizaLista()

    form.style.display = "none"
    geral.style.display = "block"

    descricaoEl.value = ''
    qtdEl.value = 0.000
    unidadeEl.value = 'UN'
    precoEl.value = 0.00
})

form.addEventListener('reset', event => {
    event.preventDefault()

    form.style.display = "none"
    geral.style.display = "block"

    document.querySelector("#text").value = ''
    document.querySelector("#unidade").value = 'UN'
    document.querySelector("#qtd").value = 0
    document.querySelector("#preco").value = 0
    zeraModal()

})

const removeItem = (idxLista, idxGrupo, index) => {

    const item = dados[idxLista].grupos[idxGrupo].itens[index]

    const id = dados[idxLista].grupos[idxGrupo].itens.indexOf(item)

    dados[idxLista].grupos[idxGrupo].itens.splice(id, 1)

    gravaListasLocalStorage()

    renderizaLista()

}

const colapseListas = () => {
    const teste = document.querySelectorAll('.lista')

    teste.forEach(item => {
        console.log(item.dataset.id != state.idLista)
        if (item.dataset.id != state.idLista) {
            item.childNodes[1].style.display = 'none'
        }
        else {

                item.childNodes[1].style.display = 'block'
        }
    })

    console.log('col',state)
}


const colapseGrupos = manter => {
    const teste = document.querySelectorAll('.headerGrupo')

    const idState = String(state.idLista) + '' + String(state.idGrupo)

    teste.forEach(item => {

        const idItem = item.dataset.idlista + '' + item.dataset.idgrupo

        if (idItem != idState) {
            item.nextSibling.style.display = 'none'
        }
        else {
            item.nextSibling.style.display = 'block'

            if (manter) {
                item.nextSibling.style.display = 'block'
            }
            else {
                if (item.nextSibling.style.display != 'none') {
                    item.nextSibling.style.display = 'none'
                }
                else {
                    item.nextSibling.style.display = 'block'
                }
            }
        }
    })
}

const clickGrupo = div => {

    const teste = document.querySelectorAll('.headerGrupo')

    state.idGrupo = -1
    state.idLista = -1

    teste.forEach(item => {

        if (item != div) {
            item.nextSibling.style.display = 'none'
        }
        else {
            if (item.nextSibling.style.display != 'none') {
                item.nextSibling.style.display = 'none'
            } else {
                item.nextSibling.style.display = 'block'
                state.idGrupo = Number(item.dataset.idgrupo)
                state.idLista = Number(item.dataset.idlista)
            }
        }

    })
}

const addGrupo = (idxLista) => {

    form2.style.display = 'block'
    geral.style.display = 'none'

    btnFrm2.value = idxLista
    DescHeader.innerHTML = 'Novo grupo'
}

const removeGrupo = (idxLista, index) => {
    const grupo = dados[idxLista].grupos[index]

    const id = dados[idxLista].grupos.indexOf(grupo)

    dados[idxLista].grupos.splice(id, 1)

    gravaListasLocalStorage()

    renderizaLista()
}

const addLista = () => {

    form2.style.display = 'block'
    geral.style.display = 'none'

    btnFrm2.value = null
    DescHeader.innerHTML = 'Nova Lista'

}

const clickLista = (target, lista) => {

    colapseGrupos(false)

    state.idLista = '-1'

    const teste = document.querySelectorAll('.lista')

    teste.forEach(item => {
        if (item != lista) {
            item.childNodes[1].style.display = 'none'
        }
        else {
            if (item.childNodes[1].style.display != 'none') {
                item.childNodes[1].style.display = 'none'
            } else {
                item.childNodes[1].style.display = 'block'
                state.idLista = item.dataset.id
            }
        }
    })

    console.log('idliste',state.idLista)

}

const removeLista = (index) => {
    dados.splice(index, 1)

    gravaListasLocalStorage()
    renderizaLista()
}

const renderizaLista = () => {
    lerListasLocalStorge()
    geral.innerHTML = '<i onclick="addLista()" class="fa fa-calendar-plus-o plus-btn" aria-hidden="true"></i>'
    // '<button onclick="addLista()" class="plus-btn">+</button>'
    dados.forEach((lista, index) => {
        inserirHeaderLista(index, lista)
    })

    if (dados.length < 1) {
        addLista()
        return
    }

    colapseGrupos(true)
    colapseListas()
}

renderizaLista()


