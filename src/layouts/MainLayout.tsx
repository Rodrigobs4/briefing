import { useState } from 'react';
import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import { getPublicUploadUrl } from '../utils/storageUrls';
import { useAuth } from '../store/AuthContext';
import { useSettings } from '../store/SettingsContext';
import { Shield, LogOut, Menu, BarChart3, Users, FileText, Settings, User, Loader2, HelpCircle } from 'lucide-react';
import GuidedTour from '../components/GuidedTour';

export default function MainLayout() {
    const { user, logout, isAuthenticated, sessionLoading } = useAuth();
    const location = useLocation();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [isTourOpen, setIsTourOpen] = useState(false);
    const { settings } = useSettings();

    const systemName = settings?.name || 'Gestão Estratégica PMBA';
    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;

    if (sessionLoading) {
        return (
            <div className="min-h-screen bg-pm-dark flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-pm-primary animate-spin mb-4" />
                <p className="text-pm-light font-medium animate-pulse tracking-wide">Validando credenciais...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const navItems = [
        { path: '/dashboard', label: 'Painel Estratégico', icon: BarChart3, show: true },
        { path: '/admin', label: 'Entrada de Dados', icon: FileText, show: user?.role === 'admin' || user?.role === 'editor' },
        { path: '/admin/users', label: 'Usuários', icon: Users, show: user?.role === 'admin' },
        { path: '/admin/settings', label: 'Configurações', icon: Settings, show: user?.role === 'admin' }
    ].filter(item => item.show);

    return (
        <div className="flex bg-pm-light min-h-screen font-sans overflow-hidden">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`flex flex-col w-72 bg-pm-dark text-pm-light h-screen fixed md:sticky top-0 left-0 border-r border-white/5 shadow-2xl z-50 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-8 flex flex-col items-center justify-center border-b border-white/5 bg-pm-dark-muted/50">
                    <div className="flex flex-col items-center justify-center w-full group">
                        {logoUrl ? (
                            <div className="relative mb-4">
                                <div className="absolute inset-0 bg-pm-primary/20 blur-xl rounded-full group-hover:bg-pm-primary/30 transition-colors"></div>
                                <img src={logoUrl} alt="Logo" className="relative w-16 h-16 object-contain bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/10 shadow-lg group-hover:scale-105 transition-transform" />
                            </div>
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-pm-primary/20 flex items-center justify-center mb-4 border border-pm-primary/30 shadow-lg group-hover:scale-105 transition-transform">
                                <Shield className="w-8 h-8 text-pm-primary" />
                            </div>
                        )}
                        <h2 className="text-sm font-black tracking-[0.05em] text-pm-primary text-center px-2 leading-tight w-full uppercase">
                            {systemName}
                        </h2>
                    </div>
                </div>

                <nav className="flex-1 px-6 py-6 space-y-1.5 relative overflow-y-auto w-full custom-scrollbar">
                    <p className="text-[10px] font-black text-pm-secondary/50 uppercase tracking-[0.2em] mb-4 ml-4">Menu Principal</p>
                    {navItems.map((item) => {
                        const idMap: Record<string, string> = {
                            '/dashboard': 'nav-dashboard',
                            '/admin': 'nav-admin',
                            '/admin/users': 'nav-users',
                            '/admin/settings': 'nav-settings'
                        };
                        return (
                            <Link key={item.path} to={item.path}
                                id={idMap[item.path]}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm group
                ${location.pathname === item.path
                                        ? 'bg-pm-primary text-pm-dark shadow-lg shadow-pm-primary/10 border border-pm-primary/20'
                                        : 'text-pm-secondary hover:bg-white/5 hover:text-white border border-transparent'}`}>
                                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${location.pathname === item.path ? 'text-pm-dark' : 'text-pm-secondary/60 group-hover:text-pm-primary'}`} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-white/5 bg-pm-dark-muted/30">
                    <button
                        onClick={logout}
                        className="flex items-center gap-3.5 px-4 py-3.5 w-full text-pm-secondary hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all text-sm font-bold group"
                    >
                        <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                        <span>Sair do Sistema</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
                <header className="bg-white/90 backdrop-blur-xl h-24 border-b border-pm-secondary/15 flex items-center justify-between px-6 sm:px-8 lg:px-12 sticky top-0 z-30 shadow-premium flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            className="md:hidden text-pm-dark hover:bg-pm-light p-2.5 rounded-xl transition-colors border border-pm-secondary/10"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-xl sm:text-2xl font-black text-pm-dark tracking-tight truncate max-w-[200px] sm:max-w-[400px] lg:max-w-none">
                                {navItems.find(item => item.path === location.pathname)?.label || 'Painel'}
                            </h1>
                            <p className="text-[10px] font-bold text-pm-secondary/60 uppercase tracking-widest hidden sm:block">
                                Gestão Estratégica & Governança
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-bold text-pm-dark">{user?.name}</span>
                            <span className="text-[10px] font-black text-pm-primary bg-pm-primary/10 px-2.5 py-1 rounded-full mt-1 border border-pm-primary/20 uppercase tracking-tighter">
                                {user?.role === 'admin' ? 'Administrador' : user?.role === 'editor' ? 'Oficial Editor' : 'Comandante Geral'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mr-2 sm:mr-4">
                            <button 
                                onClick={() => setIsTourOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-pm-light text-pm-dark hover:bg-white border border-pm-secondary/20 rounded-xl text-xs font-bold transition-all hover:shadow-sm"
                            >
                                <HelpCircle className="w-4 h-4 text-pm-primary" />
                                <span className="hidden sm:inline">Tutorial</span>
                            </button>
                        </div>

                        <div className="relative">
                            <button
                                id="profile-trigger"
                                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                onBlur={() => setTimeout(() => setIsProfileDropdownOpen(false), 200)}
                                className="w-12 h-12 rounded-2xl bg-white text-pm-primary flex items-center justify-center border-2 border-pm-primary shadow-premium hover:shadow-premium-lg transition-all cursor-pointer active:scale-95"
                            >
                                <User className="w-6 h-6" />
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-opacity">
                                    <div className="px-4 py-2 border-b border-gray-100 mb-1">
                                        <p className="text-sm font-semibold text-pm-dark truncate">{user?.name}</p>
                                        <p className="text-xs text-pm-secondary truncate">{user?.email}</p>
                                    </div>
                                    <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-pm-dark hover:bg-pm-secondary/10 transition-colors">
                                        <User className="w-4 h-4" /> Meu Perfil
                                    </Link>
                                    <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left mt-1 border-t border-gray-100 pt-2">
                                        <LogOut className="w-4 h-4" /> Sair do Sistema
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-6 sm:p-8 lg:p-12 xl:p-16 mx-auto w-full max-w-screen-2xl">
                    <Outlet />
                </div>
                
                <GuidedTour isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
            </main>
        </div>
    );
}
