# Retomada do Projeto — Gzip + GitHub Pages

## O que foi feito (sessão de 17/04/2026)

A arquitetura foi implementada completamente. Os arquivos abaixo foram modificados:

### 1. `etl.py`
- Adicionado `import gzip`
- Criado diretório `data/gz/` (gerado automaticamente ao rodar)
- Nova função `save_json_gz()` — comprime com `compresslevel=9`, salva em `data/gz/`
- Queries de `despesa.json` e `creditos_adicionais.json` **reativadas** (estavam comentadas por causa do tamanho > 100 MB)
- Pipeline agora chama `save_json()` + `save_json_gz()` para cada query

### 2. `.github/workflows/etl.yml`
- Step anterior (commit de JSONs) substituído por: commitar os `.json.gz` de `data/gz/` direto no repositório
- O GitHub Actions usa `git add data/gz/` e faz push automático

### 3. `funcao-subfuncao/index.html`
- Fetch migrado de `../data/saldo_funcao_subfuncao.json` para `../data/gz/saldo_funcao_subfuncao.json.gz`

### 4. `balanco_orcamentario/receita_orcamentaria.html`
- Fetch migrado de `../data/receita.json` para `../data/gz/receita.json.gz`

### 5. `balanco_orcamentario/despesa_orcamentaria.html`
- Fetch migrado de `../data/despesa.json` e `../data/creditos_adicionais.json`
  para `../data/gz/despesa.json.gz` e `../data/gz/creditos_adicionais.json.gz`
- Lógica de filtros, cards e gráficos intacta

Todos os dashboards usam `DecompressionStream('gzip')` nativa do browser — sem biblioteca extra.

---

## Por que não usar GitHub Releases (decisão técnica)

A ideia inicial era hospedar os JSONs grandes no GitHub Releases para contornar o limite de 100 MB por arquivo do git. Porém, ao testar, os dashboards retornavam `Failed to fetch`.

**Causa:** o GitHub Releases serve arquivos de um domínio diferente (`objects.githubusercontent.com`). Quando o dashboard hospedado no GitHub Pages (`contadoriadf.github.io`) tenta buscar dados desse domínio, o browser bloqueia a requisição por política de CORS — Cross-Origin Resource Sharing. É uma proteção do browser que impede páginas de buscar dados de domínios diferentes sem autorização explícita do servidor.

**Solução:** com a compressão gzip (redução de ~85%), o maior arquivo passou de >100 MB para apenas **15 MB**. Isso permite commitar os `.json.gz` diretamente no repositório. O GitHub Pages serve esses arquivos no mesmo domínio dos dashboards — sem CORS, sem bloqueio.

```
Sem gzip:  despesa.json     → >100 MB  → não cabe no git
Com gzip:  despesa.json.gz  →   15 MB  → cabe no git, sem CORS
```

---

## Arquitetura final

```
Oracle DB
   ↓ (etl.py — roda no self-hosted runner)
data/gz/*.json.gz  (compresslevel=9, reducao ~85%)
   ↓ (git commit + push via GitHub Actions)
Repositorio: ContadoriaDF/dashboard  (branch main)
   ↓ (GitHub Pages serve o mesmo dominio)
Dashboards: fetch('../data/gz/arquivo.json.gz') — sem CORS
   ↓ (DecompressionStream no browser)
Dados carregados
```

---

## Pendente — commitar e testar

### Passo 1 — Verificar .gitignore
Se `data/gz/` estiver no `.gitignore`, remova essa linha. Os arquivos gz precisam ser versionados.

### Passo 2 — Commitar todas as mudanças
```
git add etl.py .github/workflows/etl.yml funcao-subfuncao/index.html balanco_orcamentario/receita_orcamentaria.html balanco_orcamentario/despesa_orcamentaria.html
git commit -m "fix: busca gz do repositorio em vez do GitHub Releases (sem CORS)"
git push
```

### Passo 3 — Disparar o workflow manualmente
No GitHub: **Actions → ETL Oracle - JSON → Run workflow**
O workflow vai gerar os `.json.gz` e commitá-los em `data/gz/`.

### Passo 4 — Verificar os dashboards
- `https://contadoriadf.github.io/dashboard/funcao-subfuncao/`
- `https://contadoriadf.github.io/dashboard/balanco_orcamentario/receita_orcamentaria.html`
- `https://contadoriadf.github.io/dashboard/balanco_orcamentario/despesa_orcamentaria.html`
