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
// 3. BUSCANDO DADOS DO BANCO (NUVEM) E VARIÁVEIS DOS GRÁFICOS
// ==========================================
let dbSabores = [];
let dbVendas = [];
let dbCustos = [];
let financeChartObj, clientesChartObj, saboresChartObj; // Variáveis dos 3 gráficos

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

    document.getElementById('totalSaldo').style.color = saldoReal < 0 ? 'var(--cost-wine)' : 'var(--text-main)';
    document.getElementById('totalLucro').style.color = lucroProjetado < 0 ? 'var(--cost-wine)' : 'var(--text-main)';

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
                <div class="flavor-item" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding: 15px; border-radius: 12px; background: rgba(255,255,255,0.3); border: 1px solid var(--border-soft);">
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

        const saborDb = dbSabores.find(s => s.id === saborId);
        const precoFinal = Number(saborDb.preco) || 12;
        const valorVenda = qtd * precoFinal; 
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

        await supabaseClient.from('sabores').insert([{ nome: novoSabor, quantidade: 0, preco: precoNovoSabor }]);
        animarBotaoEAtualizar(btn, 'Adicionar Sabor <i class="fa-solid fa-plus"></i>', this);
    });
}

window.editarPreco = async function(idSabor, nomeSabor, precoAtual) {
    const novoPreco = prompt(`Qual o novo preço de venda para o sabor "${nomeSabor}"?`, precoAtual);
    
    if (novoPreco !== null && novoPreco.trim() !== "" && !isNaN(novoPreco)) {
        const precoFormatado = parseFloat(novoPreco);
        await supabaseClient.from('sabores').update({ preco: precoFormatado }).eq('id', idSabor);
        carregarDadosDoBanco(); 
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
// 6. FUNÇÕES EXTRAS E GRÁFICOS INTELIGENTES
// ==========================================

function animarBotaoEAtualizar(btn, textoOriginal, form) {
    btn.innerHTML = 'Sucesso! <i class="fa-solid fa-check"></i>';
    form.reset();
    carregarDadosDoBanco(); 
    setTimeout(() => { btn.innerHTML = textoOriginal; btn.disabled = false; }, 1500);
}

function renderizarTabelaClientes() {
    const container = document.getElementById('tabelaClientes');
    if(!container) return;
    container.innerHTML = '';

    if(dbVendas.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); width: 100%; padding: 20px;">Nenhuma venda registrada ainda.</p>';
        return;
    }

    dbVendas.forEach(venda => {
        const isPago = venda.status_pagamento === 'pago';
        const badgeClass = isPago ? 'badge-pago' : 'badge-pendente';
        const txtStatus = isPago ? 'Pago' : 'Fiado';
        const iconStatus = isPago ? '<i class="fa-solid fa-check-double"></i>' : '<i class="fa-solid fa-clock-rotate-left"></i>';
        
        let dataPrevista = '';
        if(!isPago && venda.data_pagamento_esperada) {
            const partes = venda.data_pagamento_esperada.split('-');
            if(partes.length === 3) {
                dataPrevista = `
                <div class="previsao-pagamento">
                    <i class="fa-regular fa-calendar-check"></i> Receber em: ${partes[2]}/${partes[1]}/${partes[0]}
                </div>`;
            }
        }

        container.innerHTML += `
            <div class="app-card-cliente">
                <div class="card-header">
                    <div class="cliente-info">
                        <h3>${venda.cliente_nome}</h3>
                        <span class="data-compra">${formatarData(venda.data_compra)}</span>
                    </div>
                    <span class="badge ${badgeClass}">${iconStatus} ${txtStatus}</span>
                </div>
                
                <div class="card-body">
                    <div class="pedido-info">
                        <p><i class="fa-solid fa-cake-candles" style="color: var(--brand-pink);"></i> ${venda.quantidade}x ${venda.sabor}</p>
                    </div>
                    <div class="valor-info">
                        <span class="valor-total">${formatarMoeda(venda.valor_total)}</span>
                    </div>
                </div>
                
                ${dataPrevista}
            </div>
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

// NOVA FUNÇÃO DOS 3 GRÁFICOS NO CARROSSEL
function renderizarGrafico(fat = 0, saldo = 0, cust = 0, luc = 0) {
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-muted').trim();
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border-soft').trim();
    const bgCardCor = getComputedStyle(document.body).getPropertyValue('--bg-card').trim();
    
    // Paleta de cores premium
    const coresGraficos = [
        'rgba(216, 92, 123, 0.85)', // Rosa Marca
        'rgba(217, 160, 91, 0.85)', // Champagne
        'rgba(62, 136, 99, 0.85)',  // Verde Lucro
        'rgba(201, 140, 67, 0.85)', // Ouro Pendente
        'rgba(142, 123, 130, 0.85)' // Muted
    ];

    // --- 1. Gráfico Financeiro (Barra Vertical) ---
    const ctxFinance = document.getElementById('financeChart');
    if(ctxFinance) {
        if (financeChartObj) financeChartObj.destroy();
        financeChartObj = new Chart(ctxFinance.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Vendido', 'Em Caixa', 'Custos', 'Lucro'],
                datasets: [{
                    data: [fat, saldo, cust, luc],
                    backgroundColor: coresGraficos,
                    borderRadius: 12, borderWidth: 0, barThickness: window.innerWidth < 768 ? 30 : 50
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { 
                    y: { ticks: { color: textColor, font: {family: 'Montserrat'} }, grid: { color: gridColor } }, 
                    x: { ticks: { color: textColor, font: {family: 'Montserrat'} }, grid: { display: false } } 
                }
            }
        });
    }

    // --- LÓGICA DE FILTRAGEM INTELIGENTE DOS DADOS ---
    const clientesMap = {};
    const saboresMap = {};

    dbVendas.forEach(venda => {
        // Tratamento Inteligente de Nomes (Remove espaços soltos, acentos e transforma para minúsculo para comparar)
        let nomeLimpo = venda.cliente_nome.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // Coloca a primeira letra Maiúscula para ficar bonito no gráfico
        let nomeExibicao = nomeLimpo.charAt(0).toUpperCase() + nomeLimpo.slice(1);

        if (!clientesMap[nomeExibicao]) clientesMap[nomeExibicao] = 0;
        clientesMap[nomeExibicao] += Number(venda.quantidade);

        let nomeSabor = venda.sabor;
        if (!saboresMap[nomeSabor]) saboresMap[nomeSabor] = 0;
        saboresMap[nomeSabor] += Number(venda.quantidade);
    });

    // Pega os Top 5 e ordena do maior para o menor
    const topClientes = Object.entries(clientesMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topSabores = Object.entries(saboresMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // --- 2. Gráfico Clientes (Barra Horizontal) ---
    const ctxClientes = document.getElementById('clientesChart');
    if(ctxClientes) {
        if (clientesChartObj) clientesChartObj.destroy();
        clientesChartObj = new Chart(ctxClientes.getContext('2d'), {
            type: 'bar',
            data: {
                labels: topClientes.map(c => c[0]),
                datasets: [{
                    label: 'Potes Comprados',
                    data: topClientes.map(c => c[1]),
                    backgroundColor: coresGraficos[1], // Cor Champagne
                    borderRadius: 8
                }]
            },
            options: {
                indexAxis: 'y', // Barra horizontal
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { 
                    x: { ticks: { stepSize: 1, color: textColor, font: {family: 'Montserrat'} }, grid: { color: gridColor } }, 
                    y: { ticks: { color: textColor, font: {family: 'Montserrat', weight: 'bold'} }, grid: { display: false } } 
                }
            }
        });
    }

    // --- 3. Gráfico Sabores (Doughnut / Rosquinha) ---
    const ctxSabores = document.getElementById('saboresChart');
    if(ctxSabores) {
        if (saboresChartObj) saboresChartObj.destroy();
        saboresChartObj = new Chart(ctxSabores.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: topSabores.map(s => s[0]),
                datasets: [{
                    data: topSabores.map(s => s[1]),
                    backgroundColor: coresGraficos,
                    borderWidth: 2,
                    borderColor: bgCardCor // Fica transparente/vidro onde tem a borda
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'right', 
                        labels: { color: textColor, font: {family: 'Montserrat'}, boxWidth: 12, padding: 15 } 
                    }
                },
                cutout: '65%' 
            }
        });
    }
}

// ==========================================
// 7. INICIALIZAÇÃO
// ==========================================
window.onload = carregarDadosDoBanco;
// ==========================================
// 8. CONTROLE DAS SETAS DO CARROSSEL
// ==========================================
window.moverCarrossel = function(direcao) {
    const carrossel = document.getElementById('chartsCarousel');
    if(carrossel) {
        // Pega a largura exata de 1 card visível + o espaçamento (gap)
        const larguraCard = carrossel.clientWidth; 
        // Move o carrossel (direcao: -1 para esquerda, 1 para direita)
        carrossel.scrollBy({ left: larguraCard * direcao, behavior: 'smooth' });
    }
}