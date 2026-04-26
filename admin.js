// ============================================
// admin.js - Versão Corrigida
// ============================================

let funcionarios = [];
let escalaData = {};
let semanaAtual = [];

const firebaseConfig = {
  apiKey: "AIzaSyApDJcJ-bsiPJJLITXdlRtf82gzlSYtZRY",
  authDomain: "app-escala-funcionarios.firebaseapp.com",
  projectId: "app-escala-funcionarios",
  storageBucket: "app-escala-funcionarios.firebasestorage.app",
  messagingSenderId: "1066676645204",
  appId: "1:1066676645204:web:3ce459ed8b8b76a7f92cc1"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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

// ========== FUNÇÕES PRINCIPAIS ==========


async function carregarDados() {
    try {
        console.log("🔄 Carregando dados...");
        
        // Tenta carregar do Firebase primeiro
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            const snapshot = await db.collection('funcionarios').orderBy('id').get();
            funcionarios = [];
            snapshot.forEach(doc => {
                funcionarios.push({ id: parseInt(doc.id), ...doc.data() });
            });
            console.log(`✅ ${funcionarios.length} funcionários carregados do Firebase`);
        }
        
        // Se não tem funcionários, NÃO CRIA AUTOMATICAMENTE
        // Mantém vazio para o admin cadastrar manualmente
        
        carregarEscala();
        renderizarLista();
    } catch (error) {
        console.error("❌ Erro ao carregar:", error);
        funcionarios = [];
        carregarEscala();
        renderizarLista();
    }
}

async function salvarFuncionario(funcionario) {
    try {
        if (funcionario.id) {
            // Atualizar funcionário existente
            await db.collection('funcionarios').doc(funcionario.id.toString()).update(funcionario);
            console.log("✏️ Funcionário atualizado:", funcionario.nome);
        } else {
            // Criar novo funcionário
            const novoId = Date.now();
            funcionario.id = novoId;
            await db.collection('funcionarios').doc(novoId.toString()).set(funcionario);
            console.log("➕ Novo funcionário criado:", funcionario.nome);
        }
        await carregarDados(); // Recarregar a lista
        return true;
    } catch (error) {
        console.error("❌ Erro ao salvar funcionário:", error);
        alert("Erro ao salvar no banco de dados. Verifique sua conexão.");
        return false;
    }
}

async function excluirFuncionarioFirebase(id) {
    if (confirm("Tem certeza que deseja excluir este funcionário?")) {
        try {
            await db.collection('funcionarios').doc(id.toString()).delete();
            console.log("🗑️ Funcionário excluído:", id);
            await carregarDados(); // Recarregar a lista
            return true;
        } catch (error) {
            console.error("❌ Erro ao excluir funcionário:", error);
            alert("Erro ao excluir do banco de dados.");
            return false;
        }
    }
}

// Função de fallback (caso Firebase falhe)
function salvarDadosLocal() {
    localStorage.setItem("escala_funcionarios", JSON.stringify({ funcionarios, pagamentos: {} }));
}

function carregarEscala() {
    const escalaSalva = localStorage.getItem("escala_funcionarios_escala");
    if (escalaSalva) {
        escalaData = JSON.parse(escalaSalva);
    } else {
        escalaData = {};
    }
}

function salvarEscalaGeral() {
    // Salvar apenas escala, não funcionários
    localStorage.setItem("escala_funcionarios_escala", JSON.stringify(escalaData));
    alert("✅ Escala salva com sucesso!");
}

// ========== FUNCIONÁRIOS ==========

function renderizarLista() {
    const tbody = document.getElementById("listaFuncionarios");
    if (!tbody) return;
    
    tbody.innerHTML = funcionarios.map(func => `
        <tr>
            <td>${func.id}</td>
            <td>${func.nome}</td>
            <td>****</td>
            <td>R$ ${func.diaria.toFixed(2)}</td>
            <td class="${func.status ? 'status-active' : 'status-inactive'}">${func.status ? 'Ativo' : 'Inativo'}</td>
            <td>
                <button class="btn-edit" onclick="editarFuncionario(${func.id})">✏️</button>
                <button class="btn-delete" onclick="excluirFuncionario(${func.id})">🗑️</button>
            </td>
        </table>
    `).join('');
}

function abrirModalFuncionario() {
    document.getElementById("modalTitle").innerText = "Novo Funcionário";
    document.getElementById("formFuncionario").reset();
    document.getElementById("funcionarioId").value = "";
    document.getElementById("status").checked = true;
    document.getElementById("modalFuncionario").style.display = "flex";
}

function editarFuncionario(id) {
    const func = funcionarios.find(f => f.id === id);
    if (func) {
        document.getElementById("modalTitle").innerText = "Editar Funcionário";
        document.getElementById("funcionarioId").value = func.id;
        document.getElementById("nome").value = func.nome;
        document.getElementById("senha").value = func.senha;
        document.getElementById("diaria").value = func.diaria;
        document.getElementById("status").checked = func.status;
        document.getElementById("modalFuncionario").style.display = "flex";
    }
}

async function excluirFuncionario(id) {
    if (confirm("Tem certeza?")) {
        // Usar Firebase ou localStorage?
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            await excluirFuncionarioFirebase(id);
        } else {
            // Fallback para localStorage
            funcionarios = funcionarios.filter(f => f.id !== id);
            salvarDadosLocal();
            renderizarLista();
            if (document.getElementById("tab-escala").style.display !== "none") {
                carregarSemana();
            }
        }
    }
}

function fecharModal() {
    document.getElementById("modalFuncionario").style.display = "none";
}

// ========== ESCALA EM TABELA (CORRIGIDA) ==========

function carregarSemana() {
    let dataInicio = document.getElementById("dataInicio").value;
    
    if (!dataInicio) {
        // Padrão: data atual
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        dataInicio = `${ano}-${mes}-${dia}`;
        document.getElementById("dataInicio").value = dataInicio;
    }
    
    // Gerar os 7 dias a partir da data selecionada (sem problema de fuso)
    const dias = [];
    const [ano, mes, dia] = dataInicio.split('-').map(Number);
    
    for (let i = 0; i < 7; i++) {
        // Criar data no fuso local para evitar o problema do dia anterior
        const diaAtual = new Date(ano, mes - 1, dia + i);
        const anoAtual = diaAtual.getFullYear();
        const mesAtual = String(diaAtual.getMonth() + 1).padStart(2, '0');
        const diaNumAtual = String(diaAtual.getDate()).padStart(2, '0');
        const dataStr = `${anoAtual}-${mesAtual}-${diaNumAtual}`;
        
        const nomeDia = diaAtual.toLocaleDateString('pt-BR', { weekday: 'short' });
        const diaNum = diaAtual.getDate();
        const mesNum = diaAtual.getMonth() + 1;
        
        dias.push({ 
            data: dataStr, 
            nome: nomeDia, 
            diaNum: diaNum,
            mesNum: mesNum
        });
    }
    
    semanaAtual = dias;
    renderizarTabelaEscala();
}

function renderizarTabelaEscala() {
    const thead = document.getElementById("escalaHeader");
    const tbody = document.getElementById("escalaBody");
    const container = document.querySelector(".escala-table-container");
    
    if (!thead || !tbody) return;
    
    const funcionariosAtivos = funcionarios.filter(f => f.status === true);
    
    // Cabeçalho - fixar largura da primeira coluna
    thead.innerHTML = `
        <tr>
            <th style="min-width: 130px; position: sticky; left: 0; background: #0f172a; z-index: 1;">Funcionário</th>
            ${semanaAtual.map(dia => `<th style="min-width: 140px; text-align: center;">${dia.nome}<br>${dia.diaNum}/${String(dia.mesNum).padStart(2,'0')}</th>`).join('')}
        </tr>
    `;
    
    // Corpo
    tbody.innerHTML = funcionariosAtivos.map(func => {
        return `
            <tr>
                <td class="funcionario-nome" style="min-width: 130px; position: sticky; left: 0; background: white; z-index: 1; font-weight: 600;">
                    ${func.nome}<br>
                    <span style="font-size: 11px; color: #64748b;">R$ ${func.diaria.toFixed(2)}/dia</span>
                </td>
                ${semanaAtual.map(dia => {
                    const escala = escalaData[dia.data] && escalaData[dia.data][func.id];
                    const status = escala ? escala.status : '';
                    const horario = escala && escala.horario ? escala.horario : '';
                    
                    return `
                        <td style="min-width: 140px; padding: 8px; vertical-align: top;">
                            <select class="status-select" data-data="${dia.data}" data-func="${func.id}" onchange="atualizarStatus(this)" 
                                    style="width: 100%; padding: 8px; margin-bottom: 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
                                <option value="">-- Selecionar --</option>
                                <option value="trabalha" ${status === 'trabalha' ? 'selected' : ''}>✅ Trabalha</option>
                                <option value="folga" ${status === 'folga' ? 'selected' : ''}>❌ Folga</option>
                                <option value="excluir">🗑️ Excluir</option>
                            </select>
                            <input type="text" class="horario-input" placeholder="Ex: 08h-17h" value="${horario}" 
                                   data-data="${dia.data}" data-func="${func.id}" onchange="atualizarHorario(this)"
                                   style="width: 100%; padding: 8px; font-size: 12px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;"
                                   ${status !== 'trabalha' ? 'disabled' : ''}>
                        </td>
                    `;
                }).join('')}
            </tr>
        `;
    }).join('');
    
    // Habilitar/desabilitar campos de horário baseado no status
    document.querySelectorAll('.status-select').forEach(select => {
        const td = select.closest('td');
        if (td) {
            const horarioInput = td.querySelector('.horario-input');
            if (horarioInput) {
                horarioInput.disabled = select.value !== 'trabalha';
            }
        }
    });
}

function atualizarStatus(select) {
    const data = select.getAttribute('data-data');
    const funcId = parseInt(select.getAttribute('data-func'));
    const status = select.value;
    
    const td = select.closest('td');
    const horarioInput = td ? td.querySelector('.horario-input') : null;
    
    if (status === 'trabalha') {
        if (horarioInput) {
            horarioInput.disabled = false;
        }
        if (!escalaData[data]) escalaData[data] = {};
        if (!escalaData[data][funcId]) escalaData[data][funcId] = {};
        escalaData[data][funcId].status = 'trabalha';
        escalaData[data][funcId].horario = horarioInput ? horarioInput.value : '';
        
        console.log(`✅ Trabalha: Funcionário ${funcId} no dia ${data} - Horário: ${horarioInput ? horarioInput.value : ''}`);
    } 
    else if (status === 'folga') {
        if (horarioInput) {
            horarioInput.disabled = true;
            horarioInput.value = '';
        }
        if (!escalaData[data]) escalaData[data] = {};
        if (!escalaData[data][funcId]) escalaData[data][funcId] = {};
        escalaData[data][funcId].status = 'folga';
        escalaData[data][funcId].horario = '';
        
        console.log(`❌ Folga: Funcionário ${funcId} no dia ${data}`);
    }
    else if (status === 'excluir') {
        // Excluir completamente a escala deste funcionário neste dia
        if (horarioInput) {
            horarioInput.disabled = true;
            horarioInput.value = '';
        }
        if (escalaData[data] && escalaData[data][funcId]) {
            delete escalaData[data][funcId];
            // Se não houver mais nenhum funcionário neste dia, remove o dia
            if (Object.keys(escalaData[data]).length === 0) {
                delete escalaData[data];
            }
        }
        // Resetar o select para opção vazia
        select.value = '';
        
        console.log(`🗑️ Excluído: Escala do funcionário ${funcId} removida no dia ${data}`);
    }
    else {
        // Opção vazia "Selecionar"
        if (horarioInput) {
            horarioInput.disabled = true;
            horarioInput.value = '';
        }
        if (escalaData[data] && escalaData[data][funcId]) {
            delete escalaData[data][funcId];
            if (Object.keys(escalaData[data]).length === 0) {
                delete escalaData[data];
            }
        }
        
        console.log(`⚪ Limpo: Escala do funcionário ${funcId} removida no dia ${data}`);
    }
    
    // Salvar automaticamente
    salvarEscalaGeral();
}

function limparTodosDados() {
    if (confirm("⚠️ ATENÇÃO! Isso vai apagar TODOS os funcionários e escalas. Tem certeza?")) {
        localStorage.removeItem("escala_funcionarios");
        localStorage.removeItem("escala_funcionarios_escala");
        location.reload();
    }
}

function atualizarHorario(input) {
    const data = input.getAttribute('data-data');
    const funcId = parseInt(input.getAttribute('data-func'));
    const horario = input.value;
    
    if (escalaData[data] && escalaData[data][funcId] && escalaData[data][funcId].status === 'trabalha') {
        escalaData[data][funcId].horario = horario;
        salvarEscalaGeral();
    }
}

function salvarEscalaSemana() {
    salvarEscalaGeral();
    carregarSemana();
}

// ========== PAGAMENTOS ==========

function atualizarResumoPagamentos() {
    const container = document.getElementById("resumoPagamentos");
    if (!container) return;
    
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    const diasNoMes = new Date(ano, mes, 0).getDate();
    
    console.log("📊 Calculando pagamentos para:", `${ano}-${String(mes).padStart(2,'0')}`);
    console.log("Escala data:", escalaData);
    
    const resumo = funcionarios.filter(f => f.status === true).map(func => {
        let diasTrabalhados = 0;
        let diasDetalhes = [];
        
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
            const escala = escalaData[dataStr] && escalaData[dataStr][func.id];
            
            // Só conta se existir e o status for EXATAMENTE "trabalha"
            if (escala && escala.status === 'trabalha') {
                diasTrabalhados++;
                diasDetalhes.push(dia);
            }
        }
        
        console.log(`${func.nome}: ${diasTrabalhados} dias trabalhados - Dias: ${diasDetalhes.join(', ')}`);
        
        return { 
            ...func, 
            diasTrabalhados, 
            total: diasTrabalhados * func.diaria 
        };
    });
    
    const totalGeral = resumo.reduce((sum, f) => sum + f.total, 0);
    
    container.innerHTML = `
        <div style="background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
            <strong>📊 ${String(mes).padStart(2,'0')}/${ano}</strong><br>
            <strong>💰 Total a pagar:</strong> R$ ${totalGeral.toFixed(2)}
        </div>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 10px; text-align: left;">Funcionário</th>
                        <th style="padding: 10px; text-align: center;">Dias Trabalhados</th>
                        <th style="padding: 10px; text-align: center;">Diária</th>
                        <th style="padding: 10px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${resumo.map(f => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 10px;"><strong>${f.nome}</strong>${f.diasTrabalhados === 0 ? '<br><small style="color:#ef4444;">Nenhum dia escalado</small>' : ''}</td>
                            <td style="padding: 10px; text-align: center; ${f.diasTrabalhados === 0 ? 'color:#ef4444;' : 'font-weight:600;'}">${f.diasTrabalhados}</td>
                            <td style="padding: 10px; text-align: center;">R$ ${f.diaria.toFixed(2)}</td>
                            <td style="padding: 10px; text-align: right; ${f.diasTrabalhados === 0 ? 'color:#ef4444;' : 'font-weight:600;'}">R$ ${f.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #f1f5f9; font-weight: bold;">
                        <td colspan="3" style="padding: 10px; text-align: right;">TOTAL GERAL:</td>
                        <td style="padding: 10px; text-align: right;">R$ ${totalGeral.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// ========== SISTEMA DE PAGAMENTOS ==========

let pagamentosData = {};
let mesSelecionado = null;

// Carregar pagamentos do localStorage
function carregarPagamentosStorage() {
    const pagamentosSalvos = localStorage.getItem("escala_funcionarios_pagamentos");
    if (pagamentosSalvos) {
        pagamentosData = JSON.parse(pagamentosSalvos);
    } else {
        pagamentosData = {};
    }
}

// Salvar pagamentos
function salvarPagamentosStorage() {
    localStorage.setItem("escala_funcionarios_pagamentos", JSON.stringify(pagamentosData));
}

// Carregar tela de pagamentos
function carregarPagamentos() {
    const mesInput = document.getElementById("mesPagamento");
    if (!mesInput.value) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        mesInput.value = `${ano}-${mes}`;
    }
    
    mesSelecionado = mesInput.value;
    const [ano, mes] = mesSelecionado.split('-');
    const diasNoMes = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    
    carregarPagamentosStorage();
    
    const funcionariosAtivos = funcionarios.filter(f => f.status === true);
    const container = document.getElementById("pagamentosContainer");
    
    // Gerar cabeçalho dos dias
    let diasHTML = '';
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
        const diaSemana = new Date(parseInt(ano), parseInt(mes)-1, dia).toLocaleDateString('pt-BR', { weekday: 'short' });
        diasHTML += `<th>${diaSemana}<br>${dia}</th>`;
    }
    
    // Gerar linhas dos funcionários
    let funcionariosHTML = '';
    let totaisPorFuncionario = [];
    
    funcionariosAtivos.forEach(func => {
        let diasPagos = 0;
        let diasTrabalhados = 0;
        let funcionarioDiasHTML = '';
        
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataStr = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
            
            // Verificar se o funcionário trabalhou neste dia
            const escala = escalaData[dataStr] && escalaData[dataStr][func.id];
            const trabalhou = escala && escala.status === 'trabalha';
            
            if (trabalhou) {
                diasTrabalhados++;
            }
            
            // Verificar se o dia foi pago
            const pago = pagamentosData[dataStr] && pagamentosData[dataStr][func.id] === true;
            if (pago) diasPagos++;
            
            const statusPagamento = pago ? 'Pago' : 'Pendente';
            const bgClass = pago ? 'dia-pago' : 'dia-nao-pago';
            
            funcionarioDiasHTML += `
                <td class="${bgClass}">
                    ${trabalhou ? `
                        ${pago ? 
                            `<div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                                <span style="background: #16a34a; color: white; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: bold;">
                                    ✅ PAGO
                                </span>
                                <button onclick="desfazerPagamento('${dataStr}', ${func.id})" 
                                    style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 10px; font-weight: bold;">
                                    ↺ DESFAZER
                                </button>
                            </div>` : 
                            `<button onclick="marcarDiaPago('${dataStr}', ${func.id})" 
                                style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: bold; width: 100%;">
                                💰 PAGAR
                            </button>`
                        }
                    ` : '-'}
                </td>
            `;
        }
        
        const totalReceber = diasTrabalhados * func.diaria;
        const totalPago = diasPagos * func.diaria;
        const totalPendente = totalReceber - totalPago;
        
        totaisPorFuncionario.push({
            nome: func.nome,
            diasTrabalhados,
            diasPagos,
            totalReceber,
            totalPago,
            totalPendente,
            id: func.id
        });
        
        funcionariosHTML += `
            <tr>
                <td class="funcionario-col">
                    <strong>${func.nome}</strong><br>
                    <small style="font-size: 11px;">R$ ${func.diaria.toFixed(2)}/dia</small>
                </td>
                ${funcionarioDiasHTML}
            </tr>
        `;
    });
    
    // Calcular totais gerais
    const totalGeralReceber = totaisPorFuncionario.reduce((sum, f) => sum + f.totalReceber, 0);
    const totalGeralPago = totaisPorFuncionario.reduce((sum, f) => sum + f.totalPago, 0);
    const totalGeralPendente = totalGeralReceber - totalGeralPago;
    
    // Montar HTML completo
    container.innerHTML = `
        <div class="resumo-pagamento">
            <h4>📊 Resumo do Mês ${mes}/${ano}</h4>
            ${totaisPorFuncionario.map(f => `
                <div class="resumo-item">
                    <span><strong>${f.nome}</strong> (${f.diasPagos}/${f.diasTrabalhados} dias)</span>
                    <span>R$ ${f.totalPago.toFixed(2)} de R$ ${f.totalReceber.toFixed(2)}</span>
                </div>
            `).join('')}
            <div class="resumo-total">
                <span>💰 TOTAL GERAL:</span>
                <span>R$ ${totalGeralPago.toFixed(2)} de R$ ${totalGeralReceber.toFixed(2)}</span>
            </div>
            <div class="resumo-total" style="color: ${totalGeralPendente > 0 ? '#dc2626' : '#16a34a'}">
                <span>📌 PENDENTE:</span>
                <span>R$ ${totalGeralPendente.toFixed(2)}</span>
            </div>
        </div>
        
        <div style="overflow-x: auto;">
            <table class="pagamentos-table">
                <thead>
                    <tr>
                        <th style="min-width: 120px;">Funcionário</th>
                        ${diasHTML}
                    </tr>
                </thead>
                <tbody>
                    ${funcionariosHTML}
                </tbody>
            </table>
        </div>
    `;
}

// Marcar um dia específico como pago
function marcarDiaPago(dataStr, funcId) {
    if (!pagamentosData[dataStr]) {
        pagamentosData[dataStr] = {};
    }
    pagamentosData[dataStr][funcId] = true;
    salvarPagamentosStorage();
    carregarPagamentos(); // Recarregar a tela
    console.log(`✅ Pagamento registrado: Funcionário ${funcId} no dia ${dataStr}`);
}

// Marcar todos os dias do mês como pagos para todos os funcionários
function marcarTodosPagos() {
    if (!mesSelecionado) {
        const mesInput = document.getElementById("mesPagamento");
        if (!mesInput.value) {
            alert("Selecione um mês primeiro!");
            return;
        }
        mesSelecionado = mesInput.value;
    }
    
    if (confirm("⚠️ Isso vai marcar TODOS os dias trabalhados deste mês como PAGOS. Continuar?")) {
        const [ano, mes] = mesSelecionado.split('-');
        const diasNoMes = new Date(parseInt(ano), parseInt(mes), 0).getDate();
        
        const funcionariosAtivos = funcionarios.filter(f => f.status === true);
        
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataStr = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
            
            funcionariosAtivos.forEach(func => {
                // Verificar se o funcionário trabalhou neste dia
                const escala = escalaData[dataStr] && escalaData[dataStr][func.id];
                if (escala && escala.status === 'trabalha') {
                    if (!pagamentosData[dataStr]) pagamentosData[dataStr] = {};
                    pagamentosData[dataStr][func.id] = true;
                }
            });
        }
        
        salvarPagamentosStorage();
        carregarPagamentos();
        console.log("✅ Todos os dias foram marcados como pagos!");
    }
}

// Desfazer pagamento (estornar)
function desfazerPagamento(dataStr, funcId) {
    if (confirm(`⚠️ Tem certeza que deseja DESFAZER o pagamento deste dia?`)) {
        if (pagamentosData[dataStr] && pagamentosData[dataStr][funcId]) {
            delete pagamentosData[dataStr][funcId];
            
            // Se não houver mais pagamentos neste dia, remove o dia
            if (Object.keys(pagamentosData[dataStr]).length === 0) {
                delete pagamentosData[dataStr];
            }
            
            salvarPagamentosStorage();
            carregarPagamentos(); // Recarregar a tela
            console.log(`↺ Pagamento estornado: Funcionário ${funcId} no dia ${dataStr}`);
        }
    }
}

// Desfazer todos os pagamentos do mês
function desfazerTodosPagamentos() {
    if (!mesSelecionado) {
        const mesInput = document.getElementById("mesPagamento");
        if (!mesInput.value) {
            alert("Selecione um mês primeiro!");
            return;
        }
        mesSelecionado = mesInput.value;
    }
    
    if (confirm("⚠️ ATENÇÃO! Isso vai DESFAZER TODOS os pagamentos deste mês. Continuar?")) {
        const [ano, mes] = mesSelecionado.split('-');
        const diasNoMes = new Date(parseInt(ano), parseInt(mes), 0).getDate();
        
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataStr = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
            if (pagamentosData[dataStr]) {
                delete pagamentosData[dataStr];
            }
        }
        
        salvarPagamentosStorage();
        carregarPagamentos();
        console.log("↺ Todos os pagamentos do mês foram desfeitos!");
    }
}

// ========== NAVEGAÇÃO ==========

function mudarTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.getElementById(`tab-${tabId}`).style.display = 'block';
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    if (tabId === 'escala') {
        carregarSemana();
    }
    if (tabId === 'pagamentos') {
        carregarPagamentos();
    }
}

function logout() {
    localStorage.removeItem("funcionarioLogado");
    window.location.href = "index.html";
}

// ========== FORMULÁRIO ==========

document.getElementById("formFuncionario").onsubmit = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById("funcionarioId").value;
    const nome = document.getElementById("nome").value;
    const senha = document.getElementById("senha").value;
    const diaria = parseFloat(document.getElementById("diaria").value);
    const status = document.getElementById("status").checked;
    
    if (!senha.match(/^\d+$/) || senha.length < 4 || senha.length > 6) {
        alert("Senha deve conter apenas números e ter 4 a 6 dígitos!");
        return;
    }
    
    const funcionario = { id: id ? parseInt(id) : null, nome, senha, diaria, status };
    
    // Usar Firebase ou localStorage?
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        await salvarFuncionario(funcionario);
    } else {
        // Fallback para localStorage
        if (id) {
            const index = funcionarios.findIndex(f => f.id == id);
            if (index !== -1) {
                funcionarios[index] = funcionario;
            }
        } else {
            const novoId = funcionarios.length > 0 ? Math.max(...funcionarios.map(f => f.id)) + 1 : 1;
            funcionario.id = novoId;
            funcionarios.push(funcionario);
        }
        salvarDadosLocal();
        renderizarLista();
    }
    
    fecharModal();
    
    if (document.getElementById("tab-escala").style.display !== "none") {
        carregarSemana();
    }
};

/// ========== INICIALIZAÇÃO ==========

// Forçar limpeza do localStorage na inicialização
localStorage.removeItem("escala_funcionarios");
localStorage.removeItem("escala_funcionarios_pagamentos");

console.log("🗑️ localStorage limpo na inicialização");

// Função de inicialização principal
async function inicializarSistema() {
    console.log("🚀 Inicializando sistema...");
    
    await carregarDados();
    
    // Carregar dados de pagamento
    carregarPagamentosStorage();
    
    // Se a aba de pagamentos estiver ativa ao carregar, mostrar os dados
    const abaPagamentos = document.getElementById("tab-pagamentos");
    if (abaPagamentos && abaPagamentos.style.display !== "none") {
        carregarPagamentos();
    }
    
    console.log("✅ Sistema inicializado com sucesso!");
}

// Inicializar o sistema
inicializarSistema();