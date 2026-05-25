-- ==============================================================================
-- SEED DE EXEMPLO - BRIEFING REGIONAL LESTE
-- ==============================================================================
-- Popula automaticamente dados demonstrativos para a regiao LESTE.
-- Periodo: 1º Semestre de 2024.
--
-- Este seed e idempotente para secoes snapshot.
-- Para secoes collection, remove e recria apenas registros com status = 'seed_leste'.

CREATE OR REPLACE FUNCTION public._ensure_leste_regional_entry(
    p_section_code text,
    p_reference_label text,
    p_reference_start_date date,
    p_reference_end_date date
)
RETURNS uuid AS $$
DECLARE
    v_command_id uuid;
    v_section_id uuid;
    v_entry_id uuid;
BEGIN
    SELECT id INTO v_command_id
    FROM public.regional_commands
    WHERE code = 'LESTE'
    LIMIT 1;

    IF v_command_id IS NULL THEN
        RAISE EXCEPTION 'Comando regional LESTE nao encontrado. Rode primeiro o seed de comandos regionais.';
    END IF;

    SELECT id INTO v_section_id
    FROM public.regional_briefing_sections
    WHERE code = p_section_code
    LIMIT 1;

    IF v_section_id IS NULL THEN
        RAISE EXCEPTION 'Secao regional % nao encontrada. Rode primeiro o seed de indicadores regionais.', p_section_code;
    END IF;

    SELECT id INTO v_entry_id
    FROM public.regional_briefing_entries
    WHERE regional_command_id = v_command_id
      AND section_id = v_section_id
      AND reference_start_date = p_reference_start_date
      AND reference_end_date = p_reference_end_date
    LIMIT 1;

    IF v_entry_id IS NULL THEN
        INSERT INTO public.regional_briefing_entries (
            regional_command_id,
            section_id,
            reference_label,
            reference_start_date,
            reference_end_date
        )
        VALUES (
            v_command_id,
            v_section_id,
            p_reference_label,
            p_reference_start_date,
            p_reference_end_date
        )
        RETURNING id INTO v_entry_id;
    ELSE
        UPDATE public.regional_briefing_entries
        SET
            reference_label = p_reference_label,
            reference_start_date = p_reference_start_date,
            reference_end_date = p_reference_end_date
        WHERE id = v_entry_id;
    END IF;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._set_leste_regional_value(
    p_entry_id uuid,
    p_section_code text,
    p_field_code text,
    p_value_text text DEFAULT NULL,
    p_value_number numeric DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_field_id uuid;
BEGIN
    SELECT f.id INTO v_field_id
    FROM public.regional_briefing_fields f
    JOIN public.regional_briefing_sections s ON s.id = f.section_id
    WHERE s.code = p_section_code
      AND f.code = p_field_code
    LIMIT 1;

    IF v_field_id IS NULL THEN
        RAISE EXCEPTION 'Campo %.% nao encontrado.', p_section_code, p_field_code;
    END IF;

    INSERT INTO public.regional_briefing_values (
        entry_id,
        field_id,
        value_text,
        value_number
    )
    VALUES (
        p_entry_id,
        v_field_id,
        p_value_text,
        p_value_number
    )
    ON CONFLICT (entry_id, field_id) DO UPDATE
    SET
        value_text = EXCLUDED.value_text,
        value_number = EXCLUDED.value_number,
        value_json = NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._add_leste_regional_collection_item(
    p_section_code text,
    p_reference_label text,
    p_reference_start_date date,
    p_reference_end_date date
)
RETURNS uuid AS $$
DECLARE
    v_command_id uuid;
    v_section_id uuid;
    v_item_id uuid;
BEGIN
    SELECT id INTO v_command_id
    FROM public.regional_commands
    WHERE code = 'LESTE'
    LIMIT 1;

    SELECT id INTO v_section_id
    FROM public.regional_briefing_sections
    WHERE code = p_section_code
    LIMIT 1;

    IF v_command_id IS NULL OR v_section_id IS NULL THEN
        RAISE EXCEPTION 'Comando LESTE ou secao % nao encontrados.', p_section_code;
    END IF;

    INSERT INTO public.regional_briefing_collection_items (
        regional_command_id,
        section_id,
        reference_label,
        reference_start_date,
        reference_end_date,
        status
    )
    VALUES (
        v_command_id,
        v_section_id,
        p_reference_label,
        p_reference_start_date,
        p_reference_end_date,
        'seed_leste'
    )
    RETURNING id INTO v_item_id;

    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._set_leste_regional_collection_value(
    p_item_id uuid,
    p_section_code text,
    p_field_code text,
    p_value_text text DEFAULT NULL,
    p_value_number numeric DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_field_id uuid;
BEGIN
    SELECT f.id INTO v_field_id
    FROM public.regional_briefing_fields f
    JOIN public.regional_briefing_sections s ON s.id = f.section_id
    WHERE s.code = p_section_code
      AND f.code = p_field_code
    LIMIT 1;

    IF v_field_id IS NULL THEN
        RAISE EXCEPTION 'Campo collection %.% nao encontrado.', p_section_code, p_field_code;
    END IF;

    INSERT INTO public.regional_briefing_collection_values (
        item_id,
        field_id,
        value_text,
        value_number
    )
    VALUES (
        p_item_id,
        v_field_id,
        p_value_text,
        p_value_number
    )
    ON CONFLICT (item_id, field_id) DO UPDATE
    SET
        value_text = EXCLUDED.value_text,
        value_number = EXCLUDED.value_number,
        value_json = NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    v_fixed_label text := 'Dados fixos da região';
    v_fixed_start date := DATE '1900-01-01';
    v_fixed_end date := DATE '1900-01-01';
    v_week_label text := 'Semana de 01/01/2024 a 07/01/2024';
    v_week_start date := DATE '2024-01-01';
    v_week_end date := DATE '2024-01-07';
    v_semester_label text := '1º Semestre de 2024';
    v_semester_start date := DATE '2024-01-01';
    v_semester_end date := DATE '2024-06-30';
    v_year_label text := 'Ano de 2024';
    v_year_start date := DATE '2024-01-01';
    v_year_end date := DATE '2024-12-31';
    v_entry_id uuid;
    v_item_id uuid;
    v_command_id uuid;
BEGIN
    SELECT id INTO v_command_id
    FROM public.regional_commands
    WHERE code = 'LESTE'
    LIMIT 1;

    IF v_command_id IS NULL THEN
        RAISE EXCEPTION 'Comando regional LESTE nao encontrado. Rode primeiro 20260512001000_seed_regional_commands_and_periods.sql.';
    END IF;

    -- Remove apenas itens demonstrativos antigos deste seed.
    DELETE FROM public.regional_briefing_collection_items
    WHERE regional_command_id = v_command_id
      AND status = 'seed_leste';

    v_entry_id := public._ensure_leste_regional_entry('efetivo_regional', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'efetivo_regional', 'visao_geral_regiao', 'O Comando de Policiamento Regional Leste coordena a atuação operacional das unidades sob sua responsabilidade, abrangendo polos urbanos, áreas rurais e corredores viários estratégicos da região.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'efetivo_regional', 'unidades_subordinadas', NULL, 10);
    PERFORM public._set_leste_regional_value(v_entry_id, 'efetivo_regional', 'municipios_abrangidos', NULL, 46);
    PERFORM public._set_leste_regional_value(v_entry_id, 'efetivo_regional', 'efetivo_total', NULL, 1846);
    PERFORM public._set_leste_regional_value(v_entry_id, 'efetivo_regional', 'observacoes_efetivo', 'Dados demonstrativos para validação do fluxo de briefing regional.', NULL);

    v_item_id := public._add_leste_regional_collection_item('detalhamento_efetivo_unidade', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'unidade_opm', 'CPR-Leste', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'municipio_sede', 'Feira de Santana', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'efetivo', NULL, 76);

    v_item_id := public._add_leste_regional_collection_item('detalhamento_efetivo_unidade', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'unidade_opm', '1º BPM / Feira de Santana', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'municipio_sede', 'Feira de Santana', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'efetivo', NULL, 312);

    v_item_id := public._add_leste_regional_collection_item('detalhamento_efetivo_unidade', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'unidade_opm', '16º BPM / Serrinha', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'municipio_sede', 'Serrinha', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'efetivo', NULL, 238);

    v_item_id := public._add_leste_regional_collection_item('detalhamento_efetivo_unidade', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'unidade_opm', '20ª CIPM / Santo Amaro', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'municipio_sede', 'Santo Amaro', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'efetivo', NULL, 151);

    v_item_id := public._add_leste_regional_collection_item('detalhamento_efetivo_unidade', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'unidade_opm', '57ª CIPM / Santo Estêvão', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'municipio_sede', 'Santo Estêvão', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'efetivo', NULL, 168);

    v_item_id := public._add_leste_regional_collection_item('detalhamento_efetivo_unidade', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'unidade_opm', '67ª CIPM / Feira de Santana', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'municipio_sede', 'Feira de Santana', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'efetivo', NULL, 224);

    v_item_id := public._add_leste_regional_collection_item('detalhamento_efetivo_unidade', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'unidade_opm', '97ª CIPM / Irará', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'municipio_sede', 'Irará', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'detalhamento_efetivo_unidade', 'efetivo', NULL, 139);

    v_entry_id := public._ensure_leste_regional_entry('produtividade_operacional', v_week_label, v_week_start, v_week_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'apreensao_arma_fogo_regiao', NULL, 118);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'apreensao_arma_fogo_municipio_sede', NULL, 42);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'prisoes_flagrante_regiao', NULL, 436);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'prisoes_flagrante_municipio_sede', NULL, 183);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'apreensao_drogas_regiao', NULL, 329);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'apreensao_drogas_municipio_sede', NULL, 121);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'tco_lavrados_regiao', NULL, 492);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'tco_lavrados_municipio_sede', NULL, 204);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'conducoes_delegacia_regiao', NULL, 1988);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'conducoes_delegacia_municipio_sede', NULL, 812);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'veiculos_recuperados_regiao', NULL, 143);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'veiculos_recuperados_municipio_sede', NULL, 58);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'adolescentes_apreendidos_regiao', NULL, 51);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'adolescentes_apreendidos_municipio_sede', NULL, 19);
    PERFORM public._set_leste_regional_value(v_entry_id, 'produtividade_operacional', 'fonte_dados_produtividade', 'SISPROPOL / CPR-Leste', NULL);

    v_entry_id := public._ensure_leste_regional_entry('dados_cvli', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'dados_cvli', 'cvli_regiao', NULL, 91);
    PERFORM public._set_leste_regional_value(v_entry_id, 'dados_cvli', 'cvli_municipio_sede', NULL, 37);
    PERFORM public._set_leste_regional_value(v_entry_id, 'dados_cvli', 'cvli_mes_referencia', NULL, 12);
    PERFORM public._set_leste_regional_value(v_entry_id, 'dados_cvli', 'analise_cvli_regiao', 'A região apresentou estabilidade operacional no semestre, com atenção especial aos corredores de maior fluxo e aos municípios do entorno da sede regional.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'dados_cvli', 'analise_cvli_municipio_sede', 'O município sede concentrou ações de reforço em manchas criminais e operações integradas de prevenção a CVLI.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'dados_cvli', 'fonte_cvli', 'CPR-Leste', NULL);

    v_entry_id := public._ensure_leste_regional_entry('ocorrencias_crimes', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'roubo_veiculos_regiao', NULL, 168);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'roubo_veiculos_municipio_sede', NULL, 69);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'analise_roubo_veiculos_regiao', 'As ações de abordagem em vias estruturantes contribuíram para recuperação de veículos e redução de reincidência em pontos monitorados.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'analise_roubo_veiculos_municipio_sede', 'Na sede regional, o policiamento orientado por dados priorizou horários de maior incidência.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'roubo', NULL, 122);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'roubo_estabelecimento_comercial', NULL, 18);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'roubo_onibus', NULL, 4);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'roubo_carga', NULL, 3);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'uso_porte_entorpecente', NULL, 57);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'furto_veiculo', NULL, 41);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'estupro', NULL, 9);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'tentativa_homicidio', NULL, 23);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ocorrencias_crimes', 'fonte_ocorrencias', 'SIGESPOL', NULL);

    v_entry_id := public._ensure_leste_regional_entry('operacoes_realizadas_resumo', v_week_label, v_week_start, v_week_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'operacoes_realizadas_resumo', 'resumo_operacoes', 'As operações do CPR-Leste priorizaram a prevenção de CVLI, fiscalização de corredores viários, combate ao tráfico de drogas e proteção de áreas comerciais.', NULL);

    v_item_id := public._add_leste_regional_collection_item('operacoes_realizadas', v_week_label, v_week_start, v_week_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'operacoes_realizadas', 'operacao', 'Operação Leste Seguro', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'operacoes_realizadas', 'periodicidade', 'Semanal', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'operacoes_realizadas', 'foco', 'Prevenção de CVLI e abordagens em áreas críticas', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'operacoes_realizadas', 'breve_historico', 'Emprego coordenado de guarnições ordinárias e especializadas em municípios com maior concentração de ocorrências.', NULL);

    v_item_id := public._add_leste_regional_collection_item('operacoes_realizadas', v_week_label, v_week_start, v_week_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'operacoes_realizadas', 'operacao', 'Operação Corredores', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'operacoes_realizadas', 'periodicidade', 'Diária', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'operacoes_realizadas', 'foco', 'Fiscalização de rodovias e acessos urbanos', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'operacoes_realizadas', 'breve_historico', 'Ações preventivas em vias de ligação entre municípios da região.', NULL);

    v_entry_id := public._ensure_leste_regional_entry('investimentos_totais', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'investimentos_totais', 'investimento_viaturas', NULL, 1850000);
    PERFORM public._set_leste_regional_value(v_entry_id, 'investimentos_totais', 'investimento_instalacoes_fisicas', NULL, 2400000);

    v_item_id := public._add_leste_regional_collection_item('construcoes_andamento', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'construcoes_andamento', 'obra', 'Reforma da sede regional', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'construcoes_andamento', 'municipio', 'Feira de Santana', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'construcoes_andamento', 'valor_estimado', NULL, 1200000);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'construcoes_andamento', 'situacao', 'Em execução', NULL);

    v_item_id := public._add_leste_regional_collection_item('construcoes_andamento', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'construcoes_andamento', 'obra', 'Adequação de pelotão operacional', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'construcoes_andamento', 'municipio', 'Serrinha', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'construcoes_andamento', 'valor_estimado', NULL, 760000);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'construcoes_andamento', 'situacao', 'Projeto aprovado', NULL);

    v_item_id := public._add_leste_regional_collection_item('equipamentos_recebidos', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'equipamentos_recebidos', 'equipamento', 'Motocicletas operacionais', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'equipamentos_recebidos', 'unidade_contemplada', '1º BPM e 67ª CIPM', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'equipamentos_recebidos', 'quantidade', NULL, 8);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'equipamentos_recebidos', 'valor_estimado', NULL, 280000);

    v_item_id := public._add_leste_regional_collection_item('equipamentos_recebidos', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'equipamentos_recebidos', 'equipamento', 'Viaturas SUV semiblindadas', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'equipamentos_recebidos', 'unidade_contemplada', '16º BPM e 57ª CIPM', NULL);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'equipamentos_recebidos', 'quantidade', NULL, 4);
    PERFORM public._set_leste_regional_collection_value(v_item_id, 'equipamentos_recebidos', 'valor_estimado', NULL, 920000);

    v_entry_id := public._ensure_leste_regional_entry('equipamentos_viaturas', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'equipamentos_viaturas', 'colete_balistico', NULL, 1390);
    PERFORM public._set_leste_regional_value(v_entry_id, 'equipamentos_viaturas', 'arma_fogo', NULL, 318);
    PERFORM public._set_leste_regional_value(v_entry_id, 'equipamentos_viaturas', 'viatura_propria', NULL, 27);
    PERFORM public._set_leste_regional_value(v_entry_id, 'equipamentos_viaturas', 'viatura_locada', NULL, 84);
    PERFORM public._set_leste_regional_value(v_entry_id, 'equipamentos_viaturas', 'viatura_convenio', NULL, 6);

    v_entry_id := public._ensure_leste_regional_entry('ronda_maria_penha_historico', v_year_label, v_year_start, v_year_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_historico', 'medidas_protetivas', NULL, 4210);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_historico', 'prisoes_flagrante', NULL, 18);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_historico', 'fiscalizacao_mpu', NULL, 8422);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_historico', 'rondas', NULL, 11670);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_historico', 'contatos_remotos', NULL, 24780);

    v_entry_id := public._ensure_leste_regional_entry('ronda_maria_penha_periodo_atual', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_periodo_atual', 'mulheres_atendidas', NULL, 520);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_periodo_atual', 'fiscalizacoes_medidas_protetivas', NULL, 934);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_periodo_atual', 'contatos_remotos_atendidas_agressores', NULL, 1865);
    PERFORM public._set_leste_regional_value(v_entry_id, 'ronda_maria_penha_periodo_atual', 'observacoes_ronda_maria_penha', 'Atuação integrada com rede de proteção e intensificação das rondas em áreas de maior vulnerabilidade.', NULL);

    v_entry_id := public._ensure_leste_regional_entry('patrulha_solidaria', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'patrulha_solidaria', 'familias_cadastradas', NULL, 3820);
    PERFORM public._set_leste_regional_value(v_entry_id, 'patrulha_solidaria', 'acoes_humanitarias_continuadas', 'Ações de apoio social, arrecadação de alimentos e visitas comunitárias em municípios da região.', NULL);

    v_entry_id := public._ensure_leste_regional_entry('proerd', v_semester_label, v_semester_start, v_semester_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'proerd', 'alunos_contemplados_regiao', NULL, 6240);
    PERFORM public._set_leste_regional_value(v_entry_id, 'proerd', 'alunos_contemplados_municipio_sede', NULL, 2410);

    v_entry_id := public._ensure_leste_regional_entry('policiamento_comunitario_rural_georreferenciado', v_fixed_label, v_fixed_start, v_fixed_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'policiamento_comunitario_rural_georreferenciado', 'fortalecimento_seguranca_areas_rurais', 'Expansão de visitas preventivas, cadastramento de propriedades e monitoramento de rotas rurais.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'policiamento_comunitario_rural_georreferenciado', 'unidade_pioneira', '57ª CIPM / Santo Estêvão', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'policiamento_comunitario_rural_georreferenciado', 'modernizacao_eficacia_seguranca_local', 'Uso de georreferenciamento para apoiar respostas mais rápidas e planejamento de rondas em áreas rurais.', NULL);

    v_entry_id := public._ensure_leste_regional_entry('centro_valorizacao_policial', v_fixed_label, v_fixed_start, v_fixed_end);
    PERFORM public._set_leste_regional_value(v_entry_id, 'centro_valorizacao_policial', 'academia_musculacao_artes_marciais', 'Atividades físicas orientadas e apoio à preparação operacional do efetivo.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'centro_valorizacao_policial', 'grupos_terapeuticos_fisioterapia_nutricao', 'Atendimentos coletivos e individuais voltados à saúde física e emocional dos policiais.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'centro_valorizacao_policial', 'orientacoes_juridica_psicologia_assistencia_social', 'Acompanhamento multidisciplinar aos policiais e familiares em demandas administrativas e sociais.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'centro_valorizacao_policial', 'atendimento_medico_odontologico', 'Encaminhamentos e ações preventivas em saúde, com apoio da rede institucional.', NULL);
    PERFORM public._set_leste_regional_value(v_entry_id, 'centro_valorizacao_policial', 'sistema_exames_laboratoriais', 'Controle informatizado de solicitações e acompanhamento de exames laboratoriais.', NULL);
END;
$$;

DROP FUNCTION public._set_leste_regional_collection_value(uuid, text, text, text, numeric);
DROP FUNCTION public._add_leste_regional_collection_item(text, text, date, date);
DROP FUNCTION public._set_leste_regional_value(uuid, text, text, text, numeric);
DROP FUNCTION public._ensure_leste_regional_entry(text, text, date, date);
