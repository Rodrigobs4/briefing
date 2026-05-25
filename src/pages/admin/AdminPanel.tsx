import { useSearchParams } from 'react-router-dom';
import { ClipboardList, MapPinned } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import AdminDynamicForms from './AdminDynamicForms';
import DynamicEditorPanel from './DynamicEditorPanel';
import RegionalAdminDynamicForms from './RegionalAdminDynamicForms';
import RegionalBriefing from '../regional/RegionalBriefing';

type AdminBriefingView = 'general' | 'regional';

export default function AdminPanel() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeView: AdminBriefingView = searchParams.get('view') === 'regional' ? 'regional' : 'general';

    const setActiveView = (view: AdminBriefingView) => {
        setSearchParams(view === 'regional' ? { view: 'regional' } : {});
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-pm-dark mb-1">
                        {user?.role === 'admin' ? 'Estrutura e Alimentação dos Briefings' : 'Entrada de Dados dos Briefings'}
                    </h2>
                    <p className="text-sm text-pm-secondary">
                        Bem-vindo(a), <span className="font-semibold text-pm-primary">{user?.name}</span>. Escolha abaixo se deseja trabalhar no briefing geral ou regional.
                    </p>
                </div>
                <div className="bg-pm-light border border-pm-secondary/15 rounded-2xl p-1.5 flex shrink-0">
                    <button
                        onClick={() => setActiveView('general')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-colors ${activeView === 'general' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        Geral
                    </button>
                    <button
                        onClick={() => setActiveView('regional')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-colors ${activeView === 'regional' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                    >
                        <MapPinned className="w-4 h-4" />
                        Regional
                    </button>
                </div>
            </div>

            {activeView === 'regional' && user?.role === 'admin' ? (
                <RegionalAdminDynamicForms />
            ) : activeView === 'regional' ? (
                <RegionalBriefing mode="editor" />
            ) : user?.role === 'admin' ? (
                <AdminDynamicForms />
            ) : (
                <DynamicEditorPanel />
            )}
        </div>
    );
}
