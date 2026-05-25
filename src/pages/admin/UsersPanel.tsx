import React, { useState, useEffect } from 'react';
import { useAuth, Role } from '../../store/AuthContext';
import { Plus, Search, Shield, User, X, Loader2, Edit2, Key, Power, PowerOff, Trash2, AlertTriangle, CheckCircle2, Check, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import UserReport from './UserReport';
import { compareTextPtBr, sortByTextPtBr } from '../../utils/textOrdering';

// Tipo Extendido exclusivo para visualização via API
interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    unit_ids: string[];
    unit_names: string[];
    unit_name: string; // campo legado para busca por texto
    is_active: boolean;
    created_at: string;
}

export default function UsersPanel() {
    const { user, units } = useAuth();
    const [usersList, setUsersList] = useState<AdminUser[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Status Flow
    const [searchTerm, setSearchTerm] = useState('');
    const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Modals Visibility
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Selected Users
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    // Form States
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState<Role>('editor');
    const [formUnitIds, setFormUnitIds] = useState<string[]>([]);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Print logic
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Relatórios de Usuários - PMBA - ${new Date().toISOString().split('T')[0]}`
    });

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchAdminUsers();
        }
    }, [user]);

    const showToast = (type: 'success' | 'error', text: string) => {
        setToastMsg({ type, text });
        setTimeout(() => setToastMsg(null), 4000);
    };

    if (user?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <Shield className="w-16 h-16 text-pm-secondary/50 mb-4" />
                <h2 className="text-xl font-bold text-pm-dark">Acesso Restrito</h2>
                <p className="text-pm-secondary mt-2">Apenas Administradores do sistema possuem acesso à Gestão de Usuários.</p>
            </div>
        );
    }

    const fetchAdminUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-list-users');
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            setUsersList(sortByTextPtBr(data.users || [], listedUser => listedUser.full_name || listedUser.email));
        } catch (err: any) {
            showToast('error', `Erro ao carregar lista de usuários: ${err.message}`);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-user', {
                body: {
                    name: formName,
                    email: formEmail,
                    password: formPassword,
                    role: formRole,
                    unitIds: formRole === 'editor' ? formUnitIds : []
                }
            });
            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            showToast('success', 'Usuário criado com sucesso!');
            setIsCreateOpen(false);
            fetchAdminUsers();
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        setIsProcessing(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-update-user', {
                body: {
                    userId: selectedUser.id,
                    fullName: formName,
                    role: formRole,
                    unitIds: formRole === 'editor' ? formUnitIds : []
                }
            });
            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            showToast('success', 'Usuário atualizado com sucesso.');
            setIsEditOpen(false);
            fetchAdminUsers();
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser || !formPassword) return;
        setIsProcessing(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-reset-password', {
                body: { userId: selectedUser.id, newPassword: formPassword }
            });
            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            showToast('success', 'Senha redefinida com sucesso.');
            setIsResetOpen(false);
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleStatus = async (targetUser: AdminUser) => {
        const newStatus = !targetUser.is_active;
        try {
            const { data, error } = await supabase.functions.invoke('admin-set-user-status', {
                body: { userId: targetUser.id, isActive: newStatus }
            });
            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            showToast('success', `Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso.`);
            fetchAdminUsers();
        } catch (err: any) {
            showToast('error', err.message);
        }
    };

    const handleDeleteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser || deleteConfirm !== 'EXCLUIR') return;
        setIsProcessing(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-delete-user', {
                body: { userId: selectedUser.id }
            });
            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            showToast('success', 'Usuário excluído permanentemente do Auth.');
            setIsDeleteOpen(false);
            fetchAdminUsers();
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleUnitId = (id: string) => {
        setFormUnitIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const openEdit = (u: AdminUser) => {
        setSelectedUser(u);
        setFormName(u.full_name);
        setFormRole(u.role);
        setFormUnitIds(u.unit_ids || []);
        setIsEditOpen(true);
    };

    const openReset = (u: AdminUser) => {
        setSelectedUser(u);
        setFormPassword('');
        setIsResetOpen(true);
    };

    const openDelete = (u: AdminUser) => {
        setSelectedUser(u);
        setDeleteConfirm('');
        setIsDeleteOpen(true);
    };

    const filteredUsers = usersList
        .filter(u =>
            u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.unit_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => compareTextPtBr(a.full_name || a.email, b.full_name || b.email));

    // Componente interno: seletor de tópicos com checkboxes
    const TopicsSelector = () => (
        <div>
            <label className="block text-xs font-bold mb-2 text-pm-primary">Tópicos Atrelados</label>
            <div className="border border-pm-primary/40 rounded-lg max-h-44 overflow-y-auto divide-y divide-pm-secondary/10">
                {units.length === 0 && (
                    <p className="text-xs text-pm-secondary p-3">Nenhum tópico cadastrado.</p>
                )}
                {sortByTextPtBr(units, unit => unit.name).map(u => {
                    const isChecked = formUnitIds.includes(u.id);
                    return (
                        <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleUnitId(u.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors
                                ${isChecked ? 'bg-pm-primary/8 text-pm-primary' : 'hover:bg-pm-light/60 text-pm-dark'}`}
                        >
                            <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors
                                ${isChecked ? 'bg-pm-primary border-pm-primary' : 'border-pm-secondary/40 bg-white'}`}>
                                {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </span>
                            <span className="truncate font-medium">{u.name}</span>
                        </button>
                    );
                })}
            </div>
            {formUnitIds.length > 0 && (
                <p className="text-xs text-pm-primary mt-1.5 font-medium">
                    {formUnitIds.length} tópico{formUnitIds.length > 1 ? 's' : ''} selecionado{formUnitIds.length > 1 ? 's' : ''}
                </p>
            )}
        </div>
    );

    return (
        <div className="space-y-6 relative">
            {toastMsg && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-in slide-in-from-top fade-in 
                    ${toastMsg.type === 'success' ? 'bg-pm-dark/95 text-green-400 border border-green-500/30' : 'bg-red-500 text-white'}`}>
                    {toastMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-medium text-sm">{toastMsg.text}</span>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-pm-dark mb-1">Gestão de Usuários e Permissões</h2>
                    <p className="text-sm text-pm-secondary">Painel CRUD Integrado via Edge Functions (Segurança Nuvem).</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handlePrint()}
                        disabled={isLoadingUsers || usersList.length === 0}
                        className="bg-pm-light text-pm-dark border border-pm-secondary/30 px-4 py-2 rounded-lg text-sm font-bold hover:bg-white transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        <Printer className="w-4 h-4 text-pm-primary" />
                        Gerar Relatório PDF
                    </button>
                    <button
                        onClick={() => {
                            setFormName(''); setFormEmail(''); setFormPassword(''); setFormRole('editor'); setFormUnitIds([]);
                            setIsCreateOpen(true);
                        }}
                        className="bg-pm-primary text-pm-light px-4 py-2 rounded-lg text-sm font-black hover:bg-pm-primary/90 transition-all flex items-center gap-2 shadow-md whitespace-nowrap active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Usuário
                    </button>
                </div>
            </div>

            {/* Renderer Invisível do PDF */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <UserReport users={usersList} />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-pm-secondary/20 overflow-hidden">
                <div className="p-4 border-b border-pm-secondary/10 flex items-center justify-between gap-4 bg-pm-light/30">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pm-secondary" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou tópico..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-pm-secondary/30 rounded-lg focus:ring-2 focus:ring-pm-primary outline-none"
                        />
                    </div>
                    {isLoadingUsers && <Loader2 className="w-5 h-5 text-pm-primary animate-spin" />}
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-pm-light text-pm-secondary">
                            <tr>
                                <th className="px-6 py-4 font-medium">Conta de Acesso</th>
                                <th className="px-6 py-4 font-medium">Tópico(s) Atrelado(s)</th>
                                <th className="px-6 py-4 font-medium">Acesso</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-pm-secondary/10">
                            {filteredUsers.map((u) => (
                                <tr key={u.id} className={`hover:bg-pm-light/50 transition-colors ${!u.is_active ? 'opacity-60 bg-gray-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-pm-secondary/10 flex items-center justify-center text-pm-secondary">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-pm-dark">{u.full_name}</p>
                                                <p className="text-xs text-pm-secondary">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {u.unit_names && u.unit_names.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {[...u.unit_names].sort(compareTextPtBr).map((name, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-pm-primary/10 text-pm-primary border border-pm-primary/20 rounded-full text-[10px] font-semibold">
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-pm-secondary/60 text-xs italic">Sem Tópico</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-pm-dark text-pm-light' :
                                            u.role === 'editor' ? 'bg-pm-primary/10 text-pm-primary border border-pm-primary/20' :
                                                'bg-blue-100 text-blue-800 border border-blue-200'
                                            }`}>
                                            {u.role === 'admin' ? 'Administrador' : u.role === 'editor' ? 'Editor' : 'Comandante'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleStatus(u)}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold ${u.is_active ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}
                                        >
                                            {u.is_active ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                                            {u.is_active ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEdit(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar Usuário">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => openReset(u)} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded" title="Resetar Senha">
                                                <Key className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => openDelete(u)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Excluir Permanentemente">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!isLoadingUsers && filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-pm-secondary">
                                        Nenhum usuário encontrado no sistema.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: CRIAR */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-pm-dark/60 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-pm-secondary/20 flex justify-between items-center">
                            <h3 className="font-bold text-pm-dark">Novo Usuário</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-pm-secondary hover:text-red-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[80vh]">
                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div><label className="block text-xs font-medium mb-1">Nome Completo</label><input required value={formName} onChange={e => setFormName(e.target.value)} className="w-full border p-2 text-sm rounded-md" /></div>
                                <div><label className="block text-xs font-medium mb-1">E-mail</label><input required type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full border p-2 text-sm rounded-md" /></div>
                                <div><label className="block text-xs font-medium mb-1">Senha (Mín 6 desc)</label><input required type="text" minLength={6} value={formPassword} onChange={e => setFormPassword(e.target.value)} className="w-full border p-2 text-sm rounded-md" /></div>
                                <div><label className="block text-xs font-medium mb-1">Perfil de Acesso</label>
                                    <select value={formRole} onChange={(e) => { setFormRole(e.target.value as Role); setFormUnitIds([]); }} className="w-full border p-2 text-sm rounded-md">
                                        <option value="admin">Administrador</option><option value="commander">Comandante</option><option value="editor">Editor</option>
                                    </select>
                                </div>
                                {formRole === 'editor' && <TopicsSelector />}
                                <div className="pt-4 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-gray-50">Cancelar</button>
                                    <button type="submit" disabled={isProcessing} className="px-3 py-1.5 text-xs font-medium bg-pm-primary text-white rounded flex gap-2">
                                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Conta'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: EDITAR */}
            {isEditOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-pm-dark/60 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-pm-secondary/20 flex justify-between items-center bg-blue-50/50">
                            <h3 className="font-bold text-pm-dark flex items-center gap-2"><Edit2 className="w-4 h-4 text-blue-600" /> Editar Usuário</h3>
                            <button onClick={() => setIsEditOpen(false)} className="text-pm-secondary hover:text-red-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[80vh]">
                            <p className="text-xs text-pm-secondary mb-4">Editando: <strong>{selectedUser.email}</strong></p>
                            <form onSubmit={handleUpdateUser} className="space-y-4">
                                <div><label className="block text-xs font-medium mb-1">Nome Completo</label><input required value={formName} onChange={e => setFormName(e.target.value)} className="w-full border p-2 text-sm rounded-md" /></div>
                                <div><label className="block text-xs font-medium mb-1">Perfil de Acesso</label>
                                    <select value={formRole} onChange={(e) => { setFormRole(e.target.value as Role); setFormUnitIds([]); }} className="w-full border p-2 text-sm rounded-md">
                                        <option value="admin">Administrador</option><option value="commander">Comandante</option><option value="editor">Editor</option>
                                    </select>
                                </div>
                                {formRole === 'editor' && <TopicsSelector />}
                                <div className="pt-4 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsEditOpen(false)} className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-gray-50">Cancelar</button>
                                    <button type="submit" disabled={isProcessing} className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded flex gap-2">
                                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Edição'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: RESET PASSWORD */}
            {isResetOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-pm-dark/60 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-pm-secondary/20 flex justify-between items-center bg-orange-50/50">
                            <h3 className="font-bold text-pm-dark flex items-center gap-2"><Key className="w-4 h-4 text-orange-500" /> Redefinir Senha</h3>
                            <button onClick={() => setIsResetOpen(false)} className="text-pm-secondary hover:text-red-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1">Nova Senha Bruta para: <strong>{selectedUser.email}</strong></label>
                                    <input required minLength={6} type="text" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Nova senha segura..." className="w-full border border-orange-300 p-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                </div>
                                <div className="pt-4 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsResetOpen(false)} className="px-3 py-1.5 text-xs font-medium border rounded hover:bg-gray-50">Cancelar</button>
                                    <button type="submit" disabled={isProcessing} className="px-3 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded">
                                        {isProcessing ? 'Atualizando...' : 'Alterar Senha'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: EXCLUIR */}
            {isDeleteOpen && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-pm-dark/60 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border-2 border-red-500">
                        <div className="p-5 bg-red-50 flex items-start gap-4">
                            <div className="bg-red-100 p-2 text-red-600 rounded-full"><AlertTriangle className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-bold text-red-700 text-lg">Exclusão Permanente</h3>
                                <p className="text-sm text-red-600/80 mt-1">Esta ação remove o usuário <strong>{selectedUser.email}</strong> do sistema e do banco de credenciais Auth. Isso é irreversível e apagará vínculos diretos.</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleDeleteUser} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-red-600 mb-2">Para confirmar, digite EXCLUIR no campo abaixo:</label>
                                    <input required type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" className="w-full border-red-300 p-2 text-sm rounded-md focus:ring-red-500" />
                                </div>
                                <div className="pt-4 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-sm font-medium border rounded hover:bg-gray-50">Cancelar</button>
                                    <button type="submit" disabled={isProcessing || deleteConfirm !== 'EXCLUIR'} className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50">
                                        {isProcessing ? 'Apagando ID...' : 'Destruir Conta'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
