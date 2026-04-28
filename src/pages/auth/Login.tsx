import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Shield, Lock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPublicUploadUrl } from '../../utils/storageUrls';
import { useSettings } from '../../store/SettingsContext';

export default function Login() {
    const { login, logout, isAuthenticated, sessionLoading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { settings } = useSettings();

    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;
    const bgUrl = settings?.bg_path ? getPublicUploadUrl(settings.bg_path) : null;
    const bgSize = settings?.bg_size || 'cover';
    const bgPosition = settings?.bg_position || 'center';

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        } else if (!sessionLoading && isLoading) {
            // SignIn JWT ok, mas `fetchUserProfile` deu pau na tabela 'profiles' (RLS ou Row Missing)
            setIsLoading(false);
            setError('Credenciais corretas, mas o Perfil Oficial não foi localizado ou foi Desativado. Contate o TI.');
            logout(); // Força a remoção do token que ficou preso no limbo localstorage
        }
    }, [isAuthenticated, sessionLoading, navigate, isLoading, logout]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(email, password);
            // Aguardamos o useEffect de isAuthenticated disparar o redirecionamento 
            // após o Supabase carregar o Perfil de fato em backgorund.
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar login');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-pm-dark flex items-center justify-center p-4 relative overflow-hidden">
            <div
                className="absolute inset-0 opacity-40 transition-all duration-1000"
                style={{
                    backgroundImage: bgUrl ? `url(${bgUrl})` : `url('https://images.unsplash.com/photo-1585954930327-0466ba0e44ac?q=80&w=2670&auto=format&fit=crop')`,
                    backgroundSize: bgSize === 'repeat' || bgSize === 'repeat-x' || bgSize === 'repeat-y' ? 'auto' : bgSize,
                    backgroundRepeat: bgSize.includes('repeat') ? bgSize : 'no-repeat',
                    backgroundPosition: bgPosition
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-pm-dark via-pm-dark/80 to-transparent"></div>

            <div className="glass-panel w-full max-w-md p-8 relative z-10 border-pm-primary/30 shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-pm-light rounded-full flex items-center justify-center mb-4 shadow-lg border-2 border-pm-primary/50 overflow-hidden">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo PMBA" className="w-full h-full object-contain p-2" />
                        ) : (
                            <Shield className="w-10 h-10 text-pm-primary" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-pm-dark text-center">Polícia Militar da Bahia</h1>
                    <p className="text-pm-secondary text-sm text-center font-medium mt-1">Gestão Estratégica de Informações</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-100/10 border border-red-500/50 rounded-lg text-red-500 text-sm font-medium text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">E-mail Corporativo</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@pm.ba.gov.br"
                            className="w-full bg-white border border-pm-secondary/30 rounded-lg px-4 py-3 text-pm-dark focus:outline-none focus:ring-2 focus:ring-pm-primary transition-all mb-4"
                        />

                        <label className="block text-sm font-medium text-pm-dark mb-1">Senha de Acesso</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-white border border-pm-secondary/30 rounded-lg px-4 py-3 text-pm-dark focus:outline-none focus:ring-2 focus:ring-pm-primary transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-pm-primary hover:bg-pm-primary/90 text-pm-light font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 shadow-md disabled:opacity-70 disabled:hover:scale-100"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                        {isLoading ? 'Autenticando...' : 'Entrar no Sistema'}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-pm-secondary/80">
                    <p style={{ color: '#0A0600' }}>Acesso a Policiais Militares autorizados pelo DCS</p>
                </div>
            </div>
        </div>
    );
}
