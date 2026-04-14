# Configuração GitHub — ETL Oracle → JSON → Dashboard

## Estrutura do Projeto

```
DB_JasonGitHub/
├── .github/
│   └── workflows/
│       └── etl.yml          ← workflow do GitHub Actions
├── data/
│   └── saldo_funcao_subfuncao.json
├── etl.py
├── requirements.txt
├── .gitignore               ← contém .env (nunca sobe para o GitHub)
└── .env                     ← credenciais locais (não vai ao GitHub)
```

> O arquivo `etl.yml` na raiz da pasta pode ser deletado — o que vale é o que está em `.github/workflows/`.

---

## Passo 1 — Criar o repositório no GitHub

1. Acesse https://github.com/new
2. Dê um nome ao repositório (ex: `db-dashboard-gdf`)
3. Visibilidade: **Public** (necessário para GitHub Pages gratuito) ou **Private** (requer plano pago para Pages)
4. Clique em **Create repository** — sem marcar README, .gitignore ou licença

---

## Passo 2 — Configurar os Secrets (credenciais do banco)

No repositório: **Settings → Secrets and variables → Actions → New repository secret**

| Nome do Secret           | Valor                        |
|--------------------------|------------------------------|
| `DB_USER`                | usuário Oracle               |
| `DB_PASSWORD`            | senha Oracle                 |
| `DB_DSN`                 | `10.69.1.118:1521/oraprd06`  |
| `DB_MIN_CONNECTIONS`     | `1`                          |
| `DB_MAX_CONNECTIONS`     | `5`                          |
| `DB_INCREMENT_CONNECTIONS` | `1`                        |

---

## Passo 3 — Instalar o Git (se não tiver)

Baixe em: https://git-scm.com/download/win

Após instalar, feche e reabra o PowerShell. Confirme com:
```powershell
git --version
```

---

## Passo 4 — Subir o código (primeiro push)

Abrir PowerShell dentro da pasta do projeto e rodar:

```powershell
git init
git branch -M main
git remote add origin https://github.com/contadoria2026/db-dashboard-gdf.git
git add .
git commit -m "feat: setup inicial ETL Oracle → JSON"
git push -u origin main
```

### Se o remote já existir com URL errada:
```powershell
git remote set-url origin https://github.com/contadoria2026/db-dashboard-gdf.git
git remote -v   # confirma a URL
git push -u origin main
```

---

## Passo 5 — Habilitar GitHub Pages

**Settings → Pages → Source → Deploy from a branch**

- Branch: `main`
- Folder: `/ (root)`
- Clicar em **Save**

Dashboard ficará em: `https://contadoria2026.github.io/db-dashboard-gdf/`

### ⚠️ Pages não aparece no menu?

Causa mais comum: repositório **Private** em conta gratuita.

**Solução A — Tornar público:**
Settings → General → rolar até o fim → "Change visibility" → "Make public"

**Solução B — Usar GitHub Pro** (conta paga) para manter privado com Pages ativo.

> Dados do GDF são públicos — repositório público é aceitável na maioria dos casos.

---

## Passo 6 — Testar o workflow manualmente

No repositório: **Actions → ETL Oracle → JSON → Run workflow**

Executa o ETL imediatamente sem esperar o agendamento (06h horário de Brasília).
Os logs aparecem em tempo real. Se tudo estiver correto, o arquivo
`data/saldo_funcao_subfuncao.json` é atualizado com um novo commit automático.

---

## Agendamento configurado (etl.yml)

```yaml
on:
  schedule:
    - cron: "0 9 * * *"   # Todo dia às 09:00 UTC = 06:00 Brasília
  workflow_dispatch:        # Permite rodar manualmente
```

---

## Próximo passo

Criar o `index.html` do dashboard que lê o JSON via `fetch()` e exibe os dados.
