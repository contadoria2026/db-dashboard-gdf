# Roadmap — Dashboards Fiscais GDF

> Registro dos planos de evolução do projeto. Atualizado em 26/04/2026.

---

## ✅ Concluído

- Pipeline Oracle → ETL Python → JSON.gz → GitHub → GitHub Pages
- Dashboards: RCL, Receita Orçamentária, Despesa Orçamentária, Restos a Pagar
- Runner self-hosted com GitHub Actions (schedule diário 06:00 Brasília)
- Treemap ECharts em receita e despesa (composição por espécie/GND)
- Gauge + treemap lado a lado acima dos dados detalhados
- Supabase como contingência: ETL faz upsert paralelo nas 4 tabelas; dashboards buscam gz do GitHub Pages e caem automaticamente no Supabase em caso de falha (testado e validado em 26/04/2026)

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

## ✅ Concluído — Supabase como Contingência

### Arquitetura implementada

```
ETL (etl.py)
  ├── gera gz  →  commit no GitHub  →  GitHub Pages  (produção, fonte primária)
  └── upsert   →  Supabase API      →  fallback automático nos HTMLs
```

### O que foi feito
- Projeto Supabase criado (free tier) com 4 tabelas: `receita`, `despesa`, `rcl`, `restos_a_pagar`
- Secrets `SUPABASE_URL` e `SUPABASE_KEY` configurados no GitHub
- `etl.py` adaptado: upsert paralelo no Supabase após gerar os gz
- Dashboards atualizados: tentam gz primeiro; se falhar, buscam Supabase automaticamente (sem intervenção do usuário)
- Testado e validado em 26/04/2026 via bloqueio de URL no DevTools

### Decisão de arquitetura
GitHub Pages permanece como fonte primária. Supabase é contingência passiva — ativo só em caso de falha. Estratégia híbrida de armazenamento descartada: com teto de 4 anos e tabelas pequenas (exceto despesa), o free tier comporta todos os dados sem necessidade de arquivamento em gz.

---

## 📌 Pendente — Filtro Bimestral nos Dashboards

### Objetivo
Adicionar opção de visualização "no mês" além do atual "acumulado até o mês" nos dashboards de receita e despesa orçamentária.

### Status
Ideia levantada, análise de viabilidade feita, implementação adiada por decisão do usuário.