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

// FORÇAR LIMPEZA TOTAL no primeiro carregamento
//if (!sessionStorage.getItem("cleanExecuted")) {
    //console.log("🧹 Executando limpeza forçada...");
    //localStorage.removeItem("escala_funcionarios");
    //sessionStorage.setItem("cleanExecuted", "true");
//}

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
        
        //await carregarEscalaFirebase();
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
    console.log("💾 Salvando escala com horários:", escalaData);
    
    // Salvar no localStorage
    localStorage.setItem("escala_funcionarios_escala", JSON.stringify(escalaData));
    
    // Salvar no Firebase se disponível
    if (typeof db !== 'undefined' && db) {
        salvarEscalaFirebase();
    }
    
    alert("✅ Escala salva com sucesso!");
}

// ========== CALCULAR VALOR POR DIA (MÚLTIPLOS HORÁRIOS) ==========
function calcularValorDia(funcionario, dataStr) {
    const escala = escalaData[dataStr] && escalaData[dataStr][funcionario.id];
    
    if (!escala || escala.status !== 'trabalha') return 0;
    
    const horarios = escala.horarios || [];
    
    // 🔥 Buscar adicional e desconto do pagamento
    const pagamento = pagamentosData[dataStr]?.[funcionario.id] || {};
    const adicional = Number(pagamento.adicional) || 0;
    const desconto = Number(pagamento.desconto) || 0;
    
    let valorBase = 0;
    
    if (horarios.length > 0) {
        horarios.forEach(horario => {
            if (horario === '07:00 às 15:20' || horario === '15:00 às 23:30') {
                valorBase += funcionario.diaria;
            } else if (horario === '07:00 às 23:30') {
                valorBase += funcionario.diaria * 2;
            } else if (horario && horario !== '') {
                valorBase += funcionario.diaria;
            }
        });
    } else {
        valorBase = funcionario.diaria;
    }
    
    // 🔥 APLICAR ADICIONAL E DESCONTO
    let valorFinal = valorBase + adicional - desconto;
    valorFinal = Math.max(0, valorFinal);
    
    return valorFinal;
}

// ========== FUNÇÃO PARA SALVAR ESCALA DA SEMANA ==========
async function salvarEscalaSemana() {
    try {
        await salvarEscalaFirebase();
        localStorage.setItem("escala_funcionarios_escala", JSON.stringify(escalaData));
        alert("✅ Escala salva com sucesso!");
        carregarSemana();
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar");
    }
}
// ========== FUNÇÕES DE ESCALA NO FIREBASE ==========

async function carregarEscalaFirebase() {
    try {
        if (!db) return;
        
        const snapshot = await db.collection('escala').get();
        escalaData = {};
        
        snapshot.forEach(doc => {
            const item = doc.data();
            const data = item.data;
            const funcId = String(item.funcionario_id);
            
            // Converter estrutura antiga (horario) para nova (horarios)
            let horarios = item.horarios || [];
            if (horarios.length === 0 && item.horario) {
                horarios = [item.horario];
            }
            
            if (!escalaData[data]) escalaData[data] = {};
            escalaData[data][funcId] = {
                status: item.status,
                horarios: horarios
            };
        });
        
        console.log(`✅ ${snapshot.docs.length} registros de escala carregados`);
    } catch (error) {
        console.error("Erro ao carregar escala:", error);
    }
}

async function salvarEscalaFirebase() {
    try {
        if (!db) return;
        
        const batch = db.batch();
        
        // 🔥 REMOVER TODOS OS DOCUMENTOS ANTIGOS
        const snapshot = await db.collection('escala').get();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // 🔥 ADICIONAR OS NOVOS DADOS
        for (const [data, funcionarios] of Object.entries(escalaData)) {
            for (const [funcId, dados] of Object.entries(funcionarios)) {
                const docId = `${data}_${funcId}`;
                const docRef = db.collection('escala').doc(docId);
                
                batch.set(docRef, {
                    data: data,
                    funcionario_id: parseInt(funcId),
                    status: dados.status,
                    horarios: dados.horarios || []
                });
            }
        }
        
        await batch.commit();
        console.log("✅ Escala salva no Firebase (substituição completa)");
        
    } catch (error) {
        console.error("Erro ao salvar escala:", error);
    }
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
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        dataInicio = `${ano}-${mes}-${dia}`;
        document.getElementById("dataInicio").value = dataInicio;
    }
    
    const dias = [];
    const [ano, mes, dia] = dataInicio.split('-').map(Number);
    
    for (let i = 0; i < 7; i++) {
        const diaAtual = new Date(ano, mes - 1, dia + i);
        const dataStr = `${diaAtual.getFullYear()}-${String(diaAtual.getMonth() + 1).padStart(2, '0')}-${String(diaAtual.getDate()).padStart(2, '0')}`;
        const nomeDia = diaAtual.toLocaleDateString('pt-BR', { weekday: 'short' });
        
        dias.push({ 
            data: dataStr, 
            nome: nomeDia, 
            diaNum: diaAtual.getDate(),
            mesNum: diaAtual.getMonth() + 1
        });
    }
    
    semanaAtual = dias;
    renderizarTabelaEscala();
}

function renderizarTabelaEscala() {
    const thead = document.getElementById("escalaHeader");
    const tbody = document.getElementById("escalaBody");
    
    if (!thead || !tbody) return;
    
    // 🔥 APLICAR FILTRO POR SETOR
    const filtroSetor = document.getElementById("filtroSetor")?.value || "todos";
    
    let funcionariosAtivos = funcionarios.filter(f => f.status === true);
    
    if (filtroSetor !== "todos") {
        funcionariosAtivos = funcionariosAtivos.filter(f => f.setor === filtroSetor);
    }
    
    // Se não há funcionários no setor selecionado
    if (funcionariosAtivos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${semanaAtual.length + 1}" style="text-align:center; padding:40px;">
            ⚠️ Nenhum funcionário encontrado no setor ${filtroSetor === 'cozinha' ? '🍳 Cozinha' : filtroSetor === 'frente' ? '🍽️ Frente' : '🏰 Casarão'}
        </td></tr>`;
        return;
    }
    
    // Cabeçalho
    thead.innerHTML = `
        <table>
            <th style="min-width: 150px; position: sticky; left: 0; background: #0f172a; z-index: 1;">Funcionário</th>
            ${semanaAtual.map(dia => `<th style="min-width: 160px; text-align: center;">${dia.nome}<br>${dia.diaNum}/${String(dia.mesNum).padStart(2,'0')}</th>`).join('')}
        </tr>
    `;
    
    // Corpo
    tbody.innerHTML = funcionariosAtivos.map(func => {
        return `
            <tr>
                <td class="funcionario-nome" style="min-width: 150px; position: sticky; left: 0; background: white; z-index: 1; font-weight: 600;">
                    ${func.nome}<br>
                    <span style="font-size: 11px; color: #64748b;">R$ ${func.diaria.toFixed(2)}/dia</span>
                 </td>
                ${semanaAtual.map(dia => {
                    const escala = escalaData[dia.data] && escalaData[dia.data][func.id];
                    const status = escala ? escala.status : '';
                    const horarios = escala && escala.horarios ? escala.horarios : [];
                    
                    return `
                        <td style="min-width: 160px; padding: 8px; vertical-align: top;">
                            <select class="status-select" data-data="${dia.data}" data-func="${func.id}" onchange="atualizarStatus(this)" 
                                    style="width: 100%; padding: 6px; margin-bottom: 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px;">
                                <option value="">-- Selecionar --</option>
                                <option value="trabalha" ${status === 'trabalha' ? 'selected' : ''}>✅ Trabalha</option>
                                <option value="folga" ${status === 'folga' ? 'selected' : ''}>❌ Folga</option>
                                <option value="excluir">🗑️ Excluir</option>
                            </select>
                            
                            <div class="horarios-container" data-data="${dia.data}" data-func="${func.id}">
                                ${renderizarHorarios(horarios, dia.data, func.id)}
                            </div>
                            
                            <button type="button" class="btn-add-horario" data-data="${dia.data}" data-func="${func.id}" 
                                    onclick="adicionarHorario('${dia.data}', ${func.id})"
                                    style="width: 100%; margin-top: 5px; padding: 4px; font-size: 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; ${status !== 'trabalha' ? 'display: none;' : ''}">
                                + Adicionar Horário
                            </button>
                         </td>
                    `;
                }).join('')}
             </tr>
        `;
    }).join('');
    
    // Configurar os campos após renderizar
    setTimeout(() => {
        document.querySelectorAll('.status-select').forEach(select => {
            const td = select.closest('td');
            const btnAdd = td ? td.querySelector('.btn-add-horario') : null;
            const isTrabalha = select.value === 'trabalha';
            
            if (btnAdd) {
                btnAdd.style.display = isTrabalha ? 'block' : 'none';
            }
        });
    }, 50);
}

// Função para renderizar os horários
function renderizarHorarios(horarios, data, funcId) {
    if (!horarios || horarios.length === 0) {
        return `<div class="horario-item" style="margin-bottom: 5px;">
                    <select class="horario-select" data-data="${data}" data-func="${funcId}" data-index="0" onchange="atualizarHorarioSelect(this)" 
                            style="width: 100%; padding: 5px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 11px;">
                        <option value="">-- Selecione o horário --</option>
                        <option value="07:00 às 15:20">🌅 07:00 às 15:20</option>
                        <option value="15:00 às 23:30">🌙 15:00 às 23:30</option>
                        <option value="07:00 às 23:30">🔄 07:00 às 23:30</option>
                        <option value="personalizado">✏️ Personalizado...</option>
                    </select>
                    <input type="text" class="horario-personalizado"
                        data-data="${data}"
                        data-func="${funcId}"
                        data-index="0"
                        oninput="atualizarHorarioPersonalizado(this)"
                        placeholder="Ex: 08:00 às 17:00"
                        style="width: 100%; margin-top: 4px; padding: 4px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 10px; display: none;">
                </div>`;
    }
    
    let html = '';
    horarios.forEach((horario, index) => {
        html += `
            <div class="horario-item" style="margin-bottom: 5px; position: relative;">
                <select class="horario-select" data-data="${data}" data-func="${funcId}" data-index="${index}" onchange="atualizarHorarioSelect(this)" 
                        style="width: calc(100% - 25px); padding: 5px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 11px; display: inline-block;">
                    <option value="">-- Selecione o horário --</option>
                    <option value="07:00 às 15:20" ${horario === '07:00 às 15:20' ? 'selected' : ''}>🌅 07:00 às 15:20</option>
                    <option value="15:00 às 23:30" ${horario === '15:00 às 23:30' ? 'selected' : ''}>🌙 15:00 às 23:30</option>
                    <option value="07:00 às 23:30" ${horario === '07:00 às 23:30' ? 'selected' : ''}>🔄 07:00 às 23:30</option>
                    <option value="personalizado" ${!['07:00 às 15:20','15:00 às 23:30','07:00 às 23:30',''].includes(horario) ? 'selected' : ''}>✏️ Personalizado...</option>
                </select>
                <button type="button" class="btn-remove-horario" onclick="removerHorario('${data}', ${funcId}, ${index})"
                        style="width: 20px; margin-left: 4px; padding: 4px; font-size: 10px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; display: inline-block;">
                    ✕
                </button>
                <input type="text" class="horario-personalizado"
                    data-data="${data}"
                    data-func="${funcId}"
                    data-index="${index}"
                    oninput="atualizarHorarioPersonalizado(this)"
                    placeholder="Ex: 08:00 às 17:00"
                    value="${!['07:00 às 15:20','15:00 às 23:30','07:00 às 23:30',''].includes(horario) ? horario : ''}"
                    style="width: 100%; margin-top: 4px; padding: 4px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 10px; display: ${!['07:00 às 15:20','15:00 às 23:30','07:00 às 23:30',''].includes(horario) ? 'block' : 'none'};">
            </div>
        `;
    });
    return html;
}

function atualizarStatus(select) {
    const data = select.getAttribute('data-data');
    const funcId = parseInt(select.getAttribute('data-func'));
    const status = select.value;
    
    const td = select.closest('td');
    const btnAdd = td ? td.querySelector('.btn-add-horario') : null;
    
    if (status === 'trabalha') {
        if (btnAdd) btnAdd.style.display = 'block';
        if (!escalaData[data]) escalaData[data] = {};
        if (!escalaData[data][funcId]) {
            escalaData[data][funcId] = { status: 'trabalha', horarios: [], adicional: 0 };
        }
        escalaData[data][funcId].status = 'trabalha';
        console.log(`✅ Trabalha: Funcionário ${funcId} no dia ${data}`);
    } 
    else if (status === 'folga') {
        if (btnAdd) btnAdd.style.display = 'none';
        if (!escalaData[data]) escalaData[data] = {};
        if (!escalaData[data][funcId]) escalaData[data][funcId] = {};
        escalaData[data][funcId].status = 'folga';
        escalaData[data][funcId].horarios = [];
        console.log(`❌ Folga: Funcionário ${funcId} no dia ${data}`);
    }
    else if (status === 'excluir') {
        if (btnAdd) btnAdd.style.display = 'none';
        if (escalaData[data] && escalaData[data][funcId]) {
            delete escalaData[data][funcId];
            if (Object.keys(escalaData[data]).length === 0) {
                delete escalaData[data];
            }
        }
        select.value = '';
        console.log(`🗑️ Excluído: Escala do funcionário ${funcId} removida no dia ${data}`);
    }
    else {
        if (btnAdd) btnAdd.style.display = 'none';
        if (escalaData[data] && escalaData[data][funcId]) {
            delete escalaData[data][funcId];
            if (Object.keys(escalaData[data]).length === 0) {
                delete escalaData[data];
            }
        }
    }
    
    salvarEscalaGeral();
}

// Adicionar novo horário
function adicionarHorario(data, funcId) {
    if (!escalaData[data]) escalaData[data] = {};
    if (!escalaData[data][funcId]) {
        escalaData[data][funcId] = { status: 'trabalha', horarios: [], adicional: 0 };
    }
    if (!escalaData[data][funcId].horarios) {
        escalaData[data][funcId].horarios = [];
    }
    
    escalaData[data][funcId].horarios.push('');
    salvarEscalaGeral();
    carregarSemana(); // Recarregar para mostrar o novo campo
}

// Remover horário
function removerHorario(data, funcId, index) {
    if (escalaData[data] && escalaData[data][funcId] && escalaData[data][funcId].horarios) {
        escalaData[data][funcId].horarios.splice(index, 1);
        if (escalaData[data][funcId].horarios.length === 0) {
            delete escalaData[data][funcId];
            if (Object.keys(escalaData[data]).length === 0) {
                delete escalaData[data];
            }
        }
        salvarEscalaGeral();
        carregarSemana();
    }
}

// Atualizar horário no select
function atualizarHorarioSelect(select) {
    const data = select.getAttribute('data-data');
    const funcId = parseInt(select.getAttribute('data-func'));
    const index = parseInt(select.getAttribute('data-index'));
    const valor = select.value;
    const divHorario = select.closest('.horario-item');
    const inputPersonalizado = divHorario ? divHorario.querySelector('.horario-personalizado') : null;
    
    if (valor === 'personalizado') {
        if (inputPersonalizado) {
            inputPersonalizado.style.display = 'block';
            inputPersonalizado.focus();
        }
        return;
    }
    
    if (inputPersonalizado) {
        inputPersonalizado.style.display = 'none';
        inputPersonalizado.value = '';
    }
    
    if (!escalaData[data]) escalaData[data] = {};
    if (!escalaData[data][funcId]) {
        escalaData[data][funcId] = { status: 'trabalha', horarios: [], adicional: 0 };
    }
    
    if (!escalaData[data][funcId].horarios) {
        escalaData[data][funcId].horarios = [];
    }
    
    escalaData[data][funcId].horarios[index] = valor;
    salvarEscalaGeral();
    
    console.log(`⏰ Horário "${valor}" salvo para funcionário ${funcId} no dia ${data}`);
}

// Atualizar horário personalizado
function atualizarHorarioPersonalizado(input) {
    const data = input.getAttribute('data-data');
    const funcId = parseInt(input.getAttribute('data-func'));
    const index = parseInt(input.getAttribute('data-index'));
    const horario = input.value.trim();

    if (!horario) return;

    if (!escalaData[data]) escalaData[data] = {};
    if (!escalaData[data][funcId]) {
        escalaData[data][funcId] = { status: 'trabalha', horarios: [] };
    }

    if (!escalaData[data][funcId].horarios) {
        escalaData[data][funcId].horarios = [];
    }

    escalaData[data][funcId].horarios[index] = horario;

    console.log(`💾 Horário personalizado salvo: ${horario}`);

    // 🔥 IMPORTANTE: salvar imediatamente
    localStorage.setItem("escala_funcionarios_escala", JSON.stringify(escalaData));
}

// ==========================
// 💰 FORMATAÇÃO DE MOEDA (ADICIONAL)
// ==========================

// Formata enquanto digita (R$ 0,00)
function formatarMoeda(input) {
    let valor = input.value.replace(/\D/g, '');
    
    valor = (parseInt(valor || 0) / 100).toFixed(2) + '';
    valor = valor.replace(".", ",");
    valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    input.value = 'R$ ' + valor;
}

// Formata valor ao carregar na tela
function formatarMoedaInput(valor) {
    return (valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
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
        salvarEscalaFirebase();
    }
}

function salvarEscalaSemana() {
    salvarEscalaFirebase();
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
                const valorDia = calcularValorDia(func, dataStr);
                let totalValor = 0;

                for (let dia = 1; dia <= diasNoMes; dia++) {
                    const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
                    const escala = escalaData[dataStr] && escalaData[dataStr][func.id];

                    if (escala && escala.status === 'trabalha') {
                        diasTrabalhados++;
                        totalValor += calcularValorDia(func, dataStr);
                    }
                }
            }
        }
        
        console.log(`${func.nome}: ${diasTrabalhados} dias trabalhados - Dias: ${diasDetalhes.join(', ')}`);
        
        return { 
            ...func, 
            diasTrabalhados, 
            total: totalValor
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
    // Tentar carregar do Firebase primeiro
    if (db) {
        carregarPagamentosFirebase();
    }
    
    // Fallback para localStorage
    const pagamentosSalvos = localStorage.getItem("escala_funcionarios_pagamentos");
    if (pagamentosSalvos && Object.keys(pagamentosData).length === 0) {
        pagamentosData = JSON.parse(pagamentosSalvos);
    }
    // No final da função carregarPagamentos, antes do último }
    console.log("✅ Tela de pagamentos atualizada!");
}

// Salvar pagamentos
function salvarPagamentosStorage() {
    localStorage.setItem("escala_funcionarios_pagamentos", JSON.stringify(pagamentosData));
}



// ========== FUNÇÕES DE PAGAMENTOS NO FIREBASE ==========

async function carregarPagamentosFirebase() {
    try {
        if (!db) {
            console.log("⚠️ Firebase não disponível");
            return false;
        }
        
        console.log("🔄 Carregando pagamentos do Firebase...");
        
        const snapshot = await db.collection('pagamentos').get();
        
        // 🔥 LIMPAR E RECRIAR O OBJETO
        const novoPagamentosData = {};

        snapshot.forEach(docSnapshot => {
            const item = docSnapshot.data();
            const data = item.data;
            const funcId = item.funcionario_id;

            if (!novoPagamentosData[data]) novoPagamentosData[data] = {};
            
            // 🔥 GARANTIR QUE pagos É UM ARRAY
            let pagosArray = item.pagos || [];
            if (!Array.isArray(pagosArray)) {
                pagosArray = [];
            }
            
            novoPagamentosData[data][funcId] = {
                pagos: pagosArray,
                adicional: item.adicional || 0,
                desconto: item.desconto || 0,
                descricao: item.descricao || ""
            };
        });

        // 🔥 SUBSTITUIR O OBJETO COMPLETO
        pagamentosData = novoPagamentosData;

        console.log(`✅ ${snapshot.docs.length} registros de pagamentos carregados`);
        console.log("📊 Pagamentos carregados:", pagamentosData);
        
        // Atualizar cache local
        localStorage.setItem("escala_funcionarios_pagamentos", JSON.stringify(pagamentosData));
        
        return true;

    } catch (error) {
        console.error("Erro ao carregar pagamentos:", error);
        return false;
    }
}

async function salvarPagamentosFirebase() {
    console.log("🔥 Salvando pagamentos...");
    try {
        if (!db) return;
        
        const batch = db.batch();
        
        // Limpar dados antigos
        const snapshot = await db.collection('pagamentos').get();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Salvar novos dados
        for (const [data, funcs] of Object.entries(pagamentosData)) {
            for (const [funcId, registro] of Object.entries(funcs)) {
                const docRef = db.collection('pagamentos').doc(`${data}_${funcId}`);
                
                // 🔥 GARANTIR QUE pagos É UM ARRAY
                const pagosArray = Array.isArray(registro.pagos) ? registro.pagos : [];
                
                batch.set(docRef, {
                    data: data,
                    funcionario_id: parseInt(funcId),
                    pagos: pagosArray,
                    adicional: registro.adicional || 0,
                    desconto: registro.desconto || 0,
                    descricao: registro.descricao || ""
                });
            }
        }
        
        await batch.commit();
        console.log("✅ Pagamentos salvos com sucesso");
        
    } catch (erro) {
        console.error("Erro ao salvar pagamentos:", erro);
    }
}

function salvarAdicional(data, funcId, valor) {
    if (!pagamentosData[data]) pagamentosData[data] = {};
    if (!pagamentosData[data][funcId]) pagamentosData[data][funcId] = {};

    pagamentosData[data][funcId].adicional = parseFloat(valor) || 0;
    salvarPagamentosFirebase();
}

function salvarDesconto(data, funcId, valor) {
    if (!pagamentosData[data]) pagamentosData[data] = {};
    if (!pagamentosData[data][funcId]) pagamentosData[data][funcId] = {};

    pagamentosData[data][funcId].desconto = parseFloat(valor) || 0;
    salvarPagamentosFirebase();
}

function salvarDescricao(data, funcId, texto) {
    if (!pagamentosData[data]) pagamentosData[data] = {};
    if (!pagamentosData[data][funcId]) pagamentosData[data][funcId] = {};

    pagamentosData[data][funcId].descricao = texto;
    salvarPagamentosFirebase();
}


// Carregar tela de pagamentos
async function carregarPagamentos() {
    console.log("🔄 Carregando tela de pagamentos...");
    
    await carregarPagamentosFirebase();

    const mesInput = document.getElementById("mesPagamento");
    if (!mesInput.value) {
        const hoje = new Date();
        mesInput.value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
    }

    const [ano, mes] = mesInput.value.split('-');
    const diasNoMes = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const container = document.getElementById("pagamentosContainer");
    // 🔥 FILTRO POR SETOR
    const filtroSetor = document.getElementById("filtroSetorPagamento")?.value || "todos";

    let funcionariosAtivos = funcionarios.filter(f => f.status === true);
    if (filtroSetor !== "todos") {
        funcionariosAtivos = funcionariosAtivos.filter(f => f.setor === filtroSetor);
    }

    if (!container) return;
    if (funcionariosAtivos.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;">Nenhum funcionário cadastrado</div>';
        return;
    }

    let diasHTML = '';
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const diaSemana = new Date(parseInt(ano), parseInt(mes)-1, dia).toLocaleDateString('pt-BR', { weekday: 'short' });
        diasHTML += `<th style="min-width:100px; background:#0f172a; color:white; padding:8px;">${diaSemana}<br>${dia}</th>`;
    }

    let funcionariosHTML = [];
    let totalGeralPago = 0;
    let totalGeralReceber = 0;

    for (const func of funcionariosAtivos) {
        let diasTrabalhados = 0;
        let valorTotalReceber = 0;
        let valorTotalPago = 0;
        let funcionarioDiasHTML = '';

        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataStr = `${ano}-${mes}-${String(dia).padStart(2,'0')}`;
            const escala = escalaData[dataStr]?.[func.id];
            const trabalhou = escala && escala.status === 'trabalha';

            const dadosPagamento = pagamentosData[dataStr]?.[func.id] || {};
            const pagamentosArr = dadosPagamento.pagos || [];

            const adicional = Number(dadosPagamento.adicional || 0);
            const desconto = Number(dadosPagamento.desconto || 0);
            const descricao = dadosPagamento.descricao || "";

            const numHorarios = (escala && escala.horarios) ? escala.horarios.length : 1;
            const qtdePagos = pagamentosArr.filter(p => p === true).length;

            let valorDia = 0;
            if (trabalhou) {
                diasTrabalhados++;
                
                const horarios = escala.horarios || [];
                let valorBase = 0;
                if (horarios.length > 0) {
                    horarios.forEach(horario => {
                        if (horario === '07:00 às 15:20' || horario === '15:00 às 23:30') {
                            valorBase += func.diaria;
                        } else if (horario === '07:00 às 23:30') {
                            valorBase += func.diaria * 2;
                        } else if (horario && horario !== '') {
                            valorBase += func.diaria;
                        }
                    });
                } else {
                    valorBase = func.diaria;
                }
                
                valorDia = valorBase + adicional - desconto;
                valorDia = Math.max(0, valorDia);
                valorTotalReceber += valorDia;
            }

            const todosPagos = (numHorarios > 0 && pagamentosArr.length === numHorarios && pagamentosArr.every(p => p === true));
            
            if (trabalhou && todosPagos) {
                valorTotalPago += valorDia;
            }

            let botoesHTML = '';
            if (trabalhou) {
                if (todosPagos) {
                    botoesHTML = `
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                            <span style="background:#16a34a;color:white;padding:4px 8px;border-radius:6px;">✅ PAGO - R$ ${valorDia.toFixed(2)}</span>
                            <button onclick="desfazerPagamento('${dataStr}', ${func.id})" style="background:#dc2626;color:white;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;">↺ DESFAZER</button>
                        </div>
                    `;
                } else {
                    botoesHTML = `
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                            <button onclick="marcarDiaPago('${dataStr}', ${func.id})" style="background:#f59e0b;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:11px;cursor:pointer;">💰 PAGAR (${qtdePagos}/${numHorarios})</button>
                            <input type="number" placeholder="Adicional" value="${adicional || ''}" onblur="salvarAdicional('${dataStr}', ${func.id}, this.value)" style="width:90px;font-size:10px;padding:4px;border-radius:4px;">
                            <input type="number" placeholder="Desconto" value="${desconto || ''}" onblur="salvarDesconto('${dataStr}', ${func.id}, this.value)" style="width:90px;font-size:10px;padding:4px;border-radius:4px;">
                            <input type="text" placeholder="Descrição" value="${descricao || ''}" onblur="salvarDescricao('${dataStr}', ${func.id}, this.value)" style="width:90px;font-size:9px;padding:4px;border-radius:4px;">
                        </div>
                    `;
                }
            } else {
                botoesHTML = `<span style="color:#cbd5e1;">—</span>`;
            }

            funcionarioDiasHTML += `<td style="text-align:center; background:${todosPagos ? '#dcfce7' : 'white'}; padding:6px;">${botoesHTML}</td>`;
        }

        funcionariosHTML.push(`
            <tr>
                <td style="background:#f8fafc;padding:8px;">
                    <strong>${func.nome}</strong><br>
                    💰 Receber: <strong>R$ ${valorTotalReceber.toFixed(2)}</strong><br>
                    ✅ Pago: <strong style="color:#16a34a;">R$ ${valorTotalPago.toFixed(2)}</strong>
                </td>
                ${funcionarioDiasHTML}
            </tr>
        `);
        
        totalGeralReceber += valorTotalReceber;
        totalGeralPago += valorTotalPago;
    }

    const totalGeralPendente = totalGeralReceber - totalGeralPago;

    container.innerHTML = `
        <div style="margin-bottom:15px;padding:10px;background:#f1f5f9;border-radius:8px;">
            <strong>📊 MÊS ${mes}/${ano}</strong><br>
            💰 Pago: <strong style="color:#16a34a;">R$ ${totalGeralPago.toFixed(2)}</strong><br>
            📊 Total: <strong>R$ ${totalGeralReceber.toFixed(2)}</strong><br>
            📌 Pendente: <strong style="color:${totalGeralPendente > 0 ? '#dc2626' : '#16a34a'};">R$ ${totalGeralPendente.toFixed(2)}</strong>
        </div>
        <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr style="background:#0f172a;color:white;"><th>Funcionário</th>${diasHTML}</tr></thead>
                <tbody>${funcionariosHTML.join('')}</tbody>
            </table>
        </div>
    `;
    console.log("✅ Tela atualizada");
}

async function marcarDiaPago(dataStr, funcId) {
    console.log(`💰 Marcando pagamento: ${funcId} em ${dataStr}`);
    
    if (!pagamentosData[dataStr]) pagamentosData[dataStr] = {};
    
    const escala = escalaData[dataStr]?.[funcId];
    const numHorarios = (escala && escala.horarios) ? escala.horarios.length : 1;
    
    // 🔥 PRESERVAR ADICIONAL E DESCONTO
    const dadosExistentes = pagamentosData[dataStr][funcId] || {};
    const adicional = dadosExistentes.adicional || 0;
    const desconto = dadosExistentes.desconto || 0;
    const descricao = dadosExistentes.descricao || "";
    
    // Calcular valor base
    const horarios = escala?.horarios || [];
    let valorBase = 0;
    if (horarios.length > 0) {
        horarios.forEach(horario => {
            if (horario === '07:00 às 15:20' || horario === '15:00 às 23:30') {
                valorBase += (escala ? 90 : 0); // Valor da diária do funcionário
            } else if (horario === '07:00 às 23:30') {
                valorBase += (escala ? 180 : 0);
            } else {
                valorBase += (escala ? 90 : 0);
            }
        });
    } else {
        valorBase = escala ? 90 : 0;
    }
    
    const valorTotal = valorBase + adicional - desconto;
    
    pagamentosData[dataStr][funcId] = {
        pagos: new Array(numHorarios).fill(true),
        adicional: adicional,
        desconto: desconto,
        descricao: descricao
    };
    
    await salvarPagamentosFirebase();
    await carregarPagamentos();
    
    console.log(`✅ Pagamento registrado - Valor total: R$ ${valorTotal.toFixed(2)} (Base: R$ ${valorBase} + Adicional: R$ ${adicional} - Desconto: R$ ${desconto})`);
}

async function desfazerPagamento(dataStr, funcId) {
    if (!confirm("Desfazer pagamento deste dia?")) return;
    
    if (!pagamentosData[dataStr] || !pagamentosData[dataStr][funcId]) {
        console.log("⚠️ Nenhum pagamento encontrado para desfazer");
        return;
    }
    
    const escala = escalaData[dataStr]?.[funcId];
    const numHorarios = (escala && escala.horarios) ? escala.horarios.length : 1;
    
    // 🔥 Preservar adicional e desconto
    const dadosExistentes = pagamentosData[dataStr][funcId];
    const adicional = dadosExistentes.adicional || 0;
    const desconto = dadosExistentes.desconto || 0;
    const descricao = dadosExistentes.descricao || "";
    
    // Desfazer pagamentos
    pagamentosData[dataStr][funcId] = {
        pagos: new Array(numHorarios).fill(false),
        adicional: adicional,
        desconto: desconto,
        descricao: descricao
    };
    
    await salvarPagamentosFirebase();
    await carregarPagamentosFirebase();
    await carregarPagamentos();
    
    console.log(`↺ Pagamento desfeito, mas adicional (R$ ${adicional}) e desconto (R$ ${desconto}) mantidos`);
}

function salvarAdicional(dataStr, funcId, valor) {
    if (!pagamentosData[dataStr]) pagamentosData[dataStr] = {};
    if (!pagamentosData[dataStr][funcId]) {
        pagamentosData[dataStr][funcId] = {
            pagos: [],
            adicional: 0,
            desconto: 0,
            descricao: ""
        };
    }
    
    pagamentosData[dataStr][funcId].adicional = parseFloat(valor) || 0;
    salvarPagamentosFirebase();
    carregarPagamentos();
    console.log(`➕ Adicional de R$ ${valor} salvo para ${funcId} em ${dataStr}`);
}

function salvarDesconto(dataStr, funcId, valor) {
    if (!pagamentosData[dataStr]) pagamentosData[dataStr] = {};
    if (!pagamentosData[dataStr][funcId]) {
        pagamentosData[dataStr][funcId] = {
            pagos: [],
            adicional: 0,
            desconto: 0,
            descricao: ""
        };
    }
    
    pagamentosData[dataStr][funcId].desconto = parseFloat(valor) || 0;
    salvarPagamentosFirebase();
    carregarPagamentos();
    console.log(`➖ Desconto de R$ ${valor} salvo para ${funcId} em ${dataStr}`);
}

function salvarDescricao(dataStr, funcId, texto) {
    if (!pagamentosData[dataStr]) pagamentosData[dataStr] = {};
    if (!pagamentosData[dataStr][funcId]) {
        pagamentosData[dataStr][funcId] = {
            pagos: [],
            adicional: 0,
            desconto: 0,
            descricao: ""
        };
    }
    
    pagamentosData[dataStr][funcId].descricao = texto;
    salvarPagamentosFirebase();
    console.log(`📝 Descrição salva para ${funcId} em ${dataStr}`);
}

// Marcar todos os dias do mês como pagos para todos os funcionários
async function marcarTodosPagos() {
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
        
        // 🔥 FILTRO POR SETOR
        const filtroSetor = document.getElementById("filtroSetorPagamento")?.value || "todos";

        let funcionariosAtivos = funcionarios.filter(f => f.status === true);
        if (filtroSetor !== "todos") {
            funcionariosAtivos = funcionariosAtivos.filter(f => f.setor === filtroSetor);
        }
        
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataStr = `${ano}-${mes}-${String(dia).padStart(2, '0')}`;
            
            funcionariosAtivos.forEach(func => {
                const escala = escalaData[dataStr] && escalaData[dataStr][func.id];
                if (escala && escala.status === 'trabalha') {
                    if (!pagamentosData[dataStr]) pagamentosData[dataStr] = {};
                    pagamentosData[dataStr][func.id] = true;
                }
            });
        }
        
        await salvarPagamentosFirebase();
        carregarPagamentos();
        console.log("✅ Todos os dias foram marcados como pagos!");
    }
}

// Desfazer pagamento (estornar)
// Desfazer pagamento (estornar)
async function desfazerPagamento(dataStr, funcId, horarioIndex = null) {
    if (!confirm("Desfazer pagamento?")) return;

    if (!pagamentosData[dataStr]) pagamentosData[dataStr] = {};

    let registro = pagamentosData[dataStr][funcId];

    if (!registro) {
        await salvarPagamentosFirebase();
        carregarPagamentos();
        return;
    }

    // 🔥 CONVERTER FORMATO ANTIGO (array → objeto)
    if (Array.isArray(registro)) {
        registro = {
            pagos: registro,
            adicional: 0,
            desconto: 0,
            descricao: ""
        };
        pagamentosData[dataStr][funcId] = registro;
    }

    // 🔥 GARANTIR ARRAY pagos
    if (!Array.isArray(registro.pagos)) {
        const escala = escalaData[dataStr]?.[funcId];
        const numHorarios = (escala && escala.horarios)
            ? escala.horarios.length
            : 1;

        registro.pagos = new Array(numHorarios).fill(false);
    }

    // =========================
    // 🔥 DESFAZER PAGAMENTO
    // =========================

    if (horarioIndex !== null) {
        // Desfazer apenas 1 horário
        registro.pagos[horarioIndex] = false;
    } else {
        // Desfazer TODOS
        registro.pagos = registro.pagos.map(() => false);
    }

    // =========================
    // 🔥 LIMPEZA DE DADOS
    // =========================

    const todosFalse = registro.pagos.every(p => p === false);

    if (todosFalse) {
        delete pagamentosData[dataStr][funcId];
    }

    if (Object.keys(pagamentosData[dataStr]).length === 0) {
        delete pagamentosData[dataStr];
    }

    await salvarPagamentosFirebase();
    carregarPagamentos();

    console.log(`↺ Pagamento desfeito: Funcionário ${funcId} em ${dataStr}`);
}

// Desfazer todos os pagamentos do mês
async function desfazerTodosPagamentos() {
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
        
        await salvarPagamentosFirebase();
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
    //await carregarEscalaFirebase();
    await carregarPagamentosFirebase();
    
    if (Object.keys(escalaData).length === 0) {
        carregarEscala();
    }
    
    if (Object.keys(pagamentosData).length === 0) {
        carregarPagamentosStorage();
    }
    
    renderizarLista();
    
    const abaPagamentos = document.getElementById("tab-pagamentos");
    if (abaPagamentos && abaPagamentos.style.display !== "none") {
        carregarPagamentos();
    }
    
    console.log("✅ Sistema inicializado com Firebase!");
}

// Inicializar o sistema
inicializarSistema();


// Função simples para teste
function salvarEscalaSemana() {
    alert("Botão funcionou! Salvando escala...");
    localStorage.setItem("escala_funcionarios_escala", JSON.stringify(escalaData));
    carregarSemana();
}

// ========== EXPORTAR ESCALA EM PDF ==========
async function exportarEscalaPDF() {
    console.log("📄 Iniciando exportação do PDF...");
    
    // Verificar se há funcionários
    if (funcionarios.length === 0) {
        alert("⚠️ Nenhum funcionário cadastrado para exportar!");
        return;
    }
    
    // Verificar se a semana foi carregada
    if (semanaAtual.length === 0) {
        alert("⚠️ Carregue uma semana primeiro!");
        return;
    }
    
    // Mostrar loading
    const btn = event?.target;
    const textoOriginal = btn?.innerHTML;
    if (btn) btn.innerHTML = "⏳ Gerando PDF...";
    
    try {
        // Clonar a tabela para não afetar a original
        const tabelaOriginal = document.querySelector('.escala-table');
        if (!tabelaOriginal) {
            alert("❌ Tabela não encontrada!");
            return;
        }
        
        // Criar uma cópia da tabela para o PDF
        const tabelaClone = tabelaOriginal.cloneNode(true);
        
        // Ajustar estilos para o PDF
        tabelaClone.style.width = '100%';
        tabelaClone.style.borderCollapse = 'collapse';
        tabelaClone.style.fontSize = '10px';
        
        // Remover inputs e selects, substituir por texto
        tabelaClone.querySelectorAll('.status-select').forEach(select => {
            const option = select.options[select.selectedIndex];
            const texto = option ? option.text : '';
            const span = document.createElement('span');
            span.textContent = texto;
            span.style.display = 'inline-block';
            span.style.padding = '4px';
            select.parentNode.replaceChild(span, select);
        });
        
        tabelaClone.querySelectorAll('.horario-select').forEach(select => {
            const option = select.options[select.selectedIndex];
            const texto = option && option.value !== 'personalizado' ? option.text : '';
            const span = document.createElement('span');
            span.textContent = texto || '---';
            span.style.fontSize = '9px';
            span.style.color = '#666';
            select.parentNode.replaceChild(span, select);
        });
        
        tabelaClone.querySelectorAll('.horario-personalizado').forEach(input => {
            const texto = input.value || '';
            const span = document.createElement('span');
            span.textContent = texto || '---';
            span.style.fontSize = '9px';
            span.style.color = '#666';
            input.parentNode.replaceChild(span, input);
        });
        
        // Criar um container temporário para o PDF
        const container = document.createElement('div');
        container.style.padding = '20px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.backgroundColor = 'white';
        
        // Adicionar cabeçalho
        const hoje = new Date();
        const dataAtual = hoje.toLocaleDateString('pt-BR');
        const titulo = document.createElement('h2');
        titulo.textContent = `📅 Escala de Trabalho - ${semanaAtual[0].data.split('-').reverse().join('/')} a ${semanaAtual[6].data.split('-').reverse().join('/')}`;
        titulo.style.textAlign = 'center';
        titulo.style.marginBottom = '20px';
        titulo.style.color = '#0f172a';
        container.appendChild(titulo);
        
        // Adicionar data de impressão
        const dataImpressao = document.createElement('p');
        dataImpressao.textContent = `Gerado em: ${dataAtual}`;
        dataImpressao.style.textAlign = 'right';
        dataImpressao.style.fontSize = '10px';
        dataImpressao.style.color = '#64748b';
        dataImpressao.style.marginBottom = '20px';
        container.appendChild(dataImpressao);
        
        // Adicionar a tabela
        container.appendChild(tabelaClone);
        
        // Adicionar rodapé
        const rodape = document.createElement('p');
        rodape.textContent = 'Sistema de Controle de Escala - Desenvolvido para sua empresa';
        rodape.style.textAlign = 'center';
        rodape.style.fontSize = '9px';
        rodape.style.color = '#64748b';
        rodape.style.marginTop = '20px';
        rodape.style.paddingTop = '10px';
        rodape.style.borderTop = '1px solid #e2e8f0';
        container.appendChild(rodape);
        
        // Adicionar ao corpo temporariamente
        document.body.appendChild(container);
        
        // Usar html2canvas para capturar
        const canvas = await html2canvas(container, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
        });
        
        // Remover o container temporário
        document.body.removeChild(container);
        
        // Criar PDF
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 largura em mm
        const pageHeight = 297; // A4 altura em mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        
        // Salvar PDF
        const nomeArquivo = `escala_${semanaAtual[0].data}_a_${semanaAtual[6].data}.pdf`;
        pdf.save(nomeArquivo);
        
        console.log("✅ PDF gerado com sucesso!");
        alert("📄 PDF exportado com sucesso!");
        
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("❌ Erro ao gerar PDF. Tente novamente.");
    } finally {
        if (btn) btn.innerHTML = textoOriginal;
    }
}

function normalizarPagamento(registro, dataStr, funcId) {
    if (!registro) return {
        pagos: [],
        adicional: 0,
        desconto: 0,
        descricao: ""
    };

    // 🔥 se for array antigo
    if (Array.isArray(registro)) {
        return {
            pagos: registro,
            adicional: 0,
            desconto: 0,
            descricao: ""
        };
    }

    // 🔥 garantir estrutura
    return {
        pagos: registro.pagos || [],
        adicional: Number(registro.adicional || 0),
        desconto: Number(registro.desconto || 0),
        descricao: registro.descricao || ""
    };
}