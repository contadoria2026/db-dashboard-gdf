
// ============ DADOS CARREGADOS VIA FETCH ============
let REGISTROS = [];
let PREVISAO  = [];

(function () {
  // Overlay de carregamento
  var overlay = document.createElement('div');
  overlay.id  = '_etl_loading';
  overlay.style.cssText = [
    'position:fixed', 'inset:0',
    'background:rgba(255,255,255,0.93)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'z-index:9999', 'font-family:sans-serif', 'font-size:1rem', 'color:#555',
    'flex-direction:column', 'gap:12px'
  ].join(';');
  overlay.innerHTML = '<div style="font-size:2rem">⏳</div><div>Carregando dados da receita…</div>';
  document.body.appendChild(overlay);

  // Busca JSON.GZ do repositorio e descomprime via DecompressionStream
  function fetchJsonGz(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var ds = new DecompressionStream('gzip');
      return new Response(r.body.pipeThrough(ds)).text();
    }).then(function (text) {
      return JSON.parse(text);
    });
  }

  fetchJsonGz('../data/gz/receita.json.gz')
    .then(function (json) {
      json.dados.forEach(function (r) {
        var cc = parseInt(String(r.cocontacontabil || 0), 10);
        if (cc >= 621200000 && cc <= 621399999) {
          REGISTROS.push(r);
        } else if (cc >= 521100000 && cc <= 521299999) {
          r.tipo_previsao = cc < 521200000 ? 'inicial' : 'adicional';
          PREVISAO.push(r);
        }
      });
      var el = document.getElementById('data-atualizacao');
      if (el && json.atualizado_em) {
        var d = new Date(json.atualizado_em);
        el.textContent = 'Dados atualizados em: ' + d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      }
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

const ANO_ATUAL   = 2026;
const ANO_ANTERIOR= 2025;
const MAX_MES     = 4;
const MESES_FECHADOS = [1, 2, 3, 4];

const NOMES_MES = {
    1:'Janeiro',2:'Fevereiro',3:'Março',4:'Abril',
    5:'Maio',6:'Junho',7:'Julho',8:'Agosto',
    9:'Setembro',10:'Outubro',11:'Novembro',12:'Dezembro'
};

// ============ POPULAR DROPDOWNS ============

// Meses — fixo (não depende dos outros filtros)
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

// Função auxiliar: verifica se receita é intraorçamentária (começa com 7 ou 8)
function isIntra(r) {
    const cat = r.categoria_economica || '';
    return cat.charAt(0) === '7' || cat.charAt(0) === '8';
}

// Função auxiliar: verifica categoria econômica (corrente ou capital)
// Corrente: 1xxxxxxx (regular) + 7xxxxxxx (intra corrente)
// Capital:  2xxxxxxx (regular) + 8xxxxxxx (intra capital)
function isCatEcon(r, tipo) {
    const cat = r.categoria_economica || '';
    const c = cat.charAt(0);
    if (tipo === 'corrente') return c === '1' || c === '7';
    if (tipo === 'capital')  return c === '2' || c === '8';
    return true;
}

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
    if (valorAnterior && [...sel.options].some(o => o.value === valorAnterior)) {
        sel.value = valorAnterior;
    } else {
        sel.value = '';
    }
}

// Lê os filtros atuais e retorna registros filtrados EXCLUINDO um filtro específico
// Permite que cada dropdown mostre as opções compatíveis com os DEMAIS filtros
function filtrarExcluindo(excluir) {
    const mesSel   = parseInt(document.getElementById('fMes').value);
    const ugSel    = document.getElementById('fUG').value;
    const fonteSel = document.getElementById('fFonte').value;
    const intraSel = document.querySelector('input[name="rIntra"]:checked').value;
    const catEconSel = document.querySelector('input[name="rCatEcon"]:checked').value;
    const espSel   = document.getElementById('fEspecie').value;

    let f = REGISTROS.filter(r => r.inmes <= mesSel);
    if (ugSel    && excluir !== 'ug')       f = f.filter(r => String(r.coug) === ugSel);
    if (fonteSel && excluir !== 'fonte')    f = f.filter(r => r.fonte_agrupada === fonteSel);
    if (intraSel === 'somente' && excluir !== 'intra') f = f.filter(r => isIntra(r));
    if (intraSel === 'excluir' && excluir !== 'intra') f = f.filter(r => !isIntra(r));
    if (catEconSel && excluir !== 'catecon') f = f.filter(r => isCatEcon(r, catEconSel));
    if (espSel   && excluir !== 'especie')  f = f.filter(r => r.especie_receita === espSel);
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

    // Fonte: mostrar apenas fontes presentes (sem considerar Fonte)
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

    // Espécie: mostrar apenas espécies presentes (sem considerar Espécie)
    const regParaEsp = filtrarExcluindo('especie');
    const especiesVisiveis = {};
    regParaEsp.forEach(r => {
        if (r.especie_receita && r.nome_especie_receita)
            especiesVisiveis[r.especie_receita] = r.nome_especie_receita;
    });
    repopularSelect('fEspecie',
        Object.keys(especiesVisiveis).sort().map(c => ({ valor: c, texto: especiesVisiveis[c] })),
        document.getElementById('fEspecie').value
    );
}

// ============ FORMATAÇÃO ============
function fmtMoeda(v) {
    if (!v) return 'R$ 0,00';
    return 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
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
function fmtPct(atual, anterior) {
    if (!anterior || anterior === 0) {
        if (atual > 0) return '+100,00%';
        if (atual < 0) return '-100,00%';
        return '0,00%';
    }
    const v = ((atual - anterior) / Math.abs(anterior)) * 100;
    return (v >= 0 ? '+' : '') + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + '%';
}
function clsVal(v) { return v < 0 ? 'valor-negativo' : 'valor-positivo'; }
function clsVar(d) { return d >= 0 ? 'variacao-positiva' : 'variacao-negativa'; }

const BIMESTRES = {1:'1º Bimestre',2:'1º Bimestre',3:'2º Bimestre',4:'2º Bimestre',
    5:'3º Bimestre',6:'3º Bimestre',7:'4º Bimestre',8:'4º Bimestre',
    9:'5º Bimestre',10:'5º Bimestre',11:'6º Bimestre',12:'6º Bimestre'};

const CORES_CAT = ['#006633','#2e7d32','#43a047','#66bb6a','#81c784','#a5d6a7','#1b5e20','#388e3c'];
const CORES_TREEMAP = ['#006633','#1b5e20','#2e7d32','#388e3c','#43a047','#4caf50','#66bb6a',
    '#81c784','#00695c','#00796b','#00897b','#009688','#26a69a','#4db6ac',
    '#0277bd','#0288d1','#039be5','#03a9f4','#558b2f','#689f38'];

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
    const fromDeg = angFromPct(0) * 180 / Math.PI;
    const toDeg   = angFromPct(clampPct) * 180 / Math.PI;
    s += `<animateTransform attributeName="transform" type="rotate" from="${fromDeg} ${cx} ${cy}" to="${toDeg} ${cx} ${cy}" dur="1.2s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1"/>`;
    s += `</polygon>`;
    s += `<circle cx="${cx}" cy="${cy}" r="10" fill="${corNeedle}" stroke="#fff" stroke-width="2.5">`;
    s += `<animate attributeName="fill" from="#ccc" to="${corNeedle}" dur="1.2s" fill="freeze"/>`;
    s += `</circle>`;
    s += `<circle cx="${cx}" cy="${cy}" r="3" fill="#fff"/>`;
    s += `</g>`;

    svg.innerHTML = s;
    document.getElementById('cardExecucao').style.color = corNeedle;
}

// ============ GRÁFICO DE BARRAS ============
function desenharBarras(dados) {
    const container = document.getElementById('barChart');
    if (!dados.length) { container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Sem dados</div>'; return; }
    const maxVal = Math.max(...dados.map(d => Math.abs(d.valor)));
    let html = '';
    dados.slice(0, 4).forEach((d, i) => {
        const pct = maxVal > 0 ? (Math.abs(d.valor) / maxVal * 100) : 0;
        const cor = CORES_CAT[i % CORES_CAT.length];
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

// ============ TREEMAP ============
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
        const cor = CORES_TREEMAP[i % CORES_TREEMAP.length];
        const valFmt = fmtMoeda(d.valor);
        const pctFmt = pct.toFixed(1) + '%';
        html += `<div class="treemap-item" style="flex:${pct} 1 0%;background:${cor};"
            title="${d.nome}: ${valFmt} (${pctFmt})">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;display:block;font-size:${pct > 12 ? '12' : '10'}px;">${pct > 4 ? d.nome : ''}</span>
            <small>${pctFmt}</small>
        </div>`;
    });
    container.innerHTML = html;
}

// ============ GRÁFICO DE LINHAS ============
function desenharLinhas(dadosMensaisAtual, dadosMensaisAnterior) {
    const svg = document.getElementById('lineChart');
    const W = 700, H = 200, padL = 70, padR = 20, padT = 20, padB = 30;
    const gW = W - padL - padR, gH = H - padT - padB;

    // Encontrar meses com dados
    const allMeses = [...new Set([...Object.keys(dadosMensaisAtual), ...Object.keys(dadosMensaisAnterior)])]
        .map(Number).sort((a,b) => a - b);
    if (allMeses.length === 0) { svg.innerHTML = ''; return; }

    const minM = Math.min(...allMeses), maxM = Math.max(...allMeses);
    const meses = [];
    for (let m = minM; m <= maxM; m++) meses.push(m);

    // Acumular valores mês a mês
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

    let svgContent = '';

    // Grid horizontal
    const nGrid = 4;
    for (let i = 0; i <= nGrid; i++) {
        const val = minV + (rangeV / nGrid) * i;
        const y = yPos(val);
        svgContent += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" class="grid-line"/>`;
        const label = (val / 1e6).toFixed(0) + 'M';
        svgContent += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end">${label}</text>`;
    }

    // Labels dos meses
    const MESES_CURTO = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    meses.forEach(m => {
        svgContent += `<text x="${xPos(m)}" y="${H - 4}" text-anchor="middle">${MESES_CURTO[m] || m}</text>`;
    });

    // Linhas
    function pathStr(pts) {
        return pts.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${xPos(p.m)} ${yPos(p.v)}`).join(' ');
    }
    svgContent += `<path d="${pathStr(ptsAnterior)}" class="line-anterior"/>`;
    svgContent += `<path d="${pathStr(ptsAtual)}" class="line-atual"/>`;

    // Dots
    ptsAnterior.forEach(p => {
        svgContent += `<circle cx="${xPos(p.m)}" cy="${yPos(p.v)}" class="dot-ant"/>`;
    });
    ptsAtual.forEach(p => {
        svgContent += `<circle cx="${xPos(p.m)}" cy="${yPos(p.v)}" class="dot"/>`;
    });

    // Legenda
    svgContent += `<line x1="${padL}" y1="${12}" x2="${padL+20}" y2="${12}" stroke="#006633" stroke-width="2.5"/>`;
    svgContent += `<text x="${padL+24}" y="${16}" font-size="11" fill="#006633">${ANO_ATUAL}</text>`;
    svgContent += `<line x1="${padL+80}" y1="${12}" x2="${padL+100}" y2="${12}" stroke="#999" stroke-width="2" stroke-dasharray="6,3"/>`;
    svgContent += `<text x="${padL+104}" y="${16}" font-size="11" fill="#999">${ANO_ANTERIOR}</text>`;

    svg.innerHTML = svgContent;
}

// ============ ATUALIZAR CARDS ============
function atualizarCards(filtradosRealizado, filtradosPrevisao, mesSel) {
    // Previsão Atualizada (soma de todos os registros previsão do ano atual, filtrados)
    const prevAtualizada = filtradosPrevisao
        .filter(r => r.coexercicio === ANO_ATUAL)
        .reduce((s, r) => s + r.saldo, 0);

    const prevInicial = filtradosPrevisao
        .filter(r => r.coexercicio === ANO_ATUAL && r.tipo_previsao === 'inicial')
        .reduce((s, r) => s + r.saldo, 0);

    const varPrev = prevInicial !== 0 ? ((prevAtualizada - prevInicial) / Math.abs(prevInicial) * 100) : 0;

    document.getElementById('cardPrevisao').textContent = fmtAbrev(prevAtualizada);
    const tagClass = varPrev >= 0 ? 'tag-up' : 'tag-down';
    const sinal = varPrev >= 0 ? '+' : '';
    document.getElementById('cardPrevisaoSub').innerHTML =
        `Inicial: ${fmtAbrev(prevInicial)} | Variação: <span class="${tagClass}">${sinal}${varPrev.toFixed(2).replace('.', ',')}%</span>`;

    // Realizado
    const realizadoAtual = filtradosRealizado
        .filter(r => r.coexercicio === ANO_ATUAL)
        .reduce((s, r) => s + r.saldo, 0);
    const realizadoAnterior = filtradosRealizado
        .filter(r => r.coexercicio === ANO_ANTERIOR)
        .reduce((s, r) => s + r.saldo, 0);

    const bimRef = BIMESTRES[mesSel] || '';
    document.getElementById('cardRealizadoLabel').textContent = `Realizado até ${NOMES_MES[mesSel]} (${bimRef})`;
    document.getElementById('cardRealizado').textContent = fmtAbrev(realizadoAtual);
    const varReal = realizadoAnterior !== 0 ? ((realizadoAtual - realizadoAnterior) / Math.abs(realizadoAnterior) * 100) : 0;
    const tagR = varReal >= 0 ? 'tag-up' : 'tag-down';
    const sinalR = varReal >= 0 ? '+' : '';
    document.getElementById('cardRealizadoSub').innerHTML =
        `Ano anterior: ${fmtAbrev(realizadoAnterior)} | <span class="${tagR}">${sinalR}${varReal.toFixed(2).replace('.', ',')}%</span>`;

    // Falta arrecadar (realizado - previsão; negativo = ainda falta)
    const falta = realizadoAtual - prevAtualizada;
    document.getElementById('cardSaldo').textContent = fmtAbrev(falta);
    document.getElementById('cardSaldo').className = 'card-valor ' + (falta < 0 ? 'valor-negativo' : 'variacao-positiva');
    const pctFalta = prevAtualizada !== 0 ? (falta / Math.abs(prevAtualizada) * 100) : 0;
    const descFalta = falta < 0
        ? `Faltam ${Math.abs(pctFalta).toFixed(2).replace('.', ',')}% da previsão`
        : `Superou a previsão em ${pctFalta.toFixed(2).replace('.', ',')}%`;
    document.getElementById('cardSaldoSub').innerHTML = descFalta;

    // Execução %
    const execPct = prevAtualizada !== 0 ? (realizadoAtual / prevAtualizada * 100) : 0;
    desenharGauge(execPct);
    document.getElementById('cardExecucao').textContent = execPct.toFixed(2).replace('.', ',') + '%';
    document.getElementById('cardExecSub').innerHTML =
        `Previsão Atualizada: ${fmtAbrev(prevAtualizada)}`;
}

// ============ ATUALIZAR GRÁFICOS ============
function atualizarGraficos(filtradosRealizado) {
    // Barras: realizado por espécie da receita (ano atual)
    const porEsp = {};
    filtradosRealizado.filter(r => r.coexercicio === ANO_ATUAL).forEach(r => {
        const nome = r.nome_especie_receita || r.especie_receita || '?';
        if (nome && nome !== '?') porEsp[nome] = (porEsp[nome] || 0) + r.saldo;
    });
    const barData = Object.entries(porEsp).map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    desenharBarras(barData);

    // Treemap: por tipo de receita (ano atual)
    const porTipo = {};
    filtradosRealizado.filter(r => r.coexercicio === ANO_ATUAL).forEach(r => {
        const nome = r.nome_tipo_receita || r.tipo_receita || r.nome_especie_receita || '?';
        if (nome && nome !== '?') porTipo[nome] = (porTipo[nome] || 0) + r.saldo;
    });
    const tmData = Object.entries(porTipo).map(([nome, valor]) => ({ nome, valor }));
    desenharTreemap(tmData);

    // Linha: evolução mensal acumulada
    const mensalAtual = {}, mensalAnterior = {};
    filtradosRealizado.forEach(r => {
        if (r.coexercicio === ANO_ATUAL)   mensalAtual[r.inmes] = (mensalAtual[r.inmes] || 0) + r.saldo;
        if (r.coexercicio === ANO_ANTERIOR) mensalAnterior[r.inmes] = (mensalAnterior[r.inmes] || 0) + r.saldo;
    });
    desenharLinhas(mensalAtual, mensalAnterior);
}

// ============ TOGGLE UGs DENTRO DE TIPO ============
function toggleUGs(grpId, el) {
    const rows = document.querySelectorAll('.' + grpId);
    const aberto = el.classList.toggle('aberto');
    rows.forEach(r => r.classList.toggle('visivel', aberto));
}

// ============ LÓGICA DE FILTRAGEM E RENDERIZAÇÃO ============
function aplicarFiltros() {
    // Atualizar dropdowns dinamicamente antes de filtrar
    atualizarDropdowns();

    const mesSel   = parseInt(document.getElementById('fMes').value);
    const ugSel    = document.getElementById('fUG').value;
    const fonteSel = document.getElementById('fFonte').value;
    const intraSel = document.querySelector('input[name="rIntra"]:checked').value;
    const catEconSel = document.querySelector('input[name="rCatEcon"]:checked').value;
    const espSel   = document.getElementById('fEspecie').value;
    const mostrarTipo    = document.getElementById('chkTipo').checked;

    // 1. Filtrar registros (realizado)
    let filtrados = REGISTROS.filter(r => r.inmes <= mesSel);
    if (ugSel)    filtrados = filtrados.filter(r => String(r.coug) === ugSel);
    if (fonteSel) filtrados = filtrados.filter(r => r.fonte_agrupada === fonteSel);
    if (intraSel === 'somente') filtrados = filtrados.filter(r => isIntra(r));
    if (intraSel === 'excluir') filtrados = filtrados.filter(r => !isIntra(r));
    if (catEconSel) filtrados = filtrados.filter(r => isCatEcon(r, catEconSel));
    if (espSel)   filtrados = filtrados.filter(r => r.especie_receita === espSel);

    // 1b. Filtrar previsão (mesmos filtros)
    let filtPrev = PREVISAO.filter(r => r.inmes <= mesSel);
    if (ugSel)    filtPrev = filtPrev.filter(r => String(r.coug) === ugSel);
    if (fonteSel) filtPrev = filtPrev.filter(r => r.fonte_agrupada === fonteSel);
    if (intraSel === 'somente') filtPrev = filtPrev.filter(r => isIntra(r));
    if (intraSel === 'excluir') filtPrev = filtPrev.filter(r => !isIntra(r));
    if (catEconSel) filtPrev = filtPrev.filter(r => isCatEcon(r, catEconSel));
    if (espSel)   filtPrev = filtPrev.filter(r => r.especie_receita === espSel);

    // 2. Agregar por hierarquia e ano
    function agregar(registros, camposGrupo) {
        const mapa = {};
        registros.forEach(r => {
            const chave = camposGrupo.map(c => r[c] || '').join('|');
            if (!mapa[chave]) {
                mapa[chave] = { ...Object.fromEntries(camposGrupo.map(c => [c, r[c]])), atual: 0, anterior: 0 };
            }
            if (r.coexercicio === ANO_ATUAL)   mapa[chave].atual += r.saldo;
            if (r.coexercicio === ANO_ANTERIOR) mapa[chave].anterior += r.saldo;
        });
        return Object.values(mapa);
    }

    const cats = agregar(filtrados, ['categoria_economica', 'nome_categoria_economica']);
    const oris = agregar(filtrados, ['categoria_economica', 'origem_receita', 'nome_origem_receita']);
    const esps = agregar(filtrados, ['categoria_economica', 'origem_receita', 'especie_receita', 'nome_especie_receita']);
    const tips = mostrarTipo ?
        agregar(filtrados, ['categoria_economica', 'origem_receita', 'especie_receita', 'tipo_receita', 'nome_tipo_receita']) : [];
    // UGs por tipo (para dropdown dentro de cada tipo)
    const ugsPorTipo = mostrarTipo ?
        agregar(filtrados, ['categoria_economica', 'origem_receita', 'especie_receita', 'tipo_receita', 'coug', 'noug']) : [];

    // 3. Montar linhas hierárquicas
    const linhas = [];
    let totalAtual = 0, totalAnterior = 0;

    cats.sort((a, b) => (a.categoria_economica || '').localeCompare(b.categoria_economica || ''));
    cats.forEach(cat => {
        totalAtual += cat.atual;
        totalAnterior += cat.anterior;
        linhas.push({ nivel: 1, nome: cat.nome_categoria_economica || cat.categoria_economica, atual: cat.atual, anterior: cat.anterior });

        const orisFiltr = oris.filter(o => o.categoria_economica === cat.categoria_economica)
            .sort((a, b) => (a.origem_receita || '').localeCompare(b.origem_receita || ''));
        orisFiltr.forEach(ori => {
            linhas.push({ nivel: 2, nome: ori.nome_origem_receita || ori.origem_receita, atual: ori.atual, anterior: ori.anterior });

            const espsFiltr = esps.filter(e => e.categoria_economica === cat.categoria_economica && e.origem_receita === ori.origem_receita)
                .sort((a, b) => (a.especie_receita || '').localeCompare(b.especie_receita || ''));
            // Se a origem tem apenas 1 espécie, omitir nível espécie
            const mostrarEspecie = espsFiltr.length > 1;
            espsFiltr.forEach(esp => {
                if (mostrarEspecie) {
                    linhas.push({ nivel: 3, nome: esp.nome_especie_receita || esp.especie_receita, atual: esp.atual, anterior: esp.anterior });
                }

                // Tipo (com dropdown de UGs)
                if (mostrarTipo) {
                    const tipsFiltr = tips.filter(t =>
                        t.categoria_economica === cat.categoria_economica &&
                        t.origem_receita === ori.origem_receita &&
                        t.especie_receita === esp.especie_receita
                    ).sort((a, b) => (a.tipo_receita || '').localeCompare(b.tipo_receita || ''));
                    tipsFiltr.forEach(tip => {
                        // Coletar UGs deste tipo
                        const ugsDoTipo = ugsPorTipo.filter(u =>
                            u.categoria_economica === cat.categoria_economica &&
                            u.origem_receita === ori.origem_receita &&
                            u.especie_receita === esp.especie_receita &&
                            u.tipo_receita === tip.tipo_receita
                        ).sort((a, b) => (a.coug || '').localeCompare(b.coug || ''));
                        // Se espécie omitida, tipo sobe um nível (3 ao invés de 4)
                        linhas.push({
                            nivel: mostrarEspecie ? 4 : 3,
                            nome: tip.nome_tipo_receita || tip.tipo_receita,
                            atual: tip.atual, anterior: tip.anterior,
                            ugs: ugsDoTipo
                        });
                    });
                }
            });
        });
    });

    // 4. Renderizar
    const tbody = document.getElementById('tabelaBody');
    if (linhas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#999;">Sem dados para os filtros selecionados</td></tr>';
        atualizarCards(filtrados, filtPrev, mesSel);
        atualizarGraficos(filtrados);
        return;
    }

    let html = '';
    let tipoIdx = 0;
    linhas.forEach(l => {
        // Regra: se valor do ano atual é zero, não exibe a linha
        if (l.atual === 0) return;

        const dif = l.atual - l.anterior;
        if (l.ugs && l.ugs.length > 0) {
            // Filtrar UGs com valor zero no ano atual
            const ugsVisiveis = l.ugs.filter(u => u.atual !== 0);
            const grpId = 'ugGrp' + (tipoIdx++);
            html += `<tr class="nivel-${l.nivel}">
                <td><span class="tipo-toggle" onclick="toggleUGs('${grpId}', this)">${l.nome}</span></td>
                <td class="${clsVal(l.atual)}">${fmtMoeda(l.atual)}</td>
                <td class="${clsVal(l.anterior)}">${fmtMoeda(l.anterior)}</td>
                <td class="${clsVar(dif)}">${fmtMoeda(dif)}</td>
                <td class="${clsVar(dif)}">${fmtPct(l.atual, l.anterior)}</td>
            </tr>`;
            ugsVisiveis.forEach(u => {
                const udif = u.atual - u.anterior;
                const ugNome = u.coug + ' - ' + (u.noug || '');
                html += `<tr class="ug-row ${grpId}">
                    <td>${ugNome}</td>
                    <td class="${clsVal(u.atual)}">${fmtMoeda(u.atual)}</td>
                    <td class="${clsVal(u.anterior)}">${fmtMoeda(u.anterior)}</td>
                    <td class="${clsVar(udif)}">${fmtMoeda(udif)}</td>
                    <td class="${clsVar(udif)}">${fmtPct(u.atual, u.anterior)}</td>
                </tr>`;
            });
        } else {
            html += `<tr class="nivel-${l.nivel}">
                <td>${l.nome}</td>
                <td class="${clsVal(l.atual)}">${fmtMoeda(l.atual)}</td>
                <td class="${clsVal(l.anterior)}">${fmtMoeda(l.anterior)}</td>
                <td class="${clsVar(dif)}">${fmtMoeda(dif)}</td>
                <td class="${clsVar(dif)}">${fmtPct(l.atual, l.anterior)}</td>
            </tr>`;
        }
    });

    const difT = totalAtual - totalAnterior;
    html += `<tr class="total-geral">
        <td>TOTAL DA RECEITA</td>
        <td>${fmtMoeda(totalAtual)}</td>
        <td>${fmtMoeda(totalAnterior)}</td>
        <td>${fmtMoeda(difT)}</td>
        <td>${fmtPct(totalAtual, totalAnterior)}</td>
    </tr>`;
    tbody.innerHTML = html;

    // 5. Atualizar cards e gráficos
    atualizarCards(filtrados, filtPrev, mesSel);
    atualizarGraficos(filtrados);
}

// ============ EVENTOS ============
['fMes','fUG','fFonte','fEspecie'].forEach(id => {
    document.getElementById(id).addEventListener('change', aplicarFiltros);
});
document.getElementById('chkTipo').addEventListener('change', aplicarFiltros);
document.querySelectorAll('input[name="rIntra"]').forEach(r => {
    r.addEventListener('change', aplicarFiltros);
});
document.querySelectorAll('input[name="rCatEcon"]').forEach(r => {
    r.addEventListener('change', aplicarFiltros);
});

// ============ LIMPAR FILTROS ============
function limparFiltros() {
    document.getElementById('fMes').value = MAX_MES;
    document.getElementById('fUG').value = '';
    document.getElementById('fFonte').value = '';
    document.getElementById('fEspecie').value = '';
    document.getElementById('chkTipo').checked = false;
    document.querySelector('input[name="rIntra"][value=""]').checked = true;
    document.querySelector('input[name="rCatEcon"][value=""]').checked = true;
    aplicarFiltros();
}

// ============ GERAR PDF ============
function gerarPDF() {
    // Montar resumo dos filtros ativos para aparecer no PDF
    const mesSel   = document.getElementById('fMes');
    const ugSel    = document.getElementById('fUG');
    const fonteSel = document.getElementById('fFonte');
    const espSel   = document.getElementById('fEspecie');
    const chkTipo  = document.getElementById('chkTipo').checked;
    const intraVal = document.querySelector('input[name="rIntra"]:checked').value;
    const catEconVal = document.querySelector('input[name="rCatEcon"]:checked').value;

    const mesTexto   = mesSel.options[mesSel.selectedIndex].textContent;
    const ugTexto    = ugSel.value ? ugSel.options[ugSel.selectedIndex].textContent : 'Todas';
    const fonteTexto = fonteSel.value ? fonteSel.options[fonteSel.selectedIndex].textContent : 'Todas';
    const espTexto   = espSel.value ? espSel.options[espSel.selectedIndex].textContent : 'Todas';
    const intraTexto = intraVal === 'somente' ? 'Somente Intra' : intraVal === 'excluir' ? 'Excluir Intra' : 'Todas';
    const catEconTexto = catEconVal === 'corrente' ? 'Corrente' : catEconVal === 'capital' ? 'Capital' : 'Todas';
    const detTexto = chkTipo ? 'Tipo' : 'Não';

    const resumo = document.getElementById('printResumo');
    resumo.innerHTML = `<strong>Filtros aplicados:</strong> `
        + `Mês: <strong>${mesTexto}</strong> | `
        + `UG: <strong>${ugTexto}</strong> | `
        + `Fonte: <strong>${fonteTexto}</strong> | `
        + `Intra: <strong>${intraTexto}</strong> | `
        + `Cat. Econômica: <strong>${catEconTexto}</strong> | `
        + `Espécie: <strong>${espTexto}</strong> | `
        + `Detalhamento: <strong>${detTexto}</strong> | `
        + `Comparação: <strong>${ANO_ATUAL} vs ${ANO_ANTERIOR}</strong>`;

    // Abrir diálogo de impressão (o usuário salva como PDF)
    window.print();
}

// Inicializar
aplicarFiltros();
