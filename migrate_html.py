"""
migrate_html.py — execução única
Remove os dados embutidos dos HTMLs do balanço orçamentário
e substitui por blocos fetch() que carregam os JSONs de data/.

Execute uma vez:
    python migrate_html.py

Após rodar, este arquivo pode ser deletado.
"""

from pathlib import Path

BASE_DIR = Path(__file__).parent
BO_DIR   = BASE_DIR / "balanco_orcamentario"

MARKER_START = "// ============ DADOS EMBUTIDOS"
MARKER_END   = "\nconst ANO_ATUAL"

# ── Bloco fetch para receita_orcamentaria.html ─────────────────────────────
# Carrega ../data/receita.json e separa em REGISTROS (cl.6) e PREVISAO (cl.5)
FETCH_RECEITA = """\
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

  fetch('../data/receita.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
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
"""

# ── Bloco fetch para despesa_orcamentaria.html ─────────────────────────────
# Carrega ../data/despesa.json e ../data/creditos_adicionais.json,
# combina em REGISTROS sem duplicatas.
FETCH_DESPESA = """\
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

  Promise.all([
    fetch('../data/despesa.json').then(function (r) {
      if (!r.ok) throw new Error('despesa.json — HTTP ' + r.status);
      return r.json();
    }),
    fetch('../data/creditos_adicionais.json').then(function (r) {
      if (!r.ok) throw new Error('creditos_adicionais.json — HTTP ' + r.status);
      return r.json();
    })
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
"""


def migrate(html_path: Path, fetch_block: str):
    print(f"\nProcessando: {html_path.name}")

    content = html_path.read_text(encoding="utf-8")

    start = content.find(MARKER_START)
    end   = content.find(MARKER_END, start)

    if start == -1:
        print(f"  ✗ Marcador de início não encontrado. Pulando.")
        return
    if end == -1:
        print(f"  ✗ Marcador de fim (const ANO_ATUAL) não encontrado. Pulando.")
        return

    # Tamanho do bloco removido (diagnóstico)
    bloco_removido = content[start:end]
    print(f"  → Bloco removido: {len(bloco_removido):,} caracteres")

    new_content = content[:start] + fetch_block + content[end:]

    html_path.write_text(new_content, encoding="utf-8")
    print(f"  ✓ Concluído. Arquivo novo: {len(new_content):,} caracteres")


def main():
    print("=" * 60)
    print("Migração: dados embutidos → fetch()")
    print("=" * 60)

    receita_path = BO_DIR / "receita_orcamentaria.html"
    despesa_path = BO_DIR / "despesa_orcamentaria.html"

    if not receita_path.exists():
        print(f"\n✗ Arquivo não encontrado: {receita_path}")
    else:
        migrate(receita_path, FETCH_RECEITA)

    if not despesa_path.exists():
        print(f"\n✗ Arquivo não encontrado: {despesa_path}")
    else:
        migrate(despesa_path, FETCH_DESPESA)

    print("\n" + "=" * 60)
    print("Próximos passos:")
    print("  1. Verifique os HTMLs (devem estar muito menores)")
    print("  2. Teste localmente abrindo os arquivos com um servidor:")
    print("       python -m http.server 8000")
    print("     Acesse http://localhost:8000/balanco_orcamentario/")
    print("  3. git add . && git commit -m 'refactor: dados via fetch' && git push")
    print("  4. Delete este arquivo (migrate_html.py) após confirmar que tudo funciona")
    print("=" * 60)


if __name__ == "__main__":
    main()
