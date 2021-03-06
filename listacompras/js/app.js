    const generateID = () => Math.round(Math.random() * 1000)

    let listas = []

    const getLocalStorage = () => listas = localStorage.compras ? JSON.parse(localStorage.compras) : []

    const setLocalStorage = () => localStorage.compras = JSON.stringify(listas)


    async function deleteLista(idL) {

      const retAter = await exibeAlertConfirmacao('Excluir Lista', 'Confirmar a exclusão?')
                        .then((res) => {
                                return res
                        })

      if (!retAter.data) return

      listas = listas.filter(lista => lista.id != idL)
      setLocalStorage()
      nav.push('nav-home')
    }

    customElements.define('nav-home', class NavHome extends HTMLElement {
      connectedCallback() {
        getLocalStorage()
        this.innerHTML =
          `<ion-header class="h">
                     <ion-toolbar><ion-title>Listas</ion-title></ion-toolbar>
                 </ion-header>
                 <ion-content slot="fixed">
                     <ion-fab vertical="bottom" horizontal="end" slot="fixed">
                         <ion-fab-button id="addd" onclick="createModal()">
                             <ion-icon name="add"></ion-icon>
                         </ion-fab-button>
                     </ion-fab>
                     <ion-list id="listItens">
                     ${montaDOMListas()}
                      </ion-list>
                 </ion-content>`
      }
    });

    const nav = document.querySelector('ion-nav');

    const montaDOMListas = () => {

      return listas.map((lista) =>
        `<ion-item button onclick="showDetail('${lista.id}')">                 
               <ion-label><h2>${lista.title}</h2></ion-label>
               <ion-label class="text-right" slot="end">
                   <h2>$ ${lista.itens.reduce((acc, iten) => acc + (iten.qtd * iten.preco), 0).toFixed(2)} </h2>
               </ion-label>
             </ion-item>`).join('\n')
    }

    const showDetail = id => {
      getLocalStorage()
      const lista = listas.find((lista) => lista.id == id)
      nav.push('nav-detail', { lista })
    }

    customElements.define('nav-detail', class NavDetail extends HTMLElement {
      connectedCallback() {

        this.innerHTML =
          `<ion-header translucent>
            <ion-toolbar>
              <ion-buttons slot="start">                
                <ion-back-button default-href="/"></ion-back-button>
              </ion-buttons>
              <ion-title slot="start">${this.lista.title}</ion-title>
              <ion-title id="totalItens" slot="end">
                $ ${this.lista.itens.reduce((acc, iten) => acc + (iten.qtd * iten.preco), 0).toFixed(2)}
               </ion-title>
            </ion-toolbar>
          </ion-header>
    
          <ion-content fullscreen class="ion-padding">
            <ion-fab vertical="bottom" horizontal="start" slot="fixed">
              <ion-fab-button defaultHref="/" onclick="deleteLista(${this.lista.id})" color="danger">
                <ion-icon name="md-trash"></ion-icon>
              </ion-fab-button>
              </ion-fab>
            <ion-fab vertical="bottom" horizontal="end" slot="fixed">
               <ion-fab-button id="er" onclick="createModalItem(${this.lista.id})">
                   <ion-icon name="add"></ion-icon>
               </ion-fab-button>
             </ion-fab>
             <ion-list id="gridItens">${montaDOMItens2(this.lista)}</ion-list>
          </ion-content>`
      }
    });

    customElements.define('modal-content', class ModalContent extends HTMLElement {
      connectedCallback() {
        this.innerHTML =
          `<ion-header translucent>
            <ion-toolbar>
              <ion-title>Nova Lista</ion-title>
              <ion-buttons slot="end">
                <ion-button onclick="dismissModal()">Cancelar</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content fullscreen>        
             <ion-list lines="full" class="ion-no-margin">
               <ion-item>
               <ion-label>Descrição</ion-label>
               <ion-input id="textLista" placeholder="Digite a descriçao"></ion-input>
             </ion-item>
          </ion-list>
          <section class="full-width">
        <ion-button expand="full" onclick="salvarLista()">SALVAR</ion-button>
      </section>

          </ion-content>
        `;
      }
    });

    customElements.define('modal-item', class ModalContent extends HTMLElement {
      connectedCallback() {

        let tituloTela = 'Novo Item'
        let exibe = ' style="display:none"'

        if (this.idItem != null) {
          tituloTela = "Alterar Item"
          exibe = ''
        }

        this.innerHTML =
          `<ion-header translucent>
            <ion-toolbar>
              <ion-title>${tituloTela}</ion-title>
              <ion-buttons slot="end">
                <ion-button onclick="dismissModal()">Cancelar</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content fullscreen>        
          <ion-list lines="full" class="ion-no-margin">
               <ion-item>
               <ion-label class="lbl">Descrição</ion-label>
               <ion-input class="inputFrm" id="itemDescricao" placeholder="Digite a descriçao"></ion-input>
             </ion-item>
        <ion-item>
          <ion-label class="lbl">Unidade</ion-label>
          <ion-select class="lbl" ok-text="Ok" cancel-text="Cancelar" placeholder="Selecione" id="itemUnidade">
            <ion-select-option value="UN">Unidade</ion-select-option>
            <ion-select-option value="LT">Litro</ion-select-option>
            <ion-select-option value="PC">Pacote</ion-select-option>
            <ion-select-option value="PÇ">Peça</ion-select-option>
            <ion-select-option value="DZ">Duzia</ion-select-option>
            <ion-select-option value="CX">Caixa</ion-select-option>
            <ion-select-option value="KG">Kilograma</ion-select-option>
            <ion-select-option value="FD">Fardo</ion-select-option>
            <ion-select-option value="LA">Lata</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-labe class="lbl">Quantidade</ion-labe>
          <ion-input id="itemQtd" placeholder="Quantidade" type="number" step="0.001"></ion-input>
        </ion-item>
        <ion-item>
          <ion-label class="lbl">Preço</ion-label>
          <ion-input id="itemPreco" placeholder="Preço" type="number" step="0.01"></ion-input>
        </ion-item>
          </ion-list>
          <section class="full-width">
        <ion-button expand="full" onclick="salvarItem(${this.id},${this.idItem})">SALVAR</ion-button>
        <ion-button ${exibe} expand="full" onclick="excluirItem(${this.id},${this.idItem})"" color="danger">EXCLUIR</ion-button>
      </section>
          </ion-content>`;

        if (this.idItem != null) {
          const lista = listas.find(lista => lista.id == this.id)

          itemDescricao.value = lista.itens[this.idItem].Descricao
          itemPreco.value = lista.itens[this.idItem].preco
          itemUnidade.value = lista.itens[this.idItem].unidade
          itemQtd.value = lista.itens[this.idItem].qtd
        }
      }
    });

    const montaDOMItens2 = lista => {
      return lista.itens.map((item, index) =>
        `<ion-item button onclick="createModalItem(${lista.id},${index})">    
                <ion-label class="text-left">
                    <h3>                      
                      ${item.Descricao}
                      </h3>
                  </ion-label>
                  <ion-label class="text-right">
                    <h3>${item.qtd} ${item.unidade}</h3>
                  </ion-label>
                  <ion-label class="text-right">
                    <h3>$ ${item.preco.toFixed(2)}</h3>
                  </ion-label>
                  <ion-label class="text-right">
                    <h3>$ ${(item.qtd * item.preco).toFixed(2)}</h3>
                  </ion-label>

                </ion-item>`).join('\n')

    }

    const montaDOMItens = lista => {

      document.querySelector("#gridItens").innerHTML = lista.itens.map((item, index) =>
        `<ion-item button onclick="createModalItem(${lista.id},${index})">    
                <ion-label class="text-left">
                    <h3>                      
                      ${item.Descricao}
                      </h3>
                  </ion-label>
                  <ion-label class="text-right">
                    <h3>${item.qtd} ${item.unidade}</h3>
                  </ion-label>
                  <ion-label class="text-right">
                    <h3>$${item.preco.toFixed(2)}</h3>
                  </ion-label>
                  <ion-label class="text-right">
                    <h3>$ ${(item.qtd * item.preco).toFixed(2)}</h3>
                  </ion-label>

                </ion-item>`).join('\n')

      document.querySelector("#totalItens").innerHTML =
        `$ ${lista.itens.reduce((acc, iten) => acc + (iten.qtd * iten.preco), 0).toFixed(2)}`
    }

    async function excluirItem(idlista, idItem) {

      const po = await exibeAlertConfirmacao('Excluir Item', 'Confirmar a exclusão?')
                        .then((res) => {
                                return res
                        })

      if (!po.data) return

      let lista = listas.find(lista => lista.id == idlista)

      const id = listas.indexOf(lista)

      listas[id].itens.splice(idItem, 1)

      setLocalStorage()

      nav.removeIndex(1)
      nav.push('nav-home')
      nav.push('nav-detail', { lista })

      dismissModal()

    }

    const salvarLista = () => {
      const descListaEl = document.querySelector("#textLista")

      listas.push({ "id": generateID(), 'title': descListaEl.value, 'itens': [] })

      setLocalStorage()

      nav.push('nav-home')

      descListaEl.value = ''

      dismissModal()
    }

    const salvarItem = (idlista, idItem) => {

      const lista = listas.find(lista => lista.id == idlista)

      if (idItem != null) {

        lista.itens[idItem].Descricao = itemDescricao.value
        lista.itens[idItem].preco = Number(itemPreco.value)
        lista.itens[idItem].unidade = itemUnidade.value
        lista.itens[idItem].qtd = Number(itemQtd.value)

      } else {

        const novoItem = {
          "id": generateID(),
          "Descricao": itemDescricao.value,
          "preco": Number(itemPreco.value),
          "unidade": itemUnidade.value,
          "qtd": Number(itemQtd.value)
        }
        lista.itens.push(novoItem)
      }

      setLocalStorage()
      nav.removeIndex(1)
      nav.push('nav-home')
      nav.push('nav-detail', { lista })

      dismissModal()
    }

    function createModal() {
      controller.create({
        component: 'modal-content'
      }).then(modal => {
        modal.present();
        currentModal = modal;
      });
    }

    function createModalItem(idLista, item) {
      controller.create({
        component: 'modal-item'
        , componentProps: { id: idLista, idItem: item }
      }).then(modal => {
        modal.present();
        currentModal = modal;
      });
    }

    let currentModal = null;
    
    const controller = document.querySelector('ion-modal-controller');

    function dismissModal() {
      if (currentModal) {
        currentModal.dismiss().then(() => { currentModal = null; });
      }
    }

    async function exibeAlertConfirmacao(title, message) {
      let choice

      const alertController = document.querySelector('ion-alert-controller');

      const alert = await alertController.create({
        header: title,
        subHeader: message,
        buttons: [
        {
          text: 'Não',
          handler: () => {
            alert.dismiss(false);
            return false;
          }
        },{
          text: 'Sim',
          handler: () => {
            alert.dismiss(true)
            return false
          }
        }]
      });

      await alert.present();
      await alert.onDidDismiss().then((data) => {
        choice = data
      })
      return choice
    }