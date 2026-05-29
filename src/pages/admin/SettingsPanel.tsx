import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useSettings } from '../../store/SettingsContext';
import {
    Shield, Settings2, Bell, Database, Lock, Upload, Image as ImageIcon,
    Eye, EyeOff, RefreshCw, AlertTriangle, ChevronRight,
    BarChart2, Percent, Hash, Save, Check, X, Calculator,
    Plus, Trash2, Send, Info, AlertCircle, CheckCircle2, CalendarDays, UserRound
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getPublicUploadUrl } from '../../utils/storageUrls';
import { STORAGE_BUCKET_UPLOADS } from '../../config/storage';
import { compareTextPtBr, sortByTextPtBr } from '../../utils/textOrdering';
import { isGeneralBriefingUnit } from '../../utils/generalBriefingUnits';
import { sendSystemEmail } from '../../utils/email';

type Tab = 'general' | 'security' | 'notifications' | 'indicators';

type AlertRuleDraft = {
    unitId: string;
    unitName: string;
    sectorId: string;
    updaterId: string;
    weekdays: number[];
    deadlineTime: string;
    isActive: boolean;
};

type ReportEmailFrequency = 'weekly' | 'monthly' | 'specific_date';

type ScheduledReportEmail = {
    id: string;
    name: string;
    isActive: boolean;
    frequency: ReportEmailFrequency;
    weekdays: number[];
    dayOfMonth: number | null;
    specificDate: string | null;
    sendTime: string;
    recipientUserIds: string[];
    recipientEmails: string[];
    subject: string;
    message: string;
    includeGlobalReportModel: boolean;
    includeResponsibleSummary: boolean;
    lastSentAt: string | null;
};

const WEEKDAYS = [
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sáb' },
    { value: 0, label: 'Dom' }
];

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
    const { notifications, addNotification, updateNotification, deleteNotification, units, dataGroups, fields, entries, fieldValues, regionalCommands, users, responsibleSectors, unitUpdateAlertRules, refreshData, user } = useAuth();
    const { settings, updateSettings } = useSettings();
    const briefingUnits = units.filter(unit => isGeneralBriefingUnit(unit, regionalCommands));
    const updaterOptions = users
        .filter(candidate => candidate.isActive !== false)
        .sort((left, right) => compareTextPtBr(left.email || left.name, right.email || right.name));
    
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newType, setNewType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
    const [newRole, setNewRole] = useState<'all' | 'admin' | 'editor' | 'commander'>('all');

    // Estados para e-mail e regras de cobrança
    const [smtpServer, setSmtpServer] = useState('');
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [smtpFrom, setSmtpFrom] = useState('');
    const [testEmailTo, setTestEmailTo] = useState('');
    const [emailRecipientMode, setEmailRecipientMode] = useState<'self' | 'admin' | 'commander' | 'editor' | 'all' | 'custom'>('self');
    const [customRecipients, setCustomRecipients] = useState('');
    const [emailSubject, setEmailSubject] = useState('Mensagem do Sistema Briefing');
    const [emailMessage, setEmailMessage] = useState('');
    const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
    const [reportSchedules, setReportSchedules] = useState<ScheduledReportEmail[]>([]);
    const [scheduleName, setScheduleName] = useState('Relatório semanal de indicadores');
    const [scheduleFrequency, setScheduleFrequency] = useState<ReportEmailFrequency>('weekly');
    const [scheduleWeekdays, setScheduleWeekdays] = useState<number[]>([5]);
    const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
    const [scheduleSpecificDate, setScheduleSpecificDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('08:00');
    const [scheduleRecipientUserIds, setScheduleRecipientUserIds] = useState<string[]>([]);
    const [scheduleManualRecipients, setScheduleManualRecipients] = useState('');
    const [scheduleSubject, setScheduleSubject] = useState('Relatório de Indicadores - Sistema Briefing');
    const [scheduleMessage, setScheduleMessage] = useState('Segue relatório de indicadores com setores responsáveis e usuários vinculados.');
    const [includeResponsibleSummary, setIncludeResponsibleSummary] = useState(true);
    const [isSavingReportSchedule, setIsSavingReportSchedule] = useState(false);
    const [isSendingReportSchedule, setIsSendingReportSchedule] = useState(false);
    const [newSectorName, setNewSectorName] = useState('');
    const [alertRuleDrafts, setAlertRuleDrafts] = useState<AlertRuleDraft[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setSmtpServer(settings.smtp_server || '');
            setSmtpPort(settings.smtp_port || 587);
            setSmtpUser(settings.smtp_user || '');
            setSmtpPass(settings.smtp_pass || '');
            setSmtpFrom(settings.smtp_from || 'noreply@briefing.pmdabahia.com.br');
        }
    }, [settings]);

    useEffect(() => {
        setTestEmailTo(user?.email || '');
    }, [user?.email]);

    useEffect(() => {
        const loadReportSchedules = async () => {
            const { data, error } = await supabase
                .from('scheduled_report_emails')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao carregar agendamentos de relatório:', error);
                return;
            }

            setReportSchedules((data || []).map(item => ({
                id: item.id,
                name: item.name,
                isActive: item.is_active,
                frequency: item.frequency,
                weekdays: item.weekdays || [5],
                dayOfMonth: item.day_of_month ?? null,
                specificDate: item.specific_date ?? null,
                sendTime: item.send_time?.slice(0, 5) || '08:00',
                recipientUserIds: item.recipient_user_ids || [],
                recipientEmails: item.recipient_emails || [],
                subject: item.subject,
                message: item.message || '',
                includeGlobalReportModel: item.include_global_report_model,
                includeResponsibleSummary: item.include_responsible_summary,
                lastSentAt: item.last_sent_at ?? null
            })));
        };

        if (user?.role === 'admin') {
            loadReportSchedules();
        }
    }, [user?.role]);

    const emailRecipientOptions = [
        { value: 'self', label: 'Meu e-mail' },
        { value: 'admin', label: 'Administradores' },
        { value: 'commander', label: 'Comandantes' },
        { value: 'editor', label: 'Editores' },
        { value: 'all', label: 'Todos os usuários ativos' },
        { value: 'custom', label: 'Destinatários manuais' }
    ] as const;

    const getManualRecipients = () => customRecipients
        .split(/[\n,;]+/)
        .map(email => email.trim())
        .filter(Boolean);

    const getSelectedRecipients = () => {
        if (emailRecipientMode === 'self') return testEmailTo.trim() ? [testEmailTo.trim()] : [];
        if (emailRecipientMode === 'custom') return getManualRecipients();

        return users
            .filter(candidate => candidate.isActive !== false)
            .filter(candidate => emailRecipientMode === 'all' || candidate.role === emailRecipientMode)
            .map(candidate => candidate.email?.trim())
            .filter((email): email is string => Boolean(email));
    };

    const selectedEmailRecipients = Array.from(new Set(getSelectedRecipients()));

    const getManualReportRecipients = () => scheduleManualRecipients
        .split(/[\n,;]+/)
        .map(email => email.trim())
        .filter(Boolean);

    const getScheduleRecipients = (schedule?: ScheduledReportEmail) => {
        const userIds = schedule?.recipientUserIds ?? scheduleRecipientUserIds;
        const manualEmails = schedule?.recipientEmails ?? getManualReportRecipients();
        const userEmails = users
            .filter(candidate => userIds.includes(candidate.id))
            .map(candidate => candidate.email?.trim())
            .filter((email): email is string => Boolean(email) && email.includes('@'));

        return Array.from(new Set([...userEmails, ...manualEmails]));
    };

    const buildReportEmailHtml = async (schedule?: ScheduledReportEmail) => {
        const { data, error } = await supabase
            .from('global_report_configurations')
            .select('configuration')
            .eq('id', 'general')
            .maybeSingle();

        if (error) throw error;

        const configuration = (data?.configuration || {}) as {
            selectedUnits?: string[];
            selectedGroups?: string[];
            groupOrder?: string[];
            unitOrder?: string[];
        };
        const selectedUnitIds = Array.isArray(configuration.selectedUnits) ? configuration.selectedUnits : briefingUnits.map(unit => unit.id);
        const selectedGroupIds = Array.isArray(configuration.selectedGroups) ? configuration.selectedGroups : dataGroups.map(group => group.id);
        const unitOrder = Array.isArray(configuration.unitOrder) ? configuration.unitOrder : [];
        const groupOrder = Array.isArray(configuration.groupOrder) ? configuration.groupOrder : [];
        const activeUnits = briefingUnits
            .filter(unit => selectedUnitIds.includes(unit.id))
            .sort((left, right) => {
                const leftIndex = unitOrder.indexOf(left.id);
                const rightIndex = unitOrder.indexOf(right.id);
                return (leftIndex >= 0 ? leftIndex : 9999) - (rightIndex >= 0 ? rightIndex : 9999)
                    || compareTextPtBr(left.name, right.name);
            });

        const formatValue = (value: unknown, fieldType?: string) => {
            if (value === null || value === undefined || value === '') return '-';
            if (fieldType === 'currency') return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if (fieldType === 'percentage') return `${Number(value).toLocaleString('pt-BR')}%`;
            if (typeof value === 'number') return value.toLocaleString('pt-BR');
            return String(value);
        };

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const getPeriodLabel = (group: typeof dataGroups[number]) => {
            if (group.updateFrequency === 'monthly') {
                return now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            }
            if (group.updateFrequency === 'yearly') {
                return String(currentYear);
            }
            return 'Atualização vigente';
        };
        const getPeriodEntry = (unitId: string, group: typeof dataGroups[number]) => {
            const groupEntries = entries.filter(candidate => candidate.unitId === unitId && candidate.dataGroupId === group.id);
            if (group.updateFrequency === 'monthly') {
                return groupEntries.find(candidate => candidate.referenceYear === currentYear && candidate.referenceMonth === currentMonth);
            }
            if (group.updateFrequency === 'yearly') {
                return groupEntries.find(candidate => candidate.referenceYear === currentYear);
            }
            return groupEntries.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
        };

        const rows = activeUnits.flatMap(unit => {
            const unitGroups = dataGroups
                .filter(group => group.unitId === unit.id && selectedGroupIds.includes(group.id))
                .sort((left, right) => {
                    const leftIndex = groupOrder.indexOf(left.id);
                    const rightIndex = groupOrder.indexOf(right.id);
                    return (leftIndex >= 0 ? leftIndex : 9999) - (rightIndex >= 0 ? rightIndex : 9999) || left.order - right.order;
                });

            return unitGroups.flatMap(group => {
                const entry = getPeriodEntry(unit.id, group);
                if (!entry) return [];

                const entryValues = entry ? fieldValues.filter(value => value.entryId === entry.id) : [];
                const activeFields = fields.filter(field => field.dataGroupId === group.id && field.isActive && field.type !== 'image').sort((left, right) => left.order - right.order);
                const updatedByUser = users.find(candidate => candidate.id === entry.updatedBy);
                const responsibleUser = users.find(candidate => candidate.id === unit.responsibleUpdaterId);

                return activeFields.map(field => {
                    const fieldValue = entryValues.find(value => value.fieldId === field.id);
                    if (!fieldValue || fieldValue.value === null || fieldValue.value === undefined || fieldValue.value === '') return null;
                    return {
                        unit: unit.name,
                        group: group.title,
                        field: field.name,
                        value: formatValue(fieldValue?.value, field.type),
                        period: getPeriodLabel(group),
                        updatedAt: new Date(entry.updatedAt).toLocaleString('pt-BR'),
                        updatedBy: updatedByUser?.email || updatedByUser?.name || 'Usuário não identificado',
                        sector: unit.responsibleSector || responsibleSectors.find(sector => sector.id === unit.responsibleSectorId)?.name || '-',
                        responsible: responsibleUser?.email || responsibleUser?.name || '-'
                    };
                }).filter((row): row is NonNullable<typeof row> => Boolean(row));
            });
        });

        const updatedUsers = Array.from(new Set(rows.map(row => row.updatedBy)));

        const message = schedule?.message ?? scheduleMessage;

        return `
            <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.45;">
                <h2 style="margin: 0 0 8px;">${schedule?.subject ?? scheduleSubject}</h2>
                <p style="margin: 0 0 18px;">${message.replace(/\n/g, '<br />')}</p>
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin:0 0 18px;">
                    <div style="border:1px solid #d8dee8;border-radius:8px;padding:10px 12px;"><strong>${rows.length}</strong><br /><span style="font-size:12px;color:#5f6b7a;">indicadores atualizados</span></div>
                    <div style="border:1px solid #d8dee8;border-radius:8px;padding:10px 12px;"><strong>${updatedUsers.length}</strong><br /><span style="font-size:12px;color:#5f6b7a;">usuários atualizaram</span></div>
                </div>
                <h3 style="margin: 22px 0 8px;">Indicadores atualizados no período do sistema</h3>
                <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
                    <thead><tr><th align="left" style="border:1px solid #d8dee8;padding:8px;">Atualizado por</th><th align="left" style="border:1px solid #d8dee8;padding:8px;">Tópico</th><th align="left" style="border:1px solid #d8dee8;padding:8px;">Setor</th><th align="left" style="border:1px solid #d8dee8;padding:8px;">Responsável</th><th align="left" style="border:1px solid #d8dee8;padding:8px;">Seção</th><th align="left" style="border:1px solid #d8dee8;padding:8px;">Indicador</th><th align="left" style="border:1px solid #d8dee8;padding:8px;">Valor</th><th align="left" style="border:1px solid #d8dee8;padding:8px;">Período</th><th align="left" style="border:1px solid #d8dee8;padding:8px;">Atualização</th></tr></thead>
                    <tbody>${rows.length > 0 ? rows.map(row => `<tr><td style="border:1px solid #d8dee8;padding:8px;">${row.updatedBy}</td><td style="border:1px solid #d8dee8;padding:8px;">${row.unit}</td><td style="border:1px solid #d8dee8;padding:8px;">${row.sector}</td><td style="border:1px solid #d8dee8;padding:8px;">${row.responsible}</td><td style="border:1px solid #d8dee8;padding:8px;">${row.group}</td><td style="border:1px solid #d8dee8;padding:8px;">${row.field}</td><td style="border:1px solid #d8dee8;padding:8px;">${row.value}</td><td style="border:1px solid #d8dee8;padding:8px;">${row.period}</td><td style="border:1px solid #d8dee8;padding:8px;">${row.updatedAt}</td></tr>`).join('') : '<tr><td colspan="9" style="border:1px solid #d8dee8;padding:8px;">Nenhum indicador atualizado foi encontrado para o período atual do sistema.</td></tr>'}</tbody>
                </table>
            </div>
        `;
    };

    useEffect(() => {
        setAlertRuleDrafts(sortByTextPtBr(briefingUnits, unit => unit.name).map(unit => {
            const rule = unitUpdateAlertRules.find(candidate => candidate.unitId === unit.id);
            return {
                unitId: unit.id,
                unitName: unit.name,
                sectorId: unit.responsibleSectorId || '',
                updaterId: unit.responsibleUpdaterId || '',
                weekdays: rule?.weekdays?.length ? rule.weekdays : [5],
                deadlineTime: rule?.deadlineTime?.slice(0, 5) || '18:00',
                isActive: rule?.isActive ?? false
            };
        }));
    }, [units, regionalCommands, unitUpdateAlertRules]);

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
                smtp_from: smtpFrom
            });

            for (const draft of alertRuleDrafts) {
                const sector = responsibleSectors.find(option => option.id === draft.sectorId);
                const { error: unitError } = await supabase.from('units').update({
                    responsible_sector_id: sector?.id ?? null,
                    responsible_sector: sector?.name ?? null,
                    responsible_updater_id: draft.updaterId || null
                }).eq('id', draft.unitId);
                if (unitError) throw unitError;

                const existingRule = unitUpdateAlertRules.find(rule => rule.unitId === draft.unitId);
                if (draft.weekdays.length === 0) {
                    throw new Error(`Selecione pelo menos um dia de atualização para "${draft.unitName}".`);
                }

                const { error } = await supabase.from('unit_update_alert_rules').upsert({
                    unit_id: draft.unitId,
                    starts_at: existingRule?.startsAt || new Date().toISOString(),
                    due_at: null,
                    weekdays: [...draft.weekdays].sort((left, right) => left - right),
                    deadline_time: draft.deadlineTime,
                    schedule_timezone: 'America/Maceio',
                    is_active: draft.isActive,
                    created_by: existingRule ? undefined : user?.id,
                    updated_by: user?.id
                }, { onConflict: 'unit_id' });
                if (error) throw error;
            }

            await refreshData();
            alert('Configurações e regras de alerta salvas com sucesso!');
        } catch (error) {
            console.error(error);
            alert(`Erro ao salvar configurações. ${error instanceof Error ? error.message : ''}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateAlertDraft = <K extends keyof AlertRuleDraft>(unitId: string, field: K, value: AlertRuleDraft[K]) => {
        setAlertRuleDrafts(previous => previous.map(draft => draft.unitId === unitId ? { ...draft, [field]: value } : draft));
    };

    const handleToggleAlertWeekday = (unitId: string, weekday: number) => {
        setAlertRuleDrafts(previous => previous.map(draft => {
            if (draft.unitId !== unitId) return draft;
            return {
                ...draft,
                weekdays: draft.weekdays.includes(weekday)
                    ? draft.weekdays.filter(day => day !== weekday)
                    : [...draft.weekdays, weekday]
            };
        }));
    };

    const handleAddSector = async () => {
        if (!newSectorName.trim()) return;
        const { error } = await supabase.from('responsible_sectors').insert({ name: newSectorName.trim() });
        if (error) {
            alert(`Não foi possível cadastrar o setor. ${error.message}`);
            return;
        }
        setNewSectorName('');
        await refreshData();
    };

    const sendTestEmail = async () => {
        const recipients = emailRecipientMode === 'self' && testEmailTo.trim()
            ? [testEmailTo.trim()]
            : selectedEmailRecipients;

        if (recipients.length === 0) {
            alert('Selecione pelo menos um destinatário com e-mail válido.');
            return;
        }
        if (recipients.length > 50) {
            alert('Selecione no máximo 50 destinatários por envio.');
            return;
        }
        if (!emailSubject.trim()) {
            alert('Informe o assunto do e-mail.');
            return;
        }
        if (!emailMessage.trim()) {
            alert('Informe a mensagem do e-mail.');
            return;
        }

        setIsSendingTestEmail(true);
        try {
            await sendSystemEmail({
                to: recipients,
                subject: emailSubject.trim(),
                text: emailMessage.trim(),
                html: `<p>${emailMessage.trim().replace(/\n/g, '<br />')}</p>`,
            });
            alert(`E-mail enviado com sucesso para ${recipients.length} destinatário(s).`);
        } catch (error) {
            console.error(error);
            alert(`Erro ao enviar e-mail. ${error instanceof Error ? error.message : ''}`);
        } finally {
            setIsSendingTestEmail(false);
        }
    };

    const handleToggleScheduleWeekday = (weekday: number) => {
        setScheduleWeekdays(previous => previous.includes(weekday)
            ? previous.filter(day => day !== weekday)
            : [...previous, weekday]);
    };

    const handleToggleScheduleRecipient = (userId: string) => {
        setScheduleRecipientUserIds(previous => previous.includes(userId)
            ? previous.filter(id => id !== userId)
            : [...previous, userId]);
    };

    const handleSaveReportSchedule = async () => {
        const recipientEmails = getManualReportRecipients();
        if (!scheduleName.trim()) {
            alert('Informe o nome do agendamento.');
            return;
        }
        if (scheduleRecipientUserIds.length === 0 && recipientEmails.length === 0) {
            alert('Escolha pelo menos um usuário ou e-mail manual.');
            return;
        }
        if (scheduleFrequency === 'weekly' && scheduleWeekdays.length === 0) {
            alert('Escolha pelo menos um dia da semana.');
            return;
        }
        if (scheduleFrequency === 'specific_date' && !scheduleSpecificDate) {
            alert('Escolha a data específica do envio.');
            return;
        }

        setIsSavingReportSchedule(true);
        try {
            const { error } = await supabase.from('scheduled_report_emails').insert({
                name: scheduleName.trim(),
                frequency: scheduleFrequency,
                weekdays: scheduleWeekdays.sort((left, right) => left - right),
                day_of_month: scheduleFrequency === 'monthly' ? scheduleDayOfMonth : null,
                specific_date: scheduleFrequency === 'specific_date' ? scheduleSpecificDate : null,
                send_time: scheduleTime,
                recipient_user_ids: scheduleRecipientUserIds,
                recipient_emails: recipientEmails,
                subject: scheduleSubject.trim(),
                message: scheduleMessage.trim(),
                include_global_report_model: true,
                include_responsible_summary: includeResponsibleSummary,
                created_by: user?.id,
                updated_by: user?.id
            });
            if (error) throw error;

            const { data, error: loadError } = await supabase.from('scheduled_report_emails').select('*').order('created_at', { ascending: false });
            if (loadError) throw loadError;
            setReportSchedules((data || []).map(item => ({
                id: item.id,
                name: item.name,
                isActive: item.is_active,
                frequency: item.frequency,
                weekdays: item.weekdays || [5],
                dayOfMonth: item.day_of_month ?? null,
                specificDate: item.specific_date ?? null,
                sendTime: item.send_time?.slice(0, 5) || '08:00',
                recipientUserIds: item.recipient_user_ids || [],
                recipientEmails: item.recipient_emails || [],
                subject: item.subject,
                message: item.message || '',
                includeGlobalReportModel: item.include_global_report_model,
                includeResponsibleSummary: item.include_responsible_summary,
                lastSentAt: item.last_sent_at ?? null
            })));
            alert('Agendamento de relatório salvo.');
        } catch (error) {
            console.error(error);
            alert(`Erro ao salvar agendamento. ${error instanceof Error ? error.message : ''}`);
        } finally {
            setIsSavingReportSchedule(false);
        }
    };

    const handleSendReportNow = async (schedule?: ScheduledReportEmail) => {
        const recipients = getScheduleRecipients(schedule);
        if (recipients.length === 0) {
            alert('Nenhum destinatário válido encontrado para este relatório.');
            return;
        }
        if (recipients.length > 50) {
            alert('O envio está limitado a 50 destinatários por vez.');
            return;
        }

        setIsSendingReportSchedule(true);
        try {
            const html = await buildReportEmailHtml(schedule);
            await sendSystemEmail({
                to: recipients,
                subject: schedule?.subject || scheduleSubject,
                text: schedule?.message || scheduleMessage,
                html
            });
            if (schedule) {
                await supabase.from('scheduled_report_emails').update({ last_sent_at: new Date().toISOString(), updated_by: user?.id }).eq('id', schedule.id);
            }
            alert(`Relatório enviado para ${recipients.length} destinatário(s).`);
        } catch (error) {
            console.error(error);
            alert(`Erro ao enviar relatório. ${error instanceof Error ? error.message : ''}`);
        } finally {
            setIsSendingReportSchedule(false);
        }
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
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Configuração de E-mail (Resend)</h3>
                <p className="text-xs text-pm-secondary mb-4">
                    O envio usa a API da Vercel. A chave do Resend deve ficar nas variáveis de ambiente da Vercel, nunca no navegador.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Provedor</label>
                        <input type="text" value={smtpServer} onChange={e => setSmtpServer(e.target.value)} placeholder="Resend"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Domínio</label>
                        <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="briefing.pmdabahia.com.br"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">E-mail de Origem</label>
                        <input type="email" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} placeholder="noreply@briefing.pmdabahia.com.br"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Destinatários</label>
                        <select
                            value={emailRecipientMode}
                            onChange={event => setEmailRecipientMode(event.target.value as typeof emailRecipientMode)}
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none bg-white"
                        >
                            {emailRecipientOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    {emailRecipientMode === 'self' && (
                        <div>
                            <label className="block text-sm font-medium text-pm-dark mb-1">Meu Destinatário</label>
                            <input type="email" value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} placeholder="seu@email.com"
                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                        </div>
                    )}
                    {emailRecipientMode === 'custom' && (
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-pm-dark mb-1">Destinatários Manuais</label>
                            <textarea
                                value={customRecipients}
                                onChange={event => setCustomRecipients(event.target.value)}
                                rows={3}
                                placeholder="um@email.com, outro@email.com"
                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none resize-none"
                            />
                        </div>
                    )}
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-pm-dark mb-1">Assunto</label>
                        <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Assunto do e-mail"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-pm-dark mb-1">Mensagem</label>
                        <textarea
                            value={emailMessage}
                            onChange={event => setEmailMessage(event.target.value)}
                            rows={5}
                            placeholder="Digite a mensagem que será enviada por e-mail..."
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none resize-none"
                        />
                        <p className="mt-2 text-xs text-pm-secondary">
                            Destinatários encontrados: {selectedEmailRecipients.length}. Limite por envio: 50.
                        </p>
                    </div>
                </div>
                <button 
                    onClick={sendTestEmail}
                    disabled={isSendingTestEmail || selectedEmailRecipients.length === 0}
                    className="mt-4 px-4 py-2 border border-pm-secondary/30 text-pm-dark rounded-lg text-sm font-medium hover:bg-pm-light transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                    {isSendingTestEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                    {isSendingTestEmail ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
            </div>

            {/* Agendamento de relatórios */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Envio de Relatórios por E-mail</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-pm-dark mb-1">Nome do Agendamento</label>
                        <input value={scheduleName} onChange={event => setScheduleName(event.target.value)}
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Horário</label>
                        <input type="time" value={scheduleTime} onChange={event => setScheduleTime(event.target.value)}
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-pm-dark mb-1">Recorrência</label>
                        <select value={scheduleFrequency} onChange={event => setScheduleFrequency(event.target.value as ReportEmailFrequency)}
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none bg-white">
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                            <option value="specific_date">Data específica</option>
                        </select>
                    </div>
                    {scheduleFrequency === 'weekly' && (
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-pm-dark mb-1">Dias da Semana</label>
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAYS.map(day => (
                                    <button key={day.value} type="button" onClick={() => handleToggleScheduleWeekday(day.value)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold border ${scheduleWeekdays.includes(day.value) ? 'bg-pm-primary text-white border-pm-primary' : 'bg-white text-pm-dark border-pm-secondary/20'}`}>
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {scheduleFrequency === 'monthly' && (
                        <div>
                            <label className="block text-sm font-medium text-pm-dark mb-1">Dia do Mês</label>
                            <input type="number" min={1} max={31} value={scheduleDayOfMonth} onChange={event => setScheduleDayOfMonth(Number(event.target.value))}
                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                        </div>
                    )}
                    {scheduleFrequency === 'specific_date' && (
                        <div>
                            <label className="block text-sm font-medium text-pm-dark mb-1">Data do Envio</label>
                            <input type="date" value={scheduleSpecificDate} onChange={event => setScheduleSpecificDate(event.target.value)}
                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                        </div>
                    )}
                    <div className="lg:col-span-3">
                        <label className="block text-sm font-medium text-pm-dark mb-1">Usuários Destinatários</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-52 overflow-y-auto border border-pm-secondary/20 rounded-lg p-3">
                            {updaterOptions.map(option => (
                                <label key={option.id} className="flex items-center gap-2 text-xs text-pm-dark">
                                    <input type="checkbox" checked={scheduleRecipientUserIds.includes(option.id)} onChange={() => handleToggleScheduleRecipient(option.id)} />
                                    <span className="truncate">{option.email || option.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="lg:col-span-3">
                        <label className="block text-sm font-medium text-pm-dark mb-1">E-mails Manuais</label>
                        <textarea value={scheduleManualRecipients} onChange={event => setScheduleManualRecipients(event.target.value)}
                            rows={2} placeholder="email1@dominio.com, email2@dominio.com"
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none resize-none" />
                    </div>
                    <div className="lg:col-span-3">
                        <label className="block text-sm font-medium text-pm-dark mb-1">Assunto</label>
                        <input value={scheduleSubject} onChange={event => setScheduleSubject(event.target.value)}
                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none" />
                    </div>
                    <div className="lg:col-span-3">
                        <label className="block text-sm font-medium text-pm-dark mb-1">Mensagem de Abertura</label>
                        <textarea value={scheduleMessage} onChange={event => setScheduleMessage(event.target.value)}
                            rows={3} className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none resize-none" />
                    </div>
                    <label className="lg:col-span-3 flex items-center gap-2 text-sm text-pm-dark">
                        <input type="checkbox" checked={includeResponsibleSummary} onChange={event => setIncludeResponsibleSummary(event.target.checked)} />
                        Incluir resumo de setores responsáveis e nomes/e-mails dos responsáveis
                    </label>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                    <button onClick={handleSaveReportSchedule} disabled={isSavingReportSchedule}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-pm-primary text-white disabled:opacity-60 flex items-center gap-2">
                        {isSavingReportSchedule ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Agendamento
                    </button>
                    <button onClick={() => handleSendReportNow()} disabled={isSendingReportSchedule}
                        className="px-4 py-2 rounded-lg text-sm font-bold border border-pm-secondary/30 text-pm-dark disabled:opacity-60 flex items-center gap-2">
                        {isSendingReportSchedule ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar Relatório Agora
                    </button>
                </div>

                {reportSchedules.length > 0 && (
                    <div className="mt-6 border-t border-pm-secondary/10 pt-4 space-y-2">
                        {reportSchedules.map(schedule => (
                            <div key={schedule.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-pm-secondary/10 rounded-lg p-3">
                                <div>
                                    <p className="text-sm font-bold text-pm-dark">{schedule.name}</p>
                                    <p className="text-xs text-pm-secondary">
                                        {schedule.frequency === 'weekly' ? `Semanal: ${schedule.weekdays.map(day => WEEKDAYS.find(item => item.value === day)?.label).join(', ')}` : schedule.frequency === 'monthly' ? `Mensal: dia ${schedule.dayOfMonth}` : `Data: ${schedule.specificDate}`} às {schedule.sendTime} • {getScheduleRecipients(schedule).length} destinatário(s)
                                    </p>
                                </div>
                                <button onClick={() => handleSendReportNow(schedule)} disabled={isSendingReportSchedule}
                                    className="px-3 py-2 rounded-lg text-xs font-bold border border-pm-secondary/30 text-pm-dark flex items-center gap-2">
                                    <Send className="w-3.5 h-3.5" /> Enviar agora
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Setores responsáveis */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Setores Responsáveis</h3>
                <p className="text-xs text-pm-secondary mb-4">Cadastre os setores que poderão ser vinculados aos tópicos monitorados.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        value={newSectorName}
                        onChange={event => setNewSectorName(event.target.value)}
                        placeholder="Ex.: DOP, DCS, Coordenação de Saúde"
                        className="flex-1 border border-pm-secondary/30 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                    />
                    <button
                        type="button"
                        onClick={handleAddSector}
                        disabled={!newSectorName.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-pm-primary text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Cadastrar setor
                    </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {responsibleSectors.filter(sector => sector.isActive).map(sector => (
                        <span key={sector.id} className="rounded-full border border-pm-primary/15 bg-pm-primary/5 px-3 py-1 text-xs font-bold text-pm-primary">
                            {sector.name}
                        </span>
                    ))}
                    {responsibleSectors.length === 0 && (
                        <p className="text-xs italic text-pm-secondary">Nenhum setor cadastrado.</p>
                    )}
                </div>
            </div>

            {/* Regras de atualização por tópico */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-pm-secondary/20">
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Alertas de Atualização por Tópico</h3>
                <p className="text-xs text-pm-secondary mb-5">
                    Escolha um ou mais dias da semana. A cobrança se repete automaticamente e somente conta quando houver valor atualizado em uma seção ou coleção.
                </p>
                <div className="space-y-4">
                    {alertRuleDrafts.map(draft => (
                        <div key={draft.unitId} className="rounded-xl border border-pm-secondary/15 bg-pm-light/25 p-4">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <h4 className="text-sm font-black uppercase text-pm-dark">{draft.unitName}</h4>
                                <label className="inline-flex items-center gap-2 text-xs font-bold text-pm-secondary">
                                    <input
                                        type="checkbox"
                                        checked={draft.isActive}
                                        onChange={event => handleUpdateAlertDraft(draft.unitId, 'isActive', event.target.checked)}
                                        className="h-4 w-4 rounded text-pm-primary"
                                    />
                                    Monitorar tópico
                                </label>
                            </div>
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-pm-secondary mb-1">Setor responsável</label>
                                    <select
                                        value={draft.sectorId}
                                        onChange={event => handleUpdateAlertDraft(draft.unitId, 'sectorId', event.target.value)}
                                        className="w-full border border-pm-secondary/30 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-pm-primary"
                                    >
                                        <option value="">Não definido</option>
                                        {responsibleSectors.filter(sector => sector.isActive).map(sector => (
                                            <option key={sector.id} value={sector.id}>{sector.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-pm-secondary mb-1">Usuário atualizador</label>
                                    <select
                                        value={draft.updaterId}
                                        onChange={event => handleUpdateAlertDraft(draft.unitId, 'updaterId', event.target.value)}
                                        className="w-full border border-pm-secondary/30 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-pm-primary"
                                    >
                                        <option value="">Não definido</option>
                                        {updaterOptions.map(option => (
                                            <option key={option.id} value={option.id}>{option.email || option.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 block text-[10px] font-black uppercase tracking-wider text-pm-secondary mb-1">
                                        <AlertCircle className="w-3 h-3" /> Horário limite
                                    </label>
                                    <input
                                        type="time"
                                        value={draft.deadlineTime}
                                        onChange={event => handleUpdateAlertDraft(draft.unitId, 'deadlineTime', event.target.value)}
                                        className="w-full border border-pm-secondary/30 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-pm-primary"
                                    />
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="mb-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-pm-secondary">
                                    <CalendarDays className="w-3 h-3" /> Dias de atualização
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {WEEKDAYS.map(day => (
                                        <button
                                            type="button"
                                            key={day.value}
                                            onClick={() => handleToggleAlertWeekday(draft.unitId, day.value)}
                                            className={`rounded-lg border px-3 py-2 text-xs font-black transition-colors ${
                                                draft.weekdays.includes(day.value)
                                                    ? 'border-pm-primary bg-pm-primary text-white'
                                                    : 'border-pm-secondary/20 bg-white text-pm-secondary hover:border-pm-primary/40'
                                            }`}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(draft.sectorId || draft.updaterId) && (
                                <p className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-pm-secondary">
                                    {draft.sectorId && responsibleSectors.find(sector => sector.id === draft.sectorId)?.name}
                                    {draft.sectorId && draft.updaterId && <span>·</span>}
                                    {draft.updaterId && <><UserRound className="h-3 w-3" /> {updaterOptions.find(option => option.id === draft.updaterId)?.email || updaterOptions.find(option => option.id === draft.updaterId)?.name}</>}
                                </p>
                            )}
                        </div>
                    ))}
                    {alertRuleDrafts.length === 0 && (
                        <p className="py-8 text-center text-sm font-bold text-pm-secondary">Nenhum tópico geral disponível para monitoramento.</p>
                    )}
                </div>
            </div>

            <div className="flex justify-end">
                <button 
                    onClick={handleSaveGlobalNotifications}
                    disabled={isSaving}
                    className="px-5 py-2 rounded-lg text-sm font-medium bg-pm-primary text-pm-light hover:bg-pm-primary/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Salvando...' : 'Salvar configurações e alertas'}
                </button>
            </div>
        </div>
    );
}

// ─── Setup de Indicadores ─────────────────────────────────────────────────────
function TabIndicators() {
    const { units, regionalCommands, dataGroups, fields } = useAuth();
    const briefingUnits = units.filter(unit => isGeneralBriefingUnit(unit, regionalCommands));
    const briefingUnitIds = new Set(briefingUnits.map(unit => unit.id));
    const briefingGroups = dataGroups.filter(group => briefingUnitIds.has(group.unitId));
    const briefingGroupIds = new Set(briefingGroups.map(group => group.id));

    const indicatorTypes = [
        { icon: Hash, label: 'Numérico', description: 'Contagem absoluta. Ex: 42 policiais', color: 'text-blue-600 bg-blue-50' },
        { icon: Percent, label: 'Percentual', description: 'Valor em %. Ex: 87% de cumprimento', color: 'text-green-600 bg-green-50' },
        { icon: Hash, label: 'Valor', description: 'Moeda brasileira. Ex: R$ 1.250,50', color: 'text-emerald-600 bg-emerald-50' },
        { icon: Calculator, label: 'Calculado', description: 'Operações matemáticas automáticas', color: 'text-purple-600 bg-purple-50' },
        { icon: BarChart2, label: 'Tendência', description: 'Compara com o período anterior', color: 'text-amber-600 bg-amber-50' },
    ];

    const totalFields = fields.filter(f => f.isActive && briefingGroupIds.has(f.dataGroupId));
    const numericFields = totalFields.filter(f => f.type === 'number' || f.type === 'currency' || f.type === 'percentage' || f.type === 'calculated');
    const textFields = totalFields.filter(f => f.type === 'text' || f.type === 'textarea');
    const imageFields = totalFields.filter(f => f.type === 'image');

    return (
        <div className="space-y-6">
            {/* Visão Geral */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tópicos', value: briefingUnits.length, color: 'bg-pm-primary/10 text-pm-primary' },
                    { label: 'Conjuntos', value: briefingGroups.length, color: 'bg-blue-50 text-blue-600' },
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
                <h3 className="font-bold text-pm-dark border-b border-pm-secondary/10 pb-3 mb-4">Mapeamento de Campos por Tópico</h3>
                {briefingUnits.length === 0 ? (
                    <p className="text-sm text-pm-secondary italic text-center py-6">Nenhum tópico cadastrado.</p>
                ) : (
                    <div className="space-y-2">
                        {sortByTextPtBr(briefingUnits, unit => unit.name).map(unit => {
                            const unitGroups = briefingGroups.filter(g => g.unitId === unit.id);
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
