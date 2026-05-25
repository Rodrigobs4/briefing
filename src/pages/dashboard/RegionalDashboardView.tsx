import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Clock,
  MapPinned,
  Search,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { compareTextPtBr } from "../../utils/textOrdering";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "Sem atualização";

export default function RegionalDashboardView() {
  const {
    regionalCommands,
    regionalBriefingSections,
    regionalBriefingEntries,
    regionalBriefingCollectionItems,
  } = useAuth();
  const activeCommands = regionalCommands
    .filter((command) => command.isActive)
    .sort((a, b) => compareTextPtBr(a.name, b.name));
  const [selectedCommandId, setSelectedCommandId] = useState(
    activeCommands[0]?.id || "all",
  );
  const [searchTerm, setSearchTerm] = useState("");

  const selectedCommand =
    activeCommands.find((command) => command.id === selectedCommandId) ?? null;
  const commandEntries = regionalBriefingEntries.filter(
    (entry) =>
      selectedCommandId === "all" ||
      entry.regionalCommandId === selectedCommandId,
  );
  const commandItems = regionalBriefingCollectionItems.filter(
    (item) =>
      (selectedCommandId === "all" ||
        item.regionalCommandId === selectedCommandId) &&
      item.status !== "archived",
  );
  const latestUpdate = [
    ...commandEntries.map((entry) => entry.updatedAt),
    ...commandItems.map((item) => item.updatedAt),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  const sectionStatus = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return regionalBriefingSections
      .filter((section) => section.isActive)
      .filter(
        (section) =>
          !normalizedSearch ||
          `${section.title} ${section.categoryTitle}`
            .toLowerCase()
            .includes(normalizedSearch),
      )
      .sort(
        (a, b) =>
          compareTextPtBr(a.categoryTitle, b.categoryTitle) ||
          compareTextPtBr(a.title, b.title),
      )
      .map((section) => {
        const snapshots = commandEntries.filter(
          (entry) => entry.sectionId === section.id,
        );
        const collections = commandItems.filter(
          (item) => item.sectionId === section.id,
        );
        const last = [
          ...snapshots.map((entry) => entry.updatedAt),
          ...collections.map((item) => item.updatedAt),
        ]
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

        return {
          section,
          snapshots: snapshots.length,
          collections: collections.length,
          total: snapshots.length + collections.length,
          last,
        };
      });
  }, [commandEntries, commandItems, regionalBriefingSections, searchTerm]);

  const categories = Array.from(
    new Set(sectionStatus.map((item) => item.section.categoryTitle)),
  ).sort(compareTextPtBr);

  return (
    <div className="space-y-8">
      <div className="bg-white p-5 rounded-2xl shadow-premium border border-pm-secondary/15 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-black text-pm-secondary/60 uppercase tracking-[0.15em]">
            Filtro de Comando
          </span>
          <span className="text-[11px] font-bold text-pm-secondary/70">
            {selectedCommand?.name || "Todos os comandos regionais"}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedCommandId}
            onChange={(event) => setSelectedCommandId(event.target.value)}
            className="bg-pm-light/50 border border-pm-secondary/20 text-sm font-bold rounded-xl px-4 py-2.5 text-pm-dark outline-none min-w-[260px]"
          >
            <option value="all">Todos os comandos regionais</option>
            {activeCommands.map((command) => (
              <option key={command.id} value={command.id}>
                {command.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 text-pm-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar seção"
              className="bg-pm-light/50 border border-pm-secondary/20 text-sm font-bold rounded-xl pl-9 pr-4 py-2.5 text-pm-dark outline-none min-w-[220px]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-pm-secondary/15 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-pm-primary/10 flex items-center justify-center text-pm-primary">
            <MapPinned className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-widest">
              Comandos
            </p>
            <h4 className="text-2xl font-black text-pm-dark">
              {selectedCommand ? 1 : activeCommands.length}
            </h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-pm-secondary/15 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-widest">
              Seções
            </p>
            <h4 className="text-2xl font-black text-pm-dark">
              {
                regionalBriefingSections.filter((section) => section.isActive)
                  .length
              }
            </h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-pm-secondary/15 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-widest">
              Registros
            </p>
            <h4 className="text-2xl font-black text-pm-dark">
              {commandEntries.length + commandItems.length}
            </h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-pm-secondary/15 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-widest">
              Última atualização
            </p>
            <h4 className="text-sm font-black text-pm-dark">
              {formatDate(latestUpdate)}
            </h4>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {categories.map((category) => {
          const categoryItems = sectionStatus.filter(
            (item) => item.section.categoryTitle === category,
          );
          return (
            <section key={category} className="space-y-4">
              <div className="border-b-2 border-pm-primary/20 pb-3">
                <h3 className="text-2xl font-black text-pm-dark tracking-tighter uppercase">
                  {category}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryItems.map((item) => (
                  <article
                    key={item.section.id}
                    className="bg-white rounded-2xl border border-pm-secondary/15 shadow-sm overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-pm-secondary/10 bg-pm-light/30">
                      <h4 className="section-title mb-0">
                        {item.section.title}
                      </h4>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-pm-secondary/60">
                        {item.section.mode === "collection"
                          ? "Registros múltiplos"
                          : "Indicador fixo"}{" "}
                        • {item.total > 0 ? "Com dados" : "Pendente"}
                      </p>
                    </div>
                    <div className="p-5 grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-pm-light/50 border border-pm-secondary/10 p-3">
                        <span className="text-[9px] font-black uppercase text-pm-secondary">
                          Seções
                        </span>
                        <strong className="block text-xl text-pm-dark">
                          {item.snapshots}
                        </strong>
                      </div>
                      <div className="rounded-xl bg-pm-light/50 border border-pm-secondary/10 p-3">
                        <span className="text-[9px] font-black uppercase text-pm-secondary">
                          Registros
                        </span>
                        <strong className="block text-xl text-pm-dark">
                          {item.collections}
                        </strong>
                      </div>
                      <div className="rounded-xl bg-pm-light/50 border border-pm-secondary/10 p-3">
                        <span className="text-[9px] font-black uppercase text-pm-secondary">
                          Atualização
                        </span>
                        <strong className="block text-xs text-pm-dark mt-1">
                          {item.last
                            ? new Date(item.last).toLocaleDateString("pt-BR")
                            : "-"}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
