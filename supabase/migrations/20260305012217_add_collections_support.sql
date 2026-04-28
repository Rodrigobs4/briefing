-- ADD COLUMN MODE TO DATA GROUPS
ALTER TABLE public.data_groups ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'snapshot' CHECK (mode IN ('snapshot', 'collection'));

-- CREATE COLLECTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.collection_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    data_group_id uuid NOT NULL REFERENCES public.data_groups(id) ON DELETE CASCADE,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_featured boolean DEFAULT false,
    status text DEFAULT 'published',
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- CREATE COLLECTION FIELD VALUES TABLE
CREATE TABLE IF NOT EXISTS public.collection_field_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.collection_items(id) ON DELETE CASCADE,
    field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
    value_text text,
    value_number numeric,
    value_json jsonb,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()),
    UNIQUE(item_id, field_id)
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_field_values ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR COLLECTION ITEMS
CREATE POLICY "Full access for Admins on collection_items"
    ON public.collection_items
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Read access for Commanders on collection_items"
    ON public.collection_items
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'commander'));

CREATE POLICY "Editor access for own unit on collection_items"
    ON public.collection_items
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'editor' AND unit_id = collection_items.unit_id));

-- POLICIES FOR COLLECTION FIELD VALUES
CREATE POLICY "Full access for Admins on collection_field_values"
    ON public.collection_field_values
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Read access for Commanders on collection_field_values"
    ON public.collection_field_values
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'commander'));

CREATE POLICY "Editor access for own unit on collection_field_values"
    ON public.collection_field_values
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.collection_items ci
        JOIN public.profiles p ON p.unit_id = ci.unit_id
        WHERE ci.id = collection_field_values.item_id 
        AND p.id = auth.uid() 
        AND p.role = 'editor'
    ));

-- TRIGGERS FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_collection_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collection_items_timestamp
    BEFORE UPDATE ON public.collection_items
    FOR EACH ROW
    EXECUTE FUNCTION update_collection_items_updated_at();

CREATE OR REPLACE FUNCTION update_collection_field_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collection_field_values_timestamp
    BEFORE UPDATE ON public.collection_field_values
    FOR EACH ROW
    EXECUTE FUNCTION update_collection_field_values_updated_at();
