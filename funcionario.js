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

function normalizarPagamento(registro, dataStr, funcId) {
    if (!registro) {
        const escala = escalaData[dataStr]?.[funcId];
        const numHorarios = (escala && escala.horarios)
            ? escala.horarios.length
            : 1;

        return {
            pagos: new Array(numHorarios).fill(false),
            adicional: 0,
            desconto: 0,
            descricao: ""
        };
    }

    // 🔥 Se for formato antigo (array direto)
    if (Array.isArray(registro)) {
        return {
            pagos: registro,
            adicional: 0,
            desconto: 0,
            descricao: ""
        };
    }

    // 🔥 Garantir estrutura correta
    if (!Array.isArray(registro.pagos)) {
        const escala = escalaData[dataStr]?.[funcId];
        const numHorarios = (escala && escala.horarios)
            ? escala.horarios.length
            : 1;

        registro.pagos = new Array(numHorarios).fill(false);
    }

    return {
        pagos: registro.pagos,
        adicional: Number(registro.adicional || 0),
        desconto: Number(registro.desconto || 0),
        descricao: registro.descricao || ""
    };
}

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
            const funcId = String(item.funcionario_id);

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
        console.error("🚨 ERRO DETALHADO:", error);
        alert(error.message);
        }
}

// ========== FUNÇÃO PARA CARREGAR PAGAMENTOS ==========
async function carregarPagamentosFirebase() {
    try {
        if (!db) return;

        console.log("🔄 Carregando pagamentos do Firebase...");
        
        // 🔥 CORRIGIDO: mesma estrutura do admin.js
        const snapshot = await db.collection('pagamentos').get();
        pagamentosData = {};

        snapshot.forEach(doc => {
            const item = doc.data();
            const data = item.data;
            const funcId = item.funcionario_id;

            if (!pagamentosData[data]) pagamentosData[data] = {};
            
            pagamentosData[data][funcId] = {
                pagos: item.pagos || [],
                adicional: item.adicional || 0,
                desconto: item.desconto || 0,
                descricao: item.descricao || ""
            };
        });

        console.log(`✅ ${snapshot.docs.length} registros de pagamentos carregados`);
        
    } catch (error) {
        console.error("Erro ao carregar pagamentos:", error);
        pagamentosData = {};
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
        console.error("🚨 ERRO DETALHADO:", error);
        alert(error.message);
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
                    <div class="info-valor">💰 R$ ${(resumo.valorPago || 0).toFixed(2)}</div>
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
    let valorPago = 0;
    
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const escala = escalaData[dataStr] && escalaData[dataStr][funcionarioAtual.id];
        
        if (escala && escala.status === 'trabalha') {
            diasTrabalhados++;
            
            const pagamento = pagamentosData[dataStr]?.[funcionarioAtual.id] || {};
            const pagos = pagamento.pagos || [];
            const adicional = Number(pagamento.adicional || 0);
            const desconto = Number(pagamento.desconto || 0);
            
            const numHorarios = escala.horarios ? escala.horarios.length : 1;
            
            // 🔥 CORREÇÃO: Só é pago se TODOS os horários estiverem com true
            const foiPago = pagos.length === numHorarios && pagos.every(p => p === true);
            
            if (foiPago) {
                diasPagos++;
                
                const horarios = escala.horarios || [];
                let valorBase = 0;
                if (horarios.length > 0) {
                    horarios.forEach(horario => {
                        if (horario === '07:00 às 15:20' || horario === '15:00 às 23:30') {
                            valorBase += funcionarioAtual.diaria;
                        } else if (horario === '07:00 às 23:30') {
                            valorBase += funcionarioAtual.diaria * 2;
                        } else if (horario && horario !== '') {
                            valorBase += funcionarioAtual.diaria;
                        }
                    });
                } else {
                    valorBase = funcionarioAtual.diaria;
                }
                
                let valorDia = valorBase + adicional - desconto;
                valorDia = Math.max(0, valorDia);
                valorPago += valorDia;
            }
        } else if (escala && escala.status === 'folga') {
            diasFolga++;
        }
    }
    
    console.log(`📊 ${funcionarioAtual.nome}: ${diasPagos} dias pagos, valor total: R$ ${valorPago.toFixed(2)}`);
    
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
        let valorTexto = '';
        
        const escala = escalaData[dataStr] && escalaData[dataStr][funcionarioAtual.id];
        
        // 🔥 BUSCAR PAGAMENTO DIRETAMENTE
        const pagamento = pagamentosData[dataStr]?.[funcionarioAtual.id] || {};
        const pagamentosArr = pagamento.pagos || [];
        const adicional = Number(pagamento.adicional || 0);
        const desconto = Number(pagamento.desconto || 0);
        
        const numHorarios = (escala && escala.horarios) ? escala.horarios.length : 1;
        
        // 🔥 CORREÇÃO: Só é pago se TODOS os horários tiverem valor TRUE
        // E o array NÃO pode estar vazio
        const foiPago = pagamentosArr.length === numHorarios && pagamentosArr.every(p => p === true);
        
        // 🔥 CALCULAR VALOR DO DIA (se trabalhou)
        let valorDia = 0;
        if (escala && escala.status === 'trabalha') {
            const horarios = escala.horarios || [];
            let valorBase = 0;
            if (horarios.length > 0) {
                horarios.forEach(h => {
                    if (h === '07:00 às 15:20' || h === '15:00 às 23:30') {
                        valorBase += funcionarioAtual.diaria;
                    } else if (h === '07:00 às 23:30') {
                        valorBase += funcionarioAtual.diaria * 2;
                    } else if (h && h !== '') {
                        valorBase += funcionarioAtual.diaria;
                    }
                });
            } else {
                valorBase = funcionarioAtual.diaria;
            }
            valorDia = valorBase + adicional - desconto;
            valorDia = Math.max(0, valorDia);
        }
        
        // Definir classes e ícones
        if (escala) {
            if (escala.status === 'trabalha') {
                statusClass = 'dia-trabalha';
                statusIcon = '✅';
                const horarios = escala.horarios || [];
                horario = horarios.length > 0 ? horarios[0] : '';
                
                // 🔥 SÓ MOSTRAR 💰 SE O DIA FOI REALMENTE PAGO
                if (foiPago) {
                    pagoIcon = '💰';
                    statusClass += ' dia-pago';
                    valorTexto = `<div class="dia-indicador" style="font-size:0.6rem; color:#16a34a;">R$ ${valorDia.toFixed(2)}</div>`;
                } else {
                    // Dia trabalhado mas NÃO PAGO - sem ícone de dinheiro
                    statusClass += ' dia-nao-pago';
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
                ${horario ? `<div class="dia-indicador" style="font-size:0.6rem;">${horario.substring(0, 8)}</div>` : ''}
                ${valorTexto}
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
    
    // 🔥 BUSCAR DADOS DE PAGAMENTO
    const pagamento = pagamentosData[dataStr]?.[funcionarioAtual.id] || {};
    const pagos = pagamento.pagos || [];
    const adicional = Number(pagamento.adicional || 0);
    const desconto = Number(pagamento.desconto || 0);
    
    const numHorarios = escala?.horarios?.length || 1;
    const foiPago = pagos.length === numHorarios && pagos.every(p => p === true);
    
    let statusText = '';
    let statusIcon = '';
    let horario = '';
    let pagamentoText = '';
    let pagamentoIcon = '';
    let valorInfo = '';
    
    if (escala && escala.status === 'trabalha') {
        statusText = 'Dia de Trabalho';
        statusIcon = '✅';
        
        // 🔥 CORREÇÃO: Exibir o horário definido pelo admin
        const horarios = escala.horarios || [];
        if (horarios.length > 0) {
            // Exibir todos os horários formatados
            horario = horarios.map(h => {
                if (h === '07:00 às 15:20') return '🌅 07:00 às 15:20';
                if (h === '15:00 às 23:30') return '🌙 15:00 às 23:30';
                if (h === '07:00 às 23:30') return '🔄 07:00 às 23:30';
                return h;
            }).join('<br>');
        } else {
            horario = 'Horário não definido pelo administrador';
        }
        
        // 🔥 CALCULAR VALOR DO DIA COM ADICIONAL/DESCONTO
        let valorBase = 0;
        if (horarios.length > 0) {
            horarios.forEach(h => {
                if (h === '07:00 às 15:20' || h === '15:00 às 23:30') {
                    valorBase += funcionarioAtual.diaria;
                } else if (h === '07:00 às 23:30') {
                    valorBase += funcionarioAtual.diaria * 2;
                } else if (h && h !== '') {
                    valorBase += funcionarioAtual.diaria;
                }
            });
        } else {
            valorBase = funcionarioAtual.diaria;
        }
        
        let valorDia = valorBase + adicional - desconto;
        valorDia = Math.max(0, valorDia);
        
        if (foiPago) {
            pagamentoText = 'Pagamento Confirmado';
            pagamentoIcon = '💰';
            valorInfo = `<div style="margin-top:10px;font-weight:bold;">💰 R$ ${valorDia.toFixed(2)}</div>`;
        } else {
            pagamentoText = 'Aguardando Pagamento';
            pagamentoIcon = '⏳';
            valorInfo = `<div style="margin-top:10px;font-size:11px;color:#64748b;">💰 Valor a receber: R$ ${valorDia.toFixed(2)}</div>`;
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
    modal.querySelector('.modal-horario').innerHTML = `<span style="white-space: pre-line;">⏰ ${horario}</span>`;
    
    const pagamentoDiv = modal.querySelector('.modal-pagamento');
    pagamentoDiv.innerHTML = `${pagamentoIcon} ${pagamentoText} ${valorInfo}`;
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