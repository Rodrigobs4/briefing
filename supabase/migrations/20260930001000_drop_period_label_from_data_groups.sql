-- O rótulo das colunas de ano foi descartado: os cabeçalhos continuam "Ano 2024".
-- A referência de edital agora é um campo "Edital" exibido como nota na Fase Atual.

ALTER TABLE public.data_groups
DROP COLUMN IF EXISTS period_label;
