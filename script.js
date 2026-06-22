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
// 3. BUSCANDO DADOS DO BANCO
// ==========================================
let dbSabores = [];
let dbVendas = [];
let dbCustos = [];
let twdCbaChartObj, financeChartObj, clientesChartObj, saboresChartObj;

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
// 4. ATUALIZANDO O PAINEL GERAL (A MATEMÁTICA REAL)
// ==========================================
function atualizarDashboard() {
    let faturamento = 0, aReceber = 0, saldoReal = 0, totalCustos = 0;
    
    // Contadores das empresas
    let unidadesTWD = 0, unidadesCBA = 0;
    let fatTWD = 0, fatCBA = 0;
    
    // Retenção de 10%
    let taxasRetidasTotal = 0;
    let taxasRetidasPagas = 0;

    // Lógica das Vendas
    dbVendas.forEach(venda => {
        const valor = Number(venda.valor_total);
        const qtd = Number(venda.quantidade);
        
        faturamento += valor;
        taxasRetidasTotal += (valor * 0.10);
        
        if (venda.status_pagamento === 'pago') {
            saldoReal += valor;
            taxasRetidasPagas += (valor * 0.10);
        } 
        else if (venda.status_pagamento === 'pendente') {
            aReceber += valor;
        }

        // Verifica para qual empresa foi vendido
        if(venda.categoria === 'CBA') {
            unidadesCBA += qtd;
            fatCBA += valor;
        } else {
            unidadesTWD += qtd;
            fatTWD += valor;
        }
    });

    // Lógica dos Custos (Ingredientes / Mercado)
    dbCustos.forEach(custo => {
        totalCustos += Number(custo.valor);
    });

    // === CÁLCULOS FINAIS ===
    saldoReal = saldoReal - taxasRetidasPagas - totalCustos;
    const lucroProjetado = faturamento - taxasRetidasTotal - totalCustos;

    // Atualiza Textos no Topo
    document.getElementById('totalSaldo').innerText = formatarMoeda(saldoReal);
    document.getElementById('totalReceber').innerText = formatarMoeda(aReceber);
    document.getElementById('totalFaturamento').innerText = formatarMoeda(faturamento);
    document.getElementById('totalCustos').innerText = formatarMoeda(totalCustos);
    document.getElementById('totalLucro').innerText = formatarMoeda(lucroProjetado);
    
    document.getElementById('totalUnidades').innerText = unidadesTWD;
    document.getElementById('totalBrigadeiros').innerText = unidadesCBA;

    document.getElementById('totalSaldo').style.color = saldoReal < 0 ? 'var(--cost-wine)' : 'var(--text-main)';
    document.getElementById('totalLucro').style.color = lucroProjetado < 0 ? 'var(--cost-wine)' : 'var(--text-main)';

    // RENDERIZAR NOVO DEMONSTRATIVO NA TABELA
    const tabelaCorpo = document.getElementById('resumoFinanceiroCorpo');
    if(tabelaCorpo) {
        tabelaCorpo.innerHTML = `
            <tr style="border-bottom: 1px solid var(--border-soft);">
                <td style="padding: 12px 8px; font-weight: 600;">Vendas p/ Empresa TWD</td>
                <td style="padding: 12px 8px; text-align: right;">${formatarMoeda(fatTWD)} <span style="font-size: 0.75rem; color: var(--text-muted);">(${unidadesTWD} un)</span></td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border-soft);">
                <td style="padding: 12px 8px; font-weight: 600;">Vendas p/ Empresa CBA</td>
                <td style="padding: 12px 8px; text-align: right;">${formatarMoeda(fatCBA)} <span style="font-size: 0.75rem; color: var(--text-muted);">(${unidadesCBA} un)</span></td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border-soft);">
                <td style="padding: 12px 8px; font-weight: 600; color: var(--pending-gold);">(-) Reserva (10%)</td>
                <td style="padding: 12px 8px; color: var(--pending-gold); text-align: right;">- ${formatarMoeda(taxasRetidasTotal)}</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border-soft);">
                <td style="padding: 12px 8px; font-weight: 600; color: var(--cost-wine);">(-) Despesas C/ Estoque</td>
                <td style="padding: 12px 8px; color: var(--cost-wine); text-align: right;">- ${formatarMoeda(totalCustos)}</td>
            </tr>
            <tr style="border-bottom: 2px solid var(--border-soft); background: rgba(255,255,255,0.1);">
                <td style="padding: 12px 8px; font-weight: 800; color: ${lucroProjetado >= 0 ? 'var(--profit-mint)' : 'var(--cost-wine)'};">(=) LUCRO REAL</td>
                <td style="padding: 12px 8px; font-weight: 800; text-align: right; color: ${lucroProjetado >= 0 ? 'var(--profit-mint)' : 'var(--cost-wine)'};">${formatarMoeda(lucroProjetado)}</td>
            </tr>
        `;
    }

    renderizarEstoque();
    renderizarFormularios();
    renderizarGrafico(faturamento, saldoReal, totalCustos, lucroProjetado, unidadesTWD, unidadesCBA);
}

function renderizarEstoque() {
    const stockContainer = document.getElementById('stockList');
    if(!stockContainer) return;
    stockContainer.innerHTML = '';
    
    if(dbSabores.length === 0) {
        stockContainer.innerHTML = '<p class="help-text">Nenhum sabor cadastrado.</p>';
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
        
        const nomeClienteDigitado = document.getElementById('nomeCliente').value.trim();
        const categoriaEscolhida = document.getElementById('categoriaVenda').value;
        const nomeCliente = `${nomeClienteDigitado} ${categoriaEscolhida}`; 
        
        const selectSabor = document.getElementById('saborVenda');
        const saborId = selectSabor.value;
        const qtd = parseInt(document.getElementById('qtdVenda').value);
        const status = document.getElementById('statusPagamento').value;
        const dataPgto = document.getElementById('dataPagamento').value;

        const saborDb = dbSabores.find(s => s.id === saborId);
        const precoFinal = Number(saborDb.preco) || 12;
        const valorVenda = qtd * precoFinal; 
        const novoEstoque = saborDb.quantidade - qtd;

        btn.innerHTML = 'Salvando... <i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        await Promise.all([
            supabaseClient.from('vendas').insert([{
                cliente_nome: nomeCliente, sabor: saborDb.nome, quantidade: qtd,
                valor_total: valorVenda, status_pagamento: status,
                categoria: categoriaEscolhida, 
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

window.editarNomeCliente = async function(idVenda, nomeAtual) {
    const novoNome = prompt("Corrigir nome do cliente:", nomeAtual);
    if (novoNome !== null && novoNome.trim() !== "" && novoNome !== nomeAtual) {
        await supabaseClient.from('vendas').update({ cliente_nome: novoNome.trim() }).eq('id', idVenda);
        carregarDadosDoBanco(); 
    }
}

window.editarPreco = async function(idSabor, nomeSabor, precoAtual) {
    const novoPreco = prompt(`Qual o novo preço de venda para o sabor "${nomeSabor}"?`, precoAtual);
    if (novoPreco !== null && novoPreco.trim() !== "" && !isNaN(novoPreco)) {
        const precoFormatado = parseFloat(novoPreco);
        await supabaseClient.from('sabores').update({ preco: precoFormatado }).eq('id', idSabor);
        carregarDadosDoBanco(); 
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
        btn.innerHTML = 'Baixando... <i class="fa-solid fa-spinner fa-spin"></i>';
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

        await supabaseClient.from('custos').insert([{ descricao: desc, valor: valor, categoria: 'geral' }]);
        animarBotaoEAtualizar(btn, 'Registrar Despesa <i class="fa-solid fa-minus"></i>', this);
    });
}

// ==========================================
// 6. FUNÇÕES EXTRAS E GRÁFICOS
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

        const nomeSeguro = venda.cliente_nome.replace(/'/g, "\\'");

        container.innerHTML += `
            <div class="app-card-cliente">
                <div class="card-header">
                    <div class="cliente-info">
                        <h3 style="display: flex; align-items: center; gap: 8px;">
                            ${venda.cliente_nome}
                            <button onclick="editarNomeCliente('${venda.id}', '${nomeSeguro}')" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.8rem; padding: 4px; transition: 0.3s;" onmouseover="this.style.color='var(--brand-pink)'" onmouseout="this.style.color='var(--text-muted)'" title="Editar Nome">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </h3>
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

function renderizarGrafico(fat = 0, saldo = 0, cust = 0, luc = 0, unidTWD = 0, unidCBA = 0) {
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-muted').trim();
    const gridColor = getComputedStyle(document.body).getPropertyValue('--border-soft').trim();
    const bgCardCor = getComputedStyle(document.body).getPropertyValue('--bg-card').trim();
    
    const corRosa = 'rgba(216, 92, 123, 0.85)';
    const corDourada = 'rgba(217, 160, 91, 0.85)';
    const corVerde = 'rgba(62, 136, 99, 0.85)';
    const corMuted = 'rgba(142, 123, 130, 0.85)';

    const ctxTwdCba = document.getElementById('twdCbaChart');
    if(ctxTwdCba) {
        if (twdCbaChartObj) twdCbaChartObj.destroy();
        twdCbaChartObj = new Chart(ctxTwdCba.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['TWD', 'CBA'],
                datasets: [{
                    label: 'Potes Vendidos',
                    data: [unidTWD, unidCBA],
                    backgroundColor: [corRosa, corDourada],
                    borderRadius: 12, borderWidth: 0, barThickness: window.innerWidth < 768 ? 40 : 60
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { 
                    y: { ticks: { color: textColor, font: {family: 'Montserrat'}, stepSize: 1 }, grid: { color: gridColor } }, 
                    x: { ticks: { color: textColor, font: {family: 'Montserrat', weight: 'bold'} }, grid: { display: false } } 
                }
            }
        });
    }

    const ctxFinance = document.getElementById('financeChart');
    if(ctxFinance) {
        if (financeChartObj) financeChartObj.destroy();
        financeChartObj = new Chart(ctxFinance.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Faturamento', 'Custos', 'Lucros'],
                datasets: [{
                    label: 'Valor (R$)',
                    data: [fat, cust, luc],
                    backgroundColor: [corVerde, corRosa, corDourada],
                    borderRadius: 12, borderWidth: 0, barThickness: window.innerWidth < 768 ? 30 : 50
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { 
                    y: { ticks: { color: textColor, font: {family: 'Montserrat'} }, grid: { color: gridColor } }, 
                    x: { ticks: { color: textColor, font: {family: 'Montserrat', weight: 'bold'} }, grid: { display: false } } 
                }
            }
        });
    }

    const clientesMap = {};
    const saboresMap = {};

    dbVendas.forEach(venda => {
        let nomeLimpo = venda.cliente_nome.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let nomeExibicao = nomeLimpo.charAt(0).toUpperCase() + nomeLimpo.slice(1);
        if (!clientesMap[nomeExibicao]) clientesMap[nomeExibicao] = 0;
        clientesMap[nomeExibicao] += Number(venda.quantidade);

        let nomeSabor = venda.sabor;
        if (!saboresMap[nomeSabor]) saboresMap[nomeSabor] = 0;
        saboresMap[nomeSabor] += Number(venda.quantidade);
    });

    const topClientes = Object.entries(clientesMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topSabores = Object.entries(saboresMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

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
                    backgroundColor: corDourada, 
                    borderRadius: 8
                }]
            },
            options: {
                indexAxis: 'y', 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { 
                    x: { ticks: { stepSize: 1, color: textColor, font: {family: 'Montserrat'} }, grid: { color: gridColor } }, 
                    y: { ticks: { color: textColor, font: {family: 'Montserrat', weight: 'bold'} }, grid: { display: false } } 
                }
            }
        });
    }

    const ctxSabores = document.getElementById('saboresChart');
    if(ctxSabores) {
        if (saboresChartObj) saboresChartObj.destroy();
        saboresChartObj = new Chart(ctxSabores.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: topSabores.map(s => s[0]),
                datasets: [{
                    data: topSabores.map(s => s[1]),
                    backgroundColor: [corRosa, corDourada, corVerde, corMuted, '#8E7B82'],
                    borderWidth: 2,
                    borderColor: bgCardCor 
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: textColor, font: {family: 'Montserrat'}, boxWidth: 12, padding: 15 } }
                },
                cutout: '65%' 
            }
        });
    }
}

window.onload = carregarDadosDoBanco;

// ==========================================
// 7. SISTEMA AUTOMÁTICO DE SWIPE E BOLINHAS (INTERSECTION OBSERVER)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.getElementById('mainSwipeCarousel');
    const dots = document.querySelectorAll('#mainCarouselDots .dot');
    const items = document.querySelectorAll('.chic-swipe-item');
    
    if (carousel && dots.length > 0 && items.length > 0) {
        const observerOptions = {
            root: carousel,
            threshold: 0.5
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const activeIndex = Array.from(items).indexOf(entry.target);
                    
                    dots.forEach((dot, index) => {
                        if (index === activeIndex) {
                            dot.classList.add('active');
                        } else {
                            dot.classList.remove('active');
                        }
                    });
                }
            });
        }, observerOptions);
        
        items.forEach(item => observer.observe(item));
    }
});

// Navegação direta ao clicar sobre as próprias bolinhas
window.scrollToSlide = function(index) {
    const carousel = document.getElementById('mainSwipeCarousel');
    const items = document.querySelectorAll('.chic-swipe-item');
    if (carousel && items[index]) {
        const targetScroll = items[index].offsetLeft - carousel.offsetLeft;
        carousel.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
        });
    }
};