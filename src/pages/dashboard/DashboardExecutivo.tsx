import { useState, useMemo, useEffect } from "react";
import { useAuth, calculateFieldValue } from "../../store/AuthContext";
import {
  Clock,
  ShieldAlert,
  FileText,
  Activity,
  ChevronDown,
  Check,
  Database,
  Shield,
  ShieldCheck,
  Camera,
  Video,
  FileSearch,
  ClipboardList,
  FileCheck,
  AlertCircle,
  BadgeAlert,
  Plane,
  Helicopter,
  Users,
  UserRound,
  HeartPulse,
  Stethoscope,
  Award,
  BadgeCheck,
  School,
  Building2,
  BookOpen,
  HeartHandshake,
  Brain,
  MessagesSquare,
  CarFront,
  Truck,
  Siren,
  Radio,
  Map,
  MapPinned,
  Target,
  Crosshair,
  Briefcase,
  CalendarCheck,
  NotebookPen,
  Bell,
  ClipboardPlus,
  Package,
} from "lucide-react";
import { getPublicUploadUrl } from "../../utils/storageUrls";
import { sortByTextPtBr } from "../../utils/textOrdering";
import { formatBrazilianNumber } from "../../utils/brazilianNumbers";

const TOPIC_ICONS = [
  { name: "database", icon: Database },
  { name: "shield", icon: Shield },
  { name: "shield-check", icon: ShieldCheck },
  { name: "shield-alert", icon: ShieldAlert },
  { name: "camera", icon: Camera },
  { name: "video", icon: Video },
  { name: "file-search", icon: FileSearch },
  { name: "file-text", icon: FileText },
  { name: "clipboard-list", icon: ClipboardList },
  { name: "file-check", icon: FileCheck },
  { name: "alert-circle", icon: AlertCircle },
  { name: "badge-alert", icon: BadgeAlert },
  { name: "plane", icon: Plane },
  { name: "helicopter", icon: Helicopter },
  { name: "users", icon: Users },
  { name: "user-round", icon: UserRound },
  { name: "heart-pulse", icon: HeartPulse },
  { name: "stethoscope", icon: Stethoscope },
  { name: "award", icon: Award },
  { name: "badge-check", icon: BadgeCheck },
  { name: "school", icon: School },
  { name: "building-2", icon: Building2 },
  { name: "book-open", icon: BookOpen },
  { name: "heart-handshake", icon: HeartHandshake },
  { name: "brain", icon: Brain },
  { name: "messages-square", icon: MessagesSquare },
  { name: "car-front", icon: CarFront },
  { name: "truck", icon: Truck },
  { name: "siren", icon: Siren },
  { name: "radio", icon: Radio },
  { name: "map", icon: Map },
  { name: "map-pinned", icon: MapPinned },
  { name: "target", icon: Target },
  { name: "crosshair", icon: Crosshair },
  { name: "briefcase", icon: Briefcase },
  { name: "calendar-check", icon: CalendarCheck },
  { name: "notebook-pen", icon: NotebookPen },
  { name: "bell", icon: Bell },
  { name: "clipboard-plus", icon: ClipboardPlus },
  { name: "package", icon: Package },
];

function getIconByName(name: string) {
  return (
    TOPIC_ICONS.find((ic) => ic.name === name) ||
    TOPIC_ICONS.find((ic) => ic.name === "briefcase") ||
    TOPIC_ICONS[0]
  );
}

const normalizeRegionalKey = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-\s]+/g, " ")
    .trim()
    .toLowerCase();

const FALLBACK_REGIONAL_COMMAND_KEYS = new Set([
  "cprms",
  "atlantico",
  "baia de todos os santos",
  "central",
  "norte",
  "sul",
  "leste",
  "sudoeste",
  "oeste",
  "chapada",
  "cpme",
  "comando de operacoes especializadas",
]);

function isRegionalCommandAsUnit(
  unit: { name: string },
  regionalCommands: Array<{ code: string; name: string }>,
) {
  const unitName = normalizeRegionalKey(unit.name);
  const commandKeys = new Set([
    ...regionalCommands.flatMap((command) => [
      normalizeRegionalKey(command.code),
      normalizeRegionalKey(command.name),
    ]),
    ...FALLBACK_REGIONAL_COMMAND_KEYS,
  ]);

  return commandKeys.has(unitName);
}

const ImageRenderer = ({ path, alt }: { path: string; alt: string }) => {
  const url = getPublicUploadUrl(path);

  return (
    <img
      src={url}
      alt={alt}
      className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105 cursor-pointer selection:bg-transparent"
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
    />
  );
};

export default function DashboardExecutivo() {
  const {
    units: allUnits,
    regionalCommands,
    dataGroups,
    fields,
    users,
    entries,
    getValuesForEntry,
    user,
    collectionItems,
    getValuesForItem,
  } = useAuth();
  const units = useMemo(
    () =>
      sortByTextPtBr(
        allUnits.filter(
          (unit) => !isRegionalCommandAsUnit(unit, regionalCommands),
        ),
        (unit) => unit.name,
      ),
    [allUnits, regionalCommands],
  );
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unitFilterSearch, setUnitFilterSearch] = useState("");

  useEffect(() => {
    if (!isInitialized && units.length > 0) {
      if (user?.role === "editor") {
        // Para editores, usa os múltiplos tópicos atribuídos (unitIds), com fallback para unitId legado
        const editorUnits =
          user.unitIds && user.unitIds.length > 0
            ? user.unitIds
            : user.unitId
              ? [user.unitId]
              : [];
        setSelectedUnitIds(
          editorUnits.filter((unitId) =>
            units.some((unit) => unit.id === unitId),
          ),
        );
      } else {
        // Para admin e commander, mostra todas as unidades
        setSelectedUnitIds(units.map((u) => u.id));
      }
      setIsInitialized(true);
    }
  }, [units, user, isInitialized]);

  const handleToggleUnit = (unitId: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId)
        ? prev.filter((id) => id !== unitId)
        : [...prev, unitId],
    );
  };

  const handleSelectAll = () => {
    setSelectedUnitIds(units.map((u) => u.id));
  };

  const handleClearAll = () => {
    setSelectedUnitIds([]);
  };

  const filteredFilterUnits = useMemo(() => {
    const search = unitFilterSearch.trim().toLowerCase();
    if (!search) return units;

    return units.filter((unit) => unit.name.toLowerCase().includes(search));
  }, [units, unitFilterSearch]);

  // LÓGICA 1 (NOVA): Hierarquia de Snapshots via DataGroupEntries
  const hierarchicalView = useMemo(() => {
    const result: Array<{
      unitId: string;
      unitName: string;
      unitIcon: string;
      lastUpdated: string | null;
      updatedBy: string | null;
      responsibleSector?: string | null;
      groups: Array<{
        groupId: string;
        groupTitle: string;
        mode: string;
        order: number;
        hasImageField?: boolean;
        numberFields?: Array<any>;
        textFields?: Array<any>;
        collectionItems?: Array<any>;
      }>;
    }> = [];

    const unitsToProcess = selectedUnitIds
      .map((id) => units.find((u) => u.id === id))
      .filter(Boolean) as typeof units;

    unitsToProcess.forEach((unit) => {
      const unitEntries = entries.filter((e) => e.unitId === unit.id);
      const unitCollections = collectionItems.filter(
        (i) => i.unitId === unit.id && i.status !== "archived",
      );
      if (unitEntries.length === 0 && unitCollections.length === 0) return;

      // Busca a Data de Última Edição global da Unidade baseada em ambos
      let latestUpdatedAt = 0;
      let updatedByName = "Sistema";

      if (unitEntries.length > 0) {
        const latest = [...unitEntries].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0];
        latestUpdatedAt = new Date(latest.updatedAt).getTime();
        updatedByName =
          users.find((u) => u.id === latest.updatedBy)?.name || updatedByName;
      }
      if (unitCollections.length > 0) {
        const latest = [...unitCollections].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0];
        if (new Date(latest.updatedAt).getTime() > latestUpdatedAt) {
          latestUpdatedAt = new Date(latest.updatedAt).getTime();
          updatedByName =
            users.find((u) => u.id === latest.updatedBy)?.name || updatedByName;
        }
      }

      const unitView = {
        unitId: unit.id,
        unitName: unit.name,
        unitIcon: unit.description || "briefcase",
        lastUpdated:
          latestUpdatedAt > 0 ? new Date(latestUpdatedAt).toISOString() : null,
        updatedBy: updatedByName,
        responsibleSector: unit.responsibleSector ?? null,
        groups: [] as any[],
      };

      dataGroups.forEach((group) => {
        if (group.mode === "collection") {
          const items = unitCollections.filter(
            (i) => i.dataGroupId === group.id,
          );
          if (items.length > 0) {
            // Verifica se este grupo possui campo do tipo imagem configurado
            const hasImageField = fields.some(
              (f) =>
                f.dataGroupId === group.id && f.type === "image" && f.isActive,
            );

            const processedItems = items.map((item) => {
              const itemValues = getValuesForItem(item.id);
              const author =
                users.find((u) => u.id === item.createdBy)?.name || "Sistema";

              const imageField = itemValues.find((fv: any) => {
                const f = fields.find((f) => f.id === fv.fieldId);
                return f && f.type === "image" && fv.valueJson;
              });
              const txtFields = itemValues.filter((fv: any) => {
                const f = fields.find((f) => f.id === fv.fieldId);
                return f && f.type === "text" && fv.valueText;
              });
              const descFields = itemValues.filter((fv: any) => {
                const f = fields.find((f) => f.id === fv.fieldId);
                return f && f.type === "textarea" && fv.valueText;
              });

              let imageUrls: string[] = [];
              try {
                if (imageField?.valueJson) {
                  if (
                    typeof imageField.valueJson === "string" &&
                    imageField.valueJson.startsWith("[")
                  ) {
                    imageUrls = JSON.parse(imageField.valueJson);
                  } else if (Array.isArray(imageField.valueJson)) {
                    imageUrls = imageField.valueJson;
                  } else {
                    imageUrls = [imageField.valueJson];
                  }
                }
              } catch (e) {
                if (imageField?.valueJson) imageUrls = [imageField.valueJson];
              }

              return {
                id: item.id,
                author,
                dateRaw: new Date(item.createdAt).getTime(),
                dateStr: new Date(item.createdAt).toLocaleString("pt-BR"),
                isFeatured: item.isFeatured,
                imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
                title: txtFields[0]?.valueText || "Registro",
                description: descFields[0]?.valueText || "",
              };
            });

            processedItems.sort((a, b) =>
              b.isFeatured === a.isFeatured
                ? b.dateRaw - a.dateRaw
                : a.isFeatured
                  ? -1
                  : 1,
            );

            unitView.groups.push({
              groupId: group.id,
              groupTitle: group.title,
              mode: "collection",
              order: group.order,
              hasImageField, // Adiciona flag indicando se grupo possui campo de imagem
              collectionItems: processedItems,
            });
          }
        } else {
          const entry = unitEntries
            .filter((e) => e.dataGroupId === group.id)
            .sort(
              (a, b) =>
                (b.referenceYear ?? -1) - (a.referenceYear ?? -1) ||
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            )[0];
          if (entry) {
            const snapshotValues = getValuesForEntry(entry.id);
            const groupFields = fields.filter(
              (f) => f.dataGroupId === group.id && f.isActive,
            );

            const numberFields = groupFields
              .filter((field) =>
                ["number", "currency", "percentage", "calculated"].includes(field.type),
              )
              .map((field) => {
                const fv = snapshotValues.find((v) => v.fieldId === field.id);
                let val: any = fv ? fv.value : null;

                // Fallback para calcular em tempo real se for 'calculated' e não houver valor
                if (
                  (val === null || val === undefined || val === "") &&
                  field.type === "calculated"
                ) {
                  const formDataForCalc = snapshotValues.reduce(
                    (acc, curr) => {
                      acc[curr.fieldId] = curr.value;
                      return acc;
                    },
                    {} as Record<string, any>,
                  );

                  const calculated = calculateFieldValue(
                    field,
                    formDataForCalc,
                    fields,
                    true,
                  );
                  if (calculated !== null) {
                    val = calculated;
                  }
                }

                // Se ainda assim não houver valor, não renderiza o card
                if (val === null || val === undefined || val === "") {
                  return null;
                }

                return {
                  fieldId: field.id,
                  label: field.name,
                  value: val,
                  type: field.type,
                  order: field.order,
                };
              })
              .filter((f): f is NonNullable<typeof f> => f !== null)
              .sort((a, b) => a.order - b.order);

            const textFields = groupFields
              .filter((field) => ["text", "textarea"].includes(field.type))
              .map((field) => {
                const fv = snapshotValues.find((v) => v.fieldId === field.id);
                if (!fv || !fv.value) return null;
                return {
                  fieldId: field.id,
                  label: field.name,
                  value: fv.value,
                  type: field.type,
                  order: field.order,
                };
              })
              .filter((f): f is NonNullable<typeof f> => f !== null)
              .sort((a, b) => a.order - b.order);

            if (numberFields.length > 0 || textFields.length > 0) {
              unitView.groups.push({
                groupId: group.id,
                groupTitle: group.title,
                mode: "snapshot",
                order: group.order,
                numberFields,
                textFields,
              });
            }
          }
        }
      });

      if (unitView.groups.length > 0) {
        // Ordenar Grupos
        unitView.groups.sort((a, b) => a.order - b.order);
        result.push(unitView);
      }
    });

    // Retorna preservando a ordem do array selectedUnitIds
    return result;
  }, [
    units,
    selectedUnitIds,
    entries,
    dataGroups,
    fields,
    getValuesForEntry,
    users,
    collectionItems,
    getValuesForItem,
  ]);

  // LÓGICA 2: KPIs de Inteligência de Dados (Calculado localmente, sem APIs pagas)
  const estatisticasResumo = useMemo(() => {
    const totalUnidades = selectedUnitIds.length;
    const totalSnapshots = entries.filter((e) =>
      selectedUnitIds.includes(e.unitId),
    ).length;
    const totalItens = collectionItems.filter(
      (i) => selectedUnitIds.includes(i.unitId) && i.status !== "archived",
    ).length;
    const totalRelevantes = collectionItems.filter(
      (i) =>
        selectedUnitIds.includes(i.unitId) &&
        i.isFeatured &&
        i.status !== "archived",
    ).length;

    return {
      totalUnidades,
      totalRegistros: totalSnapshots + totalItens,
      totalRelevantes,
      atividadeGlobal:
        totalSnapshots > 0 || totalItens > 0 ? "Frequente" : "Sem Dados",
    };
  }, [selectedUnitIds, entries, collectionItems]);

  return (
    <div className="space-y-10">
      {/* Filtro e impressão */}
      <div className="bg-white p-5 rounded-2xl shadow-premium border border-pm-secondary/15 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex flex-col">
            <span className="text-xs font-black text-pm-secondary/60 uppercase tracking-[0.15em]">
              Filtro de Comando
            </span>
            <span className="text-[11px] font-bold text-pm-secondary/70">
              {selectedUnitIds.length === units.length
                ? "Todas as unidades visíveis"
                : `${selectedUnitIds.length} de ${units.length} unidade(s)`}
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() =>
                user?.role !== "editor" && setIsDropdownOpen(!isDropdownOpen)
              }
              className={`bg-pm-light/50 border border-pm-secondary/20 text-sm font-bold rounded-xl px-5 py-2.5 text-pm-dark flex items-center gap-3 outline-none transition-all min-w-[240px] justify-between ${user?.role === "editor" ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-white hover:border-pm-primary/40 hover:shadow-sm"}`}
            >
              <span className="max-w-[210px] truncate text-left">
                {selectedUnitIds.length === units.length
                  ? "Todas as Unidades"
                  : `${selectedUnitIds.length} Unidade(s) selecionada(s)`}
              </span>
              {user?.role !== "editor" && (
                <ChevronDown
                  className={`w-4 h-4 text-pm-primary transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {isDropdownOpen && user?.role !== "editor" && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsDropdownOpen(false)}
                ></div>
                <div className="absolute top-full left-0 mt-2 w-[360px] bg-white border border-pm-secondary/20 shadow-xl rounded-xl z-20 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-pm-secondary/10 space-y-3">
                    <div className="relative">
                      <FileSearch className="w-4 h-4 text-pm-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={unitFilterSearch}
                        onChange={(e) => setUnitFilterSearch(e.target.value)}
                        placeholder="Buscar unidade"
                        className="w-full bg-pm-light/50 border border-pm-secondary/15 rounded-lg pl-9 pr-3 py-2 text-sm font-bold text-pm-dark outline-none focus:ring-2 focus:ring-pm-primary/20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="flex-1 text-xs font-black bg-pm-light text-pm-dark py-2 rounded-lg hover:bg-pm-secondary/20 transition-colors"
                      >
                        Selecionar Todas
                      </button>
                      <button
                        onClick={handleClearAll}
                        className="flex-1 text-xs font-black bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto w-full p-2 flex flex-col gap-1">
                    {filteredFilterUnits.length === 0 && (
                      <div className="py-8 text-center text-sm font-bold text-pm-secondary">
                        Nenhuma unidade encontrada.
                      </div>
                    )}
                    {filteredFilterUnits.map((u) => {
                      const isSelected = selectedUnitIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleUnit(u.id);
                          }}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-pm-primary/10 hover:bg-pm-primary/20" : "hover:bg-pm-light"}`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-pm-primary border-pm-primary text-white" : "border-pm-secondary/40"}`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-sm text-pm-dark truncate">
                              {u.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedUnitIds.length > 0 &&
                    selectedUnitIds.length < units.length && (
                      <div className="border-t border-pm-secondary/10 p-2 bg-pm-light/30">
                        <p className="text-[10px] font-black uppercase tracking-widest text-pm-secondary/70 px-1 mb-1">
                          Selecionadas
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {units
                            .filter((u) => selectedUnitIds.includes(u.id))
                            .slice(0, 6)
                            .map((unit) => (
                              <span
                                key={unit.id}
                                className="px-2 py-1 rounded-md bg-white border border-pm-secondary/10 text-[10px] font-black text-pm-dark"
                              >
                                {unit.name}
                              </span>
                            ))}
                          {selectedUnitIds.length > 6 && (
                            <span className="px-2 py-1 rounded-md bg-white border border-pm-secondary/10 text-[10px] font-black text-pm-secondary">
                              +{selectedUnitIds.length - 6}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 1. KPIs de Inteligência Executiva */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-pm-secondary/15 shadow-sm hover:shadow-premium transition-all flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-pm-primary/10 flex items-center justify-center text-pm-primary">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-widest leading-none mb-1">
              Total de Registros
            </p>
            <h4 className="text-2xl font-black text-pm-dark leading-none">
              {estatisticasResumo.totalRegistros}
            </h4>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-pm-secondary/15 shadow-sm hover:shadow-premium transition-all flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-widest leading-none mb-1">
              Itens Relevantes
            </p>
            <h4 className="text-2xl font-black text-pm-dark leading-none">
              {estatisticasResumo.totalRelevantes}
            </h4>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-pm-secondary/15 shadow-sm hover:shadow-premium transition-all flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-pm-secondary/10 flex items-center justify-center text-pm-secondary">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-widest leading-none mb-1">
              Unidades Ativas
            </p>
            <h4 className="text-2xl font-black text-pm-dark leading-none">
              {estatisticasResumo.totalUnidades}
            </h4>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-pm-secondary/15 shadow-sm hover:shadow-premium transition-all flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-widest leading-none mb-1">
              Status da Atividade
            </p>
            <h4 className="text-2xl font-black text-pm-dark leading-none">
              {estatisticasResumo.atividadeGlobal}
            </h4>
          </div>
        </div>
      </div>

      {/* KPIs Hierarquicos */}
      <div className="space-y-10">
        {hierarchicalView.length === 0 && (
          <div className="py-12 text-center bg-pm-light/50 border border-dashed border-pm-secondary/30 rounded-xl">
            <Activity className="w-8 h-8 text-pm-secondary mx-auto mb-2 opacity-50" />
            <p className="text-pm-secondary font-medium">
              Nenhum indicador numérico preenchido pelas unidades ainda.
            </p>
          </div>
        )}

        {hierarchicalView.map((unitNode) => (
          <div key={unitNode.unitId} className="flex flex-col gap-8 relative">
            {/* Nível 1: Unidade (Cabeçalho) */}
            <div className="border-b-2 border-pm-primary/20 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black text-pm-dark tracking-tighter uppercase flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-pm-primary/10 flex items-center justify-center text-pm-primary border border-pm-primary/20 shadow-sm">
                  {(() => {
                    const Icon = getIconByName(unitNode.unitIcon).icon;
                    return <Icon className="w-7 h-7" />;
                  })()}
                </div>
                <span>{unitNode.unitName}</span>
              </h2>
              {unitNode.lastUpdated && (
                <p className="text-[11px] text-pm-secondary font-bold flex items-center gap-2 mt-4 ml-16 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-pm-primary/60" />
                  <span>Última atualização:</span>
                  <span className="text-pm-dark/80">
                    {new Date(unitNode.lastUpdated).toLocaleString("pt-BR")}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-pm-secondary/30 mx-1"></span>
                  <span>Por:</span>
                  <span className="text-pm-dark/80">{unitNode.updatedBy}</span>
                </p>
              )}
              {unitNode.responsibleSector && (
                <p className="text-[11px] text-pm-secondary font-bold flex items-center gap-2 mt-2 ml-16 uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 text-pm-primary/60" />
                  <span>Setor responsável:</span>
                  <span className="text-pm-dark/80">
                    {unitNode.responsibleSector}
                  </span>
                </p>
              )}
            </div>

            {/* Nível 2: Grupos/Conjuntos dessa unidade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {unitNode.groups.map((groupNode) => {
                // ==================================================================================
                // LÓGICA DE LAYOUT CONDICIONAL E INTELIGENTE
                // ==================================================================================

                // 1. Analisar densidade do conteúdo
                const fieldCount =
                  (groupNode.numberFields?.length || 0) +
                  (groupNode.textFields?.length || 0);
                const isCollection = groupNode.mode === "collection";
                const hasLongText = groupNode.textFields?.some(
                  (f: any) =>
                    f.type === "textarea" || String(f.value).length > 50,
                );

                // 2. Classificar o Tópico
                // SMALL: Até 2 cards, sem texto longo, não é coleção. -> Pode dividir linha (col-span-1)
                // LARGE: 3+ cards, texto longo ou coleção. -> Ocupa linha toda (col-span-2)
                const isSmallTopic =
                  !isCollection && !hasLongText && fieldCount <= 2;

                // 3. Definir classes de grid
                const containerColSpan = isSmallTopic
                  ? "col-span-1"
                  : "md:col-span-2";

                return (
                  <div
                    key={groupNode.groupId}
                    className={`card p-0 overflow-hidden flex flex-col ${containerColSpan}`}
                  >
                    <div className="px-6 py-4 border-b border-pm-secondary/10 bg-pm-light/30">
                      <h3 className="section-title mb-0">
                        {groupNode.groupTitle}
                      </h3>
                    </div>
                    <div className="p-6 flex-1">
                      {/* Nível 3: Renderização Variante por Modo */}
                      {groupNode.mode === "snapshot" &&
                        (() => {
                          // Unificar campos numéricos e de texto para fluxo contínuo (Problema 1 e 3)
                          const allFields = [
                            ...(groupNode.numberFields || []),
                            ...(groupNode.textFields || []),
                          ].sort((a, b) => a.order - b.order);

                          // Grid interno adaptável ao tamanho do container pai
                          let internalGridCols = isSmallTopic
                            ? "grid-cols-2"
                            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

                          // AJUSTE 1: OPMS - Grid de 3 colunas fixas no desktop (Harmonia 33%)
                          if (groupNode.groupTitle === "OPMS") {
                            internalGridCols =
                              "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
                          }

                          // AJUSTE 2: CPMS - Grid de 4 colunas para permitir composição 25% / 75%
                          const isCPMsTopic =
                            groupNode.groupTitle.trim().toUpperCase() ===
                            "CPMS";
                          if (isCPMsTopic) {
                            internalGridCols = "grid-cols-1 md:grid-cols-4";
                          }

                          return (
                            <div className={`grid ${internalGridCols} gap-3`}>
                              {allFields.map((field: any) => {
                                // Lógica inteligente de tamanho: Textos longos ocupam mais espaço
                                const isLongField =
                                  field.type === "textarea" ||
                                  (field.type === "text" &&
                                    String(field.value).length > 25);

                                // Se o campo for longo:
                                // - Em tópico pequeno: ocupa as 2 colunas do grid interno (largura total do bloco pequeno)
                                // - Em tópico grande: ocupa 2 a 4 colunas do grid interno
                                let fieldColSpan = isLongField
                                  ? isSmallTopic
                                    ? "col-span-2"
                                    : "col-span-2 sm:col-span-3 lg:col-span-4"
                                  : "col-span-1";

                                // AJUSTE 1 (CORREÇÃO): Forçar col-span-1 para todos os cards dentro de "OPMS"
                                if (groupNode.groupTitle === "OPMS") {
                                  fieldColSpan = "col-span-1";
                                }

                                // AJUSTE 2: Lógica específica para campos do CPMS
                                if (isCPMsTopic) {
                                  const label = field.label || "";
                                  if (
                                    label === "Capital" ||
                                    label === "Interior"
                                  ) {
                                    fieldColSpan = "md:col-span-1";
                                  } else if (
                                    label === "Unidades da Capital" ||
                                    label === "Unidades do Interior"
                                  ) {
                                    fieldColSpan = "md:col-span-3";
                                  } else {
                                    // Garante que outros campos no CPMS não quebrem o layout de 4 colunas
                                    fieldColSpan = "md:col-span-1";
                                  }
                                }

                                const isNumeric = [
                                  "number",
                                  "currency",
                                  "percentage",
                                  "calculated",
                                ].includes(field.type);

                                return (
                                  <div
                                    key={field.fieldId}
                                    className={`bg-pm-light/30 p-4 lg:p-6 rounded-2xl border border-pm-secondary/10 hover:border-pm-primary/40 hover:bg-white transition-all relative flex flex-col group/card shadow-sm ${fieldColSpan}`}
                                  >
                                    {isNumeric && (
                                      <div className="absolute left-0 top-4 bottom-4 w-1 bg-pm-primary rounded-r-full opacity-60 group-hover/card:opacity-100 transition-opacity"></div>
                                    )}

                                    <h4
                                      className="text-[10px] uppercase tracking-widest text-pm-secondary/70 font-black mb-3 pl-2 truncate"
                                      title={field.label}
                                    >
                                      {field.label}
                                    </h4>

                                    <div className="pl-2 text-pm-dark mt-auto">
                                      {isNumeric ? (
                                        <div className="flex items-baseline gap-1.5">
                                          <span className="text-3xl lg:text-4xl font-black tracking-tighter leading-none">
                                            {field.type === "currency"
                                              ? formatBrazilianNumber(Number(field.value), true)
                                              : Number(field.value).toLocaleString("pt-BR")}
                                          </span>
                                          {field.type === "percentage" && (
                                            <span className="text-lg font-black text-pm-primary">
                                              %
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-sm font-bold whitespace-pre-wrap leading-relaxed text-pm-dark/80">
                                          {field.value}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                      {groupNode.mode === "collection" &&
                        groupNode.collectionItems && (
                          <div className="flex flex-col gap-6">
                            {groupNode.collectionItems.map((item: any) => {
                              const hasImage = !!item.imageUrl;

                              return (
                                <div
                                  key={item.id}
                                  className={`flex flex-col ${hasImage ? "lg:flex-row" : ""} gap-6 bg-white p-6 rounded-2xl border transition-all hover:shadow-premium group/item ${item.isFeatured ? "border-amber-200 bg-amber-50/30" : "border-pm-secondary/15"}`}
                                >
                                  {/* Imagem */}
                                  {hasImage && (
                                    <div className="w-full lg:w-[280px] h-[200px] bg-pm-light rounded-xl overflow-hidden border border-pm-secondary/10 relative shadow-sm">
                                      <ImageRenderer
                                        path={item.imageUrl}
                                        alt={item.title}
                                      />
                                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none"></div>
                                    </div>
                                  )}

                                  {/* Conteúdo da Ocorrência */}
                                  <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-3">
                                      <h4 className="text-xl font-black text-pm-dark leading-snug tracking-tight">
                                        {item.title}
                                      </h4>
                                      <div className="flex flex-col sm:items-end flex-shrink-0">
                                        {item.isFeatured && (
                                          <span className="badge-warning px-3 py-1 text-[10px]">
                                            <ShieldAlert className="w-3 h-3" />{" "}
                                            Relevante
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-sm font-medium text-pm-secondary/80 whitespace-pre-wrap leading-relaxed flex-1 italic">
                                      {item.description}
                                    </p>
                                    <div className="mt-6 pt-4 border-t border-pm-secondary/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[10px] uppercase tracking-widest font-black text-pm-secondary/60">
                                      <span className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-pm-primary/70" />
                                        Reportado:{" "}
                                        <span className="text-pm-dark/70 font-black">
                                          {item.dateStr}
                                        </span>
                                      </span>
                                      <span className="bg-pm-light px-2 py-1 rounded border border-pm-secondary/10">
                                        Por:{" "}
                                        <span className="text-pm-dark/70 font-black">
                                          {item.author}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
