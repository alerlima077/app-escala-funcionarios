// ============================================
// funcionario.js - Tela do Funcionário (Celular)
// ============================================

let funcionarioAtual = null;
let escalaData = {};
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let diasDoMes = [];

async function carregarEscalaFirebase() {
    try {
        if (typeof db !== 'undefined' && db) {
            const snapshot = await db.collection('escala').get();
            escalaData = {};
            
            snapshot.forEach(doc => {
                const item = doc.data();
                const data = item.data;
                const funcId = item.funcionario_id;
                
                if (!escalaData[data]) escalaData[data] = {};
                escalaData[data][funcId] = {
                    status: item.status,
                    horario: item.horario || ''
                };
            });
            console.log(`✅ ${snapshot.docs.length} registros de escala carregados`);
        }
    } catch (error) {
        console.error("Erro ao carregar escala:", error);
    }
}

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso:', registration);
            })
            .catch(error => {
                console.log('Falha ao registrar Service Worker:', error);
            });
    });
}

async function carregarDados() {
    const funcionarioStr = localStorage.getItem("funcionarioLogado");
    
    if (!funcionarioStr) {
        window.location.href = "index.html";
        return;
    }
    
    const funcionarioCache = JSON.parse(funcionarioStr);
    
    // Tentar carregar do Firebase primeiro
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        try {
            const doc = await db.collection('funcionarios').doc(funcionarioCache.id.toString()).get();
            if (doc.exists) {
                const funcAtualizado = doc.data();
                if (!funcAtualizado.status) {
                    alert("⚠️ Seu acesso foi desativado. Entre em contato com o administrador.");
                    localStorage.removeItem("funcionarioLogado");
                    window.location.href = "index.html";
                    return;
                }
                funcionarioAtual = { id: parseInt(doc.id), ...funcAtualizado };
                localStorage.setItem("funcionarioLogado", JSON.stringify(funcionarioAtual));
            } else {
                funcionarioAtual = funcionarioCache;
            }
        } catch (error) {
            console.error("Erro ao carregar do Firebase:", error);
            funcionarioAtual = funcionarioCache;
        }
    } else {
        // Fallback para localStorage
        const dadosEmpresa = localStorage.getItem("escala_funcionarios");
        if (dadosEmpresa) {
            const empresa = JSON.parse(dadosEmpresa);
            const funcAtualizado = empresa.funcionarios.find(f => f.id === funcionarioCache.id);
            funcionarioAtual = funcAtualizado || funcionarioCache;
        } else {
            funcionarioAtual = funcionarioCache;
        }
    }
    
    console.log("👤 Funcionário logado:", funcionarioAtual);
    
    // Carregar escala (também do Firebase depois)
    const escalaSalva = localStorage.getItem("escala_funcionarios_escala");
    if (escalaSalva) {
        escalaData = JSON.parse(escalaSalva);
    }
    
    renderizarTela();
}

// Renderizar tela principal
function renderizarTela() {
    const app = document.getElementById("app");
    
    // Calcular resumo do mês atual
    const resumo = calcularResumoMes();
    
    app.innerHTML = `
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
                <div class="info-valor">${resumo.diasFolga}</div>
                <div class="info-label">Dias de Folga</div>
            </div>
            <div class="info-item">
                <div class="info-valor">${resumo.diasRestantes}</div>
                <div class="info-label">Dias Restantes</div>
            </div>
            <div class="info-item">
                <div class="info-valor">R$ ${resumo.valorTotal.toFixed(2)}</div>
                <div class="info-label">A Receber no Mês</div>
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
    `;
    
    atualizarTituloMes();
    renderizarCalendario();
}

// Calcular resumo do mês
function calcularResumoMes() {
    const diasNoMes = new Date(currentYear, currentMonth + 1, 0).getDate();
    let diasTrabalhados = 0;
    let diasFolga = 0;
    
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const escala = escalaData[dataStr] && escalaData[dataStr][funcionarioAtual.id];
        
        if (escala && escala.status === 'trabalha') {
            diasTrabalhados++;
        } else if (escala && escala.status === 'folga') {
            diasFolga++;
        }
    }
    
    const diasRestantes = diasNoMes - (diasTrabalhados + diasFolga);
    const valorTotal = diasTrabalhados * funcionarioAtual.diaria;
    
    return {
        diasTrabalhados,
        diasFolga,
        diasRestantes,
        valorTotal
    };
}

// Atualizar título do mês
function atualizarTituloMes() {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const titulo = document.getElementById("mesTitulo");
    if (titulo) {
        titulo.textContent = `${meses[currentMonth]} ${currentYear}`;
    }
}

function renderizarCalendario() {
    const grid = document.getElementById("calendarioGrid");
    if (!grid) return;
    
    // Carregar dados de pagamento
    const pagamentosSalvos = localStorage.getItem("escala_funcionarios_pagamentos");
    let pagamentosData = {};
    if (pagamentosSalvos) {
        pagamentosData = JSON.parse(pagamentosSalvos);
    }
    
    const primeiroDia = new Date(currentYear, currentMonth, 1);
    const primeiroDiaSemana = primeiroDia.getDay();
    const diasNoMes = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let gridHTML = '';
    
    // Dias do mês anterior
    const diasMesAnterior = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
        gridHTML += `<div class="dia dia-vazio"></div>`;
    }
    
    // Dias do mês atual
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const escala = escalaData[dataStr] && escalaData[dataStr][funcionarioAtual.id];
        
        // Verificar se o dia foi pago
        const foiPago = pagamentosData[dataStr] && pagamentosData[dataStr][funcionarioAtual.id] === true;
        
        let statusClass = '';
        let statusIcon = '';
        let horario = '';
        let pagoIcon = '';
        
        if (escala) {
            if (escala.status === 'trabalha') {
                statusClass = 'dia-trabalha';
                statusIcon = '✅';
                horario = escala.horario || '';
                // Adicionar indicador de pagamento
                if (foiPago) {
                    statusClass = 'dia-pago';
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
                ${statusIcon ? `<div class="dia-indicador">${statusIcon}</div>` : ''}
                ${pagoIcon ? `<div class="dia-indicador" style="font-size: 10px;">${pagoIcon}</div>` : ''}
                ${horario ? `<div class="dia-indicador" style="font-size: 0.6rem;">${horario.substring(0, 8)}</div>` : ''}
            </div>
        `;
    }
    
    grid.innerHTML = gridHTML;
}

function verDetalhes(dataStr, diaNum) {
    const escala = escalaData[dataStr] && escalaData[dataStr][funcionarioAtual.id];
    const [ano, mes, dia] = dataStr.split('-');
    const dataFormatada = `${dia}/${mes}/${ano}`;
    
    // Verificar pagamento
    const pagamentosSalvos = localStorage.getItem("escala_funcionarios_pagamentos");
    let pagamentosData = {};
    let foiPago = false;
    if (pagamentosSalvos) {
        pagamentosData = JSON.parse(pagamentosSalvos);
        foiPago = pagamentosData[dataStr] && pagamentosData[dataStr][funcionarioAtual.id] === true;
    }
    
    let statusText = '';
    let statusIcon = '';
    let horario = '';
    let pagamentoText = '';
    let pagamentoIcon = '';
    
    if (escala && escala.status === 'trabalha') {
        statusText = 'Dia de Trabalho';
        statusIcon = '✅';
        horario = escala.horario || 'Horário não definido pelo administrador';
        
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
    
    // Criar modal
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

// Mudar mês
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
    
    // Atualizar resumo
    const resumo = calcularResumoMes();
    const infoLabels = document.querySelectorAll('.info-valor');
    if (infoLabels.length >= 4) {
        infoLabels[0].textContent = resumo.diasTrabalhados;
        infoLabels[1].textContent = resumo.diasFolga;
        infoLabels[2].textContent = resumo.diasRestantes;
        infoLabels[3].textContent = `R$ ${resumo.valorTotal.toFixed(2)}`;
    }
}

// Logout
function logout() {
    localStorage.removeItem("funcionarioLogado");
    window.location.href = "index.html";
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById("modalDetalhes");
    if (event.target === modal) {
        modal.style.display = "none";
    }
};

// Inicializar
carregarDados();