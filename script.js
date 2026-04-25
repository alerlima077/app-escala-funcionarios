// script.js - Sistema de login (VERSÃO FINAL CORRIGIDA)

console.log("🚀 Script de login carregado");

// Senha do admin fixa
const ADMIN_SENHA = "864175";

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

// Função de login
function fazerLogin() {
    const senha = document.getElementById("senha").value;
    const erroDiv = document.getElementById("erro");
    
    console.log("🔑 Tentando login com senha:", senha);
    
    // Verificar se é admin
    if (senha === ADMIN_SENHA) {
        console.log("✅ Login ADMIN bem sucedido");
        localStorage.setItem("tipoUsuario", "admin");
        window.location.href = "admin.html";
        return;
    }
    
    // Carregar funcionários diretamente do localStorage
    let funcionarios = [];
    const dados = localStorage.getItem("escala_funcionarios");
    
    if (dados) {
        try {
            const parsed = JSON.parse(dados);
            funcionarios = parsed.funcionarios || [];
            console.log("👥 Funcionários carregados:", funcionarios.map(f => ({ nome: f.nome, senha: f.senha, status: f.status })));
        } catch(e) {
            console.error("Erro ao ler dados:", e);
        }
    } else {
        console.log("⚠️ Nenhum dado encontrado no localStorage");
    }
    
    // Verificar se é funcionário
    const funcionario = funcionarios.find(f => f.senha === senha && f.status === true);
    
    if (funcionario) {
        console.log("✅ Login FUNCIONÁRIO bem sucedido:", funcionario.nome);
        localStorage.setItem("funcionarioLogado", JSON.stringify(funcionario));
        localStorage.setItem("tipoUsuario", "funcionario");
        window.location.href = "funcionario.html";
    } else {
        console.log("❌ Senha inválida ou funcionário inativo");
        erroDiv.innerText = "Senha inválida ou funcionário inativo.";
        erroDiv.style.display = "block";
    }
}

// Aguardar o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 Página de login carregada");
    
    const btnLogin = document.getElementById("btnLogin");
    const senhaInput = document.getElementById("senha");
    
    if (btnLogin) {
        btnLogin.addEventListener("click", fazerLogin);
        console.log("✅ Botão de login configurado");
    } else {
        console.error("❌ Botão de login não encontrado");
    }
    
    if (senhaInput) {
        senhaInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                fazerLogin();
            }
        });
        console.log("✅ Evento de tecla configurado");
    }
    
    // Debug: Mostrar funcionários disponíveis no console
    const dados = localStorage.getItem("escala_funcionarios");
    if (dados) {
        const parsed = JSON.parse(dados);
        console.log("📋 Funcionários disponíveis para login:");
        parsed.funcionarios.forEach(f => {
            console.log(`   - ${f.nome}: senha "${f.senha}" (${f.status ? 'Ativo' : 'Inativo'})`);
        });
    }
});