import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2, Lightbulb, X } from 'lucide-react';
import { useAuth } from '../store/AuthContext';

interface TourStep {
    targetId: string;
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right';
}

export default function GuidedTour({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    const steps: TourStep[] = [
        {
            targetId: 'nav-dashboard',
            title: 'Painel Estratégico',
            content: 'Aqui você visualiza todos os indicadores em tempo real. Os gráficos mostram tendências e batimento de metas das unidades.',
            position: 'right'
        },
        ...(user?.role === 'admin' || user?.role === 'editor' ? [{
            targetId: 'nav-admin',
            title: 'Entrada de Dados',
            content: 'Este é o coração do sistema para Editores. Aqui você imputa dados diários, anexa fotos e gerencia ocorrências.',
            position: 'right' as const
        }] : []),
        ...(user?.role === 'admin' ? [{
            targetId: 'nav-users',
            title: 'Gestão de Usuários',
            content: 'Gerencie quem tem acesso ao sistema, defina papéis (Editor, Comandante) e vincule policiais às suas respectivas unidades.',
            position: 'right' as const
        },
        {
            targetId: 'nav-settings',
            title: 'Configurações Avançadas',
            content: 'Personalize a identidade visual, configure o servidor de e-mail e defina as fórmulas dos indicadores calculados.',
            position: 'right' as const
        }] : []),
        {
            targetId: 'profile-trigger',
            title: 'Seu Perfil',
            content: 'Acesse aqui para trocar sua senha, atualizar seu e-mail e sair do sistema com segurança.',
            position: 'bottom'
        }
    ];

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        if (isOpen) {
            updateTargetRect();
            window.addEventListener('resize', () => {
                checkMobile();
                updateTargetRect();
            });
        }
        return () => window.removeEventListener('resize', updateTargetRect);
    }, [isOpen, currentStep]);

    const updateTargetRect = () => {
        const step = steps[currentStep];
        if (!step) return;
        const el = document.getElementById(step.targetId);
        if (el) {
            setTargetRect(el.getBoundingClientRect());
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    if (!isOpen) return null;

    const currentStepData = steps[currentStep];

    // Calculando posição dinâmica para evitar overflow
    const getPopoverStyles = () => {
        const POPOVER_WIDTH = isMobile ? window.innerWidth - 40 : 420;
        const SCREEN_MARGIN = 20;

        if (isMobile) {
            return {
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: `${POPOVER_WIDTH}px`,
                maxWidth: '100%'
            };
        }

        if (!targetRect) return {};

        let top = targetRect.top;
        let left = targetRect.left;

        if (currentStepData.position === 'right') {
            left = targetRect.right + 24;
            // Se ultrapassar a tela à direita, joga pra esquerda do elemento ou centraliza
            if (left + POPOVER_WIDTH > window.innerWidth - SCREEN_MARGIN) {
                left = targetRect.left - POPOVER_WIDTH - 24;
                // Se ainda assim ultrapassar pra esquerda, joga pra baixo
                if (left < SCREEN_MARGIN) {
                    left = Math.max(SCREEN_MARGIN, Math.min(targetRect.left, window.innerWidth - POPOVER_WIDTH - SCREEN_MARGIN));
                    top = targetRect.bottom + 24;
                }
            }
        } else if (currentStepData.position === 'left') {
            left = targetRect.left - POPOVER_WIDTH - 24;
            if (left < SCREEN_MARGIN) {
                left = targetRect.right + 24;
            }
        } else if (currentStepData.position === 'bottom') {
            top = targetRect.bottom + 24;
            // Centraliza o popover em relação ao target respeitando as bordas da tela
            left = targetRect.left + (targetRect.width / 2) - (POPOVER_WIDTH / 2);
            left = Math.max(SCREEN_MARGIN, Math.min(left, window.innerWidth - POPOVER_WIDTH - SCREEN_MARGIN));
        }

        return { top, left, width: `${POPOVER_WIDTH}px` };
    };

    return (
        <div className="fixed inset-0 z-[1000] pointer-events-none font-sans overflow-hidden">
            {/* Backdrop with Hole */}
            <div className="absolute inset-0 pointer-events-auto">
                {targetRect && !isMobile && (
                    <div 
                        className="absolute transition-all duration-500 pointer-events-none"
                        style={{
                            top: targetRect.top - 8,
                            left: targetRect.left - 8,
                            width: targetRect.width + 16,
                            height: targetRect.height + 16,
                            borderRadius: '16px',
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                        }}
                    />
                )}
                {/* Full backdrop for mobile */}
                {isMobile && (
                    <div className="absolute inset-0 bg-black/70" onClick={onClose} />
                )}
            </div>

            {/* Stepper Popover */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="absolute pointer-events-auto bg-white rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] p-8 border border-pm-primary/10 flex flex-col"
                    style={getPopoverStyles()}
                >
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3 text-pm-primary">
                            <div className="w-10 h-10 bg-pm-primary/10 rounded-xl flex items-center justify-center">
                                <Lightbulb className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60">Tutorial Interativo</span>
                                <span className="text-xs font-bold">Passo {currentStep + 1} de {steps.length}</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-pm-light transition-colors group">
                            <X className="w-5 h-5 text-pm-secondary group-hover:text-pm-dark" />
                        </button>
                    </div>
                        
                    <h4 className="text-2xl font-black text-pm-dark mb-3 tracking-tight">{currentStepData.title}</h4>
                    <p className="text-base text-pm-secondary leading-relaxed mb-8 font-medium">
                        {currentStepData.content}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-pm-light/50">
                        <button 
                            onClick={onClose}
                            className="text-sm font-bold text-pm-secondary hover:text-red-500 transition-colors px-2"
                        >
                            Encerrar
                        </button>
                        
                        <div className="flex items-center gap-3">
                            {currentStep > 0 && (
                                <button 
                                    onClick={() => setCurrentStep(prev => prev - 1)}
                                    className="p-3 rounded-2xl bg-pm-light text-pm-dark hover:bg-pm-secondary/20 transition-all active:scale-90"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            
                            {currentStep < steps.length - 1 ? (
                                <button 
                                    onClick={() => setCurrentStep(prev => prev + 1)}
                                    className="bg-pm-primary text-pm-light px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-2 hover:bg-pm-primary/90 transition-all shadow-lg shadow-pm-primary/20 active:scale-95"
                                >
                                    Próximo <ChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button 
                                    onClick={onClose}
                                    className="bg-green-600 text-white px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95"
                                >
                                    Concluir <CheckCircle2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Arrow (Desktop only) */}
                    {!isMobile && (
                        <div 
                            className={`absolute w-5 h-5 bg-white rotate-45 border-pm-primary/10
                                ${currentStepData.position === 'right' ? 'top-10 -left-2.5 border-l border-b shadow-[-4px_4px_10px_rgba(0,0,0,0.05)]' : ''}
                                ${currentStepData.position === 'left' ? 'top-10 -right-2.5 border-r border-t shadow-[4px_-4px_10px_rgba(0,0,0,0.05)]' : ''}
                                ${currentStepData.position === 'bottom' ? '-top-2.5 left-10 border-l border-t shadow-[-4px_-4px_10px_rgba(0,0,0,0.05)]' : ''}
                                ${currentStepData.position === 'top' ? '-bottom-2.5 left-10 border-r border-b shadow-[4px_4px_10px_rgba(0,0,0,0.05)]' : ''}
                            `}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
