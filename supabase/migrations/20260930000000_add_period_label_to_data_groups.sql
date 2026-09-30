-- Rótulo das colunas do comparativo anual no relatório (ex.: "Edital 2024" em vez de "Ano 2024").

ALTER TABLE public.data_groups
ADD COLUMN IF NOT EXISTS period_label text;

COMMENT ON COLUMN public.data_groups.period_label IS
'Prefixo das colunas de ano no relatório. Nulo usa "Ano".';
