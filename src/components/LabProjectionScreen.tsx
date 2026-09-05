import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tv, 
  ChevronLeft, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  ShieldCheck, 
  Clock, 
  Users, 
  UserCheck, 
  Sparkles, 
  RefreshCw, 
  Lock, 
  CheckCircle2, 
  Sun, 
  Smartphone,
  Copy,
  Check,
  Mail,
  Send,
  Share2,
  X,
  Cast,
  MessageCircle,
  ExternalLink,
  Zap,
  Monitor,
  RotateCcw,
  LogOut,
  ChevronDown,
  Plus,
  ArrowRight,
  FastForward,
  ArrowRightCircle,
  PlayCircle,
  Layers,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import { ClassPeriod } from '../types';
import { QRCodeDisplay } from './QRCodeDisplay';
import { StudentAvatar } from './StudentAvatar';
import { AppLogo } from './AppLogo';
import { getPublicTelaoUrl, getPublicStudentCheckinUrl } from '../utils/publicUrl';

interface LabProjectionScreenProps {
  onExitAndClose?: () => void;
  onBackToDashboard?: () => void;
  isStandalonePortal?: boolean;
}

// Helper to extract parameters from window.location.search or window.location.hash
const getProjectionParam = (key: string): string => {
  if (typeof window === 'undefined') return '';
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get(key)) return searchParams.get(key) || '';
  if (window.location.hash) {
    const qIndex = window.location.hash.indexOf('?');
    if (qIndex !== -1) {
      const hashParams = new URLSearchParams(window.location.hash.substring(qIndex + 1));
      if (hashParams.get(key)) return hashParams.get(key) || '';
    }
  }
  return '';
};

export const LabProjectionScreen: React.FC<LabProjectionScreenProps> = ({
  onExitAndClose,
  onBackToDashboard,
  isStandalonePortal = false,
}) => {
  const { 
    activeSession,
    sessions, 
    classes, 
    selectedClassId, 
    setSelectedClassId,
    students, 
    soundEnabled, 
    setSoundEnabled,
    dynamicToken,
    dynamicSecondsLeft,
    appSettings,
    toggleLiveSession,
    startNewSession,
    lockCurrentSession,
    reopenCurrentSession,
    lockPeriod1,
    lockPeriod2,
    setActivePeriod,
    transitionToPeriod,
    playBeep,
    activeProfessor,
    logoutProfessor
  } = useLab();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [millisecondCounter, setMillisecondCounter] = useState('00');
  const [copiedTvLink, setCopiedTvLink] = useState(false);
  const [copiedStudentLink, setCopiedStudentLink] = useState(false);
  const [copiedTvEmailText, setCopiedTvEmailText] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isConfirmLockOpen, setIsConfirmLockOpen] = useState(false);
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'email' | 'whatsapp' | 'chromecast'>('email');
  const [tvEmailRecipient, setTvEmailRecipient] = useState(activeProfessor?.email || '');
  const [latestCheckedInIds, setLatestCheckedInIds] = useState<string[]>([]);
  const [lastCheckedStudentName, setLastCheckedStudentName] = useState<string | null>(null);

  // Auto-advance configuration & state
  const [autoAdvanceOnClose, setAutoAdvanceOnClose] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('bmf4_telao_auto_advance');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [selectedNextStageOverride, setSelectedNextStageOverride] = useState<ClassPeriod | 'next_class' | null>(null);
  const [transitionToast, setTransitionToast] = useState<{ title: string; message: string; badge?: string } | null>(null);

  const prevPresentIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialMountRef = React.useRef(true);
  const hasAutoStartedRef = React.useRef(false);

  // Read URL params on mount
  const urlTurma = getProjectionParam('turma') || getProjectionParam('turmaid') || getProjectionParam('classId');
  const urlPeriod = getProjectionParam('period') || getProjectionParam('etapa');

  // Sync class from URL if present
  useEffect(() => {
    if (urlTurma) {
      const found = classes.find(c => 
        c.id === urlTurma || 
        c.name.trim().toLowerCase() === urlTurma.trim().toLowerCase() ||
        (c.code && c.code.trim().toLowerCase() === urlTurma.trim().toLowerCase())
      );
      if (found && found.id !== selectedClassId) {
        setSelectedClassId(found.id);
      }
    }
  }, [urlTurma, classes, selectedClassId, setSelectedClassId]);

  // Safe fallback for effective class so it always displays correctly on new devices/TVs
  const effectiveClassId = (urlTurma && classes.some(c => c.id === urlTurma || c.name.toLowerCase() === urlTurma.toLowerCase()))
    ? (classes.find(c => c.id === urlTurma || c.name.toLowerCase() === urlTurma.toLowerCase())?.id || urlTurma)
    : (activeSession?.classGroupId || selectedClassId || classes[0]?.id || 'class-bmf4-default');

  // Find effective session for this specific class
  const effectiveSession = useMemo(() => {
    if (activeSession && activeSession.classGroupId === effectiveClassId) {
      return activeSession;
    }
    const classSessions = sessions.filter(s => s.classGroupId === effectiveClassId);
    const live = classSessions.find(s => s.isLive && !s.isLocked);
    if (live) return live;
    const todayStr = new Date().toISOString().split('T')[0];
    const today = classSessions.find(s => s.date === todayStr);
    if (today) return today;
    return classSessions[0] || activeSession || null;
  }, [activeSession, sessions, effectiveClassId]);

  const selectedClass = useMemo(() => {
    const found = classes.find(c => 
      c.id === effectiveClassId || 
      (c.name && c.name.trim().toLowerCase() === effectiveClassId.trim().toLowerCase())
    );
    if (found) return found;
    return {
      id: effectiveClassId,
      name: 'Turma BMF4 (Medicina)',
      code: 'MED-BMF4',
      discipline: 'BMF4 - Bases Morfofuncionais 4',
      course: 'Medicina' as const,
      semester: '4º Semestre 2026',
      laboratoryRoom: 'Laboratório de Anatomia',
      schedule: '07:30 - 12:00',
      color: '#0284c7',
      totalStudents: 0,
      professorId: activeProfessor?.id || 'prof-admin-1',
      professorName: activeProfessor?.name || 'Prof. Dr. Juliano Pereira'
    };
  }, [classes, effectiveClassId, activeProfessor]);

  const classStudents = useMemo(() => {
    return students
      .filter(s => s.classGroupId === effectiveClassId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [students, effectiveClassId]);

  // Check if projection is explicitly locked or active
  const isLocked = Boolean(effectiveSession && effectiveSession.isLocked);
  
  // Projection is live strictly if the session is live and not locked
  const isLive = Boolean(effectiveSession && effectiveSession.isLive && !effectiveSession.isLocked);

  // Auto-initialize active live session on standalone projection mount ONLY if absolutely no session exists for this class
  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;

    const hasAnySessionForClass = sessions.some(s => s.classGroupId === effectiveClassId);
    if (!effectiveSession && !hasAnySessionForClass && effectiveClassId && isStandalonePortal) {
      startNewSession({
        classGroupId: effectiveClassId,
        topic: 'Aula BMF4 - Morfofuncional',
        activityCategory: 'pratica',
        activityType: 'aula_pratica',
        activePeriod: (urlPeriod as ClassPeriod) || 'p1_start'
      });
    }
  }, [effectiveSession, effectiveClassId, isStandalonePortal, sessions, startNewSession, urlPeriod]);

  const rotationInterval = appSettings.tokenRotationSeconds || 10;

  // Real-time clock with milliseconds
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setMillisecondCounter(String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0'));
    };
    updateTime();
    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, []);

  // Filter present students in real-time (includes all recorded check-ins)
  const presentStudents = useMemo(() => {
    if (!effectiveSession?.attendance) return [];

    const presentRecords = Object.entries(effectiveSession.attendance).filter(([_, rec]: [string, any]) => {
      return rec && (rec.status === 'present' || rec.status === 'late');
    });

    return presentRecords.map(([stId, rec]: [string, any]) => {
      const foundStudent = students.find(s => s.id === stId || (rec.studentRa && s.registrationNumber === rec.studentRa));
      if (foundStudent) return foundStudent;
      return {
        id: stId,
        name: rec.studentName || `Aluno ${rec.studentRa || stId}`,
        registrationNumber: rec.studentRa || stId,
        classGroupId: effectiveClassId,
        email: '',
        attendanceStats: { totalClasses: 0, attended: 0, percentage: 100, consecutiveAbsences: 0, riskLevel: 'low' as const }
      };
    }).sort((a, b) => {
      const timeA = (effectiveSession.attendance as any)?.[a.id]?.timestamp || (effectiveSession.attendance as any)?.[a.id]?.p1StartTimestamp || '00:00';
      const timeB = (effectiveSession.attendance as any)?.[b.id]?.timestamp || (effectiveSession.attendance as any)?.[b.id]?.p1StartTimestamp || '00:00';
      return timeB.localeCompare(timeA);
    });
  }, [effectiveSession, students, effectiveClassId]);

  const totalStudents = Math.max(classStudents.length, presentStudents.length);
  const presentCount = presentStudents.length;
  const presencePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Live Sound BEEP & Visual Notification on New Student Check-in
  useEffect(() => {
    const currentIds = new Set(presentStudents.map(s => s.id));

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevPresentIdsRef.current = currentIds;
      return;
    }

    const newlyAdded = presentStudents.filter(s => !prevPresentIdsRef.current.has(s.id));
    if (newlyAdded.length > 0) {
      // 1. Play auditory confirmation beep chime
      playBeep('success');

      // 2. Highlight new attendees with animated glow & banner
      const newIds = newlyAdded.map(s => s.id);
      setLatestCheckedInIds(prev => [...new Set([...prev, ...newIds])]);
      setLastCheckedStudentName(newlyAdded[0]?.name || null);

      setTimeout(() => {
        setLatestCheckedInIds(prev => prev.filter(id => !newIds.includes(id)));
      }, 5000);

      setTimeout(() => {
        setLastCheckedStudentName(null);
      }, 4000);
    }

    prevPresentIdsRef.current = currentIds;
  }, [presentStudents, playBeep]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const currentPeriod: ClassPeriod = (effectiveSession?.activePeriod || activeSession?.activePeriod || 'p1_start') as ClassPeriod;

  // Responsive screen width state for perfectly proportioned QR code across mobile and desktop/TV screens
  const [screenWidth, setScreenWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Adaptive QR Code size: 140px on mobile for optimal visual proportion and handheld scanning, 210px on tablet, 290px on projector/TV
  const qrCodeSize = useMemo(() => {
    if (screenWidth < 640) return 140;
    if (screenWidth < 1024) return 210;
    return 290;
  }, [screenWidth]);

  const dynamicCheckinUrl = getPublicStudentCheckinUrl(
    dynamicToken || 'AUTO', 
    effectiveClassId, 
    'checkin',
    currentPeriod,
    effectiveSession?.id
  );
  // Universal link for students (adapts dynamically to whichever period is currently active)
  const dynamicStudentUniversalUrl = getPublicStudentCheckinUrl(
    dynamicToken || 'AUTO',
    effectiveClassId,
    'checkin',
    undefined,
    effectiveSession?.id
  );
  const tvScreenUrl = getPublicTelaoUrl(effectiveClassId);
  const tvScreenAlternativeUrl = tvScreenUrl;

  // Stage names map
  const stageLabels: Record<string, string> = {
    'p1_start': '1ª Aula',
    'p1_end': '1ª Aula',
    'p2_start': '2ª Aula',
    'p2_end': '2ª Aula',
    '1': '1ª Aula',
    '2': '2ª Aula',
    'both': 'Chamada Integral',
    'activity_single': 'Chamada Integral (Atividade Prática)'
  };

  // Rich stage configurations for high-contrast, crystal-clear projection
  const stageConfig: Record<string, { label: string; shortLabel: string; badgeColor: string; bgSoft: string; border: string; desc: string }> = {
    'p1_start': {
      label: '1ª Aula',
      shortLabel: '1ª Aula',
      badgeColor: 'bg-emerald-600 text-white',
      bgSoft: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      border: 'border-emerald-500',
      desc: 'Registro de presença para a primeira aula',
    },
    'p1_end': {
      label: '1ª Aula',
      shortLabel: '1ª Aula',
      badgeColor: 'bg-emerald-600 text-white',
      bgSoft: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      border: 'border-emerald-500',
      desc: 'Registro de presença para a primeira aula',
    },
    'p2_start': {
      label: '2ª Aula',
      shortLabel: '2ª Aula',
      badgeColor: 'bg-sky-600 text-white',
      bgSoft: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      border: 'border-sky-500',
      desc: 'Registro de presença para a segunda aula',
    },
    'p2_end': {
      label: '2ª Aula',
      shortLabel: '2ª Aula',
      badgeColor: 'bg-sky-600 text-white',
      bgSoft: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      border: 'border-sky-500',
      desc: 'Registro de presença para a segunda aula',
    },
    '1': {
      label: '1ª Aula',
      shortLabel: '1ª Aula',
      badgeColor: 'bg-emerald-600 text-white',
      bgSoft: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      border: 'border-emerald-500',
      desc: 'Registro de presença para a primeira aula',
    },
    '2': {
      label: '2ª Aula',
      shortLabel: '2ª Aula',
      badgeColor: 'bg-sky-600 text-white',
      bgSoft: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      border: 'border-sky-500',
      desc: 'Registro de presença para a segunda aula',
    },
    'both': {
      label: 'Chamada Integral (1ª e 2ª Aulas)',
      shortLabel: 'Chamada Integral',
      badgeColor: 'bg-amber-500 text-slate-950 font-bold',
      bgSoft: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      border: 'border-amber-500',
      desc: 'Presença integral para ambas as aulas',
    },
    'activity_single': {
      label: 'Chamada Integral (Atividade Prática)',
      shortLabel: 'Chamada Integral',
      badgeColor: 'bg-teal-600 text-white',
      bgSoft: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      border: 'border-teal-500',
      desc: 'Chamada de atividade prática individual/grupo',
    }
  };

  const currentStageName = stageLabels[currentPeriod] || '1ª Aula';
  const currentStageInfo = stageConfig[currentPeriod] || {
    label: currentStageName,
    shortLabel: currentStageName,
    badgeColor: 'bg-teal-600 text-white',
    bgSoft: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    border: 'border-teal-500',
    desc: 'Chamada ativa em tempo real',
  };

  // Determine the next sequential stage or class in order
  const nextStage = useMemo(() => {
    switch (currentPeriod) {
      case 'p1_start':
      case 'p1_end':
      case '1':
        return {
          period: '2' as ClassPeriod,
          name: '2ª Aula',
          fullName: '2ª Aula',
          actionName: 'Avançar para 2ª Aula',
          type: 'period' as const,
          classId: effectiveClassId,
          badgeColor: 'bg-sky-600 text-white',
        };
      case 'p2_start':
      case 'p2_end':
      case '2':
      case 'both':
      case 'activity_single':
      default: {
        const currentIdx = classes.findIndex(c => c.id === effectiveClassId);
        if (currentIdx !== -1 && currentIdx < classes.length - 1) {
          const nextClass = classes[currentIdx + 1];
          return {
            period: 'p1_start' as ClassPeriod,
            name: nextClass.name,
            fullName: `Próxima Turma: ${nextClass.name}`,
            actionName: `Avançar para ${nextClass.name}`,
            type: 'class' as const,
            classId: nextClass.id,
            badgeColor: 'bg-emerald-600 text-white',
          };
        }
        return {
          period: 'p1_start' as ClassPeriod,
          name: 'Nova Aula',
          fullName: 'Nova Aula (Reiniciar Bloco)',
          actionName: 'Iniciar Nova Aula',
          type: 'new_session' as const,
          classId: effectiveClassId,
          badgeColor: 'bg-teal-600 text-white',
        };
      }
    }
  }, [currentPeriod, effectiveClassId, classes]);

  // Handler to close current stage and automatically transition to the next selected stage
  const handleCloseAndAdvanceToNextStage = (targetPeriodOverride?: ClassPeriod, targetClassOverride?: string) => {
    const targetPeriod = targetPeriodOverride || nextStage.period;
    const targetClassId = targetClassOverride || nextStage.classId;
    const isNextClass = (nextStage.type === 'class' && targetClassId !== effectiveClassId) || (targetClassOverride && targetClassOverride !== effectiveClassId);
    const isNewSession = nextStage.type === 'new_session';

    if (isNextClass) {
      lockCurrentSession(effectiveSession?.id, effectiveClassId);
      setSelectedClassId(targetClassId);
      startNewSession({
        classGroupId: targetClassId,
        topic: 'Aula BMF4 - Morfofuncional',
        activityCategory: 'pratica',
        activityType: 'aula_pratica',
        activePeriod: '1',
      });
      const targetClassName = classes.find(c => c.id === targetClassId)?.name || 'Nova Turma';
      setTransitionToast({
        title: 'Turma Concluída e Nova Chamada Aberta!',
        message: `A chamada da turma anterior foi encerrada. O Telão abriu automaticamente a chamada de: ${targetClassName}`,
        badge: 'Nova Turma',
      });
    } else if (isNewSession) {
      lockCurrentSession(effectiveSession?.id, effectiveClassId);
      startNewSession({
        classGroupId: effectiveClassId,
        topic: 'Aula BMF4 - Morfofuncional',
        activityCategory: 'pratica',
        activityType: 'aula_pratica',
        activePeriod: '1',
      });
      setTransitionToast({
        title: 'Nova Aula Iniciada!',
        message: `A chamada anterior foi encerrada. QR Code atualizado para uma nova aula da ${selectedClass?.name || 'Turma BMF4'}.`,
        badge: 'Nova Aula',
      });
    } else {
      transitionToPeriod(currentPeriod, targetPeriod, effectiveSession?.id);
      const nextInfo = stageConfig[targetPeriod] || { shortLabel: targetPeriod, label: targetPeriod };
      setTransitionToast({
        title: 'Etapa Anterior Encerrada com Sucesso!',
        message: `O Telão avançou automaticamente. Exibindo agora o QR Code da: ${nextInfo.label || nextInfo.shortLabel}.`,
        badge: nextInfo.shortLabel,
      });
    }

    playBeep('session_start');
    setTimeout(() => {
      setTransitionToast(null);
    }, 5000);

    setIsConfirmLockOpen(false);
  };

  // TV Screen Sharing via Email
  const tvEmailSubjectText = `[BMF4 Medicina] Link do Telão da Chamada (TV / Projetor) - Turma ${selectedClass?.name || 'BMF4'}`;
  
  const tvEmailBodyText = `Prezado(a) Professor(a) / Suporte do Laboratório,\n\nSegue o link direto para abrir a Projeção do QR Code em Telão (Smart TV / Projetor / PC da Sala) de BMF4 Medicina:\n\n📺 LINK DIRETO DO TELÃO (Abre em tela cheia no navegador sem login):\n${tvScreenUrl}\n\n📱 LINK DO ALUNO (Adapta-se dinamicamente a todas as aulas):\n${dynamicStudentUniversalUrl}\n\nTurma: ${selectedClass?.name || 'BMF4'}\nDisciplina: ${activeSession?.topic || selectedClass?.discipline || 'Bases Morfofuncionais 4'}\nEtapa: ${currentStageName}\nData: ${activeSession?.date || new Date().toLocaleDateString('pt-BR')}\nDocente: ${activeSession?.professorName || activeProfessor?.name || 'Docente'}\n\n💡 Formas de abrir na TV pelo navegador:\n1. Acesse o link acima no navegador do computador conectado ao projetor ou na Smart TV.\n2. Não é necessário fazer login de professor na TV.\n3. Ou no Google Chrome do notebook/celular, clique no menu (3 pontinhos) > Transmitir (Cast) e selecione a TV da sala.\n\nUniversidade Nove de Julho - Medicina.`;

  const handleSendTvLinkByEmail = () => {
    const targetEmail = tvEmailRecipient.trim() || activeProfessor?.email || '';
    const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(tvEmailSubjectText)}&body=${encodeURIComponent(tvEmailBodyText)}`;
    window.location.href = mailtoUrl;
  };

  const handleCopyTvEmailMessage = () => {
    navigator.clipboard.writeText(tvEmailBodyText).then(() => {
      setCopiedTvEmailText(true);
      playBeep('success');
      setTimeout(() => setCopiedTvEmailText(false), 2500);
    });
  };

  const handleCopyTvLink = () => {
    navigator.clipboard.writeText(tvScreenUrl).then(() => {
      setCopiedTvLink(true);
      playBeep('success');
      setTimeout(() => setCopiedTvLink(false), 2500);
    });
  };

  const handleCopyStudentLink = () => {
    navigator.clipboard.writeText(dynamicStudentUniversalUrl).then(() => {
      setCopiedStudentLink(true);
      playBeep('success');
      setTimeout(() => setCopiedStudentLink(false), 2500);
    });
  };

  const handleShareTvWhatsApp = () => {
    const message = `📺 *Telão BMF4 Medicina - Projeção de Chamada*\n\nTurma: *${selectedClass?.name || 'BMF4'}*\nDisciplina: *${activeSession?.topic || selectedClass?.discipline || 'Bases Morfofuncionais 4'}*\n\n🔗 *Link Direto para Smart TV / Projetor / Chromecast:*\n${tvScreenUrl}\n\n📱 *Link Público do Aluno (Registro Direto sem Login):*\n${dynamicStudentUniversalUrl}\n\n_Ao abrir o link do aluno, a presença é registrada diretamente no portal seguro._`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Google Cast / Chromecast Launch Handler
  const handleStartCast = () => {
    try {
      if ('presentation' in navigator && (navigator as any).presentation?.defaultRequest) {
        (navigator as any).presentation.defaultRequest.start().catch(() => {});
      } else {
        alert('Para transmitir via Chromecast no Google Chrome:\n\n1. No menu do Chrome (canto superior direito com 3 pontos), clique em "Transmitir..." (Cast).\n2. Selecione o Chromecast, Android TV ou Smart TV da sua sala.\n3. O QR Code será projetado em tempo real na tela grande.');
      }
    } catch {
      alert('Utilize o menu do navegador Google Chrome > Transmitir (Cast) para conectar ao Chromecast da sala.');
    }
  };

  const handleOpenLockModal = () => {
    setSelectedNextStageOverride(null);
    setIsConfirmLockOpen(true);
  };

  const handleConfirmLockSession = () => {
    lockCurrentSession(effectiveSession?.id, effectiveClassId);
    setIsConfirmLockOpen(false);
    playBeep('alert');
  };

  const handleExitAndClose = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    playBeep('click');
    logoutProfessor();
    if (onExitAndClose) {
      onExitAndClose();
    } else if (onBackToDashboard) {
      onBackToDashboard();
    }
    try {
      window.close();
    } catch {
      // Ignored if window cannot be closed by script
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-y-auto overflow-x-hidden select-none font-sans">
      
      {/* Top Header of Projection Screen - Minimalist, Responsive & Sleek */}
      <header className="px-3 sm:px-6 md:px-8 py-1.5 sm:py-3.5 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur sticky top-0 z-20 shadow-md w-full shrink-0">
        {/* Row 1: Left (Sair), Center/Left (Turma + Info), Right (Actions/Utilities) */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
          {/* Left: Sair button & Turma Selector */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-initial">
            <button
              id="btn-telao-sair-fechar"
              onClick={handleExitAndClose}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-700/80 text-slate-300 text-xs font-bold transition-all border border-slate-700 shadow-xs shrink-0 cursor-pointer active:scale-95"
              title="Sair da projeção e fechar tela"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="hidden sm:inline">Sair e Fechar</span>
              <span className="sm:hidden">Sair</span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 relative">
                {/* Class Dropdown Selector */}
                <div className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                    className="flex items-center gap-1 sm:gap-1.5 text-sm sm:text-base md:text-lg font-black text-white tracking-tight hover:text-teal-300 transition-colors cursor-pointer max-w-full"
                    title="Clique para alternar a turma projetada"
                  >
                    <span className="truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-[280px]">
                      {selectedClass?.name || 'Turma BMF4'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
                  </button>

                  {isClassDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95">
                      <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                        Selecionar Turma
                      </div>
                      {classes.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClassId(c.id);
                            setIsClassDropdownOpen(false);
                            playBeep('click');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            c.id === effectiveClassId 
                              ? 'bg-teal-600 text-white shadow-sm' 
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          {c.id === effectiveClassId && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <span className="hidden lg:inline-flex px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  {currentStageName}
                </span>
              </div>
              <p className="hidden md:flex text-xs text-slate-400 truncate items-center flex-wrap gap-1.5">
                <span>{effectiveSession?.topic || 'Bases Morfofuncionais 4'} • Prof. {effectiveSession?.professorName || selectedClass?.professorName || 'Docente'}</span>
                {effectiveSession?.activityCategory === 'pratica' && effectiveSession.labLocation && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    effectiveSession.labLocation === 'anatomia' 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}>
                    {effectiveSession.labLocation === 'anatomia' ? '🫀 Lab. Anatomia' : '🔬 Lab. Histologia'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Desktop Right Controls: Email, Actions, Clock, Sound, Fullscreen */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Email Link to PC/TV Button */}
            <button
              type="button"
              id="btn-telao-quick-email"
              onClick={() => {
                setModalTab('email');
                setIsShareModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
              title="Enviar link para abrir no PC / Projetor / TV por E-mail"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar Link por E-mail</span>
            </button>

            {/* Quick Advance & Lock Controls */}
            {!isLocked ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  id="btn-telao-avancar-proxima-aula"
                  type="button"
                  onClick={() => handleCloseAndAdvanceToNextStage()}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  title={`Encerrar esta etapa e avançar automaticamente para: ${nextStage.fullName}`}
                >
                  <FastForward className="w-3.5 h-3.5 text-teal-200" />
                  <span>{nextStage.actionName}</span>
                </button>

                <button
                  id="btn-telao-encerrar-chamada"
                  type="button"
                  onClick={handleOpenLockModal}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  title="Encerrar chamada e escolher opções de avanço"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Encerrar</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  id="btn-telao-reabrir-chamada"
                  onClick={() => {
                    reopenCurrentSession(effectiveSession?.id, effectiveClassId);
                    playBeep('session_start');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  title="Reabrir chamada encerrada"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reabrir Chamada</span>
                </button>

                <button
                  id="btn-telao-avancar-locked"
                  type="button"
                  onClick={() => handleCloseAndAdvanceToNextStage()}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  title={`Iniciar diretamente: ${nextStage.fullName}`}
                >
                  <FastForward className="w-3.5 h-3.5 text-teal-200" />
                  <span>{nextStage.actionName}</span>
                </button>

                <button
                  id="btn-telao-nova-aula-header"
                  onClick={() => {
                    startNewSession({
                      classGroupId: effectiveClassId,
                      topic: 'Aula BMF4 - Morfofuncional',
                      activityCategory: 'pratica',
                      activityType: 'aula_pratica',
                      activePeriod: '1'
                    });
                    playBeep('session_start');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  title="Iniciar uma nova aula para esta turma"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-400" />
                  <span>Nova Aula</span>
                </button>
              </div>
            )}

            {/* Real-time Digital Clock */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs font-mono font-bold text-teal-300 shrink-0">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>{currentTime}</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer shrink-0"
              title={soundEnabled ? 'Sinal sonoro ativado (Bip na presença)' : 'Silencioso'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer shrink-0"
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Mobile Right Utilities (Sound + Fullscreen on Row 1) */}
          <div className="md:hidden flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
              title={soundEnabled ? 'Sinal sonoro ativado' : 'Silencioso'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-teal-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Mobile Row 2: Action Buttons - Ultra-compact, Distinct, No Overlap! */}
        <div className="md:hidden flex items-center gap-1.5 w-full justify-between pt-1.5 mt-1 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            type="button"
            id="btn-telao-quick-email-mobile"
            onClick={() => {
              setModalTab('email');
              setIsShareModalOpen(true);
            }}
            className="px-2 py-1 bg-indigo-600 active:bg-indigo-500 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
            title="Enviar link para abrir no PC / Projetor / TV por E-mail"
          >
            <Mail className="w-3 h-3" />
            <span>E-mail</span>
          </button>

          {!isLocked ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="btn-telao-avancar-proxima-aula-mobile"
                type="button"
                onClick={() => handleCloseAndAdvanceToNextStage()}
                className="px-2 py-1 rounded-lg bg-teal-600 active:bg-teal-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
                title={`Encerrar esta etapa e avançar automaticamente para: ${nextStage.fullName}`}
              >
                <FastForward className="w-3 h-3 text-teal-200" />
                <span>{nextStage.actionName}</span>
              </button>

              <button
                id="btn-telao-encerrar-chamada-mobile"
                type="button"
                onClick={handleOpenLockModal}
                className="px-2 py-1 rounded-lg bg-rose-600 active:bg-rose-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
                title="Encerrar chamada"
              >
                <Lock className="w-3 h-3" />
                <span>Encerrar</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="btn-telao-reabrir-chamada-mobile"
                onClick={() => {
                  reopenCurrentSession(effectiveSession?.id, effectiveClassId);
                  playBeep('session_start');
                }}
                className="px-2 py-1 rounded-lg bg-emerald-600 active:bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
                title="Reabrir chamada encerrada"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reabrir</span>
              </button>

              <button
                id="btn-telao-avancar-locked-mobile"
                type="button"
                onClick={() => handleCloseAndAdvanceToNextStage()}
                className="px-2 py-1 rounded-lg bg-teal-600 active:bg-teal-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
                title={`Iniciar diretamente: ${nextStage.fullName}`}
              >
                <FastForward className="w-3 h-3 text-teal-200" />
                <span>Próxima</span>
              </button>

              <button
                id="btn-telao-nova-aula-header-mobile"
                onClick={() => {
                  startNewSession({
                    classGroupId: effectiveClassId,
                    topic: 'Aula BMF4 - Morfofuncional',
                    activityCategory: 'pratica',
                    activityType: 'aula_pratica',
                    activePeriod: 'p1_start'
                  });
                  playBeep('session_start');
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 text-teal-300 border border-teal-500/30 text-[10px] font-black flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap"
                title="Iniciar uma nova aula para esta turma"
              >
                <Plus className="w-3 h-3 text-teal-400" />
                <span>Nova</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Telão Content Body - Spacious, High Legibility, Clean, Never Cut-off */}
      <main className="flex-1 flex flex-col items-center justify-start lg:justify-center px-3 sm:px-6 md:px-8 py-2.5 sm:py-6 max-w-7xl mx-auto w-full overflow-x-hidden">
        
        {/* Floating Transition Toast Notification Banner */}
        {transitionToast && (
          <div className="w-full max-w-2xl mb-4 px-4 py-3 bg-teal-950/90 border-2 border-teal-400 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-white animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/40 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-teal-300 animate-spin" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm text-teal-200">{transitionToast.title}</h4>
                  {transitionToast.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-teal-500 text-slate-950 text-[10px] font-black uppercase">
                      {transitionToast.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 truncate">{transitionToast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTransitionToast(null)}
              className="p-1 rounded-lg hover:bg-teal-900/60 text-teal-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isLive ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
            
            {/* Left Column (7 Cols): Dynamic QR Code */}
            <div className="lg:col-span-7 flex flex-col items-center text-center space-y-2.5 sm:space-y-4 w-full">
              
              {/* Stage / Period Selector Pills in Telão */}
              <div className="flex items-center justify-start sm:justify-center gap-1.5 p-1.5 bg-slate-900/90 rounded-xl sm:rounded-2xl border border-slate-800 shadow-inner w-full max-w-full overflow-x-auto no-scrollbar sm:flex-wrap">
                <button
                  type="button"
                  id="btn-telao-period-1"
                  onClick={() => {
                    setActivePeriod('1');
                    playBeep('click');
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    currentPeriod === '1' || currentPeriod === 'p1_start' || currentPeriod === 'p1_end'
                      ? 'bg-emerald-600 text-white shadow-md scale-102 ring-1 sm:ring-2 ring-emerald-400/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="1ª Aula - Chamada da primeira aula"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                  <span>1ª Aula</span>
                </button>

                <button
                  type="button"
                  id="btn-telao-period-2"
                  onClick={() => {
                    setActivePeriod('2');
                    playBeep('click');
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    currentPeriod === '2' || currentPeriod === 'p2_start' || currentPeriod === 'p2_end'
                      ? 'bg-sky-600 text-white shadow-md scale-102 ring-1 sm:ring-2 ring-sky-400/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="2ª Aula - Chamada da segunda aula"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-300"></span>
                  <span>2ª Aula</span>
                </button>

                <button
                  type="button"
                  id="btn-telao-period-both"
                  onClick={() => {
                    setActivePeriod('both');
                    playBeep('click');
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    currentPeriod === 'both'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md scale-102 ring-1 sm:ring-2 ring-amber-300'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Chamada Integral (1ª e 2ª Aulas)"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <span>Chamada Integral</span>
                </button>
              </div>

              {/* QR Code Container with Crisp Contrast and Balanced Dimensions */}
              <div className="relative w-full max-w-[215px] xs:max-w-[230px] sm:max-w-[280px] md:max-w-[320px] lg:max-w-[380px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border-2 sm:border-4 border-teal-500/90 flex flex-col items-center justify-center overflow-hidden mx-auto">
                
                {/* Header of the QR Card: Corresponding Lesson Banner */}
                <div className="w-full bg-slate-900 px-2 sm:px-4 py-1.5 sm:py-3 border-b-2 border-teal-500/60 text-center space-y-0.5">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-wider shadow-sm ${currentStageInfo.badgeColor}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>{currentStageInfo.label}</span>
                    </span>
                  </div>

                  <p className="text-[10px] sm:text-xs font-bold text-white tracking-tight truncate px-1">
                    {selectedClass?.name || 'Turma BMF4'} • <span className="text-teal-300">{effectiveSession?.topic || selectedClass?.discipline || 'BMF4'}</span>
                  </p>
                  
                  <div className="hidden sm:flex text-[9px] sm:text-[10px] text-slate-300 items-center justify-center gap-1.5">
                    <span>Data: {effectiveSession?.date ? effectiveSession.date.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR')}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">QR Code Oficial</span>
                  </div>
                </div>

                {/* QR Code Display Area - Strictly Sized Container */}
                <div className="p-1.5 sm:p-4 flex flex-col items-center justify-center w-full max-w-full">
                  <div className="w-[135px] h-[135px] sm:w-[195px] sm:h-[195px] lg:w-[275px] lg:h-[275px] flex items-center justify-center overflow-hidden">
                    <QRCodeDisplay 
                      value={dynamicCheckinUrl} 
                      size={qrCodeSize} 
                      showBorder={false}
                    />
                  </div>

                  {/* Rotating Countdown Bar & Badge */}
                  <div className="mt-1.5 sm:mt-2.5 px-2 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-slate-950 text-teal-300 border border-teal-500/40 text-[9px] sm:text-xs font-mono font-bold flex items-center gap-1 sm:gap-1.5 shadow-inner">
                    <RefreshCw className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-teal-400 animate-spin" />
                    <span>Atualiza em <strong>{dynamicSecondsLeft}s</strong></span>
                  </div>
                </div>

                {/* Bottom Footer of the QR Card: Only on tablets/desktops */}
                <div className="hidden sm:block w-full bg-slate-100 border-t border-slate-200 px-2.5 sm:px-4 py-1.5 text-center">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-700">
                    Aponte a câmera para registrar presença na <strong className="text-teal-700 font-black">{currentStageInfo.shortLabel}</strong>
                  </p>
                </div>
              </div>

              {/* Minimal Clean Projection Instructions */}
              <div className="space-y-0.5 max-w-lg text-center px-2">
                <h2 className="text-xs sm:text-lg lg:text-xl font-bold text-white tracking-tight">
                  Aponte a Câmera do Celular • <span className="text-teal-400">{currentStageInfo.shortLabel}</span>
                </h2>
                <p className="hidden sm:block text-xs text-slate-300">
                  Confirmação instantânea de presença na tela • Sem necessidade de digitação
                </p>
              </div>

            </div>

            {/* Right Column (5 Cols): Live Real-time Attendance Feed */}
            <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-slate-800 shadow-xl space-y-2 sm:space-y-4 w-full">
              
              {/* Header of Live Feed */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 sm:pb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                    Presenças Confirmadas
                  </h3>
                </div>
                <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/80">
                  {presentCount} / {totalStudents} ({presencePercentage}%)
                </span>
              </div>

              {/* Latest student alert banner */}
              {lastCheckedStudentName && (
                <div className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] sm:text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in-95 shadow-md">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Presença confirmada: {lastCheckedStudentName}</span>
                </div>
              )}

              {/* Scrollable list of attendees */}
              <div className="max-h-[180px] sm:max-h-[340px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {presentStudents.length === 0 ? (
                  <div className="py-3.5 sm:py-14 text-center text-slate-500 text-xs space-y-1 sm:space-y-2">
                    <Smartphone className="w-5 h-5 sm:w-8 sm:h-8 mx-auto text-slate-600 animate-bounce" />
                    <p className="font-semibold text-slate-400 text-[11px] sm:text-xs">Aguardando confirmações...</p>
                    <p className="hidden sm:block text-[11px] text-slate-500">Ao ler o QR Code ou clicar no link, o nome aparece aqui instantaneamente com bip sonoro.</p>
                  </div>
                ) : (
                  presentStudents.map((st) => {
                    const rec = effectiveSession?.attendance?.[st.id];
                    const isRecentlyChecked = latestCheckedInIds.includes(st.id);

                    return (
                      <div 
                        key={st.id} 
                        className={`pt-1.5 pb-1 flex items-center justify-between text-xs transition-all duration-300 ${
                          isRecentlyChecked 
                            ? 'bg-emerald-950/80 border border-emerald-500/80 p-2 rounded-xl ring-2 ring-emerald-400/40 shadow-md' 
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <StudentAvatar name={st.name} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-200 block truncate max-w-[150px] sm:max-w-[190px]">
                                {st.name}
                              </span>
                              {isRecentlyChecked && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-400 text-slate-950 uppercase animate-pulse">
                                  AGORA
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">
                              RA: {st.registrationNumber}
                            </span>
                          </div>
                        </div>

                        <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isRecentlyChecked
                            ? 'text-white bg-emerald-600 border-emerald-400'
                            : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                        }`}>
                          {rec?.timestamp || 'Presente'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>
        ) : (
          /* When session is CLOSED / LOCKED */
          <div className="text-center py-10 sm:py-16 space-y-4 sm:space-y-5 bg-slate-900/90 rounded-3xl p-5 sm:p-12 border border-slate-800 w-full max-w-lg shadow-2xl mx-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
              <Lock className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {isLocked ? 'Chamada Encerrada pelo Professor' : 'Chamada Não Iniciada'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                O QR Code de presença fica oculto quando a chamada está fechada para segurança acadêmica.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-2 w-full">
              <button
                id="btn-telao-reopen-center"
                onClick={() => {
                  if (isLocked) {
                    reopenCurrentSession(effectiveSession?.id, effectiveClassId);
                  } else {
                    toggleLiveSession();
                  }
                  playBeep('session_start');
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                {isLocked ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isLocked ? 'Reabrir Chamada Atual' : 'Abrir Chamada e Exibir QR Code'}</span>
              </button>

              <button
                id="btn-telao-avancar-locked-center"
                onClick={() => handleCloseAndAdvanceToNextStage()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <FastForward className="w-4 h-4 text-sky-200" />
                <span>{nextStage.actionName}</span>
              </button>

              <button
                id="btn-telao-nova-aula-center"
                onClick={() => {
                  startNewSession({
                    classGroupId: effectiveClassId,
                    topic: 'Aula BMF4 - Morfofuncional',
                    activityCategory: 'pratica',
                    activityType: 'aula_pratica',
                    activePeriod: '1'
                  });
                  playBeep('session_start');
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-teal-400" />
                <span>Iniciar Nova Aula / Chamada</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Confirmation Modal for Encerrar Chamada with Auto-Next Options */}
      {isConfirmLockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-inner">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Encerrar Chamada da Aula
                  </h3>
                  <p className="text-xs text-slate-400">
                    Turma: {selectedClass?.name} • <span className="text-teal-300">{currentStageInfo.label}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmLockOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">
                Deseja encerrar e bloquear a chamada agora?
              </p>
              <p className="text-slate-400 leading-relaxed">
                Ao confirmar, a chamada será bloqueada no sistema. Novos check-ins de presença nesta aula serão imediatamente interrompidos.
              </p>
            </div>

            {/* Direct Clear Actions */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                id="btn-confirm-lock-telao-yes"
                onClick={handleConfirmLockSession}
                className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black text-xs shadow-lg shadow-rose-950/50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Sim, Encerrar e Bloquear Chamada Agora</span>
              </button>

              <button
                type="button"
                onClick={() => setIsConfirmLockOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
              >
                Cancelar / Continuar Chamada Aberta
              </button>
            </div>

            {/* Optional shortcut if professor only wanted to advance */}
            <div className="pt-2 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={() => handleCloseAndAdvanceToNextStage()}
                className="text-[11px] text-teal-400 hover:text-teal-300 underline font-semibold cursor-pointer"
              >
                Ou deseja apenas ir para a próxima etapa ({nextStage.name})?
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share by Email / TV Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Link do Telão para TV / Projetor</h3>
                  <p className="text-xs text-slate-400">Turma: {selectedClass?.name} • BMF4 Medicina</p>
                </div>
              </div>

              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs: Email, WhatsApp, Chromecast */}
            <div className="grid grid-cols-3 gap-1.5 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => setModalTab('email')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  modalTab === 'email'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">E-mail</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('whatsapp')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  modalTab === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="truncate">WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('chromecast')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  modalTab === 'chromecast'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cast className="w-3.5 h-3.5" />
                <span className="truncate">Chromecast</span>
              </button>
            </div>

            {/* TAB 1: E-MAIL */}
            {modalTab === 'email' && (
              <div className="space-y-3 animate-in fade-in">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      E-mail do Docente / TV do Laboratório
                    </label>
                    {activeProfessor?.email && (
                      <button
                        type="button"
                        onClick={() => setTvEmailRecipient(activeProfessor.email)}
                        className="text-[10px] text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        Usar meu e-mail ({activeProfessor.email.split('@')[0]})
                      </button>
                    )}
                  </div>
                  <input
                    type="email"
                    value={tvEmailRecipient}
                    onChange={(e) => setTvEmailRecipient(e.target.value)}
                    placeholder="Digite seu e-mail para abrir no computador ou TV"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    O link enviado abre o telão do QR Code dinâmico em tela cheia no navegador, ideal para espelhamento em TVs.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    Prévia do Link
                  </label>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-teal-400 break-all select-all">
                    {tvScreenUrl}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendTvLinkByEmail}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar por E-mail</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTvLink}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-xl font-bold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedTvLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedTvLink ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: WHATSAPP */}
            {modalTab === 'whatsapp' && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Envie o link direto da projeção para o WhatsApp para abrir no PC conectado à TV do laboratório.
                </p>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 break-all">
                  {tvScreenUrl}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleShareTvWhatsApp}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Compartilhar no WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTvLink}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedTvLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedTvLink ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: CHROMECAST */}
            {modalTab === 'chromecast' && (
              <div className="space-y-3 animate-in fade-in">
                <div className="p-3 bg-slate-950 rounded-xl border border-sky-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                    <Cast className="w-4 h-4" />
                    <span>Transmissão Sem Fio para Smart TV / Chromecast</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Você pode projetar esta aba diretamente no Chromecast ou Smart TV da sala de aula.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleStartCast}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Cast className="w-4 h-4" />
                    <span>Iniciar Transmissão (Cast)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTvLink}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedTvLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedTvLink ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Footer of Projection Screen */}
      <footer className="px-4 sm:px-8 py-3 border-t border-slate-800/80 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>Sistema Anti-Fraude com Rotação Criptografada BMF4</span>
        </div>
        <div>
          <span>Presenças registradas sincronizadas instantaneamente.</span>
        </div>
      </footer>

    </div>
  );
};
