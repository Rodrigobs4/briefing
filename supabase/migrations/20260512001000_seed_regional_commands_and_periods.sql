-- ==============================================================================
-- COMANDOS REGIONAIS E PERIODOS BASE
-- ==============================================================================
-- Os periodos abaixo sao apenas atalhos/presets iniciais.
-- O lancamento regional guarda reference_start_date e reference_end_date proprios,
-- entao nao e necessario criar um seed novo para cada ano futuro.

INSERT INTO public.regional_commands (code, name, type, order_index)
VALUES
    ('CPRMS', 'CPRMS', 'regional', 1),
    ('ATLANTICO', 'ATLÂNTICO', 'regional', 2),
    ('BAIA_DE_TODOS_OS_SANTOS', 'BAÍA DE TODOS OS SANTOS', 'regional', 3),
    ('CENTRAL', 'CENTRAL', 'regional', 4),
    ('NORTE', 'NORTE', 'regional', 5),
    ('SUL', 'SUL', 'regional', 6),
    ('LESTE', 'LESTE', 'regional', 7),
    ('SUDOESTE', 'SUDOESTE', 'regional', 8),
    ('OESTE', 'OESTE', 'regional', 9),
    ('CHAPADA', 'CHAPADA', 'regional', 10),
    ('CPME', 'COMANDO DE OPERAÇÕES ESPECIALIZADAS', 'specialized', 11)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    order_index = EXCLUDED.order_index,
    is_active = true;

INSERT INTO public.regional_report_periods (code, label, year, start_date, end_date, period_type, is_default)
VALUES
    ('2023_ANO', 'Ano de 2023', 2023, DATE '2023-01-01', DATE '2023-12-31', 'year', false),
    ('2024_ANO', 'Ano de 2024', 2024, DATE '2024-01-01', DATE '2024-12-31', 'year', false),
    ('2024_1SEM', '1º Semestre de 2024', 2024, DATE '2024-01-01', DATE '2024-06-30', 'custom', false),
    ('2024_JAN_JUL', 'Jan/2024 a Jul/2024', 2024, DATE '2024-01-01', DATE '2024-07-31', 'custom', false),
    ('2025_ANO', 'Ano de 2025', 2025, DATE '2025-01-01', DATE '2025-12-31', 'year', false),
    ('2026_ANO', 'Ano de 2026', 2026, DATE '2026-01-01', DATE '2026-12-31', 'year', false),
    ('2026_JAN_ABR', 'Jan/2026 a Abr/2026', 2026, DATE '2026-01-01', DATE '2026-04-30', 'custom', true)
ON CONFLICT (code) DO UPDATE
SET
    label = EXCLUDED.label,
    year = EXCLUDED.year,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    period_type = EXCLUDED.period_type,
    is_default = EXCLUDED.is_default;

-- Vinculo das unidades existentes aos Comandos Regionais:
-- Nao fazemos nenhum vinculo automatico aqui, porque isso deve ser conferido.
-- Exemplo para teste manual:
--
-- INSERT INTO public.unit_regional_commands (unit_id, regional_command_id, started_at)
-- SELECT u.id, rc.id, DATE '2026-01-01'
-- FROM public.units u
-- JOIN public.regional_commands rc ON rc.code = 'SUDOESTE'
-- WHERE u.name IN ('CPRSO', '9 BPM', '78 CIPM')
-- ON CONFLICT DO NOTHING;
