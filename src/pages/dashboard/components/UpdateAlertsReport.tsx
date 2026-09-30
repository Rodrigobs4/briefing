import { useMemo } from 'react';
import { useSettings } from '../../../store/SettingsContext';
import { getPublicUploadUrl } from '../../../utils/storageUrls';

type UpdateAlertStatus = 'overdue' | 'pending' | 'complete';

export interface UpdateAlertReportRow {
    unitId: string;
    unitName: string;
    responsibleSector: string | null;
    responsibleUpdater: string;
    dueAt: Date;
    lastUpdateAt: string | null;
    status: UpdateAlertStatus;
}

interface UpdateAlertsReportProps {
    alerts: UpdateAlertReportRow[];
    counts: Record<UpdateAlertStatus, number>;
    filterLabel: string | null;
}

const STATUS_LABEL: Record<UpdateAlertStatus, string> = {
    overdue: 'Atrasado',
    pending: 'Aguardando',
    complete: 'Atualizado',
};

const STATUS_CLASS: Record<UpdateAlertStatus, string> = {
    overdue: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-slate-50 text-slate-600 border-slate-200',
    complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const formatDateTime = (value: Date | string | null) => {
    if (!value) return 'Sem atualização';
    const date = new Date(value);
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function UpdateAlertsReport({ alerts, counts, filterLabel }: UpdateAlertsReportProps) {
    const { settings } = useSettings();
    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;
    const generatedAt = useMemo(() => new Date(), [alerts]);
    const total = counts.overdue + counts.pending + counts.complete;

    return (
        <div className="bg-white text-black font-sans p-0 m-0 w-full max-w-none">
            <div className="flex justify-between items-center border-b-[3px] border-slate-900 pb-4 mb-6">
                <div className="flex items-center gap-4">
                    {logoUrl && (
                        <img src={logoUrl} alt="Logo" className="w-[60px] h-[60px] object-contain border border-slate-100 rounded-lg p-1" />
                    )}
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase leading-none mb-1">Polícia Militar da Bahia</span>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Controle de Atualização dos Tópicos</h1>
                        <p className="text-[9px] font-semibold text-slate-400 mt-1 italic">
                            Situação do ciclo semanal de atualização do Briefing Geral
                            {filterLabel ? ` · Filtro: ${filterLabel}` : ''}
                        </p>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end">
                    <span className="text-sm font-black text-slate-900">{generatedAt.toLocaleDateString('pt-BR')}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{generatedAt.toLocaleTimeString('pt-BR')}</span>
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                {[
                    { label: 'Tópicos monitorados', value: total, color: 'text-slate-900' },
                    { label: 'Atrasado', value: counts.overdue, color: 'text-red-700' },
                    { label: 'Aguardando', value: counts.pending, color: 'text-slate-600' },
                    { label: 'Atualizado', value: counts.complete, color: 'text-emerald-700' },
                ].map(stat => (
                    <div key={stat.label} className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                        <span className={`text-lg font-black ${stat.color}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse bg-white table-fixed">
                    <thead>
                        <tr className="bg-slate-900 text-white">
                            <th className="w-[34%] px-3 py-2 text-[8px] font-black uppercase tracking-widest border-r border-white/10">Tópico / Responsável</th>
                            <th className="w-[14%] px-3 py-2 text-[8px] font-black uppercase tracking-widest border-r border-white/10">Setor</th>
                            <th className="w-[18%] px-3 py-2 text-[8px] font-black uppercase tracking-widest border-r border-white/10">Prazo</th>
                            <th className="w-[20%] px-3 py-2 text-[8px] font-black uppercase tracking-widest border-r border-white/10">Última atualização</th>
                            <th className="w-[14%] px-2 py-2 text-[8px] font-black uppercase tracking-widest text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {alerts.map(alert => (
                            <tr key={alert.unitId} className="update-alert-row">
                                <td className="px-3 py-2 border-r border-slate-100">
                                    <span className="block text-[10px] font-black text-slate-900 uppercase leading-tight">{alert.unitName}</span>
                                    <span className="block text-[8px] font-bold text-slate-500 uppercase mt-0.5">{alert.responsibleUpdater}</span>
                                </td>
                                <td className="px-3 py-2 text-[9px] font-bold text-slate-600 uppercase border-r border-slate-100">
                                    {alert.responsibleSector || 'Não definido'}
                                </td>
                                <td className="px-3 py-2 text-[9px] font-bold text-slate-700 border-r border-slate-100">
                                    {formatDateTime(alert.dueAt)}
                                </td>
                                <td className="px-3 py-2 text-[9px] font-bold text-slate-700 border-r border-slate-100">
                                    {formatDateTime(alert.lastUpdateAt)}
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-[4px] border text-[7px] font-black uppercase tracking-widest ${STATUS_CLASS[alert.status]}`}>
                                        {STATUS_LABEL[alert.status]}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mt-4 text-[8px] font-bold text-slate-500 leading-relaxed">
                Regra do ciclo: o tópico fica Aguardando a partir de segunda-feira 00:00, Atrasado se não for atualizado até o prazo,
                e Atualizado assim que houver atualização no ciclo, mesmo após o prazo.
            </p>

            <div className="mt-8 pt-4 border-t border-slate-100 opacity-50">
                <span className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em]">
                    Briefing CG PMBA · Documento gerado em {generatedAt.toLocaleDateString('pt-BR')} às {generatedAt.toLocaleTimeString('pt-BR')}
                </span>
            </div>

            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 15mm; }
                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    thead { display: table-header-group; }
                    .update-alert-row { break-inside: avoid; page-break-inside: avoid; }
                }

                * {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                }
            `}</style>
        </div>
    );
}
