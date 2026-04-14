"""
ETL: Oracle (Receitas BO/GDF) → JSON → GitHub
Extrai dados via oracledb e salva arquivos JSON em data/
para consumo pelo dashboard hospedado no GitHub Pages.
"""

import os
import json
import logging
from datetime import datetime, date, timezone
from decimal import Decimal
from pathlib import Path
from dotenv import load_dotenv

# ─── Carrega variáveis de ambiente ────────────────────────────────────────────
load_dotenv()

DB_USER       = os.getenv("DB_USER")
DB_PASSWORD   = os.getenv("DB_PASSWORD")
DB_DSN        = os.getenv("DB_DSN", "10.69.1.118:1521/oraprd06")
CLIENT_PATH   = os.getenv("ORACLE_CLIENT_PATH", "").strip()

DB_MIN  = int(os.getenv("DB_MIN_CONNECTIONS", 1))
DB_MAX  = int(os.getenv("DB_MAX_CONNECTIONS", 5))
DB_INC  = int(os.getenv("DB_INCREMENT_CONNECTIONS", 1))

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ─── Diretório de saída ───────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_DIR.mkdir(exist_ok=True)


# ──────────────────────────────────────────────────────────────────────────────
#  CONFIGURE AQUI — adicione ou edite as queries dos seus projetos
#
#  Cada item:
#    "file"  → nome do arquivo JSON gerado dentro de data/
#    "query" → SELECT executado no Oracle
# ──────────────────────────────────────────────────────────────────────────────
QUERIES = [
    {
        # Saldo contábil por função e subfunção — MIL2026
        # Fonte: MIL2026.SALDOCONTABIL + FUNCAO + SUBFUNCAO
        # Filtro: contas 52211, 52212, 52215, 52219, 62213 (5 dígitos)
        #         e contas 6221303, 6221304, 6221307 (7 dígitos)
        #         meses 1 e 2
        "file": "saldo_funcao_subfuncao.json",
        "query": """
            SELECT
                SC.*,
                FU.NOFUNCAO,
                SU.NOSUBFUNCAO,
                SUBSTR(SC.CONATUREZA, 3, 2) AS COMODALIDADE
            FROM MIL2026.SALDOCONTABIL SC
            LEFT JOIN MIL2026.FUNCAO    FU ON SC.COFUNCAO    = FU.COFUNCAO
            LEFT JOIN MIL2026.SUBFUNCAO SU ON SC.COSUBFUNCAO = SU.COSUBFUNCAO
            WHERE (
                SUBSTR(SC.COCONTACONTABIL, 1, 5) IN ('52211','52212','52215','52219','62213')
                OR SUBSTR(SC.COCONTACONTABIL, 1, 7) IN ('6221303','6221304','6221307')
            )
            AND SC.INMES IN (1, 2)
            ORDER BY FU.COFUNCAO, SU.COSUBFUNCAO
        """,
    },
    # Adicione mais queries aqui seguindo o mesmo padrão:
    # {
    #     "file": "outro_dado.json",
    #     "query": "SELECT ... FROM sua_tabela",
    # },
]
# ──────────────────────────────────────────────────────────────────────────────


def serialize(value):
    """Converte tipos Oracle não serializáveis em JSON."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def fetch(cursor, query: str) -> list[dict]:
    """Executa query e retorna lista de dicionários."""
    cursor.execute(query)
    columns = [col[0].lower() for col in cursor.description]
    return [
        {col: serialize(val) for col, val in zip(columns, row)}
        for row in cursor.fetchall()
    ]


def save_json(filename: str, data: list[dict]):
    """Salva dados como JSON com metadados."""
    payload = {
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
        "total": len(data),
        "dados": data,
    }
    path = OUTPUT_DIR / filename
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info(f"  ✓ {filename} — {len(data)} registros salvos")


def init_oracle():
    """
    Inicializa oracledb.
    - Usa thick mode se ORACLE_CLIENT_PATH estiver preenchido no .env
    - Caso contrário usa thin mode (padrão, funciona com Oracle 12.1+)
    """
    import oracledb

    if CLIENT_PATH:
        log.info(f"Inicializando thick mode → {CLIENT_PATH}")
        oracledb.init_oracle_client(lib_dir=CLIENT_PATH)
    else:
        log.info("Usando thin mode (sem Oracle Client local)")

    return oracledb


def run():
    try:
        oracledb = init_oracle()
    except ImportError:
        raise ImportError("Execute: pip install oracledb")

    if not DB_USER or not DB_PASSWORD:
        raise ValueError("DB_USER e DB_PASSWORD precisam estar definidos no .env")

    log.info(f"Conectando ao Oracle → {DB_DSN}")

    pool = oracledb.create_pool(
        user=DB_USER,
        password=DB_PASSWORD,
        dsn=DB_DSN,
        min=DB_MIN,
        max=DB_MAX,
        increment=DB_INC,
    )

    with pool.acquire() as conn:
        log.info("Conexão estabelecida. Iniciando extração...")
        with conn.cursor() as cur:
            for item in QUERIES:
                log.info(f"Extraindo → {item['file']}")
                try:
                    data = fetch(cur, item["query"])
                    save_json(item["file"], data)
                except Exception as e:
                    log.error(f"  ✗ Erro em {item['file']}: {e}")

    pool.close()
    log.info("ETL concluído com sucesso.")


if __name__ == "__main__":
    run()