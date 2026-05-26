import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, ClipboardList, FileText, MapPinned, ShieldCheck, Sparkles, X } from "lucide-react";
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
    <div className="space-y-7">
      <div className="relative overflow-hidden rounded-[2rem] bg-pm-dark px-6 py-7 text-white shadow-xl sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-16 -top-32 h-72 w-72 rounded-full bg-pm-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-[36%] h-32 w-80 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-pm-primary-light">
              <ShieldCheck className="w-4 h-4 text-pm-primary" />
              Centro de inteligência estratégica
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Painel Executivo <span className="text-pm-primary">PMBA</span>
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-white/65">
              Indicadores operacionais, registros críticos e evidências consolidados em uma leitura gerencial para decisão.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/75">
                <Sparkles className="h-3.5 w-3.5 text-pm-primary" />
                Monitoramento executivo
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/75">
                <BarChart3 className="h-3.5 w-3.5 text-pm-primary" />
                Dados atualizados pelo briefing
              </span>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto">
            <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm">
              <button
                onClick={() => setActiveView("general")}
                className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${activeView === "general" ? "bg-white text-pm-dark shadow-lg" : "text-white/65 hover:text-white"}`}
              >
                <ClipboardList className="w-4 h-4" />
                Geral
              </button>
              <button
                onClick={() => setActiveView("regional")}
                className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${activeView === "regional" ? "bg-white text-pm-dark shadow-lg" : "text-white/65 hover:text-white"}`}
              >
                <MapPinned className="w-4 h-4" />
                Regional
              </button>
            </div>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-pm-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-black/10 transition-all hover:bg-pm-primary-hover"
            >
              <FileText className="w-4 h-4" />
              {activeView === "general"
                ? "Gerar relatório geral"
                : "Gerar relatório regional"}
            </button>
          </div>
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
