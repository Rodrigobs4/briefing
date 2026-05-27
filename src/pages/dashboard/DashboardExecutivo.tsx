import { lazy, Suspense, useState, useMemo, useEffect } from "react";
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
  Image as ImageIcon,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { getPublicUploadUrl } from "../../utils/storageUrls";
import { sortByTextPtBr } from "../../utils/textOrdering";
import { formatBrazilianNumber } from "../../utils/brazilianNumbers";
import { isGeneralBriefingUnit } from "../../utils/generalBriefingUnits";

const GeneralTrendChart = lazy(() =>
  import("./components/DashboardCharts").then((module) => ({ default: module.GeneralTrendChart })),
);
const GeneralCompositionChart = lazy(() =>
  import("./components/DashboardCharts").then((module) => ({ default: module.GeneralCompositionChart })),
);
const GeneralRankingChart = lazy(() =>
  import("./components/DashboardCharts").then((module) => ({ default: module.GeneralRankingChart })),
);

const ChartFallback = () => <div className="h-full w-full animate-pulse rounded-2xl bg-pm-light/70" />;

type DashboardTab = "overview" | "indicators" | "records" | "detail";
type UpdateAlertStatus = "overdue" | "late" | "pending" | "complete";

const getRecurringUpdateCycle = (
  rule: { startsAt: string; weekdays: number[]; deadlineTime: string },
  now = new Date(),
) => {
  const activatedAt = new Date(rule.startsAt);
  const [hours = 18, minutes = 0] = rule.deadlineTime.split(":").map(Number);
  const deadlines: Date[] = [];

  for (let offset = -15; offset <= 8; offset += 1) {
    const deadline = new Date(now);
    deadline.setDate(now.getDate() + offset);
    deadline.setHours(hours, minutes, 0, 0);
    if (rule.weekdays.includes(deadline.getDay()) && deadline.getTime() >= activatedAt.getTime()) {
      deadlines.push(deadline);
    }
  }

  deadlines.sort((left, right) => left.getTime() - right.getTime());
  const elapsedDeadlines = deadlines.filter((deadline) => deadline.getTime() <= now.getTime());
  const elapsed = elapsedDeadlines[elapsedDeadlines.length - 1];
  const upcoming = deadlines.find((deadline) => deadline.getTime() > now.getTime());

  if (!elapsed) {
    return {
      startsAt: activatedAt,
      dueAt: upcoming ?? activatedAt,
      hasElapsedDeadline: false,
    };
  }

  const previousDeadlines = deadlines.filter((deadline) => deadline.getTime() < elapsed.getTime());
  const previous = previousDeadlines[previousDeadlines.length - 1];
  return {
    startsAt: previous ?? activatedAt,
    dueAt: elapsed,
    hasElapsedDeadline: true,
  };
};

const formatDashboardValue = (field: { type: string; value: unknown }) => {
  const numericValue = Number(field.value);
  if (!Number.isFinite(numericValue)) return String(field.value ?? "-");
  if (field.type === "currency") return formatBrazilianNumber(numericValue, true);
  if (field.type === "percentage") return `${numericValue.toLocaleString("pt-BR")}%`;
  return numericValue.toLocaleString("pt-BR");
};

const getMetricColor = (label: string, value: unknown) => {
  const normalizedLabel = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const numericValue = Number(value);

  if (normalizedLabel.includes("deficit") && Number.isFinite(numericValue) && numericValue > 0) {
    return "text-red-700";
  }
  return "text-pm-dark";
};

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
    fieldValues,
    getValuesForEntry,
    user,
    collectionItems,
    collectionFieldValues,
    getValuesForItem,
    unitUpdateAlertRules,
  } = useAuth();
  const units = useMemo(
    () =>
      sortByTextPtBr(
        allUnits.filter((unit) => isGeneralBriefingUnit(unit, regionalCommands)),
        (unit) => unit.name,
      ),
    [allUnits, regionalCommands],
  );
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unitFilterSearch, setUnitFilterSearch] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [focusedUnitId, setFocusedUnitId] = useState<string | null>(null);

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

  const updateAlerts = useMemo(() => {
    const hasValue = (value: unknown) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    };

    return unitUpdateAlertRules
      .filter((rule) => rule.isActive)
      .map((rule) => {
        const unit = units.find((candidate) => candidate.id === rule.unitId);
        if (!unit) return null;

        const unitEntryIds = new Set(entries.filter((entry) => entry.unitId === unit.id).map((entry) => entry.id));
        const activeItemIds = new Set(collectionItems
          .filter((item) => item.unitId === unit.id && item.status !== "archived")
          .map((item) => item.id));
        const snapshotUpdates = fieldValues
          .filter((value) => unitEntryIds.has(value.entryId) && hasValue(value.value))
          .map((value) => value.updatedAt);
        const collectionUpdates = collectionFieldValues
          .filter((value) =>
            activeItemIds.has(value.itemId) &&
            (hasValue(value.valueText) || value.valueNumber !== null || hasValue(value.valueJson)),
          )
          .map((value) => value.updatedAt);
        const cycle = getRecurringUpdateCycle(rule);
        const latestUpdate = [...snapshotUpdates, ...collectionUpdates]
          .filter((updatedAt) => new Date(updatedAt).getTime() >= cycle.startsAt.getTime())
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
        const latestAt = latestUpdate ? new Date(latestUpdate).getTime() : 0;
        const completed = latestAt >= cycle.startsAt.getTime();
        const status: UpdateAlertStatus = !cycle.hasElapsedDeadline
          ? "pending"
          : completed
            ? (latestAt > cycle.dueAt.getTime() ? "late" : "complete")
            : "overdue";

        return {
          unit,
          rule,
          dueAt: cycle.dueAt,
          latestUpdate,
          status,
          responsibleUpdater: unit.responsibleUpdaterId
            ? users.find((candidate) => candidate.id === unit.responsibleUpdaterId)?.name || "Responsável configurado"
            : "Não definido",
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const priority: Record<UpdateAlertStatus, number> = { overdue: 0, late: 1, pending: 2, complete: 3 };
        const first = left!;
        const second = right!;
        return priority[first.status] - priority[second.status] ||
          first.dueAt.getTime() - second.dueAt.getTime();
      }) as Array<{
        unit: (typeof units)[number];
        rule: (typeof unitUpdateAlertRules)[number];
        dueAt: Date;
        latestUpdate: string | null;
        status: UpdateAlertStatus;
        responsibleUpdater: string;
      }>;
  }, [collectionFieldValues, collectionItems, entries, fieldValues, unitUpdateAlertRules, units, users]);

  const actionableAlerts = updateAlerts.filter((alert) => alert.status !== "complete");
  const overdueAlertCount = updateAlerts.filter((alert) => alert.status === "overdue").length;
  const lateAlertCount = updateAlerts.filter((alert) => alert.status === "late").length;
  const pendingAlertCount = updateAlerts.filter((alert) => alert.status === "pending").length;
  const visibleActionableAlerts = actionableAlerts.slice(0, 5);

  // LÓGICA 1 (NOVA): Hierarquia de Snapshots via DataGroupEntries
  const hierarchicalView = useMemo(() => {
    const result: Array<{
      unitId: string;
      unitName: string;
      unitIcon: string;
      lastUpdated: string | null;
      updatedBy: string | null;
      responsibleSector?: string | null;
      responsibleUpdater?: string | null;
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
        responsibleUpdater: unit.responsibleUpdaterId
          ? users.find((candidate) => candidate.id === unit.responsibleUpdaterId)?.name || "Responsável configurado"
          : null,
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
                orderIndex: item.orderIndex,
                author,
                dateRaw: new Date(item.createdAt).getTime(),
                dateStr: new Date(item.createdAt).toLocaleString("pt-BR"),
                isFeatured: item.isFeatured,
                imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
                title: txtFields[0]?.valueText || "Registro",
                description: descFields[0]?.valueText || "",
              };
            });

            processedItems.sort(
              (a, b) =>
                (a.orderIndex ?? 999) - (b.orderIndex ?? 999) ||
                b.dateRaw - a.dateRaw,
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
                (b.referenceMonth ?? -1) - (a.referenceMonth ?? -1) ||
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

  const analytics = useMemo(() => {
    const selectedEntries = entries.filter((entry) =>
      selectedUnitIds.includes(entry.unitId),
    );
    const selectedItems = collectionItems.filter(
      (item) =>
        selectedUnitIds.includes(item.unitId) && item.status !== "archived",
    );
    const updates = [
      ...selectedEntries.map((entry) => ({
        date: entry.updatedAt,
        type: "Indicadores",
      })),
      ...selectedItems.map((item) => ({
        date: item.updatedAt,
        type: "Registros",
      })),
    ].filter((item) => item.date);
    const now = new Date();
    const trend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        indicadores: 0,
        registros: 0,
      };
    });
    updates.forEach((update) => {
      const date = new Date(update.date);
      const bucket = trend.find(
        (item) => item.key === `${date.getFullYear()}-${date.getMonth()}`,
      );
      if (!bucket) return;
      if (update.type === "Indicadores") bucket.indicadores += 1;
      else bucket.registros += 1;
    });

    const unitsWithRecords = units
      .filter((unit) => selectedUnitIds.includes(unit.id))
      .map((unit) => {
        const snapshots = selectedEntries.filter(
          (entry) => entry.unitId === unit.id,
        ).length;
        const items = selectedItems.filter(
          (item) => item.unitId === unit.id,
        ).length;
        return {
          name: unit.name.length > 22 ? `${unit.name.slice(0, 20)}...` : unit.name,
          fullName: unit.name,
          indicadores: snapshots,
          registros: items,
          total: snapshots + items,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
    const byUnit = unitsWithRecords.slice(0, 8);

    const composition = [
      { name: "Indicadores", value: selectedEntries.length, color: "#90846C" },
      { name: "Registros", value: selectedItems.length, color: "#172433" },
    ].filter((item) => item.value > 0);
    const lastUpdate = updates
      .map((item) => item.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    const activeUnitCount = unitsWithRecords.length;

    const gallery = hierarchicalView
      .flatMap((unit) =>
        unit.groups.flatMap((group) =>
          (group.collectionItems || [])
            .filter((item: any) => item.imageUrl)
            .map((item: any) => ({
              ...item,
              unitName: unit.unitName,
              groupTitle: group.groupTitle,
            })),
        ),
      )
      .sort(
        (a: any, b: any) =>
          Number(b.isFeatured) - Number(a.isFeatured) || b.dateRaw - a.dateRaw,
      )
      .slice(0, 4);

    return {
      selectedEntries,
      selectedItems,
      trend,
      byUnit,
      composition,
      gallery,
      lastUpdate,
      activeUnitCount,
      coverage:
        selectedUnitIds.length > 0
          ? Math.round((activeUnitCount / selectedUnitIds.length) * 100)
          : 0,
    };
  }, [collectionItems, entries, hierarchicalView, selectedUnitIds, units]);

  const visibleHierarchy = useMemo(() => {
    const search = detailSearch.trim().toLocaleLowerCase("pt-BR");
    if (!search) return hierarchicalView;

    return hierarchicalView
      .map((unit) => ({
        ...unit,
        groups: unit.groups.filter(
          (group) =>
            unit.unitName.toLocaleLowerCase("pt-BR").includes(search) ||
            group.groupTitle.toLocaleLowerCase("pt-BR").includes(search) ||
            (group.numberFields || []).some(
              (field: any) =>
                field.label.toLocaleLowerCase("pt-BR").includes(search) ||
                String(field.value).toLocaleLowerCase("pt-BR").includes(search),
            ) ||
            (group.textFields || []).some(
              (field: any) =>
                field.label.toLocaleLowerCase("pt-BR").includes(search) ||
                String(field.value).toLocaleLowerCase("pt-BR").includes(search),
            ) ||
            (group.collectionItems || []).some(
              (item: any) =>
                item.title.toLocaleLowerCase("pt-BR").includes(search) ||
                item.description.toLocaleLowerCase("pt-BR").includes(search),
            ),
        ),
      }))
      .filter((unit) => unit.groups.length > 0);
  }, [detailSearch, hierarchicalView]);

  const indicatorRows = useMemo(
    () =>
      visibleHierarchy.flatMap((unit) =>
        unit.groups.flatMap((group) =>
          group.mode === "snapshot"
            ? (group.numberFields || []).map((field: any) => ({
                ...field,
                unitId: unit.unitId,
                unitName: unit.unitName,
                groupId: group.groupId,
                groupTitle: group.groupTitle,
                lastUpdated: unit.lastUpdated,
                updatedBy: unit.updatedBy,
                responsibleSector: unit.responsibleSector,
                responsibleUpdater: unit.responsibleUpdater,
              }))
            : [],
        ),
      ),
    [visibleHierarchy],
  );

  const textualRows = useMemo(
    () =>
      visibleHierarchy.flatMap((unit) =>
        unit.groups.flatMap((group) =>
          group.mode === "snapshot"
            ? (group.textFields || []).map((field: any) => ({
                ...field,
                unitId: unit.unitId,
                unitName: unit.unitName,
                groupId: group.groupId,
                groupTitle: group.groupTitle,
                lastUpdated: unit.lastUpdated,
                updatedBy: unit.updatedBy,
                responsibleSector: unit.responsibleSector,
                responsibleUpdater: unit.responsibleUpdater,
              }))
            : [],
        ),
      ),
    [visibleHierarchy],
  );

  const recordRows = useMemo(
    () =>
      visibleHierarchy
        .flatMap((unit) =>
          unit.groups.flatMap((group) =>
            group.mode === "collection"
              ? (group.collectionItems || []).map((item: any) => ({
                  ...item,
                  unitId: unit.unitId,
                  unitName: unit.unitName,
                  groupId: group.groupId,
                  groupTitle: group.groupTitle,
                  responsibleSector: unit.responsibleSector,
                  responsibleUpdater: unit.responsibleUpdater,
                }))
              : [],
          ),
        ),
    [visibleHierarchy],
  );

  useEffect(() => {
    if (visibleHierarchy.some((unit) => unit.unitId === focusedUnitId)) return;
    setFocusedUnitId(visibleHierarchy[0]?.unitId ?? null);
  }, [focusedUnitId, visibleHierarchy]);

  const focusedUnit =
    visibleHierarchy.find((unit) => unit.unitId === focusedUnitId) ||
    visibleHierarchy[0] ||
    null;

  const dashboardTabs: Array<{
    id: DashboardTab;
    label: string;
    count?: number;
  }> = [
    { id: "overview", label: "Visão geral" },
    { id: "indicators", label: "Indicadores", count: indicatorRows.length + textualRows.length },
    { id: "records", label: "Registros", count: recordRows.length },
    { id: "detail", label: "Detalhe por tópico", count: visibleHierarchy.length },
  ];

  return (
    <div className="space-y-8">
      {/* Filtro e impressão */}
      <div className="bg-white p-5 rounded-3xl shadow-premium border border-pm-secondary/15 flex flex-wrap gap-4 items-center justify-between">
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
        <div className="relative w-full sm:w-[280px]">
          <Search className="w-4 h-4 text-pm-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={detailSearch}
            onChange={(event) => setDetailSearch(event.target.value)}
            placeholder="Buscar tópico ou seção"
            className="w-full rounded-xl border border-pm-secondary/15 bg-pm-light/50 py-2.5 pl-10 pr-4 text-sm font-bold text-pm-dark outline-none focus:border-pm-primary/40 focus:ring-4 focus:ring-pm-primary/10"
          />
        </div>
      </div>

      {user?.role !== "editor" && updateAlerts.length > 0 && (
        <section className="rounded-2xl border border-pm-secondary/15 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="min-w-[220px]">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                <ShieldAlert className="h-4 w-4 text-amber-600" /> Alertas
              </p>
              <h3 className="mt-1 text-base font-black text-pm-dark">Controle de atualização</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <div className={`rounded-xl px-3 py-2 text-center ${overdueAlertCount > 0 ? "bg-red-50 text-red-700" : "bg-pm-light text-pm-secondary"}`}>
                <strong className="block text-lg font-black">{overdueAlertCount}</strong>
                <span className="text-[9px] font-black uppercase tracking-wider">em atraso</span>
              </div>
              <div className={`rounded-xl px-3 py-2 text-center ${lateAlertCount > 0 ? "bg-amber-50 text-amber-700" : "bg-pm-light text-pm-secondary"}`}>
                <strong className="block text-lg font-black">{lateAlertCount}</strong>
                <span className="text-[9px] font-black uppercase tracking-wider">atrasado</span>
              </div>
              <div className="rounded-xl bg-blue-50 px-3 py-2 text-center text-blue-700">
                <strong className="block text-lg font-black">{pendingAlertCount}</strong>
                <span className="text-[9px] font-black uppercase tracking-wider">aguardando</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {actionableAlerts.length === 0 ? (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
                  Todos os tópicos monitorados foram atualizados dentro do ciclo vigente.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-pm-secondary/10">
                  {visibleActionableAlerts.map((alert) => (
                    <div key={alert.rule.id} className="grid grid-cols-1 gap-2 border-b border-pm-secondary/10 px-3 py-2 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black uppercase text-pm-dark">{alert.unit.name}</p>
                        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-pm-secondary">
                          {alert.unit.responsibleSector || "Setor não definido"} · {alert.responsibleUpdater}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-pm-secondary">
                        {alert.dueAt.toLocaleDateString("pt-BR")} {alert.dueAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
                        alert.status === "overdue"
                          ? "bg-red-100 text-red-700"
                          : alert.status === "late"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                      }`}>
                        {alert.status === "overdue" ? "Não atualizado" : alert.status === "late" ? "Com atraso" : "Aguardando"}
                      </span>
                    </div>
                  ))}
                  {actionableAlerts.length > visibleActionableAlerts.length && (
                    <div className="bg-pm-light/40 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-pm-secondary">
                      +{actionableAlerts.length - visibleActionableAlerts.length} pendências adicionais
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-pm-secondary/15 bg-white p-2 shadow-sm">
        {dashboardTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-all ${
                isActive
                  ? "bg-pm-dark text-white shadow-md"
                  : "text-pm-secondary hover:bg-pm-light hover:text-pm-dark"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    isActive ? "bg-white/15 text-white" : "bg-pm-light text-pm-secondary"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {activeTab === "overview" && (
        <>
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
            <p className="mt-2 text-[11px] font-bold text-pm-secondary">
              {analytics.selectedEntries.length} indicadores + {analytics.selectedItems.length} registros
            </p>
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
            <p className="mt-2 text-[11px] font-bold text-pm-secondary">
              Priorizados para leitura
            </p>
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
            <p className="mt-2 text-[11px] font-bold text-pm-secondary">
              {analytics.coverage}% com registros
            </p>
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
            <h4 className="text-base font-black text-pm-dark leading-tight">
              {analytics.lastUpdate
                ? new Date(analytics.lastUpdate).toLocaleDateString("pt-BR")
                : estatisticasResumo.atividadeGlobal}
            </h4>
            <p className="mt-2 text-[11px] font-bold text-pm-secondary">
              Última atualização
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-5">
        <section className="bg-white rounded-3xl border border-pm-secondary/15 shadow-premium overflow-hidden">
          <div className="px-6 pt-6 pb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                Fluxo de atualização
              </p>
              <h3 className="mt-1 text-xl font-black text-pm-dark">
                Evolução dos últimos 6 meses
              </h3>
            </div>
            <span className="badge badge-success">
              <TrendingUp className="w-3 h-3" />
              Dados reais
            </span>
          </div>
          <div className="h-[280px] px-3 pb-4">
            <Suspense fallback={<ChartFallback />}>
              <GeneralTrendChart data={analytics.trend} />
            </Suspense>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-pm-secondary/15 shadow-premium overflow-hidden">
          <div className="px-6 pt-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
              Composição
            </p>
            <h3 className="mt-1 text-xl font-black text-pm-dark">Base selecionada</h3>
          </div>
          <div className="h-[190px]">
            <Suspense fallback={<ChartFallback />}>
              <GeneralCompositionChart data={analytics.composition} />
            </Suspense>
          </div>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {analytics.composition.map((item) => (
              <div key={item.name} className="rounded-xl bg-pm-light/60 p-2.5 text-center">
                <span className="mx-auto mb-1 block h-2 w-2 rounded-full" style={{ background: item.color }} />
                <strong className="block text-lg text-pm-dark">{item.value}</strong>
                <span className="block truncate text-[9px] font-black uppercase text-pm-secondary">{item.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5">
        <section className="bg-white rounded-3xl border border-pm-secondary/15 shadow-premium p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                Ranking operacional
              </p>
              <h3 className="mt-1 text-xl font-black text-pm-dark">Registros por tópico</h3>
            </div>
          </div>
          {analytics.byUnit.length > 0 ? (
            <div className="h-[300px]">
              <Suspense fallback={<ChartFallback />}>
                <GeneralRankingChart data={analytics.byUnit} />
              </Suspense>
            </div>
          ) : (
            <p className="py-16 text-center text-sm font-bold text-pm-secondary">Sem dados para os filtros atuais.</p>
          )}
        </section>

        <section className="bg-white rounded-3xl border border-pm-secondary/15 shadow-premium overflow-hidden">
          <div className="p-6 pb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                Evidências visuais
              </p>
              <h3 className="mt-1 text-xl font-black text-pm-dark">Destaques recentes</h3>
            </div>
            <ImageIcon className="w-5 h-5 text-pm-primary" />
          </div>
          {analytics.gallery.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              {analytics.gallery.map((item: any) => (
                <article key={item.id} className="group/card relative overflow-hidden rounded-2xl bg-pm-dark min-h-[138px]">
                  <ImageRenderer path={item.imageUrl} alt={item.title} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-12">
                    {item.isFeatured && <span className="mb-1 inline-flex rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase text-pm-dark">Destaque</span>}
                    <p className="truncate text-xs font-black text-white">{item.title}</p>
                    <p className="truncate text-[10px] font-bold text-white/70">{item.unitName}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="m-5 mt-0 flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-pm-secondary/20 bg-pm-light/40 text-center">
              <Sparkles className="h-8 w-8 text-pm-primary/60" />
              <p className="mt-3 text-sm font-black text-pm-dark">Nenhuma imagem registrada</p>
              <p className="mt-1 max-w-[240px] text-xs font-bold text-pm-secondary">
                Imagens inseridas nas coleções aparecerão aqui automaticamente.
              </p>
            </div>
          )}
        </section>
      </div>
        </>
      )}

      {activeTab === "indicators" && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 rounded-3xl border border-pm-secondary/15 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                Valores gerados
              </p>
              <h3 className="mt-1 text-2xl font-black text-pm-dark">Indicadores consolidados</h3>
              <p className="mt-2 text-sm font-medium text-pm-secondary">
                Valores preenchidos nas seções das unidades selecionadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-xl bg-pm-light px-4 py-2 text-sm font-black text-pm-dark">
                {indicatorRows.length} valor(es)
              </span>
              <span className="rounded-xl bg-pm-light px-4 py-2 text-sm font-black text-pm-dark">
                {textualRows.length} nota(s)
              </span>
            </div>
          </div>

          {indicatorRows.length === 0 && textualRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-pm-secondary/25 bg-white py-16 text-center text-sm font-bold text-pm-secondary">
              Nenhum indicador encontrado para os filtros atuais.
            </div>
          ) : (
            <>
            {indicatorRows.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {indicatorRows.map((field: any) => (
                <article
                  key={`${field.unitId}-${field.groupId}-${field.fieldId}`}
                  className="rounded-2xl border border-pm-secondary/15 bg-white p-5 shadow-sm transition-all hover:border-pm-primary/30 hover:shadow-premium"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black uppercase tracking-widest text-pm-secondary">
                        {field.unitName}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-pm-primary">
                        {field.groupTitle}
                      </p>
                    </div>
                    <Activity className="h-4 w-4 shrink-0 text-pm-primary/60" />
                  </div>
                  <p className="mt-5 text-xs font-black uppercase tracking-wide text-pm-secondary/75">
                    {field.label}
                  </p>
                  <p className={`mt-2 text-3xl font-black tracking-tight ${getMetricColor(field.label, field.value)}`}>
                    {formatDashboardValue(field)}
                  </p>
                  <div className="mt-4 space-y-1.5 border-t border-pm-secondary/10 pt-3 text-[10px] font-bold uppercase tracking-wide text-pm-secondary/70">
                    {field.responsibleSector && (
                      <p className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" />
                        {field.responsibleSector}
                      </p>
                    )}
                    {field.responsibleUpdater && (
                      <p className="flex items-center gap-1.5">
                        <UserRound className="h-3 w-3" />
                        Responsável: {field.responsibleUpdater}
                      </p>
                    )}
                    {field.lastUpdated && (
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Última: {new Date(field.lastUpdated).toLocaleDateString("pt-BR")} por {field.updatedBy}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
            )}
            {textualRows.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-wider text-pm-secondary">
                  Informações qualitativas
                </h4>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {textualRows.map((field: any) => (
                    <article
                      key={`${field.unitId}-${field.groupId}-${field.fieldId}`}
                      className="rounded-2xl border border-pm-secondary/15 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wide">
                        <span className="rounded-lg bg-pm-light px-2 py-1 text-pm-secondary">{field.unitName}</span>
                        <span className="text-pm-primary">{field.groupTitle}</span>
                      </div>
                      <p className="mt-4 text-xs font-black uppercase text-pm-secondary/75">{field.label}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-pm-dark">
                        {field.value}
                      </p>
                      {(field.responsibleUpdater || field.responsibleSector) && (
                        <p className="mt-4 border-t border-pm-secondary/10 pt-3 text-[10px] font-bold uppercase text-pm-secondary/75">
                          {field.responsibleSector || "Setor não definido"}
                          {field.responsibleUpdater ? ` · Responsável: ${field.responsibleUpdater}` : ""}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
            </>
          )}
        </section>
      )}

      {activeTab === "records" && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 rounded-3xl border border-pm-secondary/15 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                Conteúdo registrado
              </p>
              <h3 className="mt-1 text-2xl font-black text-pm-dark">Registros e evidências</h3>
              <p className="mt-2 text-sm font-medium text-pm-secondary">
                Informações produzidas nas coleções, organizadas por relevância e data.
              </p>
            </div>
            <span className="rounded-xl bg-pm-light px-4 py-2 text-sm font-black text-pm-dark">
              {recordRows.length} registro(s)
            </span>
          </div>

          {recordRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-pm-secondary/25 bg-white py-16 text-center text-sm font-bold text-pm-secondary">
              Nenhum registro de coleção encontrado para os filtros atuais.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {recordRows.map((item: any) => (
                <article
                  key={`${item.unitId}-${item.groupId}-${item.id}`}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                    item.isFeatured ? "border-amber-300" : "border-pm-secondary/15"
                  }`}
                >
                  {item.imageUrl && (
                    <div className="group/card h-48 w-full bg-pm-light">
                      <ImageRenderer path={item.imageUrl} alt={item.title} />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-pm-light px-2 py-1 text-[10px] font-black uppercase text-pm-secondary">
                        {item.unitName}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-pm-primary">
                        {item.groupTitle}
                      </span>
                      {item.isFeatured && (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-700">
                          Relevante
                        </span>
                      )}
                    </div>
                    <h4 className="mt-4 text-xl font-black text-pm-dark">{item.title}</h4>
                    {item.description && (
                      <p className="mt-2 line-clamp-4 text-sm font-medium leading-relaxed text-pm-secondary">
                        {item.description}
                      </p>
                    )}
                    {(item.responsibleUpdater || item.responsibleSector) && (
                      <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-pm-secondary/75">
                        {item.responsibleSector || "Setor não definido"}
                        {item.responsibleUpdater ? ` · Responsável: ${item.responsibleUpdater}` : ""}
                      </p>
                    )}
                    <p className="mt-5 flex items-center gap-2 border-t border-pm-secondary/10 pt-4 text-[10px] font-black uppercase tracking-wide text-pm-secondary/75">
                      <Clock className="h-3.5 w-3.5 text-pm-primary" />
                      {item.dateStr} · {item.author}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "detail" && (
      <div className="space-y-8">
        <div className="flex flex-col gap-1 border-b border-pm-secondary/15 pb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
            Detalhamento
          </p>
          <h3 className="text-2xl font-black text-pm-dark">Análise do tópico selecionado</h3>
          <p className="text-sm font-medium text-pm-secondary">
            Selecione um tópico para consultar suas seções sem percorrer todas as unidades.
          </p>
        </div>
        {visibleHierarchy.length === 0 && (
          <div className="py-12 text-center bg-pm-light/50 border border-dashed border-pm-secondary/30 rounded-xl">
            <Activity className="w-8 h-8 text-pm-secondary mx-auto mb-2 opacity-50" />
            <p className="text-pm-secondary font-medium">
              Nenhum tópico encontrado para os filtros atuais.
            </p>
          </div>
        )}

        {visibleHierarchy.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {visibleHierarchy.map((unitNode) => (
              <button
                key={unitNode.unitId}
                type="button"
                onClick={() => setFocusedUnitId(unitNode.unitId)}
                className={`min-w-[220px] rounded-2xl border p-4 text-left transition-all ${
                  focusedUnit?.unitId === unitNode.unitId
                    ? "border-pm-primary bg-pm-primary/10 shadow-sm"
                    : "border-pm-secondary/15 bg-white hover:border-pm-primary/35"
                }`}
              >
                <p className="truncate text-sm font-black text-pm-dark">{unitNode.unitName}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-pm-secondary">
                  {unitNode.groups.length} seção(ões)
                </p>
                {unitNode.responsibleUpdater && (
                  <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-pm-primary">
                    {unitNode.responsibleUpdater}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {(focusedUnit ? [focusedUnit] : []).map((unitNode) => (
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
              {unitNode.responsibleUpdater && (
                <p className="text-[11px] text-pm-secondary font-bold flex items-center gap-2 mt-2 ml-16 uppercase tracking-wider">
                  <UserRound className="w-3.5 h-3.5 text-pm-primary/60" />
                  <span>Responsável pela atualização:</span>
                  <span className="text-pm-dark/80">{unitNode.responsibleUpdater}</span>
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
      )}
    </div>
  );
}
