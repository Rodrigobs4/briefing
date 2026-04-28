import { useAuth } from '../../store/AuthContext';
import AdminDynamicForms from './AdminDynamicForms';
import DynamicEditorPanel from './DynamicEditorPanel';

export default function AdminPanel() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-pm-dark mb-1">
                        {user?.role === 'admin' ? 'Construtor de Formulários e Módulos' : 'Painel de Entrada de Dados'}
                    </h2>
                    <p className="text-sm text-pm-secondary">
                        Bem-vindo(a), <span className="font-semibold text-pm-primary">{user?.name}</span>. Você está operando como <span className="font-semibold">{user?.role === 'admin' ? 'Administrador Geral' : `Oficial Designado (Editor)`}</span>.
                    </p>
                </div>
            </div>

            {/* Condicional de Renderização Baseada em Regras de Acesso */}
            {user?.role === 'admin' ? (
                <AdminDynamicForms />
            ) : (
                <DynamicEditorPanel />
            )}
        </div>
    );
}
