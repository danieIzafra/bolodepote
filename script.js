// ==========================================
// 1. CONEXÃO COM O SUPABASE 
// ==========================================
const supabaseUrl = 'https://jljwtpgowqnndhccxila.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsand0cGdvd3FubmRoY2N4aWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTU4MTEsImV4cCI6MjA5MzU5MTgxMX0.Z376Nfn5RGsjiQH0vjK7yIvNzW8uV03DMojSz-y1tRw'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. CONFIGURAÇÕES GERAIS E TEMA
// ==========================================
const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarData = (isoString) => {
    if(!isoString) return '-';
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR');
};

const themeToggleBtn = document.getElementById('themeToggle');
if(themeToggleBtn) {
    const themeIcon = themeToggleBtn.querySelector('i');
    if (localStorage.getItem('dashboardTheme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        localStorage.setItem('dashboardTheme', isDark ? 'dark' : 'light');
        if(window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            atualizarDashboard(); 
        }
    });
}

// ==========================================
// 3. BUSCANDO DADOS DO BANCO (NUVEM)
// ==========================================
let dbSabores = [];
let dbVendas = [];
let dbCustos = [];
let meuGrafico;

async function carregarDadosDoBanco() {
    try {
        const [resSabores, resVendas, resCustos] = await Promise.all([
            supabaseClient.from('sabores').select('*').order('nome'),
            supabaseClient.from('vendas').select('*').order('data_compra', { ascending: false }),
            supabaseClient.from('custos').select('*')
        ]);

        if (resSabores.error) throw resSabores.error;
        if (resVendas.error) throw resVendas.error;
        if (resCustos.error) throw resCustos.error;

        dbSabores = resSabores.data;
        dbVendas = resVendas.data;
        dbCustos = resCustos.data;

        if(document.getElementById('totalSaldo')) atualizarDashboard();
        if(document.getElementById('tabelaClientes')) renderizarTabelaClientes();
        if(document.getElementById('saborVenda') && !document.getElementById('totalSaldo')) renderizarFormularios();

    } catch (error) {
        console.error("Erro ao puxar dados do Supabase:", error);
        alert("Erro de conexão com o banco de dados. Verifique as chaves.");
    }
}

// ==========================================
// 4. ATUALIZANDO O PAINEL GERAL (DASHBOARD)
// ==========================================
function atualizarDashboard() {
    let faturamento = 0;
    let unidadesVendidas = 0;
    let aReceber = 0;
    let saldoReal = 0;
    let totalCustos = 0;

    dbVendas.forEach(venda => {
        faturamento += Number(venda.valor_total);
        unidadesVendidas += Number(venda.quantidade);
        if (venda.status_pagamento === 'pago') saldoReal += Number(venda.valor_total);
        else if (venda.status_pagamento === 'pendente') aReceber += Number(venda.valor_total);
    });

    dbCustos.forEach(custo => {
        totalCustos += Number(custo.valor);
        saldoReal -= Number(custo.valor); 
    });

    const lucroProjetado = faturamento - totalCustos;

    document.getElementById('totalSaldo').innerText = formatarMoeda(saldoReal);
    document.getElementById('totalReceber').innerText = formatarMoeda(aReceber);
    document.getElementById('totalFaturamento').innerText = formatarMoeda(faturamento);
    document.getElementById('totalCustos').innerText = formatarMoeda(totalCustos);
    document.getElementById('totalLucro').innerText = formatarMoeda(lucroProjetado);
    document.getElementById('totalUnidades').innerText = unidadesVendidas;

    document.getElementById('totalSaldo').style.color = saldoReal < 0 ? 'var(--cost-red)' : 'var(--text-main)';
    document.getElementById('totalLucro').style.color = lucroProjetado < 0 ? 'var(--cost-red)' : 'var(--text-main)';

    renderizarEstoque();
    renderizarFormularios();
    renderizarGrafico(faturamento, saldoReal, totalCustos, lucroProjetado);
}

function renderizarEstoque() {
    const stockContainer = document.getElementById('stockList');
    if(!stockContainer) return;
    stockContainer.innerHTML = '';
    
    if(dbSabores.length === 0) {
        stockContainer.innerHTML = '<p class="help-text">Nenhum sabor cadastrado. Cadastre na aba "Sabores".</p>';
        return;
    }

    dbSabores.forEach(sabor => {
        stockContainer.innerHTML += `
            <div class="stock-item ${sabor.quantidade <= 0 ? 'empty' : ''}">
                <h4>${sabor.nome}</h4><span>${sabor.quantidade} un</span>
            </div>`;
    });
}

function renderizarFormularios() {
    const selectVenda = document.getElementById('saborVenda');
    const selectProducao = document.getElementById('saborProducao');
    const selectDivida = document.getElementById('dividaSelecionada');
    const listaSaboresAtual = document.getElementById('listaSaboresAtual');
    
    if(selectVenda) selectVenda.innerHTML = '';
    if(selectProducao) selectProducao.innerHTML = '';
    if(selectDivida) selectDivida.innerHTML = '';
    if(listaSaboresAtual) listaSaboresAtual.innerHTML = '';

    dbSabores.forEach(sabor => {
        const precoDb = Number(sabor.preco) || 12;
        const textoVenda = `${sabor.nome} (${formatarMoeda(precoDb)})`;

        if(selectVenda) selectVenda.appendChild(new Option(textoVenda, sabor.id)); 
        if(selectProducao) selectProducao.appendChild(new Option(sabor.nome, sabor.id));
        
        if(listaSaboresAtual) {
            listaSaboresAtual.innerHTML += `
                <div class="flavor-item" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding: 15px; border-radius: 12px; background: var(--input-bg); border: 1px solid var(--border-color);">
                    <div style="flex:1;">
                        <strong style="color: var(--text-main); font-size: 0.95rem;">${sabor.nome}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">
                            <span style="color: var(--profit-mint); font-weight: bold;">${formatarMoeda(precoDb)}</span> | Estoque: ${sabor.quantidade} un
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="theme-btn" style="width:35px; height:35px; font-size:0.9rem;" onclick="editarPreco('${sabor.id}', '${sabor.nome}', ${precoDb})" title="Editar Preço"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="theme-btn" style="width:35px; height:35px; font-size:0.9rem; color:var(--cost-wine);" onclick="removerSabor('${sabor.id}', ${sabor.quantidade})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        }
    });

    if(dbSabores.length === 0) {
        if(document.querySelector('.btn-venda')) document.querySelector('.btn-venda').disabled = true;
        if(document.querySelector('.btn-producao')) document.querySelector('.btn-producao').disabled = true;
    } else {
        if(document.querySelector('.btn-venda')) document.querySelector('.btn-venda').disabled = false;
        if(document.querySelector('.btn-producao')) document.querySelector('.btn-producao').disabled = false;
    }

    const dividas = dbVendas.filter(v => v.status_pagamento === 'pendente');
    if(selectDivida) {
        if(dividas.length === 0) {
            selectDivida.appendChild(new Option("Nenhuma dívida pendente 🎉", ""));
            if(document.querySelector('.btn-receber')) document.querySelector('.btn-receber').disabled = true;
        } else {
            if(document.querySelector('.btn-receber')) document.querySelector('.btn-receber').disabled = false;
            dividas.forEach(d => {
                const texto = `${d.cliente_nome} - ${formatarMoeda(d.valor_total)} (${d.sabor})`;
                selectDivida.appendChild(new Option(texto, d.id)); 
            });
        }
    }
}

// ==========================================
// 5. EVENTOS DOS FORMULÁRIOS
// ==========================================

const formVenda = document.getElementById('formVenda');
if(formVenda) {
    formVenda.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('.btn-submit');
        
        const nomeCliente = document.getElementById('nomeCliente').value;
        const selectSabor = document.getElementById('saborVenda');
        const saborId = selectSabor.value;
        const qtd = parseInt(document.getElementById('qtdVenda').value);
        const status = document.getElementById('statusPagamento').value;
        const dataPgto = document.getElementById('dataPagamento').value;

        // Pega as infos exatas do sabor escolhido
        const saborDb = dbSabores.find(s => s.id === saborId);
        const precoFinal = Number(saborDb.preco) || 12;
        const valorVenda = qtd * precoFinal; // CALCULA COM O PREÇO DO SABOR
        const novoEstoque = saborDb.quantidade - qtd;

        btn.innerHTML = 'Salvando na Nuvem... <i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        await Promise.all([
            supabaseClient.from('vendas').insert([{
                cliente_nome: nomeCliente, sabor: saborDb.nome, quantidade: qtd,
                valor_total: valorVenda, status_pagamento: status,
                data_pagamento_esperada: status === 'pendente' ? dataPgto : null
            }]),
            supabaseClient.from('sabores').update({ quantidade: novoEstoque }).eq('id', saborId)
        ]);

        animarBotaoEAtualizar(btn, 'Registrar Venda <i class="fa-solid fa-cart-arrow-down"></i>', this);
        const divDataPgto = document.getElementById('divDataPagamento');
        if(divDataPgto) divDataPgto.style.display = 'none';
    });
}

const formProducao = document.getElementById('formProducao');
if(formProducao) {
    formProducao.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('.btn-submit');
        const saborId = document.getElementById('saborProducao').value;
        const qtd = parseInt(document.getElementById('qtdProducao').value);

        btn.innerHTML = 'Adicionando... <i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        const saborDb = dbSabores.find(s => s.id === saborId);
        const novoEstoque = saborDb.quantidade + qtd;

        await supabaseClient.from('sabores').update({ quantidade: novoEstoque }).eq('id', saborId);
        animarBotaoEAtualizar(btn, 'Adicionar ao Estoque <i class="fa-solid fa-plus"></i>', this);
    });
}

// CADASTRAR NOVO SABOR COM PREÇO
const formSabores = document.getElementById('formSabores');
if(formSabores) {
    formSabores.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('.btn-submit');
        const novoSabor = document.getElementById('novoSabor').value.trim();
        const precoNovoSabor = parseFloat(document.getElementById('precoNovoSabor').value);

        const existe = dbSabores.some(s => s.nome.toLowerCase() === novoSabor.toLowerCase());
        if(existe) { alert('Esse sabor já está cadastrado!'); return; }

        btn.innerHTML = 'Cadastrando... <i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        // Salva o nome, define o estoque inicial como 0, e salva o preço
        await supabaseClient.from('sabores').insert([{ nome: novoSabor, quantidade: 0, preco: precoNovoSabor }]);
        animarBotaoEAtualizar(btn, 'Adicionar Sabor <i class="fa-solid fa-plus"></i>', this);
    });
}

// FUNÇÃO MÁGICA: EDITAR PREÇO DO SABOR
window.editarPreco = async function(idSabor, nomeSabor, precoAtual) {
    const novoPreco = prompt(`Qual o novo preço de venda para o sabor "${nomeSabor}"?`, precoAtual);
    
    // Verifica se a pessoa digitou um número válido e não cancelou
    if (novoPreco !== null && novoPreco.trim() !== "" && !isNaN(novoPreco)) {
        const precoFormatado = parseFloat(novoPreco);
        await supabaseClient.from('sabores').update({ preco: precoFormatado }).eq('id', idSabor);
        carregarDadosDoBanco(); // Atualiza a tela pra mostrar o novo preço
    } else if (novoPreco !== null) {
        alert("Por favor, digite um valor numérico válido (ex: 15.50).");
    }
}

window.removerSabor = async function(idSabor, qtdEstoque) {
    if(qtdEstoque > 0) {
        if(!confirm(`Atenção: Você tem ${qtdEstoque} potes desse sabor no estoque. Deseja mesmo excluir?`)) return;
    } else {
        if(!confirm('Tem certeza que deseja excluir este sabor?')) return;
    }
    await supabaseClient.from('sabores').delete().eq('id', idSabor);
    carregarDadosDoBanco(); 
}

const formReceber = document.getElementById('formReceber');
if(formReceber) {
    formReceber.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('.btn-submit');
        const idVenda = document.getElementById('dividaSelecionada').value;

        if(!idVenda) return;
        btn.innerHTML = 'Baixando Dívida... <i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        await supabaseClient.from('vendas').update({ status_pagamento: 'pago' }).eq('id', idVenda);
        animarBotaoEAtualizar(btn, 'Confirmar Pagamento <i class="fa-solid fa-hand-holding-dollar"></i>', this);
    });
}

const formCusto = document.getElementById('formCusto');
if(formCusto) {
    formCusto.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('.btn-submit');
        const desc = document.getElementById('descCusto').value;
        const valor = parseFloat(document.getElementById('valorCusto').value);

        btn.innerHTML = 'Registrando... <i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        await supabaseClient.from('custos').insert([{ descricao: desc, valor: valor }]);
        animarBotaoEAtualizar(btn, 'Registrar Despesa <i class="fa-solid fa-minus"></i>', this);
    });
}

// ==========================================
// 6. FUNÇÕES EXTRAS
// ==========================================

function animarBotaoEAtualizar(btn, textoOriginal, form) {
    btn.innerHTML = 'Sucesso! <i class="fa-solid fa-check"></i>';
    form.reset();
    carregarDadosDoBanco(); 
    setTimeout(() => { btn.innerHTML = textoOriginal; btn.disabled = false; }, 1500);
}

function renderizarTabelaClientes() {
    const tbody = document.getElementById('tabelaClientes');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(dbVendas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma venda registrada ainda.</td></tr>';
        return;
    }

    dbVendas.forEach(venda => {
        const badgeClass = venda.status_pagamento === 'pago' ? 'badge-pago' : 'badge-pendente';
        const txtStatus = venda.status_pagamento === 'pago' ? 'Pago' : 'Fiado';
        
        let dataPrevista = '-';
        if(venda.status_pagamento === 'pendente' && venda.data_pagamento_esperada) {
            const partes = venda.data_pagamento_esperada.split('-');
            if(partes.length === 3) dataPrevista = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${formatarData(venda.data_compra)}</td>
                <td><strong>${venda.cliente_nome}</strong></td>
                <td>${venda.sabor}</td>
                <td>${venda.quantidade}</td>
                <td>${formatarMoeda(venda.valor_total)}</td>
                <td><span class="badge ${badgeClass}">${txtStatus}</span></td>
                <td>${dataPrevista}</td>
            </tr>
        `;
    });
}

const statusPgto = document.getElementById('statusPagamento');
if(statusPgto) {
    statusPgto.addEventListener('change', function(e) {
        const divData = document.getElementById('divDataPagamento');
        if (e.target.value === 'pendente') {
            divData.style.display = 'block';
            document.getElementById('dataPagamento').required = true;
        } else {
            divData.style.display = 'none';
            document.getElementById('dataPagamento').required = false;
        }
    });
}

window.showTab = function(tab) {
    const tabs = ['producao', 'receber', 'custo', 'sabores'];
    const btns = document.querySelectorAll('.tab-btn');
    tabs.forEach((t, index) => {
        const form = document.getElementById(`form${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if(form) form.style.display = (t === tab) ? 'block' : 'none';
        if(btns[index]) {
            if(t === tab) btns[index].classList.add('active');
            else btns[index].classList.remove('active');
        }
    });
}

function renderizarGrafico(fat = 0, saldo = 0, cust = 0, luc = 0) {
    const canvas = document.getElementById('financeChart');
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-muted').trim();
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border-color').trim();
    
    if (meuGrafico) meuGrafico.destroy();
    
    meuGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Vendido', 'Em Caixa', 'Custos', 'Lucro'],
            datasets: [{
                data: [fat, saldo, cust, luc],
                backgroundColor: ['rgba(212, 122, 138, 0.85)', 'rgba(229, 195, 166, 0.85)', 'rgba(154, 59, 82, 0.85)', 'rgba(78, 154, 129, 0.85)'],
                borderRadius: 12, borderWidth: 0, barThickness: window.innerWidth < 768 ? 30 : 50
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { y: { ticks: { color: textColor, font: {family: 'Montserrat'} }, grid: { color: gridColor } }, x: { ticks: { color: textColor, font: {family: 'Montserrat'} }, grid: { display: false } } }
        }
    });
}

// ==========================================
// 7. INICIALIZAÇÃO
// ==========================================
window.onload = carregarDadosDoBanco;