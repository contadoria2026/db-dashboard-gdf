-- =============================================================
-- Supabase: criação das tabelas do projeto Dashboard Fiscal GDF
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard)
-- =============================================================

-- -------------------------------------------------------
-- FASE 1: restos_a_pagar
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS restos_a_pagar (
    id              BIGSERIAL PRIMARY KEY,
    ano             INTEGER        NOT NULL,
    coug            TEXT           NOT NULL,
    noug            TEXT,
    cocontacontabil INTEGER        NOT NULL,
    cat             TEXT,
    nocat           TEXT,
    gnd             TEXT,
    nognd           TEXT,
    saldo           NUMERIC(18,2),
    inmes           INTEGER        NOT NULL,
    atualizado_em   TIMESTAMPTZ    DEFAULT NOW(),
    UNIQUE (ano, coug, cocontacontabil, cat, gnd, inmes)
);

-- Permite leitura pública sem autenticação (dashboards públicos)
ALTER TABLE restos_a_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura publica" ON restos_a_pagar
    FOR SELECT USING (true);

-- -------------------------------------------------------
-- FASE 2 (futuro): receita
-- -------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS receita ( ... );

-- -------------------------------------------------------
-- FASE 2 (futuro): despesa
-- -------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS despesa ( ... );

-- -------------------------------------------------------
-- FASE 2 (futuro): rcl
-- -------------------------------------------------------
-- CREATE TABLE IF NOT EXISTS rcl ( ... );
