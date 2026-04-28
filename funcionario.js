// ============================================
// funcionario.js - Tela do Funcionário (Celular)
// Versão CORRIGIDA
// ============================================

let funcionarioAtual = null;
let escalaData = {};
let pagamentosData = {};
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

// ========== CONFIGURAÇÃO DO FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyApDJcJ-bsiPJJLITXdlRtf82gzlSYtZRY",
    authDomain: "app-escala-funcionarios.firebaseapp.com",
    projectId: "app-escala-funcionarios",
    storageBucket: "app-escala-funcionarios.firebasestorage.app",
    messagingSenderId: "1066676645204",
    appId: "1:1066676645204:web:3ce459ed8b8b76a7f92cc1"
};

let db = null;
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    console.log("✅ Firebase conectado no funcionario.js");
}

// ========== FUNÇÃO PARA CARREGAR ESCALA ==========
async function carregarEscalaFirebase() {
    try {
        if (!db) return;

        const snapshot = await db.collection('escala').get();
        escalaData = {};

        snapshot.forEach(doc => {
            const item = doc.data();
            const data = item.data;
            const funcId = item.funcionario_id;

            let horarios = item.horarios || [];

            // compatibilidade com versão antiga
            if (horarios.length === 0 && item.horario) {
                horarios = [item.horario];
            }

            if (!escalaData[data]) escalaData[data] = {};

            escalaData[data][funcId] = {
                status: item.status,
                horarios: horarios
            };
        });

    } catch (error) {
        console.error("Erro ao carregar escala:", error);
    }
}

// ========== FUNÇÃO PARA CARREGAR PAGAMENTOS ==========
async function carregarPagamentosFirebase() {
    try {
        if (!db) return;

        const snapshot = await db.collection('pagamentos').get();
        pagamentosData = {};

        snapshot.forEach(doc => {
            const item = doc.data();
            const data = item.data;
            const funcId = item.funcionario_id;

            if (!pagamentosData[data]) pagamentosData[data] = {};

            pagamentosData[data][funcId] = item || {};
        });

    } catch (error) {
        console.error("Erro ao carregar pagamentos:", error);
    }
}

// ========== FUNÇÃO PRINCIPAL ==========
async function carregarDados() {
    const funcionarioStr = localStorage.getItem("funcionarioLogado");
    
    if (!funcionarioStr) {
        window.location.href = "index.html";
        return;
    }
    
    try {
        funcionarioAtual = JSON.parse(funcionarioStr);
        console.log("👤 Funcionário logado:", funcionarioAtual.nome);
        
        // Carregar dados do Firebase
        await carregarEscalaFirebase();
        await carregarPagamentosFirebase();
        
        renderizarTela();
        
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        document.getElementById("app").innerHTML = `
            <div class="loading">
                <p>❌ Erro ao carregar dados</p>
                <button onclick="location.reload()">Tentar novamente</button>
            </div>
        `;
    }
}

// ========== RENDERIZAR TELA ==========
function renderizarTela() {
    const app = document.getElementById("app");
    
    const resumo = calcularResumoMes();
    
    app.innerHTML = `
        <div class="container">
            <div class="func-header">
                <div class="func-nome">👋 Olá, ${funcionarioAtual.nome}</div>
                <div class="func-diaria">💰 Diária: R$ ${funcionarioAtual.diaria.toFixed(2)}</div>
            </div>
            
            <div class="resumo-card">
                <div class="info-item">
                    <div class="info-valor">${resumo.diasTrabalhados}</div>
                    <div class="info-label">Dias Trabalhados</div>
                </div>
                <div class="info-item">
                    <div class="info-valor">${resumo.diasPagos || 0}</div>
                    <div class="info-label">Dias Pagos</div>
                </div>
                <div class="info-item">
                    <div class="info-valor">${resumo.diasFolga}</div>
                    <div class="info-label">Dias de Folga</div>
                </div>
                <div class="info-item">
                    <div class="info-valor">R$ ${(resumo.valorPago || 0).toFixed(2)}</div>
                    <div class="info-label">Valor Recebido</div>
                </div>
            </div>
            
            <div class="calendario-card">
                <div class="mes-navegacao">
                    <button class="nav-btn" onclick="mudarMes(-1)">◀</button>
                    <div class="mes-titulo" id="mesTitulo"></div>
                    <button class="nav-btn" onclick="mudarMes(1)">▶</button>
                </div>
                
                <div class="dias-semana">
                    <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
                </div>
                
                <div class="calendario-grid" id="calendarioGrid"></div>
            </div>
            
            <button class="btn-sair" onclick="logout()">🚪 Sair</button>
        </div>
    `;
    
    atualizarTituloMes();
    renderizarCalendario();
}

// ========== CALCULAR RESUMO ==========
function calcularResumoMes() {
    const diasNoMes = new Date(currentYear, currentMonth + 1, 0).getDate();
    let diasTrabalhados = 0;
    let diasFolga = 0;
    let diasPagos = 0;
    
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const escala = escalaData[dataStr] && escalaData[dataStr][funcionarioAtual.id];
        
        if (escala && escala.status === 'trabalha') {
            diasTrabalhados++;
            const dadosPagamento = pagamentosData[dataStr]?.[funcionarioAtual.id] || {};
            const pagamentosArr = dadosPagamento.pagos || [];
            const foiPago = pagamentosArr.length > 0 && pagamentosArr.every(p => p === true);
            if (foiPago) diasPagos++;
        } else if (escala && escala.status === 'folga') {
            diasFolga++;
        }
    }
    
    let valorPago = 0;

    for (let dia = 1; dia <= diasNoMes; dia++) {

        const dataStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const escala = escalaData[dataStr]?.[funcionarioAtual.id];

        if (escala && escala.status === 'trabalha') {

            const dados = pagamentosData[dataStr]?.[funcionarioAtual.id] || {};
            const pagos = dados.pagos || [];

            const foiPago = pagos.length > 0 && pagos.every(p => p === true);

            if (foiPago) {
                let valorDia = funcionarioAtual.diaria;

                valorDia += Number(dados.adicional || 0);
                valorDia -= Number(dados.desconto || 0);

                valorPago += valorDia;
            }
        }
    }
        
    return {
        diasTrabalhados,
        diasFolga,
        diasPagos,
        valorPago
    };
}

// ========== ATUALIZAR TÍTULO ==========
function atualizarTituloMes() {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const titulo = document.getElementById("mesTitulo");
    if (titulo) {
        titulo.textContent = `${meses[currentMonth]} ${currentYear}`;
    }
}

// ========== RENDERIZAR CALENDÁRIO ==========
function renderizarCalendario() {
    const grid = document.getElementById("calendarioGrid");
    if (!grid) return;
    
    const primeiroDia = new Date(currentYear, currentMonth, 1);
    const primeiroDiaSemana = primeiroDia.getDay();
    const diasNoMes = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let gridHTML = '';
    
    // Dias do mês anterior
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
        gridHTML += `<div class="dia dia-vazio"></div>`;
    }
    
    // Dias do mês atual
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        
        let statusClass = '';
        let statusIcon = '';
        let horario = '';
        let pagoIcon = '';
        
        const escala = escalaData[dataStr] && escalaData[dataStr][funcionarioAtual.id];
        const dadosPagamento = pagamentosData[dataStr]?.[funcionarioAtual.id] || {};
        const pagamentosArr = dadosPagamento.pagos || [];
        const foiPago = pagamentosArr.length > 0 && pagamentosArr.every(p => p === true);
        
        if (escala) {
            if (escala.status === 'trabalha') {
                statusClass = 'dia-trabalha';
                statusIcon = '✅';
                const horarios = escala.horarios || [];
                horario = horarios.join(' | ');
                if (foiPago) {
                    pagoIcon = '💰';
                }
            } else if (escala.status === 'folga') {
                statusClass = 'dia-folga';
                statusIcon = '❌';
            }
        }
        
        const isHoje = (currentYear === new Date().getFullYear() && 
                       currentMonth === new Date().getMonth() && 
                       dia === new Date().getDate());
        
        gridHTML += `
            <div class="dia ${statusClass}" onclick="verDetalhes('${dataStr}', ${dia})">
                <div class="dia-numero">${dia}${isHoje ? '📍' : ''}</div>
                <div class="dia-indicador">${statusIcon} ${pagoIcon}</div>
                ${horario ? `<div class="dia-indicador">${horario}</div>` : ''}
            </div>
        `;
    }
    
    grid.innerHTML = gridHTML;
}

// ========== VER DETALHES ==========
function verDetalhes(dataStr, diaNum) {
    const escala = escalaData[dataStr] && escalaData[dataStr][funcionarioAtual.id];
    const [ano, mes, dia] = dataStr.split('-');
    const dataFormatada = `${dia}/${mes}/${ano}`;
    
    const dadosPagamento = pagamentosData[dataStr]?.[funcionarioAtual.id] || {};
    const pagamentosArr = dadosPagamento.pagos || [];
    const foiPago = pagamentosArr.length > 0 && pagamentosArr.every(p => p === true);
    
    let statusText = '';
    let statusIcon = '';
    let horario = '';
    let pagamentoText = '';
    let pagamentoIcon = '';
    
    if (escala && escala.status === 'trabalha') {
        statusText = 'Dia de Trabalho';
        statusIcon = '✅';
        const horarios = escala.horarios || [];

        horario = horarios.length > 0 
            ? horarios.join('<br>')
            : 'Horário não definido';
        
        if (foiPago) {
            pagamentoText = 'Pagamento Confirmado';
            pagamentoIcon = '💰';
        } else {
            pagamentoText = 'Aguardando Pagamento';
            pagamentoIcon = '⏳';
        }
    } else if (escala && escala.status === 'folga') {
        statusText = 'Dia de Folga';
        statusIcon = '❌';
        horario = 'Aproveite para descansar!';
        pagamentoText = 'Não se aplica';
        pagamentoIcon = '📅';
    } else {
        statusText = 'Não definido';
        statusIcon = '❓';
        horario = 'Aguardando definição do administrador';
        pagamentoText = 'Aguardando escala';
        pagamentoIcon = '⌛';
    }
    
    let modal = document.getElementById("modalDetalhes");
    if (!modal) {
        modal = document.createElement('div');
        modal.id = "modalDetalhes";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-data"></div>
                <div class="modal-status"></div>
                <div class="modal-horario"></div>
                <div class="modal-pagamento" style="margin: 16px 0; padding: 12px; border-radius: 12px; text-align: center;"></div>
                <button class="close-modal">Fechar</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    modal.querySelector('.modal-data').innerHTML = `📅 ${dataFormatada}`;
    modal.querySelector('.modal-status').innerHTML = `${statusIcon} ${statusText}`;
    modal.querySelector('.modal-horario').innerHTML = `⏰ ${horario}`;
    
    const pagamentoDiv = modal.querySelector('.modal-pagamento');
    pagamentoDiv.innerHTML = `${pagamentoIcon} ${pagamentoText}`;
    pagamentoDiv.style.background = foiPago ? '#dcfce7' : '#fef3c7';
    pagamentoDiv.style.color = foiPago ? '#166534' : '#92400e';
    
    modal.style.display = 'flex';
}

// ========== FUNÇÕES DE NAVEGAÇÃO ==========
function mudarMes(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    
    atualizarTituloMes();
    renderizarCalendario();
    
    const resumo = calcularResumoMes();
    const infoLabels = document.querySelectorAll('.info-valor');
    if (infoLabels.length >= 4) {
        infoLabels[0].textContent = resumo.diasTrabalhados;
        infoLabels[1].textContent = resumo.diasPagos || 0;
        infoLabels[2].textContent = resumo.diasFolga;
        infoLabels[3].textContent = `R$ ${(resumo.valorPago || 0).toFixed(2)}`;
    }
}

function logout() {
    localStorage.removeItem("funcionarioLogado");
    window.location.href = "index.html";
}

// Fechar modal
window.onclick = function(event) {
    const modal = document.getElementById("modalDetalhes");
    if (event.target === modal) {
        modal.style.display = "none";
    }
};

// Inicializar
carregarDados();