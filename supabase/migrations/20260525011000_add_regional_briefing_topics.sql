-- Gives the regional briefing the same topic -> section -> field hierarchy as the general briefing.
-- Legacy category fields remain synchronized for existing regional views and reports.

CREATE TABLE IF NOT EXISTS public.regional_briefing_topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    order_index integer NOT NULL DEFAULT 999,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.regional_briefing_topics (name, order_index)
SELECT
    BTRIM(section.category_title),
    MIN(section.category_order)
FROM public.regional_briefing_sections AS section
WHERE NULLIF(BTRIM(section.category_title), '') IS NOT NULL
GROUP BY BTRIM(section.category_title)
ON CONFLICT (name) DO UPDATE
SET order_index = LEAST(public.regional_briefing_topics.order_index, EXCLUDED.order_index);

ALTER TABLE public.regional_briefing_sections
ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.regional_briefing_topics(id) ON DELETE RESTRICT;

UPDATE public.regional_briefing_sections AS section
SET topic_id = topic.id
FROM public.regional_briefing_topics AS topic
WHERE section.topic_id IS NULL
  AND BTRIM(section.category_title) = topic.name;

CREATE INDEX IF NOT EXISTS idx_regional_briefing_topics_order
ON public.regional_briefing_topics (is_active, order_index, name);

CREATE INDEX IF NOT EXISTS idx_regional_briefing_sections_topic_order
ON public.regional_briefing_sections (topic_id, is_active, order_index);

DROP TRIGGER IF EXISTS update_regional_briefing_topics_updated_at ON public.regional_briefing_topics;
CREATE TRIGGER update_regional_briefing_topics_updated_at
BEFORE UPDATE ON public.regional_briefing_topics
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

ALTER TABLE public.regional_briefing_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Regional briefing topics read" ON public.regional_briefing_topics;
CREATE POLICY "Regional briefing topics read" ON public.regional_briefing_topics
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional briefing topics admin write" ON public.regional_briefing_topics;
CREATE POLICY "Regional briefing topics admin write" ON public.regional_briefing_topics
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.regional_briefing_topics IS
'First hierarchy level of regional briefing configuration, owning regional sections and fields.';

COMMENT ON COLUMN public.regional_briefing_sections.topic_id IS
'Regional topic that owns this section; category_title/category_order remain compatibility mirrors.';
