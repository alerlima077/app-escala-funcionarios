// script.js - Sistema de login com Firebase
console.log("🚀 Script de login carregado");

// ========== CONFIGURAÇÃO DO FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyApDJcJ-bsiPJJLITXdlRtf82gzlSYtZRY",
    authDomain: "app-escala-funcionarios.firebaseapp.com",
    projectId: "app-escala-funcionarios",
    storageBucket: "app-escala-funcionarios.firebasestorage.app",
    messagingSenderId: "1066676645204",
    appId: "1:1066676645204:web:3ce459ed8b8b76a7f92cc1"
};

// Inicializar Firebase (se disponível)
let db = null;
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    console.log("✅ Firebase conectado!");
} else {
    console.log("⚠️ Firebase SDK não carregado");
}

// ========== FUNÇÃO DE LOGIN ==========
async function fazerLogin() {
    const senha = document.getElementById("senha").value;
    const erroDiv = document.getElementById("erro");
    
    console.log("🔑 Tentando login com senha:", senha);
    
    // Verificar se é admin
    if (senha === "123456") {
        console.log("✅ Login ADMIN bem sucedido");
        localStorage.setItem("tipoUsuario", "admin");
        window.location.href = "admin.html";
        return;
    }
    
    // Buscar funcionários do Firebase
    let funcionarios = [];
    
    if (db) {
        try {
            const snapshot = await db.collection('funcionarios').get();
            snapshot.forEach(doc => {
                funcionarios.push({ id: parseInt(doc.id), ...doc.data() });
            });
            console.log("👥 Funcionários carregados do Firebase:", funcionarios.map(f => ({ nome: f.nome, senha: f.senha })));
        } catch(e) {
            console.error("Erro ao buscar funcionários:", e);
        }
    } else {
        // Fallback para localStorage
        const dados = localStorage.getItem("escala_funcionarios");
        if (dados) {
            const parsed = JSON.parse(dados);
            funcionarios = parsed.funcionarios || [];
        }
    }
    
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

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 Página de login carregada");
    
    const btnLogin = document.getElementById("btnLogin");
    const senhaInput = document.getElementById("senha");
    
    if (btnLogin) {
        btnLogin.addEventListener("click", fazerLogin);
        console.log("✅ Botão de login configurado");
    }
    
    if (senhaInput) {
        senhaInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                fazerLogin();
            }
        });
        console.log("✅ Evento de tecla configurado");
    }
});