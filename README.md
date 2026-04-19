# Dashboards Fiscais — ContDF/SEEC

Dashboards interativos de execução orçamentária do Governo do Distrito Federal, publicados via GitHub Pages e alimentados por ETL automatizado a partir do banco Oracle.

🔗 **Acesso público:** https://contadoriadf.github.io/dashboard/

---

## Arquitetura

```
Oracle (ORAPRD06)
    ↓ etl.py  (Python + oracledb)
data/gz/*.json.gz  (comprimido com gzip, ~85% menor)
    ↓ git push  (GitHub Actions — runner self-hosted)
GitHub Pages
    ↓ fetch + DecompressionStream
Dashboards HTML  (browser descomprime em tempo real)
```

O ETL roda automaticamente todo dia às **06:00 (horário de Brasília)** via GitHub Actions com runner self-hosted instalado na estação de trabalho do James (james.coelho).

---

## Estrutura do projeto

```
├── index.html                          # Página inicial — links para os dashboards
├── etl.py                              # ETL: Oracle → JSON.GZ
├── requirements.txt                    # Dependências Python
├── .env                                # Credenciais (não versionado)
├── .github/
│   └── workflows/
│       └── etl.yml                     # Workflow de automação (Actions)
├── data/
│   ├── gz/                             # Arquivos comprimidos (commitados)
│   │   ├── despesa.json.gz
│   │   ├── receita.json.gz
│   │   └── saldo_funcao_subfuncao.json.gz
│   └── queries/                        # SQLs das extrações
│       ├── DESPESA.sql
│       ├── RECEITA.sql
│       └── saldocontabil_funcao_subfuncao.sql
├── balanco_orcamentario/
│   ├── index.html                      # Menu: Receita e Despesa
│   ├── receita_orcamentaria.html       # Dashboard de Receita
│   └── despesa_orcamentaria.html       # Dashboard de Despesa
├── funcao-subfuncao/
│   └── index.html                      # Dashboard Função e Subfunção
└── tools/
    └── Brasão_do_Distrito_Federal_Brasil.png
```

---

## Configuração do ambiente

### 1. Pré-requisitos

- Python 3.10+
- Acesso à rede do GDF (VPN ou máquina interna)
- Oracle Instant Client (opcional — thin mode não precisa)

### 2. Instalar dependências

```cmd
py -m pip install -r requirements.txt
```

### 3. Configurar credenciais

Crie o arquivo `.env` na raiz do projeto:

```env
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_DSN=10.69.1.118:1521/oraprd06
ORACLE_CLIENT_PATH=          # deixe vazio para thin mode
DB_MIN_CONNECTIONS=1
DB_MAX_CONNECTIONS=5
DB_INCREMENT_CONNECTIONS=1
```

### 4. Executar o ETL manualmente

```cmd
py etl.py
```

Os arquivos `.json.gz` serão gerados em `data/gz/`.

---

## GitHub Actions — Runner self-hosted

O workflow `etl.yml` roda no servidor do GDF via runner self-hosted.

### Registrar o runner

1. Acesse: `github.com/contadoriadf/dashboard` → Settings → Actions → Runners → **New self-hosted runner**
2. Siga as instruções para Windows
3. Configure com:
   ```cmd
   .\config.cmd --url https://github.com/contadoriadf/dashboard --token <TOKEN>
   ```
4. Inicie o runner:
   ```cmd
   .\run.cmd
   ```

### Secrets necessários no repositório

Configure em Settings → Secrets → Actions:

| Secret | Descrição |
|--------|-----------|
| `DB_USER` | Usuário Oracle |
| `DB_PASSWORD` | Senha Oracle |
| `DB_DSN` | DSN de conexão |
| `ORACLE_CLIENT_PATH` | Caminho do Oracle Client (vazio = thin mode) |
| `DB_MIN_CONNECTIONS` | Mínimo de conexões no pool |
| `DB_MAX_CONNECTIONS` | Máximo de conexões no pool |
| `DB_INCREMENT_CONNECTIONS` | Incremento do pool |

---

## Colaboradores — como contribuir

Colaboradores não precisam de acesso à pasta local do administrador. O fluxo é:

### 1. Clonar o repositório

```cmd
git clone https://github.com/contadoriadf/dashboard.git
```

Isso baixa uma cópia completa do projeto para a máquina do colaborador.

### 2. Desenvolver localmente

Criar a pasta do novo dashboard, desenvolver o `index.html` seguindo o padrão visual do projeto e adicionar a query SQL em `data/queries/`.

### 3. Enviar para o GitHub

```cmd
git add .
git commit -m "feat: novo dashboard RCL"
git push origin main
```

O GitHub centraliza tudo. Ninguém acessa a pasta do outro — cada um trabalha na sua cópia local e o repositório é o ponto de encontro.

### 4. Sincronizar após contribuição de outro colaborador

```cmd
git pull origin main
```

### Conceder acesso a colaboradores

Acesse `github.com/contadoriadf/dashboard` → **Settings → Collaborators → Add people** e adicione o usuário GitHub do colaborador.

---

## Reverter alterações com Git

### Ver histórico de commits

```cmd
git log --oneline
```

Exemplo de saída:
```
a1b2c3d fix: remove backslash antes do DOCTYPE
e4f5g6h feat: brasão via tools/ em todos os dashboards
f7h8i9j feat: navegação hierárquica - botão voltar por nível
```

### Recuperar um arquivo específico de um commit anterior

```cmd
git checkout <hash> -- nome-do-arquivo.html
```

Exemplo — restaurar a despesa para como estava em `e4f5g6h`:
```cmd
git checkout e4f5g6h -- balanco_orcamentario/despesa_orcamentaria.html
```

Após recuperar, commitar novamente:
```cmd
git add .
git commit -m "fix: reverte arquivo para versão anterior"
git push origin main
```

### Desfazer o último commit (mantendo os arquivos)

```cmd
git revert HEAD
git push origin main
```

### Voltar tudo para um commit específico (⚠️ irreversível)

```cmd
git reset --hard <hash>
git push origin main --force
```

> **Atenção:** `reset --hard` apaga permanentemente tudo que veio após aquele commit. Use com cautela.

---

## Adicionar novo dashboard

1. Crie uma pasta para o novo demonstrativo (ex: `resultado-primario/`)
2. Desenvolva o `index.html` seguindo o padrão visual dos dashboards existentes
3. Inclua o botão **← Voltar** no cabeçalho apontando para o nível anterior
4. Adicione a query SQL em `data/queries/` e registre em `etl.py` (lista `QUERIES`)
5. Adicione o link na página `index.html` da seção correspondente ou no `index.html` raiz

---

## Navegação

```
Início (index.html)
├── Balanço Orçamentário  →  balanco_orcamentario/index.html
│   ├── Receita Orçamentária
│   └── Despesa Orçamentária
└── Função e Subfunção    →  funcao-subfuncao/index.html
```

---

*ContDF/SEEC — Contadoria Geral do Distrito Federal*
