import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, ClipboardList, FileText, MapPinned, X } from "lucide-react";
import DashboardExecutivo from "./DashboardExecutivo";
import RegionalDashboardView from "./RegionalDashboardView";
import ReportBuilderModal from "./components/ReportBuilderModal";
import RegionalBriefing from "../regional/RegionalBriefing";

type BriefingView = "general" | "regional";

export default function DashboardHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const activeView: BriefingView =
    searchParams.get("view") === "regional" ? "regional" : "general";

  const setActiveView = (view: BriefingView) => {
    setSearchParams(view === "regional" ? { view: "regional" } : {});
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-3xl border border-pm-secondary/15 shadow-sm p-6 flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-pm-secondary">
            <BarChart3 className="w-4 h-4 text-pm-primary" />
            Painel Estratégico
          </div>
          <h2 className="text-3xl font-black text-pm-dark tracking-tight mt-1">
            BRIEFING
          </h2>
          <p className="text-sm text-pm-secondary mt-1 max-w-3xl">
            Use a chave abaixo para alternar entre o briefing geral e o briefing
            regional no mesmo painel.
          </p>
        </div>

        <div className="flex flex-col gap-3 shrink-0 w-full sm:w-auto">
          <div className="bg-pm-light border border-pm-secondary/15 rounded-2xl p-1.5 flex">
            <button
              onClick={() => setActiveView("general")}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${activeView === "general" ? "bg-white text-pm-dark shadow-sm" : "text-pm-secondary hover:text-pm-dark"}`}
            >
              <ClipboardList className="w-4 h-4" />
              Geral
            </button>
            <button
              onClick={() => setActiveView("regional")}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${activeView === "regional" ? "bg-white text-pm-dark shadow-sm" : "text-pm-secondary hover:text-pm-dark"}`}
            >
              <MapPinned className="w-4 h-4" />
              Regional
            </button>
          </div>
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black shadow-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {activeView === "general"
              ? "Imprimir briefing geral"
              : "Imprimir briefing regional"}
          </button>
        </div>
      </div>

      {activeView === "general" ? (
        <DashboardExecutivo />
      ) : (
        <RegionalDashboardView />
      )}

      {isReportModalOpen && activeView === "general" && (
        <ReportBuilderModal onClose={() => setIsReportModalOpen(false)} />
      )}

      {isReportModalOpen && activeView === "regional" && (
        <div className="fixed inset-0 bg-pm-dark/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-pm-light rounded-3xl shadow-2xl w-full max-w-7xl h-[92vh] border border-white/20 overflow-hidden flex flex-col">
            <div className="bg-white px-6 py-4 border-b border-pm-secondary/15 flex items-center justify-between gap-4 shrink-0">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                  Impressão
                </p>
                <h3 className="text-lg font-black text-pm-dark">
                  Briefing Regional
                </h3>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="w-10 h-10 rounded-xl border border-pm-secondary/15 text-pm-secondary hover:text-pm-dark hover:bg-pm-light transition-colors flex items-center justify-center"
                aria-label="Fechar impressão regional"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
              <RegionalBriefing />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
