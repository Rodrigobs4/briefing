import { useMemo } from 'react';
import { useSettings } from '../../store/SettingsContext';
import { getPublicUploadUrl } from '../../utils/storageUrls';

interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: string;
    unit_ids: string[];
    unit_names: string[];
    unit_name: string;
    is_active: boolean;
    created_at: string;
}

interface UserReportProps {
    users: AdminUser[];
}

export default function UserReport({ users }: UserReportProps) {
    const { settings } = useSettings();
    const date = useMemo(() => new Date().toLocaleDateString('pt-BR'), []);
    const time = useMemo(() => new Date().toLocaleTimeString('pt-BR'), []);
    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;

    return (
        <div className="bg-white text-black font-sans p-0 m-0 w-full max-w-none print:max-w-none">
            {/* Header Institucional Compacto */}
            <div className="flex justify-between items-center border-b-[3px] border-slate-900 pb-4 mb-6">
                <div className="flex items-center gap-4">
                    {logoUrl && (
                        <img src={logoUrl} alt="Logo" className="w-[60px] h-[60px] object-contain border border-slate-100 rounded-lg p-1" />
                    )}
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase leading-none mb-1">Polícia Militar da Bahia</span>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Gestão Estratégica - Cadastro de Usuários</h1>
                        <p className="text-[9px] font-semibold text-slate-400 mt-1 italic">Controle de Acessos e Permissões Administrativas</p>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end">
                    <span className="text-sm font-black text-slate-900">{date}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{time}</span>
                </div>
            </div>

            {/* Resumo Consolidado (Linha Única) */}
            <div className="flex gap-4 mb-6">
                {[
                    { label: 'Total de Contas', value: users.length },
                    { label: 'Contas Ativas', value: users.filter(u => u.is_active).length, color: 'text-green-700' },
                    { label: 'Editores Operacionais', value: users.filter(u => u.role === 'editor').length }
                ].map((stat, i) => (
                    <div key={i} className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl flex items-center justify-between shadow-sm">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                        <span className={`text-lg font-black ${stat.color || 'text-slate-900'}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Tabela Principal Otimizada para A4 */}
            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                <table className="w-full text-left border-collapse bg-white table-fixed">
                    <thead>
                        <tr className="bg-slate-900 text-white">
                            <th className="w-[28%] px-3 py-2 text-[8px] font-black uppercase tracking-widest border-r border-white/10">NOME DO POLICIAL / CONTA</th>
                            <th className="w-[25%] px-3 py-2 text-[8px] font-black uppercase tracking-widest border-r border-white/10">EMAIL CORPORATIVO</th>
                            <th className="w-[37%] px-3 py-2 text-[8px] font-black uppercase tracking-widest border-r border-white/10">TÓPICOS ATRELADOS</th>
                            <th className="w-[10%] px-2 py-2 text-[8px] font-black uppercase tracking-widest last:border-0 text-center">PERFIL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map((u, i) => (
                            <tr key={i} className={`hover:bg-slate-50 transition-colors ${!u.is_active ? 'bg-slate-50 grayscale opacity-60' : ''}`}>
                                <td className="px-3 py-2 text-[10px] font-bold text-slate-800 border-r border-slate-100 uppercase truncate">
                                    {u.full_name}
                                    {!u.is_active && <span className="block text-[7px] text-red-500 italic">[INATIVO]</span>}
                                </td>
                                <td className="px-3 py-2 text-[9px] font-bold text-slate-600 border-r border-slate-100 truncate">
                                    {u.email}
                                </td>
                                <td className="px-3 py-2 text-[9px] font-medium text-slate-700 border-r border-slate-100 leading-tight italic">
                                    {u.unit_names && u.unit_names.length > 0 
                                        ? u.unit_names.join(', ') 
                                        : (u.role === 'admin' ? 'ACESSO TOTAL (ADMIN)' : 'NENHUM VÍNCULO')}
                                </td>
                                <td className="px-1 py-2 text-center last:border-0">
                                    <span className={`px-2 py-0.5 rounded-[4px] text-[7px] font-black uppercase tracking-widest border ${
                                        u.role === 'admin' ? 'bg-slate-900 text-white border-slate-900' :
                                        u.role === 'editor' ? 'bg-white text-slate-900 border-slate-300' :
                                        'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}>
                                        {u.role === 'admin' ? 'Admin' : u.role === 'editor' ? 'Editor' : 'Cmd'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Rodapé Slim */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-end opacity-50">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em]">Briefing CG PMBA - Gerado via Sistema Dashboard v1.2</span>
                    <span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">Documento gerado em {date} às {time}</span>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 15mm; 
                    }
                    body { 
                        background: white !important;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                    .shadow-sm { box-shadow: none !important; }
                    .border-slate-200 { border-color: #e2e8f0 !important; }
                }

                * {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                }
            `}</style>
        </div>
    );
}
