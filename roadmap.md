# Roadmap — Dashboards Fiscais GDF

> Registro dos planos de evolução do projeto. Atualizado em 25/04/2026.

---

## ✅ Concluído

- Pipeline Oracle → ETL Python → JSON.gz → GitHub → GitHub Pages
- Dashboards: RCL, Receita Orçamentária, Despesa Orçamentária, Restos a Pagar
- Runner self-hosted com GitHub Actions (schedule diário 06:00 Brasília)
- Treemap ECharts em receita e despesa (composição por espécie/GND)
- Gauge + treemap lado a lado acima dos dados detalhados

---

## 📌 Pendente — Ambiente de Homologação (branch `dev`)

### Objetivo
Criar um ambiente de testes para validar novas queries, mudanças no ETL e novos dashboards antes de subir para produção.

### Implementação
1. Criar branch `dev` no repositório
2. Criar `.github/workflows/etl-dev.yml` — cópia do `etl.yml` com:
   - Trigger na branch `dev` (push ou `workflow_dispatch`)
   - Runner self-hosted (mesmo runner, mesmo Oracle)
   - Commit dos JSON.gz na própria branch `dev`
3. Fluxo de desenvolvimento:
   - Nova query em `data/queries/`
   - Ajuste no `etl.py`
   - Novo HTML do dashboard
   - Push para `dev` → Actions roda ETL → valida dados
4. Merge para produção quando validado:

```powershell
git checkout main
git merge dev
git push origin main
```

### Casos de uso
- Criação de novo demonstrativo (nova query + ETL + HTML)
- Mudanças estruturais no ETL
- Testes de novos componentes visuais nos dashboards

---

## 📌 Pendente — Supabase como Contingência (arquitetura paralela)

### Objetivo
Criar uma segunda estrutura paralela usando Supabase como back-end, sem alterar a estrutura atual. A estrutura atual permanece em produção enquanto a nova é validada.

### Arquitetura

```
ETL (etl.py)
  ├── gera gz  →  commit no GitHub  →  GitHub Pages  (atual, produção)
  └── INSERT   →  Supabase API      →  GitHub Pages  (paralela, validação)
```

### Implementação
1. Criar projeto no Supabase (supabase.com — free tier)
2. Criar tabelas PostgreSQL espelhando os datasets atuais:
   - `receita` (colunas do receita.json.gz)
   - `despesa` (colunas do despesa.json.gz)
   - `rcl` (colunas do rcl.json.gz)
   - `restos_a_pagar` (colunas do restos_a_pagar.json.gz)
3. Adicionar secrets no GitHub: `SUPABASE_URL` e `SUPABASE_KEY`
4. Adaptar `etl.py`: ao final da geração dos gz, adicionar bloco de `upsert` no Supabase via `supabase-py`
5. Criar versão paralela dos HTMLs (ex: `receita_supabase.html`) que busca dados na API REST do Supabase em vez dos gz
6. Validar dados lado a lado com a versão atual
7. Quando validado: promover versão Supabase para produção, desligar geração de gz

### Estimativa de recursos (free tier Supabase)
| Recurso | Disponível | Estimado no projeto |
|---|---|---|
| Armazenamento | 500 MB | ~268 MB (1 ano) |
| Banda/mês | 5 GB | ~1–1,2 GB |

---

## 📌 Pendente — Estratégia Híbrida de Armazenamento (ano corrente + histórico)

### Objetivo
Manter o Supabase sempre leve (só ano corrente) e arquivar anos anteriores como gz no GitHub. HTML com seletor de ano.

### Funcionamento
- **Ano corrente** → dados no Supabase (frescos, filtráveis via API)
- **Anos anteriores** → gz arquivados em `data/gz/{ano}/` no GitHub

### Lógica no HTML
```javascript
if (anoSelecionado === anoCorrente) {
    // busca Supabase com filtro de mês
    fetch(`${SUPABASE_URL}/rest/v1/despesa?inmes=lte.${mes}&select=*`, { headers })
} else {
    // busca gz histórico do GitHub
    fetch(`https://raw.githubusercontent.com/.../data/gz/${anoSelecionado}/despesa.json.gz`)
}
```

### Virada de ano (janeiro de cada ano)
1. Exportar dados do ano encerrado do Supabase para gz
2. Commitar gz em `data/gz/{ano}/` no GitHub
3. Limpar tabelas no Supabase para o novo ano
4. Atualizar o seletor de anos nos HTMLs

### Benefício
O Supabase nunca ultrapassa ~268 MB → free tier sustentável indefinidamente.

---

## 📌 Pendente — Filtro Bimestral nos Dashboards

### Objetivo
Adicionar opção de visualização "no mês" além do atual "acumulado até o mês" nos dashboards de receita e despesa orçamentária.

### Status
Ideia levantada, análise de viabilidade feita, implementação adiada por decisão do usuário.