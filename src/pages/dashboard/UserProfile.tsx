import { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Shield, Lock, Mail, Save, User as UserIcon, Loader2, AlertCircle, Building2, Briefcase } from 'lucide-react';
import { sortByTextPtBr } from '../../utils/textOrdering';

export default function UserProfile() {
    const { user, updateUserPassword, updateUserEmail, units } = useAuth();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const [newEmail, setNewEmail] = useState(user?.email || '');
    const [emailError, setEmailError] = useState('');
    const [emailSuccess, setEmailSuccess] = useState('');
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

    useEffect(() => {
        if (user) {
            setNewEmail(user.email);
        }
    }, [user]);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword.length < 6) {
            setPasswordError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('As senhas não coincidem.');
            return;
        }

        try {
            setIsUpdatingPassword(true);
            await updateUserPassword(newPassword);
            setPasswordSuccess('Senha alterada com sucesso!');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setPasswordError(error.message || 'Erro ao alterar a senha.');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError('');
        setEmailSuccess('');

        if (!newEmail || !newEmail.includes('@')) {
            setEmailError('Insira um endereço de e-mail válido.');
            return;
        }

        if (newEmail === user?.email) {
            setEmailError('O e-mail informado já é o atual.');
            return;
        }

        try {
            setIsUpdatingEmail(true);
            const data = await updateUserEmail(newEmail);

            // O Supabase retorna 'new_email' pendente se a flag "Secure email change" estiver ATIVADA.
            if (data?.user?.new_email) {
                setEmailSuccess('Solicitação registrada com sucesso! Para sua segurança, um e-mail de confirmação foi enviado ao endereço informado. A alteração só terá efeito contínuo no sistema após você clicar no link recebido. Por favor, lembre-se de conferir também as caixas de Spam, Lixo Eletrônico ou Promoções caso não o encontre.');
            } else {
                setEmailSuccess('E-mail alterado com sucesso! A mudança já está valendo na sua sessão.');
            }
        } catch (error: any) {
            setEmailError(error.message || 'Erro ao alterar o e-mail. Verifique a conexão.');
        } finally {
            setIsUpdatingEmail(false);
        }
    };

    const getRoleName = (role?: string) => {
        switch (role) {
            case 'admin': return 'Administrador';
            case 'editor': return 'Oficial Editor';
            case 'commander': return 'Comandante Geral';
            default: return 'Usuário Convidado';
        }
    };

    // Obter dados vinculados para exibição
    const userUnitIds = (user?.unitIds && user.unitIds.length > 0) ? user.unitIds : (user?.unitId ? [user.unitId] : []);
    const userUnits = sortByTextPtBr(units.filter(u => userUnitIds.includes(u.id)), unit => unit.name);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-pm-primary/10 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-pm-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-pm-dark">Meu Perfil</h1>
                    <p className="text-sm text-pm-secondary">Gerencie seus dados de acesso ao sistema</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna 1: Informações de Somente Leitura */}
                <div className="space-y-6 lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-pm-primary/10 p-6">
                        <h2 className="text-lg font-bold text-pm-dark mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-pm-primary" />
                            Dados Institucionais
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-pm-secondary uppercase tracking-wider mb-1 block">Nome Completo</label>
                                <div className="text-pm-dark font-medium bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    {user?.name || 'Não informado'}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-pm-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Briefcase className="w-3.5 h-3.5" />
                                    Perfil de Acesso
                                </label>
                                <div className="text-pm-dark font-medium bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-pm-primary"></span>
                                    {getRoleName(user?.role)}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-pm-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5" />
                                    Tópico/Unidade Vinculada
                                </label>
                                <div className="text-pm-dark font-medium bg-gray-50 p-2.5 rounded-lg border border-gray-100 space-y-2">
                                    {userUnits.length > 0 ? (
                                        userUnits.map(unit => (
                                            <div key={unit.id}>
                                                <p className="font-semibold">{unit.name}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-pm-secondary italic">Sistema Global (Sem Unidade Vinculada)</span>
                                    )}
                                    {userUnits.length > 1 && (
                                        <p className="text-[10px] text-pm-secondary pt-2 border-t border-gray-200 mt-2">
                                            Você tem acesso a múltiplos tópicos. Use o seletor no painel de preenchimento.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-gray-100 text-xs text-pm-secondary">
                            <AlertCircle className="w-4 h-4 inline-block mr-1 text-yellow-500" />
                            A alteração de Unidade, Cargo ou Nome é feita apenas por Administradores.
                        </div>
                    </div>
                </div>

                {/* Coluna 2 e 3: Formulários */}
                <div className="space-y-6 lg:col-span-2">

                    {/* Alteraçao de E-mail */}
                    <div className="bg-white rounded-2xl shadow-sm border border-pm-primary/10 p-6">
                        <h2 className="text-lg font-bold text-pm-dark mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-pm-primary" />
                            Gerenciar E-mail
                        </h2>

                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-pm-dark mb-1">
                                    Endereço de E-mail
                                </label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pm-primary/20 focus:border-pm-primary outline-none transition-all"
                                    disabled={isUpdatingEmail}
                                />
                                <p className="text-xs text-pm-secondary mt-1 ml-1">Usado para comunicação e recuperação de senha.</p>
                            </div>

                            {emailError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                                    {emailError}
                                </div>
                            )}

                            {emailSuccess && (
                                <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100 font-medium">
                                    {emailSuccess}
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isUpdatingEmail || newEmail === user?.email}
                                    className="px-6 py-2.5 bg-pm-dark text-white rounded-xl hover:bg-pm-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                                >
                                    {isUpdatingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar E-mail
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Alteraçao de Senha */}
                    <div className="bg-white rounded-2xl shadow-sm border border-pm-primary/10 p-6">
                        <h2 className="text-lg font-bold text-pm-dark mb-4 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-pm-primary" />
                            Alterar Senha
                        </h2>

                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-pm-dark mb-1">
                                        Nova Senha
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pm-primary/20 focus:border-pm-primary outline-none transition-all"
                                        disabled={isUpdatingPassword}
                                        placeholder="Min. 6 caracteres"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-pm-dark mb-1">
                                        Confirme a Nova Senha
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pm-primary/20 focus:border-pm-primary outline-none transition-all"
                                        disabled={isUpdatingPassword}
                                        placeholder="Repita a nova senha"
                                    />
                                </div>
                            </div>

                            {passwordError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                                    {passwordError}
                                </div>
                            )}

                            {passwordSuccess && (
                                <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100 font-medium">
                                    {passwordSuccess}
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                                    className="px-6 py-2.5 bg-pm-primary text-pm-dark rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                                >
                                    {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Redefinir Senha
                                </button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
}
