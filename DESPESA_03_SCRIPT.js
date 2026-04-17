
// ============ DADOS CARREGADOS VIA FETCH ============
let REGISTROS = [];

(function () {
  var overlay = document.createElement('div');
  overlay.id  = '_etl_loading';
  overlay.style.cssText = [
    'position:fixed', 'inset:0',
    'background:rgba(255,255,255,0.93)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'z-index:9999', 'font-family:sans-serif', 'font-size:1rem', 'color:#555',
    'flex-direction:column', 'gap:12px'
  ].join(';');
  overlay.innerHTML = '<div style="font-size:2rem">⏳</div><div>Carregando dados da despesa…</div>';
  document.body.appendChild(overlay);

  // Busca JSON.GZ do repositorio e descomprime via DecompressionStream
  function fetchJsonGz(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url.split('/').pop() + ' - HTTP ' + r.status);
      var ds = new DecompressionStream('gzip');
      return new Response(r.body.pipeThrough(ds)).text();
    }).then(function (text) {
      return JSON.parse(text);
    });
  }

  Promise.all([
    fetchJsonGz('../data/gz/despesa.json.gz'),
    fetchJsonGz('../data/gz/creditos_adicionais.json.gz')
  ])
    .then(function (results) {
      var seen = {};
      results.forEach(function (json) {
        json.dados.forEach(function (r) {
          var key = [
            r.cocontacontabil,
            r.cocontacorrente,
            r.inmes,
            r.coexercicio,
            r.coug
          ].join('|');
          if (!seen[key]) {
            seen[key] = true;
            REGISTROS.push(r);
          }
        });
      });
      overlay.remove();
      aplicarFiltros();
    })
    .catch(function (err) {
      overlay.innerHTML =
        '<div style="font-size:1.5rem">❌</div><div>Erro ao carregar dados:<br><code>' +
        err.message + '</code></div>';
      overlay.style.color = '#c62828';
    });
})();

const ANO_ATUAL    = "2026";
const ANO_ANTERIOR = "2025";
const MAX_MES      = 3;

const NOMES_MES = {
    1:'Janeiro',2:'Fevereiro',3:'Março',4:'Abril',
    5:'Maio',6:'Junho',7:'Julho',8:'Agosto',
    9:'Setembro',10:'Outubro',11:'Novembro',12:'Dezembro'
};

// ============ POPULAR DROPDOWNS ============

// Mês — fixo (não depende dos outros filtros)
(function() {
    const sel = document.getElementById('fMes');
    for (let m = 1; m <= MAX_MES; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m + ' - ' + NOMES_MES[m];
        sel.appendChild(opt);
    }
    sel.value = MAX_MES;
})();

// Despesas ignoradas (global)
const DESPESAS_IGNORAR_GLOBAL = ['11130300', '16210200'];

// Helper: repopula um <select> preservando a seleção anterior
function repopularSelect(selId, itens, valorAnterior) {
    const sel = document.getElementById(selId);
    const primeiraOpt = sel.options[0]; // "Todas/Todos"
    sel.innerHTML = '';
    sel.appendChild(primeiraOpt);
    itens.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.valor;
        opt.textContent = item.texto;
        sel.appendChild(opt);
    });
    // Restaurar seleção se ainda existir
    if (valorAnterior && [...sel.options].some(o => o.value === valorAnterior)) {
        sel.value = valorAnterior;
    } else {
        sel.value = '';
    }
}

// Lê os filtros atuais e retorna os registros filtrados EXCLUINDO o filtro 'excluir'
// Isso permite que cada dropdown mostre as opções compatíveis com os DEMAIS filtros
function filtrarExcluindo(excluir) {
    const mesSel   = parseInt(document.getElementById('fMes').value);
    const ugSel    = document.getElementById('fUG').value;
    const fonteSel = document.getElementById('fFonte').value;
    const supSel   = document.getElementById('chkSuperavit').checked;
    const intraSel = document.querySelector('input[name="rIntra"]:checked').value;
    const catEconSel = document.querySelector('input[name="rCatEcon"]:checked').value;
    const gndSel   = document.getElementById('fGND').value;
    const despSel  = document.getElementById('fDesp').value;
    const funcSel  = document.getElementById('fFuncao').value;
    const subfSel  = document.getElementById('fSubfuncao').value;

    let f = REGISTROS.filter(r => r.inmes <= mesSel && !DESPESAS_IGNORAR_GLOBAL.includes(r.despesa));
    if (ugSel    && excluir !== 'ug')       f = f.filter(r => r.coug === ugSel);
    if (supSel   && excluir !== 'superavit') f = f.filter(r => isFonteSuperavit(r));
    if (fonteSel && excluir !== 'fonte')    f = f.filter(r => r.fonte_agrupada === fonteSel);
    if (intraSel === 'somente' && excluir !== 'intra') f = f.filter(r => isIntra(r));
    if (intraSel === 'excluir' && excluir !== 'intra') f = f.filter(r => !isIntra(r));
    if (catEconSel && excluir !== 'catecon') f = f.filter(r => isCatEconDesp(r, catEconSel));
    if (gndSel   && excluir !== 'gnd')      f = f.filter(r => r.gnd === gndSel);
    if (despSel  && excluir !== 'desp')     f = f.filter(r => r.despesa === despSel);
    if (funcSel  && excluir !== 'funcao')   f = f.filter(r => r.cofuncao === funcSel);
    if (subfSel  && excluir !== 'subfuncao') f = f.filter(r => r.cosubfuncao === subfSel);
    return f;
}

// Atualiza TODOS os dropdowns dinamicamente com base nos filtros atuais
function atualizarDropdowns() {
    // UG: mostrar apenas UGs presentes nos registros filtrados (sem considerar UG)
    const regParaUG = filtrarExcluindo('ug');
    const ugsVisiveis = {};
    regParaUG.forEach(r => { if (r.coug && r.noug) ugsVisiveis[r.coug] = r.noug; });
    repopularSelect('fUG',
        Object.keys(ugsVisiveis).sort().map(c => ({ valor: c, texto: c + ' - ' + ugsVisiveis[c] })),
        document.getElementById('fUG').value
    );

    // Fonte: mostrar apenas fontes presentes nos registros filtrados (sem considerar Fonte)
    const regParaFonte = filtrarExcluindo('fonte');
    const fontesVisiveis = {};
    regParaFonte.forEach(r => {
        if (r.fonte_agrupada) {
            const display = (r.cofontefederal ? r.cofontefederal + '.' + r.fonte_agrupada : r.fonte_agrupada);
            const nome = r.nome_fonte || '';
            fontesVisiveis[r.fonte_agrupada] = { display, nome };
        }
    });
    repopularSelect('fFonte',
        Object.keys(fontesVisiveis).sort((a,b) => {
            const da = fontesVisiveis[a].display, db = fontesVisiveis[b].display;
            return da.localeCompare(db);
        }).map(c => ({ valor: c, texto: fontesVisiveis[c].display + (fontesVisiveis[c].nome ? ' — ' + fontesVisiveis[c].nome : '') })),
        document.getElementById('fFonte').value
    );

    // GND: mostrar apenas GNDs presentes (sem considerar GND)
    const regParaGND = filtrarExcluindo('gnd');
    const gndsVisiveis = {};
    regParaGND.forEach(r => {
        if (r.gnd && r.nome_gnd && (r.gnd.startsWith('3') || r.gnd.startsWith('4')))
            gndsVisiveis[r.gnd] = r.nome_gnd;
    });
    repopularSelect('fGND',
        Object.keys(gndsVisiveis).sort().map(c => ({ valor: c, texto: gndsVisiveis[c] })),
        document.getElementById('fGND').value
    );

    // Despesa: depende de GND selecionado + demais filtros (sem considerar Desp)
    const gndSel = document.getElementById('fGND').value;
    const divDesp = document.getElementById('filtroDesp');
    if (gndSel) {
        divDesp.style.display = '';
        const regParaDesp = filtrarExcluindo('desp');
        const despsVisiveis = {};
        regParaDesp.forEach(r => {
            if (r.gnd === gndSel && r.despesa && r.nome_despesa)
                despsVisiveis[r.despesa] = r.nome_despesa;
        });
        repopularSelect('fDesp',
            Object.keys(despsVisiveis).sort().map(c => ({ valor: c, texto: c + ' - ' + despsVisiveis[c] })),
            document.getElementById('fDesp').value
        );
    } else {
        divDesp.style.display = 'none';
        document.getElementById('fDesp').value = '';
    }

    // Função: mostrar apenas funções presentes (sem considerar Função)
    const regParaFunc = filtrarExcluindo('funcao');
    const funcsVisiveis = {};
    regParaFunc.forEach(r => {
        if (r.cofuncao && r.nofuncao) funcsVisiveis[r.cofuncao] = r.nofuncao;
    });
    repopularSelect('fFuncao',
        Object.keys(funcsVisiveis).sort().map(c => ({ valor: c, texto: c + ' - ' + funcsVisiveis[c] })),
        document.getElementById('fFuncao').value
    );

    // Subfunção: depende de Função selecionada + demais filtros (sem considerar Subfunção)
    const funcSel = document.getElementById('fFuncao').value;
    const divSub = document.getElementById('filtroSubfuncao');
    if (funcSel) {
        divSub.style.display = '';
        const regParaSub = filtrarExcluindo('subfuncao');
        const subsVisiveis = {};
        regParaSub.forEach(r => {
            if (r.cofuncao === funcSel && r.cosubfuncao && r.nosubfuncao)
                subsVisiveis[r.cosubfuncao] = r.nosubfuncao;
        });
        repopularSelect('fSubfuncao',
            Object.keys(subsVisiveis).sort().map(c => ({ valor: c, texto: c + ' - ' + subsVisiveis[c] })),
            document.getElementById('fSubfuncao').value
        );
    } else {
        divSub.style.display = 'none';
        document.getElementById('fSubfuncao').value = '';
    }
}

// ============ CLASSIFICAÇÃO DE CONTAS ============
function isEmpenhada(r)  { return r.cocontacontabil >= '622130000' && r.cocontacontabil <= '622139999'; }
function isLiquidada(r)  { return r.cocontacontabil === '622130300' || r.cocontacontabil === '622130400' || r.cocontacontabil === '622130700'; }
function isPaga(r)       { return r.cocontacontabil === '622920104'; }
function isAutorizada(r) {
    const c = r.cocontacontabil;
    return (c >= '522110000' && c <= '522129999')
        || (c >= '522150000' && c <= '522159999')
        || (c >= '522190000' && c <= '522199999');
}
function isIntra(r)      { return r.intra === '91'; }

// Função auxiliar: verifica categoria econômica da despesa pelo conatureza
// Corrente: conatureza entre 300000 e 399999 (primeiro dígito = '3')
// Capital:  conatureza entre 400000 e 499999 (primeiro dígito = '4')
function isCatEconDesp(r, tipo) {
    const nat = (r.conatureza || r.despesa || '').substring(0, 1);
    if (tipo === 'corrente') return nat === '3';
    if (tipo === 'capital')  return nat === '4';
    return true;
}

// Função auxiliar: verifica se a fonte é de superávit financeiro
// Fontes de superávit: cofonte entre 300000000-499999999 ou 800000000-899999999
// Ou seja, primeiro dígito da fonte (9 dígitos) = '3', '4' ou '8'
function isFonteSuperavit(r) {
    const f = r.fonte || '';
    const d = f.charAt(0);
    return d === '3' || d === '4' || d === '8';
}

// ============ FORMATAÇÃO ============
function fmtMoeda(v) {
    if (!v && v !== 0) return 'R$ 0,00';
    return 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function clsVal(v) { return v < 0 ? 'valor-negativo' : 'valor-positivo'; }
function fmtVar(atual, anterior) {
    if (!anterior || anterior === 0) return atual > 0 ? '—' : '—';
    const pct = ((atual - anterior) / Math.abs(anterior)) * 100;
    return pct.toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + '%';
}
function clsVar(atual, anterior) {
    if (!anterior || anterior === 0) return '';
    return (atual - anterior) < 0 ? 'valor-negativo' : 'valor-positivo';
}
function fmtAbrev(v) {
    if (!v && v !== 0) return 'R$ 0';
    const abs = Math.abs(v);
    const sinal = v < 0 ? '-' : '';
    if (abs >= 1e9) return sinal + 'R$ ' + (abs / 1e9).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' bi';
    if (abs >= 1e6) return sinal + 'R$ ' + (abs / 1e6).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' mi';
    if (abs >= 1e3) return sinal + 'R$ ' + (abs / 1e3).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + ' mil';
    return fmtMoeda(v);
}

// ============ GAUGE SVG (Velocímetro) ============
function desenharGauge(pct) {
    const svg = document.getElementById('gaugeChart');
    const clampPct = Math.max(0, Math.min(pct, 100));
    const cx = 150, cy = 160, r = 120;

    // Ângulos em radianos SVG (clockwise a partir de 3h)
    // Equivalente ao ECharts startAngle:220 endAngle:-40 (260° de arco)
    const startAng = 140 * Math.PI / 180;   // ~7:20h (lower-left)
    const endAng   =  40 * Math.PI / 180;   // ~4:40h (lower-right)
    const totalAng = (2 * Math.PI - startAng) + endAng;  // ~260°

    function angFromPct(p) {
        return startAng + totalAng * (p / 100);
    }
    function ptAtAng(ang, raio) {
        return { x: cx + raio * Math.cos(ang), y: cy + raio * Math.sin(ang) };
    }
    function arcPath(a1, a2, raio) {
        const p1 = ptAtAng(a1, raio), p2 = ptAtAng(a2, raio);
        const large = (a2 - a1) > Math.PI ? 1 : 0;
        return `M${p1.x},${p1.y} A${raio},${raio} 0 ${large},1 ${p2.x},${p2.y}`;
    }

    let s = '';

    // Segmentos coloridos (vermelho → verde) — mesmas cores do ECharts ref
    const segments = [
        { de: 0,  ate: 30,  cor: '#ef4444' },   // vermelho
        { de: 30, ate: 60,  cor: '#f59e0b' },   // amarelo/laranja
        { de: 60, ate: 80,  cor: '#22c55e' },   // verde claro
        { de: 80, ate: 100, cor: '#15803d' },   // verde escuro
    ];
    segments.forEach(seg => {
        const a1 = angFromPct(seg.de), a2 = angFromPct(seg.ate);
        s += `<path d="${arcPath(a1, a2, r)}" fill="none" stroke="${seg.cor}" stroke-width="18" stroke-linecap="butt"/>`;
    });

    // Ticks brancos por cima do arco (separadores, como no ECharts ref)
    [0, 20, 40, 60, 80, 100].forEach(p => {
        const ang = angFromPct(p);
        const inner = ptAtAng(ang, r - 9);
        const outer = ptAtAng(ang, r + 9);
        s += `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="#fff" stroke-width="2.5"/>`;
    });

    // Labels de percentual (fora do arco)
    [0, 20, 40, 60, 80, 100].forEach(p => {
        const ang = angFromPct(p);
        const label = ptAtAng(ang, r + 22);
        s += `<text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#64748b" font-weight="500">${p}%</text>`;
    });

    // Ticks menores (a cada 10%, entre os maiores)
    [10, 30, 50, 70, 90].forEach(p => {
        const ang = angFromPct(p);
        const inner = ptAtAng(ang, r - 6);
        const outer = ptAtAng(ang, r + 6);
        s += `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="#fff" stroke-width="1.5"/>`;
    });

    // Cor do ponteiro baseada no valor
    let corNeedle = '#ef4444';
    if (clampPct >= 80) corNeedle = '#15803d';
    else if (clampPct >= 60) corNeedle = '#22c55e';
    else if (clampPct >= 30) corNeedle = '#f59e0b';

    // Ponteiro (needle) — desenhado apontando para a DIREITA (0°),
    // depois girado via animateTransform para a posição correta
    const needleLen = r - 22;
    s += `<g>`;
    s += `<polygon points="${cx + needleLen},${cy} ${cx - 8},${cy - 5} ${cx - 8},${cy + 5}" fill="${corNeedle}" stroke="${corNeedle}" stroke-width="0.5" stroke-linejoin="round">`;
    // Anima a rotação do ângulo 0% até o ângulo alvo
    const fromDeg = angFromPct(0) * 180 / Math.PI;
    const toDeg   = angFromPct(clampPct) * 180 / Math.PI;
    s += `<animateTransform attributeName="transform" type="rotate" from="${fromDeg} ${cx} ${cy}" to="${toDeg} ${cx} ${cy}" dur="1.2s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1"/>`;
    s += `</polygon>`;
    // Centro do ponteiro (círculo)
    s += `<circle cx="${cx}" cy="${cy}" r="10" fill="${corNeedle}" stroke="#fff" stroke-width="2.5">`;
    s += `<animate attributeName="fill" from="#ccc" to="${corNeedle}" dur="1.2s" fill="freeze"/>`;
    s += `</circle>`;
    s += `<circle cx="${cx}" cy="${cy}" r="3" fill="#fff"/>`;
    s += `</g>`;

    svg.innerHTML = s;
    document.getElementById('cardExecucao').style.color = corNeedle;
}

const CORES_BAR = ['#006633','#2e7d32','#43a047','#66bb6a','#81c784','#a5d6a7','#1b5e20','#388e3c'];
const CORES_TM = ['#006633','#1b5e20','#2e7d32','#388e3c','#43a047','#4caf50','#66bb6a',
    '#81c784','#00695c','#00796b','#00897b','#009688','#26a69a','#4db6ac',
    '#0277bd','#0288d1','#039be5','#03a9f4','#558b2f','#689f38'];

// ============ GRÁFICOS ============
function desenharBarras(dados) {
    const container = document.getElementById('barChart');
    if (!dados.length) { container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Sem dados</div>'; return; }
    const maxVal = Math.max(...dados.map(d => Math.abs(d.valor)));
    let html = '';
    dados.slice(0, 10).forEach((d, i) => {
        const pct = maxVal > 0 ? (Math.abs(d.valor) / maxVal * 100) : 0;
        const cor = CORES_BAR[i % CORES_BAR.length];
        const valFmt = fmtMoeda(d.valor);
        html += `<div class="bar-row">
            <div class="bar-label" title="${d.nome}">${d.nome}</div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${Math.max(pct, 2)}%;background:${cor};"></div>
            </div>
            <span class="bar-valor-fora">${valFmt}</span>
        </div>`;
    });
    container.innerHTML = html;
}

function desenharTreemap(dados) {
    const container = document.getElementById('treemapChart');
    if (!dados.length) { container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;width:100%;">Sem dados</div>'; return; }
    const total = dados.reduce((s, d) => s + Math.abs(d.valor), 0);
    if (total === 0) { container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;width:100%;">Sem dados</div>'; return; }

    dados.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    // Limitar ao top 7 categorias; agrupar restante em "Outros"
    const MAX_ITEMS = 7;
    let principais = dados.slice(0, MAX_ITEMS);
    const restante = dados.slice(MAX_ITEMS);
    if (restante.length > 0) {
        const outrosValor = restante.reduce((s, d) => s + Math.abs(d.valor), 0);
        principais.push({ nome: 'Outros', valor: outrosValor });
    }

    let html = '';
    principais.forEach((d, i) => {
        const pct = (Math.abs(d.valor) / total) * 100;
        if (pct < 0.5) return;
        const cor = CORES_TM[i % CORES_TM.length];
        const pctFmt = pct.toFixed(1) + '%';
        html += `<div class="treemap-item" style="flex:${pct} 1 0%;background:${cor};"
            title="${d.nome}: ${fmtMoeda(d.valor)} (${pctFmt})">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;display:block;font-size:${pct > 12 ? '12' : '10'}px;">${pct > 4 ? d.nome : ''}</span>
            <small>${pctFmt}</small>
        </div>`;
    });
    container.innerHTML = html;
}

function desenharLinhas(dadosMensaisAtual, dadosMensaisAnterior) {
    const svg = document.getElementById('lineChart');
    const W = 700, H = 200, padL = 70, padR = 20, padT = 20, padB = 30;
    const gW = W - padL - padR, gH = H - padT - padB;
    const allMeses = [...new Set([...Object.keys(dadosMensaisAtual), ...Object.keys(dadosMensaisAnterior)])]
        .map(Number).sort((a,b) => a - b);
    if (allMeses.length === 0) { svg.innerHTML = ''; return; }
    const minM = Math.min(...allMeses), maxM = Math.max(...allMeses);
    const meses = []; for (let m = minM; m <= maxM; m++) meses.push(m);
    let acumAtual = 0, acumAnt = 0;
    const ptsAtual = [], ptsAnterior = [];
    meses.forEach(m => {
        acumAtual += (dadosMensaisAtual[m] || 0);
        acumAnt += (dadosMensaisAnterior[m] || 0);
        ptsAtual.push({ m, v: acumAtual });
        ptsAnterior.push({ m, v: acumAnt });
    });
    const allVals = [...ptsAtual.map(p=>p.v), ...ptsAnterior.map(p=>p.v)];
    const maxV = Math.max(...allVals, 1);
    const minV = Math.min(0, ...allVals);
    const rangeV = maxV - minV || 1;
    function xPos(m) { return padL + ((m - minM) / (maxM - minM || 1)) * gW; }
    function yPos(v) { return padT + gH - ((v - minV) / rangeV) * gH; }
    let sc = '';
    const nGrid = 4;
    for (let i = 0; i <= nGrid; i++) {
        const val = minV + (rangeV / nGrid) * i;
        const y = yPos(val);
        sc += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" class="grid-line"/>`;
        sc += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end">${(val / 1e6).toFixed(0)}M</text>`;
    }
    const MC = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    meses.forEach(m => { sc += `<text x="${xPos(m)}" y="${H - 4}" text-anchor="middle">${MC[m]||m}</text>`; });
    function pathStr(pts) { return pts.map((p, i) => (i===0?'M':'L')+` ${xPos(p.m)} ${yPos(p.v)}`).join(' '); }
    sc += `<path d="${pathStr(ptsAnterior)}" class="line-anterior"/>`;
    sc += `<path d="${pathStr(ptsAtual)}" class="line-atual"/>`;
    ptsAnterior.forEach(p => { sc += `<circle cx="${xPos(p.m)}" cy="${yPos(p.v)}" class="dot-ant"/>`; });
    ptsAtual.forEach(p => { sc += `<circle cx="${xPos(p.m)}" cy="${yPos(p.v)}" class="dot"/>`; });
    sc += `<line x1="${padL}" y1="12" x2="${padL+20}" y2="12" stroke="#006633" stroke-width="2.5"/>`;
    sc += `<text x="${padL+24}" y="16" font-size="11" fill="#006633">${ANO_ATUAL}</text>`;
    sc += `<line x1="${padL+80}" y1="12" x2="${padL+100}" y2="12" stroke="#999" stroke-width="2" stroke-dasharray="6,3"/>`;
    sc += `<text x="${padL+104}" y="16" font-size="11" fill="#999">${ANO_ANTERIOR}</text>`;
    svg.innerHTML = sc;
}

// ============ GRÁFICO DE PIZZA 3D ============
const CORES_PIZZA = [
    '#006633','#d32f2f','#1565c0','#ff8f00','#6a1b9a','#00838f',
    '#c62828','#2e7d32','#ef6c00','#283593','#00695c','#ad1457',
    '#4e342e','#0277bd','#558b2f','#7b1fa2','#e65100','#1b5e20',
    '#ff6f00','#0d47a1','#b71c1c','#33691e','#4a148c','#004d40',
    '#bf360c','#01579b','#827717','#880e4f','#3e2723','#455a64'
];

function desenharPizza(dados, titulo) {
    const container = document.getElementById('pizzaChart');
    const tituloEl = document.getElementById('pizzaTitulo');
    tituloEl.textContent = titulo;

    if (!dados.length) {
        container.innerHTML = '<div style="color:#999;text-align:center;padding:40px;">Sem dados</div>';
        return;
    }

    // Ordenar por valor decrescente
    dados.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

    // Agrupar em "Outros" se mais de 10 fatias
    const MAX_FATIAS = 10;
    let fatias = dados.slice(0, MAX_FATIAS);
    const restante = dados.slice(MAX_FATIAS);
    if (restante.length > 0) {
        const outrosVal = restante.reduce((s, d) => s + Math.abs(d.valor), 0);
        fatias.push({ nome: 'OUTROS', valor: outrosVal });
    }

    const total = fatias.reduce((s, d) => s + Math.abs(d.valor), 0);
    if (total === 0) {
        container.innerHTML = '<div style="color:#999;text-align:center;padding:40px;">Sem dados</div>';
        return;
    }

    // --- SVG da pizza 3D (sem labels) ---
    const cx = 160, cy = 140;
    const rx = 140, ry = 85;
    const depth = 22;
    const svgW = 320, svgH = 300;

    let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">`;

    // Calcular ângulos
    const slices = [];
    let angAcum = -Math.PI / 2;
    fatias.forEach((d, i) => {
        const pct = Math.abs(d.valor) / total;
        const angulo = pct * 2 * Math.PI;
        slices.push({
            nome: d.nome, valor: d.valor, pct: pct,
            angInicio: angAcum, angFim: angAcum + angulo,
            cor: CORES_PIZZA[i % CORES_PIZZA.length],
        });
        angAcum += angulo;
    });

    function escurecerCor(hex, fator) {
        const r = Math.max(0, Math.round(parseInt(hex.slice(1,3), 16) * fator));
        const g = Math.max(0, Math.round(parseInt(hex.slice(3,5), 16) * fator));
        const b = Math.max(0, Math.round(parseInt(hex.slice(5,7), 16) * fator));
        return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
    }
    function ptX(ang) { return cx + rx * Math.cos(ang); }
    function ptY(ang) { return cy + ry * Math.sin(ang); }

    // 1. Laterais 3D
    slices.forEach(s => {
        const corLat = escurecerCor(s.cor, 0.65);
        const a1 = s.angInicio, a2 = s.angFim;
        const steps = Math.max(2, Math.ceil((a2 - a1) / 0.05));
        for (let i = 0; i < steps; i++) {
            const t1 = a1 + (a2 - a1) * (i / steps);
            const t2 = a1 + (a2 - a1) * ((i + 1) / steps);
            if (Math.sin(t1) > -0.1 || Math.sin(t2) > -0.1) {
                const x1 = ptX(t1), y1 = ptY(t1);
                const x2 = ptX(t2), y2 = ptY(t2);
                svg += `<polygon points="${x1},${y1} ${x2},${y2} ${x2},${y2+depth} ${x1},${y1+depth}" fill="${corLat}" stroke="${corLat}" stroke-width="0.5"/>`;
            }
        }
    });
    // Bordas laterais dos cortes
    slices.forEach(s => {
        const corLat = escurecerCor(s.cor, 0.65);
        [s.angInicio, s.angFim].forEach(ang => {
            if (Math.sin(ang) > -0.2) {
                const ex = ptX(ang), ey = ptY(ang);
                svg += `<polygon points="${cx},${cy} ${ex},${ey} ${ex},${ey+depth} ${cx},${cy+depth}" fill="${corLat}" stroke="${escurecerCor(s.cor, 0.5)}" stroke-width="0.3"/>`;
            }
        });
    });

    // 2. Faces superiores
    slices.forEach(s => {
        const largeArc = s.pct > 0.5 ? 1 : 0;
        const x1 = ptX(s.angInicio), y1 = ptY(s.angInicio);
        const x2 = ptX(s.angFim), y2 = ptY(s.angFim);
        if (s.pct >= 0.999) {
            svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${s.cor}" stroke="#fff" stroke-width="1"/>`;
        } else {
            svg += `<path d="M${cx},${cy} L${x1},${y1} A${rx},${ry} 0 ${largeArc},1 ${x2},${y2} Z" fill="${s.cor}" stroke="#fff" stroke-width="1.5"/>`;
        }
    });

    svg += '</svg>';

    // --- Legenda lateral (tabela HTML) ---
    let legenda = '<div class="pizza-legenda"><table>';
    legenda += '<thead><tr><th></th><th style="text-align:left;">Classificação</th><th style="text-align:right;">Valor</th><th style="text-align:right;">%</th></tr></thead><tbody>';
    slices.forEach(s => {
        const pctFmt = (s.pct * 100).toFixed(2).replace('.', ',') + '%';
        const valFmt = fmtAbrev(s.valor);
        legenda += `<tr>
            <td><span class="pizza-cor" style="background:${s.cor};"></span></td>
            <td class="pizza-nome">${s.nome}</td>
            <td class="pizza-valor">${valFmt}</td>
            <td class="pizza-pct">${pctFmt}</td>
        </tr>`;
    });
    // Linha total
    legenda += `<tr class="pizza-total">
        <td></td>
        <td class="pizza-nome">TOTAL</td>
        <td class="pizza-valor">${fmtAbrev(total)}</td>
        <td class="pizza-pct">100,00%</td>
    </tr>`;
    legenda += '</tbody></table></div>';

    container.innerHTML = svg + legenda;
}

function atualizarGraficos(filtrados) {
    // Barras: liquidada por GND (ano atual)
    const porGnd = {};
    filtrados.filter(r => r.coexercicio === ANO_ATUAL && isLiquidada(r)).forEach(r => {
        const nome = r.nome_gnd || r.gnd || '?';
        porGnd[nome] = (porGnd[nome] || 0) + r.saldo;
    });
    desenharBarras(Object.entries(porGnd).map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)));

    // Treemap: por despesa (ano atual, liquidada)
    const porDesp = {};
    filtrados.filter(r => r.coexercicio === ANO_ATUAL && isLiquidada(r)).forEach(r => {
        const nome = r.nome_despesa || r.despesa || '?';
        if (nome && nome !== '?') porDesp[nome] = (porDesp[nome] || 0) + r.saldo;
    });
    desenharTreemap(Object.entries(porDesp).map(([nome, valor]) => ({ nome, valor })));

    // Linha: liquidada mensal acumulada
    const mensalAtual = {}, mensalAnterior = {};
    filtrados.filter(r => isLiquidada(r)).forEach(r => {
        if (r.coexercicio === ANO_ATUAL)   mensalAtual[r.inmes] = (mensalAtual[r.inmes] || 0) + r.saldo;
        if (r.coexercicio === ANO_ANTERIOR) mensalAnterior[r.inmes] = (mensalAnterior[r.inmes] || 0) + r.saldo;
    });
    desenharLinhas(mensalAtual, mensalAnterior);

    // Pizza: Função ou Subfunção (dinâmico)
    const funcSel = document.getElementById('fFuncao').value;
    const liqAtual = filtrados.filter(r => r.coexercicio === ANO_ATUAL && isLiquidada(r));

    if (funcSel) {
        // Função selecionada → mostrar Subfunções
        const porSub = {};
        liqAtual.forEach(r => {
            const nome = r.nosubfuncao || r.cosubfuncao || '?';
            if (nome && nome !== '?') porSub[nome] = (porSub[nome] || 0) + r.saldo;
        });
        desenharPizza(
            Object.entries(porSub).map(([nome, valor]) => ({ nome, valor })),
            'Despesa Liquidada por Subfunção (' + ANO_ATUAL + ')'
        );
    } else {
        // Nenhuma função selecionada → mostrar Funções
        const porFunc = {};
        liqAtual.forEach(r => {
            const nome = r.nofuncao || r.cofuncao || '?';
            if (nome && nome !== '?') porFunc[nome] = (porFunc[nome] || 0) + r.saldo;
        });
        desenharPizza(
            Object.entries(porFunc).map(([nome, valor]) => ({ nome, valor })),
            'Despesa Liquidada por Função (' + ANO_ATUAL + ')'
        );
    }
}

// ============ CARDS ============
function atualizarCards(filtrados) {
    // Totais ano atual
    let empAtual = 0, liqAtual = 0, pagAtual = 0, autAtual = 0;
    let empAnt = 0, liqAnt = 0, pagAnt = 0;
    filtrados.forEach(r => {
        if (r.coexercicio === ANO_ATUAL) {
            if (isEmpenhada(r))  empAtual += r.saldo;
            if (isLiquidada(r))  liqAtual += r.saldo;
            if (isPaga(r))       pagAtual += r.saldo;
            if (isAutorizada(r)) autAtual += r.saldo;
        } else {
            if (isEmpenhada(r))  empAnt += r.saldo;
            if (isLiquidada(r))  liqAnt += r.saldo;
            if (isPaga(r))       pagAnt += r.saldo;
        }
    });

    // Card Empenhada
    document.getElementById('cardEmp').textContent = fmtAbrev(empAtual);
    const varEmp = empAnt ? ((empAtual - empAnt) / Math.abs(empAnt) * 100) : 0;
    const tagEmp = varEmp >= 0 ? 'tag-up' : 'tag-down';
    const sinalEmp = varEmp >= 0 ? '+' : '';
    document.getElementById('cardEmpSub').innerHTML =
        `Ano anterior: ${fmtAbrev(empAnt)} | <span class="${tagEmp}">${sinalEmp}${varEmp.toFixed(1).replace('.', ',')}%</span>`;

    // Card Liquidada
    document.getElementById('cardLiq').textContent = fmtAbrev(liqAtual);
    const varLiq = liqAnt ? ((liqAtual - liqAnt) / Math.abs(liqAnt) * 100) : 0;
    const tagLiq = varLiq >= 0 ? 'tag-up' : 'tag-down';
    const sinalLiq = varLiq >= 0 ? '+' : '';
    document.getElementById('cardLiqSub').innerHTML =
        `Ano anterior: ${fmtAbrev(liqAnt)} | <span class="${tagLiq}">${sinalLiq}${varLiq.toFixed(1).replace('.', ',')}%</span>`;

    // Card Paga
    document.getElementById('cardPag').textContent = fmtAbrev(pagAtual);
    const varPag = pagAnt ? ((pagAtual - pagAnt) / Math.abs(pagAnt) * 100) : 0;
    const tagPag = varPag >= 0 ? 'tag-up' : 'tag-down';
    const sinalPag = varPag >= 0 ? '+' : '';
    document.getElementById('cardPagSub').innerHTML =
        `Ano anterior: ${fmtAbrev(pagAnt)} | <span class="${tagPag}">${sinalPag}${varPag.toFixed(1).replace('.', ',')}%</span>`;

    // Gauge: Execução = Liquidada / Autorizada × 100
    const execPct = autAtual ? (liqAtual / autAtual) * 100 : 0;
    desenharGauge(execPct);
    document.getElementById('cardExecucao').textContent = execPct.toFixed(2).replace('.', ',') + '%';
    document.getElementById('cardExecSub').innerHTML =
        `Autorizada: ${fmtAbrev(autAtual)}`;
}

// ============ TOGGLE SUBELEMENTO ============
function toggleSub(grpId, el) {
    const rows = document.querySelectorAll('.' + grpId);
    const aberto = el.classList.toggle('aberto');
    rows.forEach(r => r.classList.toggle('visivel', aberto));
}

// ============ FILTRAGEM E RENDERIZAÇÃO ============
function aplicarFiltros() {
    // Atualizar dropdowns dinamicamente antes de filtrar
    atualizarDropdowns();

    const mesSel   = parseInt(document.getElementById('fMes').value);
    const ugSel    = document.getElementById('fUG').value;
    const fonteSel = document.getElementById('fFonte').value;
    const supSel   = document.getElementById('chkSuperavit').checked;
    const intraSel = document.querySelector('input[name="rIntra"]:checked').value;
    const catEconSel = document.querySelector('input[name="rCatEcon"]:checked').value;
    const gndSel   = document.getElementById('fGND').value;
    const despSel  = document.getElementById('fDesp').value;
    const funcSel  = document.getElementById('fFuncao').value;
    const subfSel  = document.getElementById('fSubfuncao').value;

    // Filtrar
    let filtrados = REGISTROS.filter(r => r.inmes <= mesSel && !DESPESAS_IGNORAR_GLOBAL.includes(r.despesa));
    if (ugSel)    filtrados = filtrados.filter(r => r.coug === ugSel);
    if (supSel)   filtrados = filtrados.filter(r => isFonteSuperavit(r));
    if (fonteSel) filtrados = filtrados.filter(r => r.fonte_agrupada === fonteSel);
    if (intraSel === 'somente') filtrados = filtrados.filter(r => isIntra(r));
    if (intraSel === 'excluir') filtrados = filtrados.filter(r => !isIntra(r));
    if (catEconSel) filtrados = filtrados.filter(r => isCatEconDesp(r, catEconSel));
    if (gndSel)   filtrados = filtrados.filter(r => r.gnd === gndSel);
    if (despSel)  filtrados = filtrados.filter(r => r.despesa === despSel);
    if (funcSel)  filtrados = filtrados.filter(r => r.cofuncao === funcSel);
    if (subfSel)  filtrados = filtrados.filter(r => r.cosubfuncao === subfSel);

    // Agregar por hierarquia (ano atual + anterior)
    function agregar(registros, camposGrupo) {
        const mapa = {};
        registros.forEach(r => {
            const chave = camposGrupo.map(c => r[c] || '').join('|');
            if (!mapa[chave]) {
                mapa[chave] = { ...Object.fromEntries(camposGrupo.map(c => [c, r[c]])),
                    emp: 0, liq: 0, pag: 0, empAnt: 0, liqAnt: 0, pagAnt: 0 };
            }
            const isAtual = r.coexercicio === ANO_ATUAL;
            if (isEmpenhada(r)) { if (isAtual) mapa[chave].emp += r.saldo; else mapa[chave].empAnt += r.saldo; }
            if (isLiquidada(r)) { if (isAtual) mapa[chave].liq += r.saldo; else mapa[chave].liqAnt += r.saldo; }
            if (isPaga(r))      { if (isAtual) mapa[chave].pag += r.saldo; else mapa[chave].pagAnt += r.saldo; }
        });
        return Object.values(mapa);
    }

    // Agregar subelementos por tipo de conta separadamente
    function agregarSubelemento(registros, camposGrupo, filterFn) {
        const mapa = {};
        registros.filter(filterFn).forEach(r => {
            const sub = r.subelemento || '00';
            const nomeSub = r.nome_subelemento || '';
            const chave = camposGrupo.map(c => r[c] || '').join('|') + '|' + sub;
            if (!mapa[chave]) {
                mapa[chave] = { ...Object.fromEntries(camposGrupo.map(c => [c, r[c]])),
                    subelemento: sub, nome_subelemento: nomeSub, val: 0, valAnt: 0 };
            }
            if (r.coexercicio === ANO_ATUAL) mapa[chave].val += r.saldo;
            else mapa[chave].valAnt += r.saldo;
        });
        return Object.values(mapa);
    }

    // Para tabela: excluir contas de autorizada (classe 5) — usadas só nos cards
    const filtExec = filtrados.filter(r => !isAutorizada(r));

    // Montar linhas conforme seleção de GND e Despesa
    const linhas = [];
    let totalEmp = 0, totalLiq = 0, totalPag = 0;
    let totalEmpAnt = 0, totalLiqAnt = 0, totalPagAnt = 0;

    // Subelementos: só são montados quando despesa específica selecionada
    // Cada linha de despesa terá um array de subs por tipo (emp, liq, pag)
    let subsPorDesp = {};

    if (despSel) {
        // Despesa selecionada: mostrar GND nível 1, despesa nível 2 com setinha de expand
        const gndAgg = agregar(filtExec, ['gnd', 'nome_gnd']);
        const despAgg = agregar(filtExec, ['gnd', 'nome_gnd', 'despesa', 'nome_despesa']);

        // Agregar subelementos por tipo de conta
        // Paga usa 622130400 para subelemento (622920104 não carrega conta corrente com subelemento)
        const subEmp = agregarSubelemento(filtExec, ['despesa'], isEmpenhada);
        const subLiq = agregarSubelemento(filtExec, ['despesa'], isLiquidada);
        const subPag = agregarSubelemento(filtExec, ['despesa'], function(r) { return r.cocontacontabil === '622130400'; });

        subsPorDesp = { emp: subEmp, liq: subLiq, pag: subPag };

        gndAgg.sort((a, b) => (a.gnd || '').localeCompare(b.gnd || ''));
        gndAgg.forEach(g => {
            totalEmp += g.emp; totalLiq += g.liq; totalPag += g.pag;
            totalEmpAnt += g.empAnt; totalLiqAnt += g.liqAnt; totalPagAnt += g.pagAnt;
            linhas.push({ nivel: 1, nome: g.nome_gnd || g.gnd,
                emp: g.emp, liq: g.liq, pag: g.pag,
                empAnt: g.empAnt, liqAnt: g.liqAnt, pagAnt: g.pagAnt });

            const despsFiltr = despAgg.filter(d => d.gnd === g.gnd)
                .sort((a, b) => (a.despesa || '').localeCompare(b.despesa || ''));
            despsFiltr.forEach(d => {
                const nomeDesp = d.despesa + ' - ' + (d.nome_despesa || '');
                linhas.push({ nivel: 2, nome: nomeDesp, despesa: d.despesa,
                    temSub: true,
                    emp: d.emp, liq: d.liq, pag: d.pag,
                    empAnt: d.empAnt, liqAnt: d.liqAnt, pagAnt: d.pagAnt });
            });
        });
    } else if (gndSel) {
        // GND selecionado: mostrar GND como nível 1, subdespesas como nível 2
        const gndAgg = agregar(filtExec, ['gnd', 'nome_gnd']);
        const despAgg = agregar(filtExec, ['gnd', 'nome_gnd', 'despesa', 'nome_despesa']);

        gndAgg.sort((a, b) => (a.gnd || '').localeCompare(b.gnd || ''));
        gndAgg.forEach(g => {
            totalEmp += g.emp; totalLiq += g.liq; totalPag += g.pag;
            totalEmpAnt += g.empAnt; totalLiqAnt += g.liqAnt; totalPagAnt += g.pagAnt;
            linhas.push({ nivel: 1, nome: g.nome_gnd || g.gnd,
                emp: g.emp, liq: g.liq, pag: g.pag,
                empAnt: g.empAnt, liqAnt: g.liqAnt, pagAnt: g.pagAnt });

            const despsFiltr = despAgg.filter(d => d.gnd === g.gnd)
                .sort((a, b) => (a.despesa || '').localeCompare(b.despesa || ''));
            despsFiltr.forEach(d => {
                const nomeDesp = d.despesa + ' - ' + (d.nome_despesa || '');
                linhas.push({ nivel: 2, nome: nomeDesp,
                    emp: d.emp, liq: d.liq, pag: d.pag,
                    empAnt: d.empAnt, liqAnt: d.liqAnt, pagAnt: d.pagAnt });
            });
        });
    } else {
        // Visão padrão: categoria econômica > GND
        const cats = agregar(filtExec, ['categoria_economica', 'nome_categoria_economica']);
        const gnds = agregar(filtExec, ['categoria_economica', 'gnd', 'nome_gnd']);

        cats.sort((a, b) => (a.categoria_economica || '').localeCompare(b.categoria_economica || ''));
        cats.forEach(cat => {
            totalEmp += cat.emp; totalLiq += cat.liq; totalPag += cat.pag;
            totalEmpAnt += cat.empAnt; totalLiqAnt += cat.liqAnt; totalPagAnt += cat.pagAnt;
            linhas.push({ nivel: 1, nome: cat.nome_categoria_economica || cat.categoria_economica,
                emp: cat.emp, liq: cat.liq, pag: cat.pag,
                empAnt: cat.empAnt, liqAnt: cat.liqAnt, pagAnt: cat.pagAnt });

            const gndsFiltr = gnds.filter(g => g.categoria_economica === cat.categoria_economica)
                .sort((a, b) => (a.gnd || '').localeCompare(b.gnd || ''));
            gndsFiltr.forEach(g => {
                linhas.push({ nivel: 2, nome: g.nome_gnd || g.gnd,
                    emp: g.emp, liq: g.liq, pag: g.pag,
                    empAnt: g.empAnt, liqAnt: g.liqAnt, pagAnt: g.pagAnt });
            });
        });
    }

    // Renderizar 3 quadros separados
    const vazio = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#999;">Sem dados para os filtros selecionados</td></tr>';
    if (linhas.length === 0) {
        document.getElementById('tabelaEmp').innerHTML = vazio;
        document.getElementById('tabelaLiq').innerHTML = vazio;
        document.getElementById('tabelaPag').innerHTML = vazio;
        atualizarCards(filtrados);
        atualizarGraficos(filtrados);
        return;
    }

    let subIdx = 0;
    function renderQuadro(linhas, campoAtual, campoAnterior, totalAtual, totalAnterior, tipoSub) {
        let html = '';
        linhas.forEach(l => {
            // Regra: se valor do ano atual é zero, não exibe a linha
            if (l[campoAtual] === 0) return;

            if (l.temSub && subsPorDesp[tipoSub]) {
                // Linha de despesa com setinha para expandir subelementos
                const grpId = 'subGrp' + (subIdx++);
                const subsArr = subsPorDesp[tipoSub].filter(s => s.despesa === l.despesa && s.val !== 0)
                    .sort((a, b) => (a.subelemento || '').localeCompare(b.subelemento || ''));
                html += `<tr class="nivel-${l.nivel}">
                    <td><span class="desp-toggle" onclick="toggleSub('${grpId}', this)">${l.nome}</span></td>
                    <td class="${clsVal(l[campoAtual])}">${fmtMoeda(l[campoAtual])}</td>
                    <td class="${clsVal(l[campoAnterior])}">${fmtMoeda(l[campoAnterior])}</td>
                    <td class="col-var ${clsVar(l[campoAtual], l[campoAnterior])}">${fmtVar(l[campoAtual], l[campoAnterior])}</td>
                </tr>`;
                subsArr.forEach(s => {
                    const subNome = s.nome_subelemento ? s.subelemento + ' - ' + s.nome_subelemento : s.subelemento;
                    html += `<tr class="sub-row ${grpId} nivel-3">
                        <td>${subNome}</td>
                        <td class="${clsVal(s.val)}">${fmtMoeda(s.val)}</td>
                        <td class="${clsVal(s.valAnt)}">${fmtMoeda(s.valAnt)}</td>
                        <td class="col-var ${clsVar(s.val, s.valAnt)}">${fmtVar(s.val, s.valAnt)}</td>
                    </tr>`;
                });
            } else {
                html += `<tr class="nivel-${l.nivel}">
                    <td>${l.nome}</td>
                    <td class="${clsVal(l[campoAtual])}">${fmtMoeda(l[campoAtual])}</td>
                    <td class="${clsVal(l[campoAnterior])}">${fmtMoeda(l[campoAnterior])}</td>
                    <td class="col-var ${clsVar(l[campoAtual], l[campoAnterior])}">${fmtVar(l[campoAtual], l[campoAnterior])}</td>
                </tr>`;
            }
        });
        html += `<tr class="total-geral">
            <td>TOTAL</td>
            <td>${fmtMoeda(totalAtual)}</td>
            <td>${fmtMoeda(totalAnterior)}</td>
            <td>${fmtVar(totalAtual, totalAnterior)}</td>
        </tr>`;
        return html;
    }

    subIdx = 0;
    document.getElementById('tabelaEmp').innerHTML = renderQuadro(linhas, 'emp', 'empAnt', totalEmp, totalEmpAnt, 'emp');
    document.getElementById('tabelaLiq').innerHTML = renderQuadro(linhas, 'liq', 'liqAnt', totalLiq, totalLiqAnt, 'liq');
    document.getElementById('tabelaPag').innerHTML = renderQuadro(linhas, 'pag', 'pagAnt', totalPag, totalPagAnt, 'pag');

    atualizarCards(filtrados);
    atualizarGraficos(filtrados);
}

// ============ EVENTOS ============
['fMes','fUG','fFonte','fGND','fDesp','fFuncao','fSubfuncao'].forEach(id => {
    document.getElementById(id).addEventListener('change', aplicarFiltros);
});
document.querySelectorAll('input[name="rIntra"]').forEach(r => {
    r.addEventListener('change', aplicarFiltros);
});
document.querySelectorAll('input[name="rCatEcon"]').forEach(r => {
    r.addEventListener('change', aplicarFiltros);
});
document.getElementById('chkSuperavit').addEventListener('change', aplicarFiltros);

// ============ LIMPAR FILTROS ============
function limparFiltros() {
    document.getElementById('fMes').value = MAX_MES;
    document.getElementById('fUG').value = '';
    document.getElementById('fFonte').value = '';
    document.getElementById('fGND').value = '';
    document.getElementById('fDesp').innerHTML = '<option value="">Todas</option>';
    document.getElementById('filtroDesp').style.display = 'none';
    document.getElementById('fFuncao').value = '';
    document.getElementById('fSubfuncao').innerHTML = '<option value="">Todas</option>';
    document.getElementById('filtroSubfuncao').style.display = 'none';
    document.querySelector('input[name="rIntra"][value=""]').checked = true;
    document.querySelector('input[name="rCatEcon"][value=""]').checked = true;
    document.getElementById('chkSuperavit').checked = false;
    aplicarFiltros();
}

// ============ GERAR PDF ============
function gerarPDF() {
    const mesSel   = document.getElementById('fMes');
    const ugSel    = document.getElementById('fUG');
    const fonteSel = document.getElementById('fFonte');
    const intraVal = document.querySelector('input[name="rIntra"]:checked').value;
    const catEconVal = document.querySelector('input[name="rCatEcon"]:checked').value;
    const supVal   = document.getElementById('chkSuperavit').checked;

    const mesTexto   = mesSel.options[mesSel.selectedIndex].textContent;
    const ugTexto    = ugSel.value ? ugSel.options[ugSel.selectedIndex].textContent : 'Todas';
    const fonteTexto = fonteSel.value ? fonteSel.options[fonteSel.selectedIndex].textContent : 'Todas';
    const gndEl      = document.getElementById('fGND');
    const gndTexto   = gndEl.value ? gndEl.options[gndEl.selectedIndex].textContent : 'Todos';
    const despEl     = document.getElementById('fDesp');
    const despTexto  = despEl.value ? despEl.options[despEl.selectedIndex].textContent : 'Todas';
    const funcEl     = document.getElementById('fFuncao');
    const funcTexto  = funcEl.value ? funcEl.options[funcEl.selectedIndex].textContent : 'Todas';
    const subfEl     = document.getElementById('fSubfuncao');
    const subfTexto  = subfEl.value ? subfEl.options[subfEl.selectedIndex].textContent : 'Todas';
    const intraTexto = intraVal === 'somente' ? 'Somente Intra' : intraVal === 'excluir' ? 'Excluir Intra' : 'Todas';
    const catEconTexto = catEconVal === 'corrente' ? 'Corrente' : catEconVal === 'capital' ? 'Capital' : 'Todas';

    document.getElementById('printResumo').innerHTML = `<strong>Filtros aplicados:</strong> `
        + `Mês: <strong>${mesTexto}</strong> | `
        + `UG: <strong>${ugTexto}</strong> | `
        + `Fonte: <strong>${fonteTexto}</strong> | `
        + (supVal ? `Superávit: <strong>Sim</strong> | ` : '')
        + `Intra: <strong>${intraTexto}</strong> | `
        + `Cat. Econômica: <strong>${catEconTexto}</strong> | `
        + `GND: <strong>${gndTexto}</strong> | `
        + `Despesa: <strong>${despTexto}</strong> | `
        + `Função: <strong>${funcTexto}</strong> | `
        + `Subfunção: <strong>${subfTexto}</strong> | `
        + `Exercício: <strong>${ANO_ATUAL}</strong>`;

    window.print();
}

// Inicializar
aplicarFiltros();
