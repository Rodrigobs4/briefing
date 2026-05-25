import { useMemo, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Award,
  BadgeAlert,
  BadgeCheck,
  Bell,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  CalendarCheck,
  Camera,
  CarFront,
  Clock,
  ClipboardList,
  ClipboardPlus,
  Crosshair,
  Database,
  FileCheck,
  FileSearch,
  FileText,
  HeartHandshake,
  HeartPulse,
  Helicopter,
  Map as MapIcon,
  MapPinned,
  MessagesSquare,
  NotebookPen,
  Package,
  Plane,
  Radio,
  School,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Stethoscope,
  Target,
  Truck,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import {
  calculateFieldValue,
  useAuth,
  type DataGroup,
  type Field,
  type Unit,
} from "../../../store/AuthContext";
import { useSettings } from "../../../store/SettingsContext";
import { formatBrazilianNumber } from "../../../utils/brazilianNumbers";
import { getPublicUploadUrl } from "../../../utils/storageUrls";

interface ReportPresentationRendererProps {
  selectedUnits: string[];
  selectedGroups: string[];
  reportCategoryConfig?: {
    groupAssignments: Record<string, string>;
    categoryOrder: string[];
    unitOrder?: string[];
    groupOrder?: string[];
  };
  fontSize?: "standard" | "large";
}

type TopicSlide = {
  unit: Unit;
  category: string;
  groups: DataGroup[];
  imageUrl: string | null;
  metrics: Array<{
    label: string;
    value: ReactNode;
    valueClass: "numeric" | "shortText" | "longText";
  }>;
  highlights: Array<{
    title: string;
    description: string;
    date: string;
    featured: boolean;
  }>;
  detailRows: Array<{
    section: string;
    label: string;
    value: string;
    valueClass: "numeric" | "shortText" | "longText" | "empty";
    kind: "indicator" | "record";
  }>;
  responsibleSector: string | null;
  lastUpdate: { dateTime: string; author: string } | null;
};

type TopicPage = {
  slide: TopicSlide;
  rows: TopicSlide["detailRows"];
  pageIndex: number;
  totalPages: number;
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
  { name: "map", icon: MapIcon },
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

const getIconByName = (name?: string | null) =>
  TOPIC_ICONS.find((icon) => icon.name === name) ||
  TOPIC_ICONS.find((icon) => icon.name === "briefcase") ||
  TOPIC_ICONS[0];

const getCategoryLabel = (
  unit: Unit | undefined,
  group: { categoryTitle?: string | null },
  assignments?: Record<string, string>,
) => assignments?.[unit?.id || ""]?.trim() || unit?.reportCategoryTitle?.trim() || group.categoryTitle?.trim() || "Geral";

const isBlankValue = (value: any) => {
  if (value === null || value === undefined) return true;
  const text = String(value).trim().toLowerCase();
  return (
    text === "" || text === "null" || text === "undefined" || text === "nan"
  );
};

const fallbackValue = (value: any) =>
  isBlankValue(value) ? "Não informado" : String(value);

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isDateOrPeriodField = (fieldName: string) => {
  const normalized = normalizeText(fieldName);
  return [
    "data",
    "periodo",
    "prazo",
    "inicio",
    "fim",
    "vigencia",
    "competencia",
    "mes",
    "ano",
    "exercicio",
  ].some((term) => normalized.includes(term));
};

const formatValue = (
  field: Field,
  value: any,
  allValues: Record<string, any>,
  fields: Field[],
) => {
  let displayValue = value;

  if (
    (displayValue === null ||
      displayValue === undefined ||
      displayValue === "") &&
    field.type === "calculated"
  ) {
    displayValue = calculateFieldValue(field, allValues, fields, true);
  }

  if (isBlankValue(displayValue)) return "Não informado";
  if (field.type === "percentage") {
    const numberValue = Number(displayValue);
    return Number.isFinite(numberValue)
      ? `${numberValue.toLocaleString("pt-BR")}%`
      : "Não informado";
  }
  if (field.type === "currency") {
    const numberValue = Number(displayValue);
    return Number.isFinite(numberValue)
      ? formatBrazilianNumber(numberValue, true)
      : "Não informado";
  }
  if (field.type === "number" || field.type === "calculated") {
    const numberValue = Number(displayValue);
    return Number.isFinite(numberValue)
      ? numberValue.toLocaleString("pt-BR")
      : "Não informado";
  }
  return fallbackValue(displayValue);
};

const normalizeImageList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (parsed) return [String(parsed)];
    } catch {
      return [value];
    }
  }
  return [String(value)];
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0])
    .join("")
    .toUpperCase();

const metricLooksVisual = (field: Field) =>
  field.type !== "image" && field.type !== "textarea";

const getMetricValueClass = (
  value: ReactNode,
): "numeric" | "shortText" | "longText" => {
  if (typeof value !== "string") return "shortText";
  const normalized = value
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace("%", "")
    .trim();
  const isNumeric = normalized !== "" && Number.isFinite(Number(normalized));
  if (isNumeric) return "numeric";
  return value.length > 28 ? "longText" : "shortText";
};

const getDetailValueClass = (
  value: string,
): "numeric" | "shortText" | "longText" | "empty" => {
  if (value === "Não informado") return "empty";
  return getMetricValueClass(value);
};

const formatCollectionFieldValue = (field: Field, value: any) => {
  if (field.type === "number" || field.type === "percentage" || field.type === "currency") {
    const numberValue = value.valueNumber;
    if (isBlankValue(numberValue)) return "Não informado";
    if (field.type === "currency") return formatBrazilianNumber(Number(numberValue), true);
    return `${Number(numberValue).toLocaleString("pt-BR")}${field.type === "percentage" ? "%" : ""}`;
  }

  return fallbackValue(value.valueText);
};

const GENERIC_FIELD_LABELS = new Set([
  "quantidade",
  "qtd",
  "total",
  "valor",
  "resultado",
  "status",
  "observacao",
  "observações",
  "observacoes",
  "descricao",
  "descrição",
  "informacao",
  "informação",
  "dados",
]);

const shouldPrefixSection = (label: string) => {
  const normalized = normalizeText(label)
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
  return normalized.length <= 3 || GENERIC_FIELD_LABELS.has(normalized);
};

const composeCardLabel = (section: string, label: string) => {
  const cleanSection = fallbackValue(section);
  const cleanLabel = fallbackValue(label);
  if (cleanLabel === cleanSection) return cleanLabel;
  return shouldPrefixSection(cleanLabel)
    ? `${cleanSection} - ${cleanLabel}`
    : cleanLabel;
};

const TOPIC_GRID_COLUMNS = 4;
const FIRST_TOPIC_GRID_HEIGHT_MM = 103;
const CONTINUATION_TOPIC_GRID_HEIGHT_MM = 103;

const getTopicDimensions = (largeText: boolean) => ({
  cardHeight: largeText ? 43 : 38,
  sectionHeight: largeText ? 7 : 6,
  rowGap: largeText ? 2 : 1.5,
});

const getSectionHeight = (cardCount: number, largeText: boolean) => {
  if (cardCount <= 0) return 0;
  const { cardHeight, sectionHeight, rowGap } = getTopicDimensions(largeText);
  const cardRows = Math.ceil(cardCount / TOPIC_GRID_COLUMNS);
  return (
    sectionHeight +
    rowGap +
    cardRows * cardHeight +
    Math.max(0, cardRows - 1) * rowGap
  );
};

const getMaxCardsForGridHeight = (heightMm: number, largeText: boolean) => {
  const { cardHeight, sectionHeight, rowGap } = getTopicDimensions(largeText);
  const availableForCards =
    heightMm - sectionHeight - rowGap;
  const rows = Math.max(
    1,
    Math.floor(
      (availableForCards + rowGap) /
        (cardHeight + rowGap),
    ),
  );
  return rows * TOPIC_GRID_COLUMNS;
};

const paginateTopicRows = (rows: TopicSlide["detailRows"], largeText: boolean) => {
  const pages: TopicSlide["detailRows"][] = [];
  let currentPage: TopicSlide["detailRows"] = [];
  let currentHeight = 0;
  let currentHeightLimit = FIRST_TOPIC_GRID_HEIGHT_MM;
  const sectionGroups: TopicSlide["detailRows"][] = [];

  rows.forEach((row) => {
    const lastGroup = sectionGroups[sectionGroups.length - 1];
    if (!lastGroup || lastGroup[0]?.section !== row.section) {
      sectionGroups.push([row]);
      return;
    }

    lastGroup.push(row);
  });

  const pushPage = () => {
    pages.push(currentPage);
    currentPage = [];
    currentHeight = 0;
    currentHeightLimit = CONTINUATION_TOPIC_GRID_HEIGHT_MM;
  };

  sectionGroups.forEach((groupRows) => {
    const { rowGap } = getTopicDimensions(largeText);
    const groupHeight = getSectionHeight(groupRows.length, largeText);
    const fitsCurrentPage =
      currentHeight +
        (currentHeight > 0 ? rowGap : 0) +
        groupHeight <=
      currentHeightLimit;
    const fitsFreshPage = groupHeight <= currentHeightLimit;

    if (currentPage.length > 0 && fitsFreshPage && !fitsCurrentPage) {
      pushPage();
    }

    if (getSectionHeight(groupRows.length, largeText) <= currentHeightLimit) {
      currentHeight +=
        (currentHeight > 0 ? rowGap : 0) +
        getSectionHeight(groupRows.length, largeText);
      currentPage.push(...groupRows);
      return;
    }

    let remainingRows = [...groupRows];
    while (remainingRows.length > 0) {
      if (currentPage.length > 0) {
        pushPage();
      }

      const maxCards = getMaxCardsForGridHeight(currentHeightLimit, largeText);
      const chunk = remainingRows.slice(0, maxCards);
      currentPage.push(...chunk);
      currentHeight = getSectionHeight(chunk.length, largeText);
      remainingRows = remainingRows.slice(maxCards);

      if (remainingRows.length > 0) {
        pushPage();
      }
    }
  });

  if (currentPage.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  return pages;
};

export default function ReportPresentationRenderer({
  selectedUnits,
  selectedGroups,
  reportCategoryConfig,
  fontSize = "standard",
}: ReportPresentationRendererProps) {
  const {
    units,
    dataGroups,
    fields,
    entries,
    getValuesForEntry,
    collectionItems,
    getValuesForItem,
    users,
  } = useAuth();
  const { settings } = useSettings();
  const largeText = fontSize === "large";

  const logoUrl = settings?.logo_path
    ? getPublicUploadUrl(settings.logo_path)
    : null;

  const sortedGroups = useMemo(() => {
    const categoryOrder = reportCategoryConfig?.categoryOrder ?? [];
    const groupOrder = reportCategoryConfig?.groupOrder ?? [];

    const getCategoryOrder = (group: DataGroup) => {
      const category = getCategoryLabel(
        units.find((unit) => unit.id === group.unitId),
        group,
        reportCategoryConfig?.groupAssignments,
      );
      const configuredIndex = categoryOrder.indexOf(category);
      return configuredIndex >= 0
        ? configuredIndex
        : (units.find((unit) => unit.id === group.unitId)?.reportCategoryOrder ?? group.categoryOrder ?? 999);
    };

    const getGroupOrder = (group: DataGroup) => {
      const configuredIndex = groupOrder.indexOf(group.id);
      return configuredIndex >= 0 ? configuredIndex : group.order;
    };

    return dataGroups
      .filter((group) => selectedGroups.includes(group.id))
      .sort(
        (a, b) =>
          getCategoryOrder(a) - getCategoryOrder(b) ||
          getGroupOrder(a) - getGroupOrder(b),
      );
  }, [dataGroups, reportCategoryConfig, selectedGroups]);

  const orderedCategories = useMemo(
    () =>
      Array.from(
        new Set(
          sortedGroups.map((group) =>
            getCategoryLabel(units.find((unit) => unit.id === group.unitId), group, reportCategoryConfig?.groupAssignments),
          ),
        ),
      ),
    [reportCategoryConfig?.groupAssignments, sortedGroups, units],
  );

  const topicSlides = useMemo<TopicSlide[]>(
    () =>
      orderedCategories.flatMap((category) =>
        units
          .filter((unit) => selectedUnits.includes(unit.id))
          .sort((a, b) => {
            const unitOrder = reportCategoryConfig?.unitOrder ?? [];
            const aIndex = unitOrder.indexOf(a.id);
            const bIndex = unitOrder.indexOf(b.id);
            const normalizedAIndex = aIndex >= 0 ? aIndex : 9999;
            const normalizedBIndex = bIndex >= 0 ? bIndex : 9999;
            return normalizedAIndex - normalizedBIndex || (a.order_index ?? 999) - (b.order_index ?? 999);
          })
          .map((unit) => {
            const groups = sortedGroups.filter(
              (group) =>
                group.unitId === unit.id &&
                getCategoryLabel(
                  unit,
                  group,
                  reportCategoryConfig?.groupAssignments,
                ) === category,
            );
            if (groups.length === 0) return null;

          const metrics: TopicSlide["metrics"] = [];
          const highlights: TopicSlide["highlights"] = [];
          const detailRows: TopicSlide["detailRows"] = [];
          let imagePath: string | null = null;
          const groupIds = groups.map((group) => group.id);
          const latestTopicUpdate = [
            ...entries
              .filter(
                (entry) =>
                  entry.unitId === unit.id &&
                  groupIds.includes(entry.dataGroupId),
              )
              .map((entry) => ({
                updatedAt: entry.updatedAt,
                updatedBy: entry.updatedBy,
              })),
            ...collectionItems
              .filter(
                (item) =>
                  item.unitId === unit.id &&
                  groupIds.includes(item.dataGroupId) &&
                  item.status !== "archived",
              )
              .map((item) => ({
                updatedAt: item.updatedAt,
                updatedBy: item.updatedBy,
              })),
          ]
            .filter((item) => item.updatedAt)
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            )[0];
          const latestTopicUpdateDate = latestTopicUpdate
            ? new Date(latestTopicUpdate.updatedAt)
            : null;
          const latestTopicUpdateAuthor = latestTopicUpdate?.updatedBy
            ? users.find((user) => user.id === latestTopicUpdate.updatedBy)
                ?.name || "Responsável não identificado"
            : "Responsável não identificado";

          groups.forEach((group) => {
            if (group.mode === "snapshot") {
              const entry = entries
                .filter(
                  (item) =>
                    item.unitId === unit.id && item.dataGroupId === group.id,
                )
                .sort(
                  (a, b) =>
                    (b.referenceYear ?? -1) - (a.referenceYear ?? -1) ||
                    new Date(b.updatedAt).getTime() -
                      new Date(a.updatedAt).getTime(),
                )[0];
              const entryValues = entry ? getValuesForEntry(entry.id) : [];
              const valuesByField = entryValues.reduce<Record<string, any>>(
                (acc, item) => {
                  acc[item.fieldId] = item.value;
                  return acc;
                },
                {},
              );

              fields
                .filter(
                  (field) => field.dataGroupId === group.id && field.isActive,
                )
                .sort((a, b) => a.order - b.order)
                .forEach((field) => {
                  const rawValue = valuesByField[field.id];
                  if (field.type === "image" && !imagePath) {
                    imagePath = normalizeImageList(rawValue)[0] || null;
                    return;
                  }

                  const displayValue = formatValue(
                    field,
                    rawValue,
                    valuesByField,
                    fields,
                  );
                  detailRows.push({
                    section: group.title,
                    label: composeCardLabel(group.title, field.name),
                    value: displayValue,
                    valueClass: getDetailValueClass(displayValue),
                    kind: "indicator",
                  });

                  if (
                    metrics.length < 6 &&
                    metricLooksVisual(field) &&
                    displayValue !== "Não informado"
                  ) {
                    metrics.push({
                      label: field.name,
                      value: displayValue,
                      valueClass: getMetricValueClass(displayValue),
                    });
                  }
                });
              return;
            }

            collectionItems
              .filter(
                (item) =>
                  item.unitId === unit.id &&
                  item.dataGroupId === group.id &&
                  item.status !== "archived",
              )
              .sort(
                (a, b) =>
                  new Date(a.updatedAt).getTime() -
                  new Date(b.updatedAt).getTime(),
              )
              .forEach((item) => {
                const itemValues = getValuesForItem(item.id);
                const valuesWithField = itemValues
                  .map((value) => ({
                    value,
                    field: fields.find((field) => field.id === value.fieldId),
                  }))
                  .filter(({ field }) => field);
                const imageValue = valuesWithField.find(
                  ({ field, value }) =>
                    field?.type === "image" && value.valueJson,
                );
                if (!imagePath && imageValue) {
                  imagePath =
                    normalizeImageList(imageValue.value.valueJson)[0] || null;
                }

                const textValues = valuesWithField.filter(
                  ({ field }) =>
                    field?.type === "text" || field?.type === "textarea",
                );
                const datePeriodValues = valuesWithField.filter(
                  ({ field }) => field && isDateOrPeriodField(field.name),
                );
                const titleValue =
                  textValues.find(
                    ({ field, value }) =>
                      field?.type === "text" &&
                      field &&
                      !isDateOrPeriodField(field.name) &&
                      !isBlankValue(value.valueText),
                  ) ||
                  textValues.find(
                    ({ value }) => !isBlankValue(value.valueText),
                  );
                const title = fallbackValue(
                  titleValue?.value.valueText || "Registro",
                );
                const datePeriodLabel = datePeriodValues
                  .map(({ field, value }) =>
                    field ? formatCollectionFieldValue(field, value) : null,
                  )
                  .filter((value) => value && value !== "Não informado")
                  .join(" | ");
                const recordLabel = datePeriodLabel
                  ? `${datePeriodLabel} - ${title}`
                  : title;
                const description = fallbackValue(
                  textValues.find(
                    ({ field, value }) =>
                      field?.type === "textarea" &&
                      !isBlankValue(value.valueText),
                  )?.value.valueText ||
                    textValues
                      .map(({ value }) => value.valueText)
                      .filter((value) => !isBlankValue(value))
                      .slice(0, 3)
                      .join(" | ") ||
                    "Registro sem resumo textual.",
                );

                highlights.push({
                  title,
                  description,
                  date: new Date(item.updatedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  }),
                  featured: item.isFeatured,
                });

                const detailValue = valuesWithField
                  .filter(
                    ({ field }) =>
                      field?.type !== "image" &&
                      field?.id !== titleValue?.field?.id &&
                      !isDateOrPeriodField(field?.name || ""),
                  )
                  .map(({ field, value }) => {
                    if (!field) return null;
                    return `${field.name}: ${formatCollectionFieldValue(field, value)}`;
                  })
                  .filter(Boolean)
                  .join(" | ");

                detailRows.push({
                  section: group.title,
                  label: composeCardLabel(group.title, recordLabel),
                  value: detailValue || description,
                  valueClass: getDetailValueClass(detailValue || description),
                  kind: "record",
                });
              });
          });

          return {
            unit,
            category,
            groups,
            imageUrl: imagePath ? getPublicUploadUrl(imagePath) : null,
            metrics: metrics.slice(0, 6),
            highlights: highlights.slice(0, 3),
            detailRows,
            responsibleSector: unit.responsibleSector?.trim() || null,
            lastUpdate: latestTopicUpdateDate
              ? {
                  dateTime: latestTopicUpdateDate.toLocaleString("pt-BR"),
                  author: latestTopicUpdateAuthor,
                }
              : null,
          };
          })
          .filter((slide): slide is TopicSlide => Boolean(slide)),
      ),
    [
      collectionItems,
      entries,
      fields,
      getValuesForEntry,
      getValuesForItem,
      orderedCategories,
      reportCategoryConfig,
      selectedUnits,
      sortedGroups,
      units,
      users,
    ],
  );

  const categories = orderedCategories.filter((category) =>
    topicSlides.some((slide) => slide.category === category),
  );
  const topicPages = topicSlides.flatMap<TopicPage>((slide) => {
    const pages = paginateTopicRows(slide.detailRows, largeText);

    return pages.map((rows, pageIndex) => ({
      slide,
      rows,
      pageIndex: pageIndex + 1,
      totalPages: pages.length,
    }));
  });
  const lastUpdate = useMemo(() => {
    const selectedUpdates = [
      ...entries
        .filter(
          (entry) =>
            selectedUnits.includes(entry.unitId) &&
            selectedGroups.includes(entry.dataGroupId),
        )
        .map((entry) => ({
          updatedAt: entry.updatedAt,
          updatedBy: entry.updatedBy,
        })),
      ...collectionItems
        .filter(
          (item) =>
            selectedUnits.includes(item.unitId) &&
            selectedGroups.includes(item.dataGroupId) &&
            item.status !== "archived",
        )
        .map((item) => ({
          updatedAt: item.updatedAt,
          updatedBy: item.updatedBy,
        })),
    ].filter((item) => item.updatedAt);
    const latestUpdate = selectedUpdates.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];

    if (!latestUpdate) return null;

    const updatedAt = new Date(latestUpdate.updatedAt);
    return {
      date: updatedAt.toLocaleDateString("pt-BR"),
      time: updatedAt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      author: latestUpdate.updatedBy
        ? users.find((user) => user.id === latestUpdate.updatedBy)?.name ||
          "Responsável não identificado"
        : "Responsável não identificado",
    };
  }, [collectionItems, entries, selectedGroups, selectedUnits, users]);
  const generatedAt = new Date();

  return (
    <div className={`presentation-report bg-white text-slate-950 ${largeText ? "presentation-font-large" : ""}`}>
      <section className="presentation-page presentation-cover">
        <div className="presentation-cover-mark" />
        <header className="presentation-topbar">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" />
          ) : (
            <Building2 className="w-12 h-12" />
          )}
          <div>
            <strong>PMBA - Comando Geral</strong>
            <span>
              DCS / Gabinete de Gestão -{" "}
              {generatedAt.toLocaleDateString("pt-BR")}
            </span>
          </div>
        </header>

        <main className="presentation-cover-main">
          <span className="presentation-kicker">Briefing visual executivo</span>
          <h1>Apresentação Comandante Geral</h1>
          <p>Briefing do relatório intuitivo.</p>
        </main>

        <div className="presentation-cover-update">
          <span>Última atualização</span>
          <strong>
            {lastUpdate
              ? `${lastUpdate.date} às ${lastUpdate.time}`
              : "Sem registro"}
          </strong>
          <p>{lastUpdate?.author || "Responsável não identificado"}</p>
        </div>

        <div className="presentation-cover-grid">
          <div>
            <span>Tópicos</span>
            <strong>{topicSlides.length}</strong>
          </div>
          <div>
            <span>Categorias</span>
            <strong>{categories.length}</strong>
          </div>
          <div>
            <span>Seções</span>
            <strong>{sortedGroups.length}</strong>
          </div>
          <div>
            <span>Informações</span>
            <strong>
              {topicSlides.reduce(
                (total, slide) => total + slide.detailRows.length,
                0,
              )}
            </strong>
          </div>
        </div>
      </section>

      {categories.map((category, categoryIndex) => {
        const slides = topicSlides.filter(
          (slide) => slide.category === category,
        );
        const categoryTopicPages = topicPages.filter(
          (topicPage) => topicPage.slide.category === category,
        );

        return (
          <div key={category} className="presentation-category-flow">
            <section className="presentation-page presentation-category-page">
              <div className="presentation-category-number">
                {String(categoryIndex + 1).padStart(2, "0")}
              </div>
              <div>
                <span className="presentation-kicker">Categoria</span>
                <h2>{category}</h2>
                <p>{slides.length} tópico(s) nesta etapa do briefing.</p>
              </div>
              <div className="presentation-category-strip">
                {slides.map((slide) => (
                  <span key={slide.unit.id}>{slide.unit.name}</span>
                ))}
              </div>
            </section>

            {categoryTopicPages.map((topicPage, index) => {
              const slide = topicPage.slide;
              const Icon = getIconByName(slide.unit.description).icon;
              const isContinuation = topicPage.pageIndex > 1;
              const hasInfoRows = topicPage.rows.length > 0;
              const renderSectionedRows = (
                rows: TopicSlide["detailRows"],
                cardClassName: string,
              ) => {
                let currentSection = "";

                return rows.flatMap((row, rowIndex) => {
                  const items = [];
                  if (row.section !== currentSection) {
                    currentSection = row.section;
                    items.push(
                      <div
                        key={`${row.section}-${rowIndex}-section`}
                        className="presentation-topic-section-card"
                      >
                        {row.section}
                      </div>,
                    );
                  }

                  items.push(
                  <article
                    key={`${row.section}-${row.label}-${rowIndex}`}
                    className={`${cardClassName} presentation-info-row-${row.kind} presentation-topic-data-card-${row.valueClass}`}
                  >
                    <strong>{row.label}</strong>
                    <p>{row.value}</p>
                  </article>
                  );

                  return items;
                });
              };

              return (
                <section
                  key={`${slide.unit.id}-${topicPage.pageIndex}`}
                  className="presentation-page presentation-topic-page"
                >
                  <div className="presentation-topic-hero">
                    <div className="presentation-topic-image">
                      {slide.imageUrl ? (
                        <img src={slide.imageUrl} alt={slide.unit.name} />
                      ) : (
                        <div className="presentation-topic-fallback presentation-topic-fallback-large">
                          <Icon className="w-20 h-20" />
                          <strong>{getInitials(slide.unit.name)}</strong>
                        </div>
                      )}
                    </div>

                    <div className="presentation-topic-content">
                      <span className="presentation-kicker">
                        {String(index + 1).padStart(2, "0")} / {slide.category}
                      </span>
                      <h2>{slide.unit.name}</h2>
                      <p>
                        {isContinuation
                          ? `Continuação do tópico - parte ${topicPage.pageIndex} de ${topicPage.totalPages}`
                          : "Tópico operacional do briefing executivo."}
                      </p>
                      <div className="presentation-topic-updated">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Última atualização:</span>
                        <strong>
                          {slide.lastUpdate?.dateTime || "Sem registro"}
                        </strong>
                        <i />
                        <span>Responsável pela atualização:</span>
                        <strong>
                          {slide.lastUpdate?.author ||
                            "Responsável não identificado"}
                        </strong>
                      </div>
                      {slide.responsibleSector && (
                        <div className="presentation-topic-updated presentation-topic-sector">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Setor responsável:</span>
                          <strong>{slide.responsibleSector}</strong>
                        </div>
                      )}

                      <div className="presentation-section-tags">
                        {slide.groups.slice(0, 7).map((group) => (
                          <span key={group.id}>{group.title}</span>
                        ))}
                        {slide.groups.length > 7 && (
                          <span>+{slide.groups.length - 7} seção(ões)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="presentation-topic-data-grid">
                    {hasInfoRows ? (
                      renderSectionedRows(
                        topicPage.rows,
                        "presentation-topic-data-card",
                      )
                    ) : (
                      <div className="presentation-empty-card">
                        <Activity className="w-6 h-6" />
                        <span>Sem indicadores numericos destacados.</span>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        );
      })}

      <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 0;
                    }

                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .presentation-page {
                        box-shadow: none !important;
                        width: 297mm !important;
                        height: 210mm !important;
                        min-height: 210mm !important;
                        max-height: 210mm !important;
                        overflow: hidden !important;
                    }
                }

                .presentation-report {
                    width: 100%;
                    font-family: Inter, system-ui, -apple-system, sans-serif;
                    -webkit-font-smoothing: antialiased;
                }

                .presentation-page {
                    width: 297mm;
                    height: 210mm;
                    min-height: 210mm;
                    max-height: 210mm;
                    position: relative;
                    overflow: hidden;
                    padding: 13mm;
                    background: #f8fafc;
                    page-break-after: always;
                    break-after: page;
                    box-sizing: border-box;
                }

                .presentation-cover {
                    color: #ffffff;
                    background: linear-gradient(135deg, #0f172a 0%, #293241 48%, #8a7a3f 100%);
                }

                .presentation-cover-mark {
                    position: absolute;
                    right: -52mm;
                    top: -42mm;
                    width: 180mm;
                    height: 180mm;
                    border-radius: 50%;
                    border: 28mm solid rgba(255, 255, 255, 0.08);
                }

                .presentation-topbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    position: relative;
                    z-index: 1;
                }

                .presentation-topbar img {
                    width: 54px;
                    height: 54px;
                    object-fit: contain;
                    background: rgba(255, 255, 255, 0.92);
                    border-radius: 12px;
                    padding: 6px;
                }

                .presentation-topbar strong,
                .presentation-topbar span {
                    display: block;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .presentation-topbar strong {
                    font-size: 13px;
                    font-weight: 950;
                }

                .presentation-topbar span {
                    margin-top: 4px;
                    color: rgba(255, 255, 255, 0.72);
                    font-size: 10px;
                    font-weight: 800;
                }

                .presentation-cover-main {
                    position: relative;
                    z-index: 1;
                    max-width: 170mm;
                    margin-top: 30mm;
                }

                .presentation-kicker {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: rgba(138, 122, 63, 0.15);
                    color: #8a7a3f;
                    border: 1px solid rgba(138, 122, 63, 0.32);
                    font-size: 10px;
                    font-weight: 950;
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                }

                .presentation-cover .presentation-kicker {
                    background: rgba(255, 255, 255, 0.12);
                    color: #f8fafc;
                    border-color: rgba(255, 255, 255, 0.24);
                }

                .presentation-cover-main h1 {
                    margin: 12px 0 0;
                    font-size: 50px;
                    line-height: 1.08;
                    font-weight: 950;
                    letter-spacing: 0;
                    text-transform: uppercase;
                    max-width: 140mm;
                    padding-top: 2px;
                    padding-bottom: 2px;
                }

                .presentation-cover-main p {
                    margin: 14px 0 0;
                    max-width: 110mm;
                    color: rgba(255, 255, 255, 0.78);
                    font-size: 16px;
                    font-weight: 700;
                    line-height: 1.35;
                }

                .presentation-cover-update {
                    position: absolute;
                    left: 13mm;
                    right: 13mm;
                    bottom: 42mm;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: 1fr auto auto;
                    align-items: center;
                    gap: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(15, 23, 42, 0.26);
                    border-radius: 10px;
                    padding: 9px 12px;
                }

                .presentation-cover-update span,
                .presentation-cover-update strong,
                .presentation-cover-update p {
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .presentation-cover-update span {
                    color: rgba(255, 255, 255, 0.62);
                    font-size: 9px;
                    font-weight: 950;
                }

                .presentation-cover-update strong {
                    color: #ffffff;
                    font-size: 12px;
                    font-weight: 950;
                }

                .presentation-cover-update strong,
                .presentation-cover-update p {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .presentation-cover-update p {
                    color: rgba(255, 255, 255, 0.78);
                    font-size: 10px;
                    font-weight: 850;
                    text-align: right;
                }

                .presentation-cover-grid {
                    position: absolute;
                    left: 13mm;
                    right: 13mm;
                    bottom: 13mm;
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 10px;
                }

                .presentation-cover-grid div {
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 12px;
                }

                .presentation-cover-grid span {
                    display: block;
                    color: rgba(255, 255, 255, 0.62);
                    font-size: 10px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .presentation-cover-grid strong {
                    display: block;
                    margin-top: 6px;
                    color: #ffffff;
                    font-size: 25px;
                    font-weight: 950;
                    line-height: 1;
                }

                .presentation-page-header {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 14px;
                }

                .presentation-page-header > span,
                .presentation-category-number {
                    width: 46px;
                    height: 46px;
                    border-radius: 12px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: #0f172a;
                    color: #ffffff;
                    font-size: 16px;
                    font-weight: 950;
                }

                .presentation-page-header h2,
                .presentation-category-page h2,
                .presentation-topic-content h2 {
                    margin: 0;
                    color: #0f172a;
                    font-weight: 950;
                    letter-spacing: 0;
                    text-transform: uppercase;
                }

                .presentation-page-header h2 {
                    font-size: 31px;
                    line-height: 1.12;
                    padding-top: 1px;
                    padding-bottom: 1px;
                }

                .presentation-page-header p,
                .presentation-category-page p,
                .presentation-topic-content p {
                    margin: 5px 0 0;
                    color: #475569;
                    font-weight: 800;
                }

                .presentation-topic-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                    max-height: 164mm;
                    overflow: hidden;
                }

                .presentation-topic-card {
                    height: 34mm;
                    display: grid;
                    grid-template-columns: 54px minmax(0, 1fr);
                    gap: 8px;
                    align-items: center;
                    background: #ffffff;
                    border: 1px solid #dbe3ee;
                    border-radius: 12px;
                    padding: 8px;
                    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
                    break-inside: avoid;
                    overflow: hidden;
                }

                .presentation-topic-card-media {
                    width: 54px;
                    height: 54px;
                    border-radius: 10px;
                    overflow: hidden;
                    background: #e2e8f0;
                }

                .presentation-topic-card-media img,
                .presentation-topic-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .presentation-topic-card span {
                    color: #8a7a3f;
                    font-size: 9px;
                    font-weight: 950;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .presentation-topic-card h3 {
                    margin: 4px 0 0;
                    color: #0f172a;
                    font-size: 13px;
                    line-height: 1.16;
                    font-weight: 950;
                    text-transform: uppercase;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-topic-card p {
                    margin: 4px 0 0;
                    color: #64748b;
                    font-size: 9px;
                    font-weight: 800;
                }

                .presentation-topic-fallback {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    color: #0f172a;
                    background: linear-gradient(135deg, #e2e8f0 0%, #d8cca1 100%);
                }

                .presentation-topic-fallback strong {
                    font-size: 14px;
                    font-weight: 950;
                    letter-spacing: 0.04em;
                }

                .presentation-category-page {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    background: #111827;
                    color: #ffffff;
                }

                .presentation-category-page .presentation-category-number {
                    background: #d8cca1;
                    color: #111827;
                    margin-bottom: 16px;
                }

                .presentation-category-page h2 {
                    color: #ffffff;
                    font-size: 46px;
                    line-height: 1.08;
                    max-width: 190mm;
                    padding-top: 2px;
                    padding-bottom: 2px;
                }

                .presentation-category-page p {
                    color: rgba(255, 255, 255, 0.68);
                    font-size: 18px;
                }

                .presentation-category-strip {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 26px;
                    max-width: 220mm;
                }

                .presentation-category-strip span {
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 999px;
                    padding: 8px 12px;
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .presentation-topic-page {
                    display: flex;
                    flex-direction: column;
                    gap: 5mm;
                    background: #f8fafc;
                }

                .presentation-topic-hero {
                    display: grid;
                    grid-template-columns: 40% minmax(0, 1fr);
                    gap: 10px;
                    height: 70mm;
                    min-height: 0;
                }

                .presentation-topic-image {
                    border-radius: 16px;
                    overflow: hidden;
                    background: #dbe3ee;
                    border: 1px solid #cbd5e1;
                }

                .presentation-topic-fallback-large strong {
                    font-size: 32px;
                }

                .presentation-topic-content {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    background: #ffffff;
                    border: 1px solid #dbe3ee;
                    border-radius: 16px;
                    padding: 14px;
                    overflow: hidden;
                }

                .presentation-topic-content h2 {
                    margin-top: 8px;
                    font-size: 32px;
                    line-height: 1.12;
                    padding-top: 2px;
                    padding-bottom: 2px;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-topic-content p {
                    font-size: 13px;
                    line-height: 1.35;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-topic-updated {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 9px;
                    color: #64748b;
                    font-size: 9px;
                    font-weight: 900;
                    line-height: 1;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    white-space: nowrap;
                    overflow: hidden;
                }

                .presentation-topic-updated svg {
                    flex: 0 0 auto;
                    color: rgba(138, 122, 63, 0.7);
                }

                .presentation-topic-updated span,
                .presentation-topic-updated strong {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .presentation-topic-updated strong {
                    color: rgba(15, 23, 42, 0.82);
                    font-weight: 950;
                }

                .presentation-topic-updated i {
                    width: 4px;
                    height: 4px;
                    flex: 0 0 4px;
                    border-radius: 999px;
                    background: rgba(100, 116, 139, 0.32);
                }

                .presentation-section-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 9px;
                    max-height: 22mm;
                    overflow: hidden;
                }

                .presentation-section-tags span {
                    border-radius: 999px;
                    border: 1px solid #d8cca1;
                    background: #f7f3df;
                    color: #584b20;
                    padding: 5px 8px;
                    font-size: 9px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .presentation-topic-data-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    column-gap: 3mm;
                    row-gap: 1.5mm;
                    height: 103mm;
                    align-content: start;
                    overflow: hidden;
                }

                .presentation-metric-card,
                .presentation-empty-card,
                .presentation-topic-data-card {
                    background: #ffffff;
                    border: 1px solid #dbe3ee;
                    border-radius: 12px;
                    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
                }

                .presentation-metric-card {
                    min-height: 48mm;
                    padding: 8px 9px;
                    overflow: hidden;
                }

                .presentation-topic-data-card {
                    height: 38mm;
                    padding: 8px 9px;
                    overflow: hidden;
                    border-left-width: 5px;
                    break-inside: avoid;
                }

                .presentation-topic-section-card {
                    grid-column: 1 / -1;
                    height: 6mm;
                    display: flex;
                    align-items: center;
                    border-radius: 6px;
                    background: #e8edf3;
                    border-left: 5px solid #111827;
                    color: #111827;
                    padding: 0 9px;
                    font-size: 9px;
                    line-height: 1.1;
                    font-weight: 950;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    margin: 0;
                }

                .presentation-metric-card span {
                    display: block;
                    color: #64748b;
                    font-size: 10px;
                    font-weight: 900;
                    line-height: 1.2;
                    text-transform: uppercase;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-metric-card strong {
                    display: block;
                    margin-top: 6px;
                    color: #0f172a;
                    line-height: 0.96;
                    font-weight: 950;
                    word-break: break-word;
                    letter-spacing: 0;
                }

                .presentation-metric-value-numeric {
                    font-size: 29px;
                }

                .presentation-metric-value-shortText {
                    font-size: 20px;
                    line-height: 1.05;
                    display: -webkit-box !important;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-metric-value-longText {
                    font-size: 13px;
                    line-height: 1.18;
                    font-weight: 900;
                    display: -webkit-box !important;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-empty-card {
                    grid-column: 1 / -1;
                    min-height: 42mm;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    color: #64748b;
                    font-size: 13px;
                    font-weight: 900;
                }

                .presentation-info-list {
                    padding: 10px;
                    overflow: hidden;
                }

                .presentation-info-list h3 {
                    margin: 0 0 8px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #0f172a;
                    font-size: 13px;
                    font-weight: 950;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }

                .presentation-info-row {
                    padding: 7px 0;
                    border-top: 1px solid #e2e8f0;
                    break-inside: avoid;
                }

                .presentation-info-row-indicator {
                    border-left: 4px solid #0f172a;
                    padding-left: 8px;
                }

                .presentation-info-row-record {
                    border-left: 4px solid #8a7a3f;
                    padding-left: 8px;
                }

                .presentation-info-row span,
                .presentation-topic-data-card span {
                    display: block;
                    color: #584b20;
                    background: #f7f3df;
                    border: 1px solid #d8cca1;
                    border-radius: 999px;
                    width: fit-content;
                    max-width: 100%;
                    padding: 2px 6px;
                    font-size: 8px;
                    font-weight: 950;
                    line-height: 1.15;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-info-row strong,
                .presentation-topic-data-card strong {
                    color: #0f172a;
                    font-size: 11.5px;
                    line-height: 1.15;
                    font-weight: 950;
                    text-transform: uppercase;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    margin-top: 0;
                }

                .presentation-info-row p,
                .presentation-topic-data-card p {
                    margin: 6px 0 0;
                    color: #475569;
                    font-size: 10px;
                    line-height: 1.22;
                    font-weight: 700;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-data-page {
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .presentation-data-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 14px;
                    background: #ffffff;
                    border: 1px solid #dbe3ee;
                    border-left: 8px solid #8a7a3f;
                    border-radius: 14px;
                    padding: 12px 14px;
                    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
                }

                .presentation-data-header h2 {
                    margin: 9px 0 0;
                    color: #0f172a;
                    font-size: 27px;
                    line-height: 1;
                    font-weight: 950;
                    letter-spacing: 0;
                    text-transform: uppercase;
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-data-header p {
                    margin: 4px 0 0;
                    color: #64748b;
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .presentation-data-header > strong {
                    width: 42px;
                    height: 42px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    background: #0f172a;
                    color: #ffffff;
                    font-size: 18px;
                    font-weight: 950;
                    flex: 0 0 auto;
                }

                .presentation-data-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 7px;
                    height: 151mm;
                    overflow: hidden;
                }

                .presentation-data-row {
                    min-height: 19mm;
                    display: grid;
                    grid-template-columns: 34% minmax(0, 1fr);
                    gap: 8px;
                    align-items: start;
                    background: #ffffff;
                    border: 1px solid #dbe3ee;
                    border-radius: 10px;
                    padding: 8px 9px;
                    overflow: hidden;
                    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
                    break-inside: avoid;
                }

                .presentation-data-row-indicator {
                    border-left: 5px solid #0f172a;
                }

                .presentation-data-row-record {
                    border-left: 5px solid #8a7a3f;
                }

                .presentation-data-row span {
                    display: block;
                    color: #8a7a3f;
                    font-size: 8.5px;
                    font-weight: 950;
                    line-height: 1.15;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-data-row strong {
                    display: -webkit-box;
                    margin-top: 4px;
                    color: #0f172a;
                    font-size: 11px;
                    line-height: 1.15;
                    font-weight: 950;
                    text-transform: uppercase;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .presentation-data-row p {
                    margin: 0;
                    color: #334155;
                    font-size: 10.5px;
                    line-height: 1.25;
                    font-weight: 750;
                    display: -webkit-box;
                    -webkit-line-clamp: 4;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    word-break: break-word;
                }

                .presentation-topic-data-card p {
                    -webkit-line-clamp: 5;
                }

                .presentation-topic-data-card-numeric p {
                    color: #0f172a;
                    font-size: 27px;
                    line-height: 0.98;
                    font-weight: 950;
                    -webkit-line-clamp: 2;
                    letter-spacing: 0;
                }

                .presentation-topic-data-card-shortText p {
                    color: #0f172a;
                    font-size: 18px;
                    line-height: 1.05;
                    font-weight: 950;
                    -webkit-line-clamp: 3;
                    letter-spacing: 0;
                }

                .presentation-topic-data-card-empty strong {
                    font-size: 19px;
                    line-height: 1.05;
                    -webkit-line-clamp: 3;
                }

                .presentation-topic-data-card-empty p {
                    display: none;
                }

                .presentation-font-large .presentation-topic-updated,
                .presentation-font-large .presentation-section-tags span {
                    font-size: 10px;
                }

                .presentation-font-large .presentation-topic-data-grid {
                    row-gap: 2mm;
                }

                .presentation-font-large .presentation-topic-section-card {
                    height: 7mm;
                    font-size: 11px;
                    padding: 0 11px;
                }

                .presentation-font-large .presentation-topic-data-card {
                    height: 43mm;
                    padding: 10px 11px;
                }

                .presentation-font-large .presentation-topic-data-card strong {
                    font-size: 13px;
                    line-height: 1.22;
                }

                .presentation-font-large .presentation-topic-data-card p {
                    font-size: 12px;
                    line-height: 1.34;
                }

                .presentation-font-large .presentation-topic-data-card-numeric p {
                    font-size: 31px;
                    line-height: 1;
                }

                .presentation-font-large .presentation-topic-data-card-shortText p {
                    font-size: 20px;
                    line-height: 1.1;
                }
            `}</style>
    </div>
  );
}
