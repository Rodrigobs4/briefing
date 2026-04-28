-- Adicionar suporte a campos calculados
-- Este campo armazenará a configuração do cálculo em formato JSON
-- Exemplo: {"operation": "sum", "sourceFieldIds": ["uuid1", "uuid2"]}

ALTER TABLE public.fields
ADD COLUMN IF NOT EXISTS calculation_config jsonb DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.fields.calculation_config IS 'Configuração JSON para campos calculados. Formato: {"operation": "sum"|"subtract", "sourceFieldIds": ["id1", "id2", ...]}';
