-- ==============================================================================
-- CATALOGO DE INDICADORES DO BRIEFING REGIONAL
-- ==============================================================================
-- Este seed cria o padrao do relatorio regional baseado no PDF de exemplo.
-- Ele nao cria unidades, nao apaga dados e nao altera valores ja preenchidos.

DROP FUNCTION IF EXISTS public._ensure_regional_briefing_section(text, text, text, integer, integer, text, text, text);
DROP FUNCTION IF EXISTS public._ensure_regional_briefing_section(text, text, text, integer, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public._ensure_regional_briefing_section(
    p_code text,
    p_title text,
    p_category_title text,
    p_category_order integer,
    p_order integer,
    p_mode text,
    p_source_strategy text DEFAULT 'manual',
    p_description text DEFAULT NULL,
    p_update_frequency text DEFAULT 'custom'
)
RETURNS uuid AS $$
DECLARE
    v_section_id uuid;
BEGIN
    INSERT INTO public.regional_briefing_sections (
        code,
        title,
        category_title,
        category_order,
        order_index,
        mode,
        source_strategy,
        update_frequency,
        description,
        is_active
    )
    VALUES (
        p_code,
        p_title,
        p_category_title,
        p_category_order,
        p_order,
        p_mode,
        p_source_strategy,
        p_update_frequency,
        p_description,
        true
    )
    ON CONFLICT (code) DO UPDATE
    SET
        title = EXCLUDED.title,
        category_title = EXCLUDED.category_title,
        category_order = EXCLUDED.category_order,
        order_index = EXCLUDED.order_index,
        mode = EXCLUDED.mode,
        source_strategy = EXCLUDED.source_strategy,
        update_frequency = EXCLUDED.update_frequency,
        description = EXCLUDED.description,
        is_active = true
    RETURNING id INTO v_section_id;

    RETURN v_section_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._ensure_regional_briefing_field(
    p_section_id uuid,
    p_code text,
    p_label text,
    p_field_type text,
    p_order integer,
    p_required boolean DEFAULT false,
    p_supports_comparison boolean DEFAULT false,
    p_aggregation_method text DEFAULT 'none',
    p_calculation_config jsonb DEFAULT NULL,
    p_source_config jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_field_id uuid;
BEGIN
    INSERT INTO public.regional_briefing_fields (
        section_id,
        code,
        label,
        field_type,
        order_index,
        is_required,
        supports_comparison,
        aggregation_method,
        calculation_config,
        source_config,
        is_active
    )
    VALUES (
        p_section_id,
        p_code,
        p_label,
        p_field_type,
        p_order,
        p_required,
        p_supports_comparison,
        p_aggregation_method,
        p_calculation_config,
        p_source_config,
        true
    )
    ON CONFLICT (section_id, code) DO UPDATE
    SET
        label = EXCLUDED.label,
        field_type = EXCLUDED.field_type,
        order_index = EXCLUDED.order_index,
        is_required = EXCLUDED.is_required,
        supports_comparison = EXCLUDED.supports_comparison,
        aggregation_method = EXCLUDED.aggregation_method,
        calculation_config = EXCLUDED.calculation_config,
        source_config = EXCLUDED.source_config,
        is_active = true
    RETURNING id INTO v_field_id;

    RETURN v_field_id;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    v_section_id uuid;
BEGIN
    v_section_id := public._ensure_regional_briefing_section('efetivo_regional', 'Efetivo Regional', 'Efetivo', 1, 1, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'visao_geral_regiao', 'Visão geral da região', 'textarea', 1, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'unidades_subordinadas', 'Unidades subordinadas', 'number', 2, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'municipios_abrangidos', 'Municípios abrangidos', 'number', 3, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'efetivo_total', 'Total geral de efetivo', 'number', 4, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'observacoes_efetivo', 'Observações do efetivo', 'textarea', 5, false, false, 'latest');

    v_section_id := public._ensure_regional_briefing_section('detalhamento_efetivo_unidade', 'Detalhamento do Efetivo por Unidade', 'Efetivo', 1, 2, 'collection', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'unidade_opm', 'Unidade / OPM', 'text', 1, true, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'municipio_sede', 'Município sede', 'text', 2, false, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'efetivo', 'Efetivo', 'number', 3, false, false, 'sum');

    v_section_id := public._ensure_regional_briefing_section('produtividade_operacional', 'Produtividade Operacional', 'Produtividade', 2, 3, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'apreensao_arma_fogo_regiao', 'Apreensão de arma de fogo - Região', 'number', 1, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'apreensao_arma_fogo_municipio_sede', 'Apreensão de arma de fogo - Município sede', 'number', 2, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'prisoes_flagrante_regiao', 'Prisões em flagrante - Região', 'number', 3, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'prisoes_flagrante_municipio_sede', 'Prisões em flagrante - Município sede', 'number', 4, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'apreensao_drogas_regiao', 'Apreensão de drogas - Região', 'number', 5, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'apreensao_drogas_municipio_sede', 'Apreensão de drogas - Município sede', 'number', 6, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'tco_lavrados_regiao', 'TCO lavrados - Região', 'number', 7, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'tco_lavrados_municipio_sede', 'TCO lavrados - Município sede', 'number', 8, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'conducoes_delegacia_regiao', 'Conduções à delegacia - Região', 'number', 9, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'conducoes_delegacia_municipio_sede', 'Conduções à delegacia - Município sede', 'number', 10, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'veiculos_recuperados_regiao', 'Veículos recuperados - Região', 'number', 11, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'veiculos_recuperados_municipio_sede', 'Veículos recuperados - Município sede', 'number', 12, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'adolescentes_apreendidos_regiao', 'Adolescentes apreendidos - Região', 'number', 13, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'adolescentes_apreendidos_municipio_sede', 'Adolescentes apreendidos - Município sede', 'number', 14, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'fonte_dados_produtividade', 'Fonte dos dados', 'text', 15, false, false, 'latest');

    v_section_id := public._ensure_regional_briefing_section('dados_cvli', 'Dados de CVLI', 'Indicadores Criminais', 3, 4, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'cvli_regiao', 'CVLI região', 'number', 1, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'cvli_municipio_sede', 'CVLI município sede', 'number', 2, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'cvli_mes_referencia', 'CVLI mês de referência', 'number', 3, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'analise_cvli_regiao', 'Análise CVLI da região', 'textarea', 4, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'analise_cvli_municipio_sede', 'Análise CVLI do município sede', 'textarea', 5, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'fonte_cvli', 'Fonte CVLI', 'text', 6, false, false, 'latest');

    v_section_id := public._ensure_regional_briefing_section('ocorrencias_crimes', 'Ocorrências de Crimes', 'Indicadores Criminais', 3, 5, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'roubo_veiculos_regiao', 'Roubo de veículos - Região', 'number', 1, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'roubo_veiculos_municipio_sede', 'Roubo de veículos - Município sede', 'number', 2, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'analise_roubo_veiculos_regiao', 'Análise roubo de veículos - Região', 'textarea', 3, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'analise_roubo_veiculos_municipio_sede', 'Análise roubo de veículos - Município sede', 'textarea', 4, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'roubo', 'Roubo', 'number', 5, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'roubo_estabelecimento_comercial', 'Roubo a estabelecimento comercial', 'number', 6, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'roubo_onibus', 'Roubo a ônibus', 'number', 7, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'roubo_carga', 'Roubo de carga', 'number', 8, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'uso_porte_entorpecente', 'Uso/Porte de substância entorpecente', 'number', 9, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'furto_veiculo', 'Furto de veículo', 'number', 10, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'estupro', 'Estupro', 'number', 11, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'tentativa_homicidio', 'Tentativa de homicídio', 'number', 12, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'fonte_ocorrencias', 'Fonte das ocorrências', 'text', 13, false, false, 'latest');

    v_section_id := public._ensure_regional_briefing_section('operacoes_realizadas_resumo', 'Operações Realizadas - Resumo', 'Operações', 4, 6, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'resumo_operacoes', 'Resumo das operações realizadas', 'textarea', 1, false, false, 'latest');

    v_section_id := public._ensure_regional_briefing_section('operacoes_realizadas', 'Principais Operações', 'Operações', 4, 7, 'collection', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'operacao', 'Operação', 'text', 1, true, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'periodicidade', 'Periodicidade', 'text', 2, false, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'foco', 'Foco', 'text', 3, false, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'breve_historico', 'Breve histórico', 'textarea', 4, false, false, 'list');

    v_section_id := public._ensure_regional_briefing_section('investimentos_totais', 'Investimentos Totais', 'Estrutura e Equipamentos', 5, 8, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'investimento_viaturas', 'Investimento em viaturas', 'currency', 1, false, false, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'investimento_instalacoes_fisicas', 'Investimento em instalações físicas', 'currency', 2, false, false, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'total_investimentos', 'Total de investimentos', 'calculated', 3, false, false, 'calculated', '{"operation":"sum","fields":["investimento_viaturas","investimento_instalacoes_fisicas"]}'::jsonb);

    v_section_id := public._ensure_regional_briefing_section('construcoes_andamento', 'Construções em Andamento', 'Estrutura e Equipamentos', 5, 9, 'collection', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'obra', 'Obra', 'text', 1, true, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'municipio', 'Município', 'text', 2, false, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'valor_estimado', 'Valor estimado', 'currency', 3, false, false, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'situacao', 'Situação', 'text', 4, false, false, 'list');

    v_section_id := public._ensure_regional_briefing_section('equipamentos_recebidos', 'Equipamentos Recebidos', 'Estrutura e Equipamentos', 5, 10, 'collection', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'equipamento', 'Equipamento', 'text', 1, true, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'unidade_contemplada', 'Unidade contemplada', 'text', 2, false, false, 'list');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'quantidade', 'Quantidade', 'number', 3, false, false, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'valor_estimado', 'Valor estimado', 'currency', 4, false, false, 'sum');

    v_section_id := public._ensure_regional_briefing_section('equipamentos_viaturas', 'Equipamentos e Viaturas', 'Estrutura e Equipamentos', 5, 11, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'colete_balistico', 'Colete balístico', 'number', 1, false, false, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'arma_fogo', 'Arma de fogo', 'number', 2, false, false, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'viatura_propria', 'Viatura própria', 'number', 3, false, false, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'viatura_locada', 'Viatura locada', 'number', 4, false, false, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'viatura_convenio', 'Viatura convênio', 'number', 5, false, false, 'sum');

    v_section_id := public._ensure_regional_briefing_section('ronda_maria_penha_historico', 'Operação Ronda Maria da Penha - Histórico', 'Programas e Ações Especializadas', 6, 12, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'medidas_protetivas', 'Medidas protetivas', 'number', 1, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'prisoes_flagrante', 'Prisões em flagrante', 'number', 2, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'fiscalizacao_mpu', 'Fiscalização de MPU', 'number', 3, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'rondas', 'Rondas', 'number', 4, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'contatos_remotos', 'Contatos remotos', 'number', 5, false, true, 'sum');

    v_section_id := public._ensure_regional_briefing_section('ronda_maria_penha_periodo_atual', 'Operação Ronda Maria da Penha - Período Atual', 'Programas e Ações Especializadas', 6, 13, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'mulheres_atendidas', 'Mulheres atendidas', 'number', 1, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'fiscalizacoes_medidas_protetivas', 'Fiscalizações de medidas protetivas', 'number', 2, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'contatos_remotos_atendidas_agressores', 'Contatos remotos com atendidas ou agressores', 'number', 3, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'observacoes_ronda_maria_penha', 'Observações do período', 'textarea', 4, false, false, 'latest');

    v_section_id := public._ensure_regional_briefing_section('patrulha_solidaria', 'Patrulha Solidária', 'Programas e Ações Especializadas', 6, 14, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'familias_cadastradas', 'Famílias cadastradas', 'number', 1, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'acoes_humanitarias_continuadas', 'Ações humanitárias continuadas', 'textarea', 2, false, false, 'latest');

    v_section_id := public._ensure_regional_briefing_section('proerd', 'PROERD', 'Programas e Ações Especializadas', 6, 15, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'alunos_contemplados_regiao', 'Alunos contemplados na região', 'number', 1, false, true, 'sum');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'alunos_contemplados_municipio_sede', 'Alunos contemplados no município sede', 'number', 2, false, true, 'sum');

    v_section_id := public._ensure_regional_briefing_section('policiamento_comunitario_rural_georreferenciado', 'Policiamento Comunitário Rural Georreferenciado', 'Programas e Ações Especializadas', 6, 16, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'fortalecimento_seguranca_areas_rurais', 'Fortalecimento da segurança em áreas rurais', 'textarea', 1, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'unidade_pioneira', 'Unidade pioneira', 'text', 2, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'modernizacao_eficacia_seguranca_local', 'Modernização e eficácia da segurança pública local', 'textarea', 3, false, false, 'latest');

    v_section_id := public._ensure_regional_briefing_section('centro_valorizacao_policial', 'Centro de Valorização Policial', 'Valorização Policial', 7, 17, 'snapshot', 'manual');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'academia_musculacao_artes_marciais', 'Academia de musculação e artes marciais', 'textarea', 1, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'grupos_terapeuticos_fisioterapia_nutricao', 'Grupos terapêuticos, fisioterapia e nutrição', 'textarea', 2, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'orientacoes_juridica_psicologia_assistencia_social', 'Orientações jurídica, psicologia e assistência social', 'textarea', 3, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'atendimento_medico_odontologico', 'Atendimento médico e odontológico em diversas áreas', 'textarea', 4, false, false, 'latest');
    PERFORM public._ensure_regional_briefing_field(v_section_id, 'sistema_exames_laboratoriais', 'Sistema informatizado para exames laboratoriais', 'textarea', 5, false, false, 'latest');
END;
$$;

UPDATE public.regional_briefing_sections
SET update_frequency = CASE code
    WHEN 'efetivo_regional' THEN 'yearly'
    WHEN 'detalhamento_efetivo_unidade' THEN 'yearly'
    WHEN 'produtividade_operacional' THEN 'weekly'
    WHEN 'dados_cvli' THEN 'semester'
    WHEN 'ocorrencias_crimes' THEN 'semester'
    WHEN 'operacoes_realizadas_resumo' THEN 'weekly'
    WHEN 'operacoes_realizadas' THEN 'weekly'
    WHEN 'investimentos_totais' THEN 'yearly'
    WHEN 'construcoes_andamento' THEN 'semester'
    WHEN 'equipamentos_recebidos' THEN 'semester'
    WHEN 'equipamentos_viaturas' THEN 'yearly'
    WHEN 'ronda_maria_penha_historico' THEN 'yearly'
    WHEN 'ronda_maria_penha_periodo_atual' THEN 'semester'
    WHEN 'patrulha_solidaria' THEN 'semester'
    WHEN 'proerd' THEN 'semester'
    WHEN 'policiamento_comunitario_rural_georreferenciado' THEN 'fixed'
    WHEN 'centro_valorizacao_policial' THEN 'fixed'
    ELSE update_frequency
END
WHERE code IN (
    'efetivo_regional',
    'detalhamento_efetivo_unidade',
    'produtividade_operacional',
    'dados_cvli',
    'ocorrencias_crimes',
    'operacoes_realizadas_resumo',
    'operacoes_realizadas',
    'investimentos_totais',
    'construcoes_andamento',
    'equipamentos_recebidos',
    'equipamentos_viaturas',
    'ronda_maria_penha_historico',
    'ronda_maria_penha_periodo_atual',
    'patrulha_solidaria',
    'proerd',
    'policiamento_comunitario_rural_georreferenciado',
    'centro_valorizacao_policial'
);

-- Campos antigos de comparativo direto ficam inativos.
-- O comparativo deve ser calculado pelo sistema comparando dois periodos preenchidos.
UPDATE public.regional_briefing_fields f
SET is_active = false
FROM public.regional_briefing_sections s
WHERE s.id = f.section_id
  AND s.code IN ('dados_cvli', 'ocorrencias_crimes')
  AND f.code IN (
      'cvli_regiao_periodo_comparativo',
      'cvli_regiao_periodo_atual',
      'cvli_regiao_variacao_percentual',
      'cvli_municipio_sede_periodo_comparativo',
      'cvli_municipio_sede_periodo_atual',
      'cvli_municipio_sede_variacao_percentual',
      'roubo_veiculos_periodo_comparativo',
      'roubo_veiculos_periodo_atual',
      'roubo_veiculos_variacao_percentual'
  );

DROP FUNCTION public._ensure_regional_briefing_field(uuid, text, text, text, integer, boolean, boolean, text, jsonb, jsonb);
DROP FUNCTION public._ensure_regional_briefing_section(text, text, text, integer, integer, text, text, text, text);
