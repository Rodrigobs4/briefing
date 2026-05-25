import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useSettings } from '../../store/SettingsContext';
import {
    Shield, Settings2, Bell, Database, Lock, Upload, Image as ImageIcon,
    Eye, EyeOff, RefreshCw, AlertTriangle, ChevronRight,
    BarChart2, Percent, Hash, Save, Check, X, Calculator,
    Plus, Trash2, Send, Info, AlertCircle, CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getPublicUploadUrl } from '../../utils/storageUrls';
import { STORAGE_BUCKET_UPLOADS } from '../../config/storage';
import { compareTextPtBr, sortByTextPtBr } from '../../utils/textOrdering';

type Tab = 'general' | 'security' | 'notifications' | 'indicators';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'Parâmetros Gerais', icon: Settings2 },
    { id: 'security', label: 'Segurança e Acesso', icon: Lock },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'indicators', label: 'Setup de Indicadores', icon: Database },
];

// ─── Parâmetros Gerais ────────────────────────────────────────────────────────
function TabGeneral() {
    const { settings, updateSettings } = useSettings();

    const [logoPath, setLogoPath] = useState<string | null>(settings?.logo_path || null);
    const [bgPath, setBgPath] = useState<string | null>(settings?.bg_path || null);
    const [bgSize, setBgSize] = useState(settings?.bg_size || 'cover');
    const [bgPosition, setBgPosition] = useState(settings?.bg_position || 'center');

    const [systemName, setSystemName] = useState(settings?.name || 'Gestão Estratégica PMBA');
    const [systemTz, setSystemTz] = useState(settings?.timezone || 'Brasília (BRT) - UTC-3');
    const [systemLang, setSystemLang] = useState(settings?.language || 'Português (Brasil)');

    useEffect(() => {
        if (settings) {
            setLogoPath(settings.logo_path);
            setBgPath(settings.bg_path);
            setBgSize(settings.bg_size);
            setBgPosition(settings.bg_position);
            setSystemName(settings.name);
            setSystemTz(settings.timezone);
            setSystemLang(settings.language);
        }
    }, [settings]);

    const [uploading, setUploading] = useState(false);
    const [uploadingBg, setUploadingBg] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadBgError, setUploadBgError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [uploadBgSuccess, setUploadBgSuccess] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const bgFileRef = useRef<HTMLInputElement>(null);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setUploadError('Apenas imagens são permitidas (PNG, JPG, SVG).');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setUploadError('Arquivo muito grande. Máximo 2MB.');
            return;
        }

        setUploading(true);
        setUploadError('');
        setUploadSuccess(false);

        const ext = file.name.split('.').pop();
        const path = `system/logo.${ext}`;

        const { error } = await supabase.storage.from(STORAGE_BUCKET_UPLOADS).upload(path, file, { upsert: true });

        setUploading(false);
        if (error) {
            setUploadError(`Erro no upload: ${error.message}`);
        } else {
            setLogoPath(path);
            await updateSettings({ logo_path: path });
            setUploadSuccess(true);
            setTimeout(() => setUploadSuccess(false), 3000);
        }
    };

    const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setUploadBgError('Apenas imagens são permitidas (PNG, JPG, SVG).');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setUploadBgError('Arquivo muito grande. Máximo 5MB.');
            return;
        }

        setUploadingBg(true);
        setUploadBgError('');
        setUploadBgSuccess(false);

        const ext = file.name.split('.').pop();
        const path = `system/background.${ext}`;

        const { error } = await supabase.storage.from(STORAGE_BUCKET_UPLOADS).upload(path, file, { upsert: true });

        setUploadingBg(false);
        if (error) {
            setUploadBgError(`Erro no upload: ${error.message}`);
        } else {
            setBgPath(path);
            await updateSettings({ bg_path: path });
            setUploadBgSuccess(true);
            setTimeout(() => setUploadBgSuccess(false), 3000);
        }
    };

    const handleRemoveLogo = async () => {
        setLogoPath(null);
        await updateSettings({ logo_path: null });
    };

    const handleRemoveBg = async () => {
        setBgPath(null);
        await updateSettings({ bg_path: null });
    };

    const saveSettings = async () => {
        try {
            await updateSettings({
                name: systemName,
                timezone: systemTz,
                language: systemLang,
                bg_size: bgSize,
                bg_position: bgPosition
            });
            alert('Configurações salvas com sucesso no banco de dados!');
        } catch (error) {
            alert('Falha ao salvar. Verifique sua conexão.');
        }
    };

    const logoUrl = logoPath ? getPublicUploadUrl(logoPath) : null;
    const bgUrl = bgPath ? getPublicUploadUrl(bgPath) : null;

    return (
        <div className="space-y-6">
            {/* Logo */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Identidade Visual</h3>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="w-28 h-28 rounded-xl border-2 border-dashed border-pm-secondary/30 flex items-center justify-center bg-pm-light/50 overflow-hidden flex-shrink-0">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo do sistema" className="w-full h-full object-contain p-2" />
                        ) : (
                            <div className="text-center text-pm-secondary">
                                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                                <p className="text-[10px]">Sem logo</p>
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <p className="text-sm font-medium text-pm-dark mb-1">Logomarca do Sistema</p>
                        <p className="text-xs text-pm-secondary mb-3">
                            PNG, JPG ou SVG. Máx. 2MB. Recomendado: 200×200px ou maior, fundo transparente.
                        </p>

                        {uploadError && (
                            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{uploadError}
                            </p>
                        )}
                        {uploadSuccess && (
                            <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                                <Check className="w-4 h-4 flex-shrink-0" /> Logo atualizada com sucesso!
                            </p>
                        )}

                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-pm-primary text-pm-light rounded-lg text-sm font-medium hover:bg-pm-primary/90 transition-colors disabled:opacity-60"
                            >
                                {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {uploading ? 'Enviando...' : 'Fazer Upload'}
                            </button>
                            {logoPath && (
                                <button
                                    onClick={handleRemoveLogo}
                                    className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                                >
                                    <X className="w-4 h-4" /> Remover
                                </button>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mt-6 pt-6 border-t border-pm-secondary/10">
                    <div className="w-28 h-20 rounded-xl border-2 border-dashed border-pm-secondary/30 flex items-center justify-center bg-pm-light/50 overflow-hidden flex-shrink-0">
                        {bgUrl ? (
                            <div
                                className="w-full h-full opacity-80"
                                style={{
                                    backgroundImage: `url(${bgUrl})`,
                                    backgroundSize: bgSize === 'repeat' || bgSize === 'repeat-x' || bgSize === 'repeat-y' ? 'auto' : bgSize,
                                    backgroundRepeat: bgSize.includes('repeat') ? bgSize : 'no-repeat',
                                    backgroundPosition: bgPosition
                                }}
                            />
                        ) : (
                            <div className="text-center text-pm-secondary">
                                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                                <p className="text-[10px]">Sem Backg.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <p className="text-sm font-medium text-pm-dark mb-1">Imagem de Fundo (Login)</p>
                        <p className="text-xs text-pm-secondary mb-3">
                            PNG, ou JPG. Máx. 5MB. Recomendado: Mínimo 1920x1080px.
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-pm-dark mb-1">Ajuste na Tela</label>
                                <select
                                    value={bgSize}
                                    onChange={(e) => setBgSize(e.target.value)}
                                    className="w-full border border-pm-secondary/30 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-pm-primary outline-none bg-white"
                                >
                                    <option value="contain">Encaixar (Não corta)</option>
                                    <option value="cover">Preencher tela (Padrão)</option>
                                    <option value="repeat-x">Repetir Horizontal</option>
                                    <option value="repeat">Repetir Mosaico</option>
                                    <option value="repeat-y">Repetir Vertical</option>
                                    <option value="auto">Tamanho original</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-pm-dark mb-1">Posicionamento</label>
                                <select
                                    value={bgPosition}
                                    onChange={(e) => setBgPosition(e.target.value)}
                                    className="w-full border border-pm-secondary/30 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-pm-primary outline-none bg-white"
                                >
                                    <option value="center">Centralizado</option>
                                    <option value="right">Direita</option>
                                    <option value="left">Esquerda</option>
                                    <option value="bottom">Rodapé</option>
                                    <option value="top">Topo</option>
                                    <option value="top right">Topo Direita</option>
                                    <option value="top left">Topo Esquerda</option>
                                </select>
                            </div>
                        </div>

                        {uploadBgError && (
                            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{uploadBgError}
                            </p>
                        )}
                        {uploadBgSuccess && (
                            <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                                <Check className="w-4 h-4 flex-shrink-0" /> Fundo de tela atualizado com sucesso!
                            </p>
                        )}

                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => bgFileRef.current?.click()}
                                disabled={uploadingBg}
                                className="flex items-center gap-2 px-4 py-2 bg-pm-primary text-pm-light rounded-lg text-sm font-medium hover:bg-pm-primary/90 transition-colors disabled:opacity-60"
                            >
                                {uploadingBg ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {uploadingBg ? 'Enviando...' : 'Fazer Upload'}
                            </button>
                            {bgPath && (
                                <button
                                    onClick={handleRemoveBg}
                                    className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                                >
                                    <X className="w-4 h-4" /> Remover
                                </button>
                            )}
                        </div>
                        <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                    </div>
                </div>
            </div>

            {/* Informações da Organização */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Informações da Organização</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Nome do Sistema</label>
                        <input type="text" value={systemName} onChange={e => setSystemName(e.target.value)}
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Fuso Horário</label>
                        <select value={systemTz} onChange={e => setSystemTz(e.target.value)} className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none bg-white">
                            <option>Amazônas (AMT) - UTC-4</option>
                            <option>Brasília (BRT) - UTC-3</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Idioma</label>
                        <select value={systemLang} onChange={e => setSystemLang(e.target.value)} className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none bg-white">
                            <option>English (US)</option>
                            <option>Português (Brasil)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Módulos */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Módulos Ativos</h3>
                <div className="space-y-3">
                    {[
                        { label: 'Exportação Dinâmica de Relatórios (PDF)', id: 'export', default: true },
                        { label: 'Notificações por E-mail Diárias', id: 'email', default: true },
                        { label: 'Exibir painel de Suicídios / PMs Mortos', id: 'sensible', default: false },
                        { label: 'Auditoria Rigorosa de Edições', id: 'audit', default: true },
                    ].map((item) => (
                        <label key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-pm-secondary/10 hover:bg-pm-light cursor-pointer transition-colors">
                            <span className="text-sm font-medium text-pm-dark">{item.label}</span>
                            <input type="checkbox" defaultChecked={item.default} className="w-4 h-4 text-pm-primary rounded focus:ring-pm-primary" />
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button onClick={saveSettings} className="px-5 py-2 rounded-lg text-sm font-medium bg-pm-primary text-pm-light hover:bg-pm-primary/90 transition-colors shadow-sm flex items-center gap-2">
                    <Save className="w-4 h-4" /> Salvar Configurações
                </button>
            </div>
        </div>
    );
}

// ─── Segurança e Acesso ───────────────────────────────────────────────────────
function TabSecurity() {
    const [showPassword, setShowPassword] = useState(false);
    const [sessionTimeout, setSessionTimeout] = useState('60');

    const policies = [
        { id: 'mfa', label: 'Autenticação em Dois Fatores (2FA)', description: 'Exige código extra no login para todos os usuários', enabled: false },
        { id: 'iplock', label: 'Bloqueio por IP Suspeito', description: 'Alerta e bloqueia acessos de localizações incomuns', enabled: true },
        { id: 'brute', label: 'Proteção Contra Força Bruta', description: 'Bloqueia conta após 5 tentativas de login falhas', enabled: true },
        { id: 'log', label: 'Log de Acesso Detalhado', description: 'Registra cada ação dos usuários com IP e timestamp', enabled: true },
    ];

    return (
        <div className="space-y-6">
            {/* Política de Senhas */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Política de Senhas</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Comprimento mínimo</label>
                        <select className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none bg-white">
                            <option>8 caracteres</option>
                            <option>10 caracteres</option>
                            <option>12 caracteres</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {['Letras maiúsculas obrigatórias', 'Números obrigatórios', 'Caracteres especiais obrigatórios', 'Expirar senha a cada 90 dias'].sort(compareTextPtBr).map(rule => (
                            <label key={rule} className="flex items-center gap-2 text-sm text-pm-dark font-medium cursor-pointer p-2 rounded-lg border border-pm-secondary/10 hover:bg-pm-light">
                                <input type="checkbox" defaultChecked className="w-4 h-4 text-pm-primary rounded" />
                                {rule}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sessão */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Controle de Sessão</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">
                            Timeout automático (min inatividade): <strong>{sessionTimeout} min</strong>
                        </label>
                        <input type="range" min="15" max="480" step="15" value={sessionTimeout}
                            onChange={e => setSessionTimeout(e.target.value)}
                            className="w-full accent-pm-primary"
                        />
                        <div className="flex justify-between text-xs text-pm-secondary mt-1">
                            <span>15 min</span><span>8 horas</span>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-pm-secondary/10 hover:bg-pm-light cursor-pointer">
                        <input type="checkbox" defaultChecked className="w-4 h-4 text-pm-primary rounded" />
                        <div>
                            <p className="text-sm font-medium text-pm-dark">Sessão única por usuário</p>
                            <p className="text-xs text-pm-secondary">Impede login simultâneo na mesma conta em dispositivos diferentes</p>
                        </div>
                    </label>
                </div>
            </div>

            {/* Políticas de Segurança */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Políticas de Segurança</h3>
                <div className="space-y-3">
                    {sortByTextPtBr(policies, policy => policy.label).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-pm-secondary/10 hover:bg-pm-light transition-colors">
                            <div>
                                <p className="text-sm font-medium text-pm-dark">{p.label}</p>
                                <p className="text-xs text-pm-secondary">{p.description}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                                <input type="checkbox" defaultChecked={p.enabled} className="sr-only peer" />
                                <div className="w-10 h-5 bg-pm-secondary/30 peer-focus:ring-2 peer-focus:ring-pm-primary rounded-full peer peer-checked:bg-pm-primary transition-colors"></div>
                                <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Senha Admin */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Alterar Senha do Administrador</h3>
                <div className="space-y-3">
                    <div className="relative">
                        <label className="block text-sm font-medium text-pm-dark mb-1">Nova Senha</label>
                        <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none pr-10" />
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-pm-secondary hover:text-pm-dark">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Confirmar Nova Senha</label>
                        <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <button className="px-4 py-2 bg-pm-primary text-pm-light rounded-lg text-sm font-medium hover:bg-pm-primary/90 transition-colors flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Atualizar Senha
                    </button>
                </div>
            </div>

            <div className="flex justify-end">
                <button className="px-5 py-2 rounded-lg text-sm font-medium bg-pm-primary text-pm-light hover:bg-pm-primary/90 transition-colors shadow-sm flex items-center gap-2">
                    <Save className="w-4 h-4" /> Salvar Políticas
                </button>
            </div>
        </div>
    );
}

// ─── Notificações ─────────────────────────────────────────────────────────────
function TabNotifications() {
    const { notifications, addNotification, updateNotification, deleteNotification, units } = useAuth();
    const { settings, updateSettings } = useSettings();
    
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newType, setNewType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
    const [newRole, setNewRole] = useState<'all' | 'admin' | 'editor' | 'commander'>('all');

    // Estados para SMTP e Prazos
    const [smtpServer, setSmtpServer] = useState('');
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [smtpFrom, setSmtpFrom] = useState('');
    const [deadlines, setDeadlines] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setSmtpServer(settings.smtp_server || '');
            setSmtpPort(settings.smtp_port || 587);
            setSmtpUser(settings.smtp_user || '');
            setSmtpPass(settings.smtp_pass || '');
            setSmtpFrom(settings.smtp_from || 'noreply@pmba.gov.br');
            
            // Garantir que temos deadlines para todas as unidades se estiver vazio
            if (settings.notification_deadlines && settings.notification_deadlines.length > 0) {
                setDeadlines(sortByTextPtBr(settings.notification_deadlines, deadline => deadline.unit));
            } else {
                setDeadlines(sortByTextPtBr(units, unit => unit.name).map(u => ({ id: u.id, unit: u.name, day: 'Sexta-feira', hour: '18:00' })));
            }
        }
    }, [settings, units]);

    const handleCreate = async () => {
        if (!newTitle || !newContent) return;
        await addNotification({
            title: newTitle,
            content: newContent,
            type: newType,
            target_role: newRole,
            isActive: true
        });
        setNewTitle('');
        setNewContent('');
        setIsCreating(false);
    };

    const handleSaveGlobalNotifications = async () => {
        setIsSaving(true);
        try {
            await updateSettings({
                smtp_server: smtpServer,
                smtp_port: smtpPort,
                smtp_user: smtpUser,
                smtp_pass: smtpPass,
                smtp_from: smtpFrom,
                notification_deadlines: deadlines
            });
            alert('Configurações de notificação salvas com sucesso!');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar configurações.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateDeadline = (unitId: string, field: 'day' | 'hour', value: string) => {
        setDeadlines(prev => prev.map(d => d.id === unitId ? { ...d, [field]: value } : d));
    };

    const sendTestEmail = async () => {
        if (!smtpServer || !smtpUser || !smtpFrom) {
            alert('Preencha os campos de SMTP antes de testar.');
            return;
        }
        alert(`Simulando envio de e-mail de teste através de ${smtpServer}...\n\n(No ambiente de produção, este comando acionaria um Edge Function de envio).`);
    };

    const channels = [
        { id: 'email_daily', label: 'Resumo Diário por E-mail', description: 'Envia às 07h um resumo dos indicadores de todas as unidades', channel: 'E-mail', enabled: true },
        { id: 'email_alert', label: 'Alertas de Pendências', description: 'Notifica Editores com dados não preenchidos após prazo', channel: 'E-mail', enabled: true },
        { id: 'email_new_user', label: 'Novo Usuário Criado', description: 'Notifica o Admin quando um novo usuário é cadastrado', channel: 'E-mail', enabled: false },
        { id: 'email_report', label: 'Relatório Gerado', description: 'Notifica quando um PDF é exportado pelo Comandante', channel: 'E-mail', enabled: false },
    ];

    return (
        <div className="space-y-8 pb-10">
            {/* Lançar Comunicados */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <div className="flex justify-between items-center border-b border-pm-secondary/10 pb-4 mb-6">
                    <div>
                        <h3 className="font-bold text-pm-dark">Comunicados do Sistema</h3>
                        <p className="text-xs text-pm-secondary mt-0.5">Informe os usuários sobre manutenções, prazos ou avisos de comando.</p>
                    </div>
                    {!isCreating && (
                        <button 
                            onClick={() => setIsCreating(true)}
                            className="bg-pm-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-pm-primary/90 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Novo Comunicado
                        </button>
                    )}
                </div>

                {isCreating && (
                    <div className="bg-pm-light/30 p-5 rounded-2xl border-2 border-dashed border-pm-primary/20 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-pm-secondary uppercase tracking-widest mb-2">Título do Aviso</label>
                                <input 
                                    type="text" 
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Ex: Manutenção Programada - Sábado"
                                    className="w-full border border-pm-secondary/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-pm-secondary uppercase tracking-widest mb-2">Tipo de Alerta</label>
                                <select 
                                    value={newType}
                                    onChange={e => setNewType(e.target.value as any)}
                                    className="w-full border border-pm-secondary/20 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-pm-primary outline-none bg-white font-bold"
                                >
                                    <option value="warning">Aviso (Laranja)</option>
                                    <option value="error">Crítico (Vermelho)</option>
                                    <option value="info">Informação (Azul)</option>
                                    <option value="success">Sucesso (Verde)</option>
                                </select>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-pm-secondary uppercase tracking-widest mb-2">Conteúdo do Comunicado</label>
                            <textarea 
                                value={newContent}
                                onChange={e => setNewContent(e.target.value)}
                                rows={3}
                                placeholder="Descreva aqui o que os usuários precisam saber..."
                                className="w-full border border-pm-secondary/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none resize-none"
                            />
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-pm-secondary">Público-alvo:</span>
                                <select 
                                    value={newRole}
                                    onChange={e => setNewRole(e.target.value as any)}
                                    className="bg-white border border-pm-secondary/20 rounded-lg px-3 py-1.5 text-xs font-bold text-pm-dark outline-none"
                                >
                                    <option value="admin">Apenas Administradores</option>
                                    <option value="commander">Apenas Comandantes</option>
                                    <option value="editor">Apenas Editores</option>
                                    <option value="all">Todos os Usuários</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsCreating(false)}
                                    className="px-4 py-2 text-pm-secondary hover:text-pm-dark text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleCreate}
                                    className="bg-pm-primary text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:shadow-lg transition-all"
                                >
                                    <Send className="w-3.5 h-3.5" /> Publicar Agora
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {notifications.length === 0 ? (
                        <div className="text-center py-10 bg-pm-light/20 rounded-2xl border border-dashed border-pm-secondary/20">
                            <Bell className="w-10 h-10 text-pm-secondary/30 mx-auto mb-3" />
                            <p className="text-sm font-bold text-pm-secondary">Nenhum comunicado ativo no sistema.</p>
                        </div>
                    ) : (
                        notifications.map(n => {
                            const Icon = n.type === 'warning' ? AlertCircle : (n.type === 'error' ? AlertCircle : (n.type === 'success' ? CheckCircle2 : Info));
                            const colorClass = n.type === 'warning' ? 'text-amber-600 border-amber-100 bg-amber-50' : (n.type === 'error' ? 'text-red-600 border-red-100 bg-red-50' : (n.type === 'success' ? 'text-green-600 border-green-100 bg-green-50' : 'text-blue-600 border-blue-100 bg-blue-50'));

                            return (
                                <div key={n.id} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${n.isActive ? colorClass : 'bg-pm-light text-pm-secondary border-pm-secondary/10 opacity-60'}`}>
                                    <div className="mt-1">
                                        <Icon className="w-5 h-5 flex-shrink-0" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-black uppercase tracking-tight">{n.title}</h4>
                                            <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-black/5 bg-opacity-10">Público: {n.target_role}</span>
                                        </div>
                                        <p className="text-xs font-medium leading-relaxed mb-3">{n.content}</p>
                                        <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest opacity-60">
                                            <span>Em: {new Date(n.createdAt).toLocaleDateString('pt-BR')}</span>
                                            <div className="flex gap-3 ml-auto opacity-100">
                                                <button 
                                                    onClick={() => updateNotification(n.id, { isActive: !n.isActive })}
                                                    className="hover:text-pm-dark transition-colors"
                                                >
                                                    {n.isActive ? 'Desativar' : 'Ativar'}
                                                </button>
                                                <button 
                                                    onClick={() => deleteNotification(n.id)}
                                                    className="hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Canais */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Canais de Notificação</h3>
                <div className="space-y-3">
                    {sortByTextPtBr(channels, channel => channel.label).map(c => (
                        <div key={c.id} className="flex items-start justify-between p-3 rounded-lg border border-pm-secondary/10 hover:bg-pm-light transition-colors gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-pm-dark">{c.label}</p>
                                    <span className="text-[10px] bg-pm-light border border-pm-secondary/20 text-pm-secondary px-1.5 py-0.5 rounded font-mono">{c.channel}</span>
                                </div>
                                <p className="text-xs text-pm-secondary mt-0.5">{c.description}</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                                <input type="checkbox" defaultChecked={c.enabled} className="sr-only peer" />
                                <div className="w-10 h-5 bg-pm-secondary/30 rounded-full peer peer-checked:bg-pm-primary transition-colors"></div>
                                <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Config de E-mail */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Configuração de E-mail (SMTP)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Servidor SMTP</label>
                        <input type="text" value={smtpServer} onChange={e => setSmtpServer(e.target.value)} placeholder="smtp.example.com"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Porta</label>
                        <input type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} placeholder="587"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Usuário SMTP</label>
                        <input type="email" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="noreply@pmba.gov.br"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Senha SMTP</label>
                        <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="••••••••"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-pm-dark mb-1">E-mail de Origem</label>
                    <input type="email" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)}
                        className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                </div>
                <button 
                    onClick={sendTestEmail}
                    className="mt-4 px-4 py-2 border border-pm-secondary/30 text-pm-dark rounded-lg text-sm font-medium hover:bg-pm-light transition-colors flex items-center gap-2"
                >
                    <Bell className="w-4 h-4" /> Enviar E-mail de Teste
                </button>
            </div>

            {/* Prazos por Unidade */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Prazos de Entrega por Unidade</h3>
                <p className="text-xs text-pm-secondary mb-4">Define quando cada unidade deve ter seus dados atualizados. Após o prazo, alertas são enviados automaticamente.</p>
                <div className="space-y-3">
                    {sortByTextPtBr(deadlines, deadline => deadline.unit).map(d => (
                        <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border border-pm-secondary/10 bg-pm-light/30">
                            <span className="text-sm font-bold text-pm-dark w-24 truncate">{d.unit}</span>
                            <select 
                                value={d.day} 
                                onChange={e => handleUpdateDeadline(d.id, 'day', e.target.value)}
                                className="flex-1 border border-pm-secondary/30 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pm-primary outline-none bg-white font-bold"
                            >
                                {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'].map(day => (
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                            <input 
                                type="time" 
                                value={d.hour}
                                onChange={e => handleUpdateDeadline(d.id, 'hour', e.target.value)}
                                className="border border-pm-secondary/30 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pm-primary outline-none font-bold" 
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button 
                    onClick={handleSaveGlobalNotifications}
                    disabled={isSaving}
                    className="px-5 py-2 rounded-lg text-sm font-medium bg-pm-primary text-pm-light hover:bg-pm-primary/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Salvando...' : 'Salvar Notificações'}
                </button>
            </div>
        </div>
    );
}

// ─── Setup de Indicadores ─────────────────────────────────────────────────────
function TabIndicators() {
    const { units, dataGroups, fields } = useAuth();

    const indicatorTypes = [
        { icon: Hash, label: 'Numérico', description: 'Contagem absoluta. Ex: 42 policiais', color: 'text-blue-600 bg-blue-50' },
        { icon: Percent, label: 'Percentual', description: 'Valor em %. Ex: 87% de cumprimento', color: 'text-green-600 bg-green-50' },
        { icon: Hash, label: 'Valor', description: 'Moeda brasileira. Ex: R$ 1.250,50', color: 'text-emerald-600 bg-emerald-50' },
        { icon: Calculator, label: 'Calculado', description: 'Operações matemáticas automáticas', color: 'text-purple-600 bg-purple-50' },
        { icon: BarChart2, label: 'Tendência', description: 'Compara com o período anterior', color: 'text-amber-600 bg-amber-50' },
    ];

    const totalFields = fields.filter(f => f.isActive);
    const numericFields = totalFields.filter(f => f.type === 'number' || f.type === 'currency' || f.type === 'percentage' || f.type === 'calculated');
    const textFields = totalFields.filter(f => f.type === 'text' || f.type === 'textarea');
    const imageFields = totalFields.filter(f => f.type === 'image');

    return (
        <div className="space-y-6">
            {/* Visão Geral */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Unidades', value: units.length, color: 'bg-pm-primary/10 text-pm-primary' },
                    { label: 'Conjuntos', value: dataGroups.length, color: 'bg-blue-50 text-blue-600' },
                    { label: 'Campos Ativos', value: totalFields.length, color: 'bg-green-50 text-green-600' },
                    { label: 'Indicadores', value: numericFields.length, color: 'bg-amber-50 text-amber-600' },
                ].map(stat => (
                    <div key={stat.label} className={`rounded-xl p-4 ${stat.color} border border-current/10`}>
                        <p className="text-2xl font-black">{stat.value}</p>
                        <p className="text-xs font-semibold mt-1 opacity-70 uppercase tracking-wider">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Tipos de Indicadores */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Tipos de Indicadores Suportados</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {sortByTextPtBr(indicatorTypes, type => type.label).map(t => (
                        <div key={t.label} className="p-4 rounded-xl border border-pm-secondary/10 bg-pm-light/30">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${t.color}`}>
                                <t.icon className="w-4 h-4" />
                            </div>
                            <p className="text-sm font-bold text-pm-dark">{t.label}</p>
                            <p className="text-xs text-pm-secondary mt-1">{t.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Campos por Tipo */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Distribuição dos Campos por Tipo</h3>
                <div className="space-y-3">
                    {[
                        { label: 'Campos Numéricos e Percentuais', count: numericFields.length, total: totalFields.length, color: 'bg-blue-500' },
                        { label: 'Campos de Texto', count: textFields.length, total: totalFields.length, color: 'bg-pm-primary' },
                        { label: 'Campos de Imagem', count: imageFields.length, total: totalFields.length, color: 'bg-green-500' },
                    ].sort((a, b) => compareTextPtBr(a.label, b.label)).map(item => (
                        <div key={item.label}>
                            <div className="flex justify-between text-xs font-medium text-pm-dark mb-1">
                                <span>{item.label}</span>
                                <span>{item.count} campo{item.count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="h-2 bg-pm-light rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                                    style={{ width: item.total > 0 ? `${(item.count / item.total) * 100}%` : '0%' }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Mapeamento por Unidade */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Mapeamento de Campos por Unidade</h3>
                {units.length === 0 ? (
                    <p className="text-sm text-pm-secondary italic text-center py-6">Nenhuma unidade cadastrada.</p>
                ) : (
                    <div className="space-y-2">
                        {sortByTextPtBr(units, unit => unit.name).map(unit => {
                            const unitGroups = dataGroups.filter(g => g.unitId === unit.id);
                            const unitGroupIds = unitGroups.map(g => g.id);
                            const unitFields = fields.filter(f => unitGroupIds.includes(f.dataGroupId) && f.isActive);
                            const unitNumeric = unitFields.filter(f => f.type === 'number' || f.type === 'currency' || f.type === 'percentage' || f.type === 'calculated').length;
                            return (
                                <div key={unit.id} className="flex items-center gap-3 p-3 rounded-lg border border-pm-secondary/10 bg-pm-light/20 hover:bg-pm-light/50 transition-colors">
                                    <div className="w-12 h-12 rounded-lg bg-pm-primary/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs font-black text-pm-primary">{unit.name.slice(0, 3)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-pm-dark truncate">{unit.name}</p>
                                        <p className="text-xs text-pm-secondary">{unitGroups.length} conjuntos · {unitFields.length} campos</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-black text-pm-primary">{unitNumeric}</p>
                                        <p className="text-[10px] text-pm-secondary uppercase tracking-wider">Indicadores</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-pm-secondary/40" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Configurações Globais de Cálculo */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Configurações Globais de Cálculo</h3>
                <div className="space-y-3">
                    {[
                        { label: 'Calcular variação em relação à semana anterior', enabled: true },
                        { label: 'Marcar indicadores críticos (abaixo da meta) em vermelho', enabled: true },
                        { label: 'Mostrar meta nos cards do dashboard', enabled: false },
                        { label: 'Incluir indicadores sem preenchimento no relatório (como "—")', enabled: true },
                    ].sort((a, b) => compareTextPtBr(a.label, b.label)).map((item, i) => (
                        <label key={i} className="flex items-center justify-between p-3 rounded-lg border border-pm-secondary/10 hover:bg-pm-light cursor-pointer">
                            <span className="text-sm font-medium text-pm-dark">{item.label}</span>
                            <input type="checkbox" defaultChecked={item.enabled} className="w-4 h-4 text-pm-primary rounded" />
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button className="px-5 py-2 rounded-lg text-sm font-medium bg-pm-primary text-pm-light hover:bg-pm-primary/90 transition-colors shadow-sm flex items-center gap-2">
                    <Save className="w-4 h-4" /> Salvar Setup
                </button>
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SettingsPanel() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('general');

    if (user?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <Shield className="w-16 h-16 text-pm-secondary/50 mb-4" />
                <h2 className="text-xl font-bold text-pm-dark">Acesso Restrito</h2>
                <p className="text-pm-secondary mt-2">Apenas Administradores podem alterar configurações globais.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h2 className="text-xl font-bold text-pm-dark mb-1">Configurações do Sistema</h2>
                <p className="text-sm text-pm-secondary">Preferências gerais, segurança, notificações e setup de indicadores.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="md:col-span-1 space-y-1.5">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${activeTab === tab.id
                                ? 'bg-pm-primary text-pm-light shadow-sm'
                                : 'hover:bg-pm-light text-pm-dark border border-transparent hover:border-pm-secondary/20'
                                }`}
                        >
                            <tab.icon className="w-4 h-4 flex-shrink-0" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="md:col-span-3">
                    {activeTab === 'general' && <TabGeneral />}
                    {activeTab === 'security' && <TabSecurity />}
                    {activeTab === 'notifications' && <TabNotifications />}
                    {activeTab === 'indicators' && <TabIndicators />}
                </div>
            </div>
        </div>
    );
}
