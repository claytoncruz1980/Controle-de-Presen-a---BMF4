import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Award, 
  Search, 
  FileSpreadsheet, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  BookOpen,
  Filter,
  CheckCircle2,
  XCircle,
  BarChart2,
  TrendingUp,
  Users,
  Activity,
  Layers,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  X,
  GraduationCap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLab } from '../context/LabContext';
import { StudentAvatar } from './StudentAvatar';
import { Student } from '../types';
import { exportModernGradesExcel } from '../utils/exportExcel';

// Interface para um ciclo de avaliação (Teórica + Prática Anatomia + Prática Histologia + Média)
export interface GradeCycle {
  cycleNumber: number;
  label: string;
  name: string;
  teorica: { id: string; keyAlt: string; label: string; title: string };
  anatomia: { id: string; keyAlt: string; label: string; title: string };
  histologia: { id: string; keyAlt: string; label: string; title: string };
}

// 5 Ciclos Estruturados conforme solicitado:
// Atividade Teórica N + Atividade Prática Anatomia N + Histologia N + Média N
export const GRADE_CYCLES: GradeCycle[] = [
  {
    cycleNumber: 1,
    label: 'Ciclo 1',
    name: 'Atividades do Ciclo 1',
    teorica: { id: 'AT1', keyAlt: 't1', label: 'AT1', title: 'Atividade Teórica 1' },
    anatomia: { id: 'APA1', keyAlt: 'a1', label: 'APA1', title: 'Atividade Prática Anatomia 1' },
    histologia: { id: 'APH1', keyAlt: 'h1', label: 'APH1', title: 'Atividade Prática Histologia 1' },
  },
  {
    cycleNumber: 2,
    label: 'Ciclo 2',
    name: 'Atividades do Ciclo 2',
    teorica: { id: 'AT2', keyAlt: 't2', label: 'AT2', title: 'Atividade Teórica 2' },
    anatomia: { id: 'APA2', keyAlt: 'a2', label: 'APA2', title: 'Atividade Prática Anatomia 2' },
    histologia: { id: 'APH2', keyAlt: 'h2', label: 'APH2', title: 'Atividade Prática Histologia 2' },
  },
  {
    cycleNumber: 3,
    label: 'Ciclo 3',
    name: 'Atividades do Ciclo 3',
    teorica: { id: 'AT3', keyAlt: 't3', label: 'AT3', title: 'Atividade Teórica 3' },
    anatomia: { id: 'APA3', keyAlt: 'a3', label: 'APA3', title: 'Atividade Prática Anatomia 3' },
    histologia: { id: 'APH3', keyAlt: 'h3', label: 'APH3', title: 'Atividade Prática Histologia 3' },
  },
  {
    cycleNumber: 4,
    label: 'Ciclo 4',
    name: 'Atividades do Ciclo 4',
    teorica: { id: 'AT4', keyAlt: 't4', label: 'AT4', title: 'Atividade Teórica 4' },
    anatomia: { id: 'APA4', keyAlt: 'a4', label: 'APA4', title: 'Atividade Prática Anatomia 4' },
    histologia: { id: 'APH4', keyAlt: 'h4', label: 'APH4', title: 'Atividade Prática Histologia 4' },
  },
  {
    cycleNumber: 5,
    label: 'Ciclo 5',
    name: 'Atividades do Ciclo 5',
    teorica: { id: 'AT5', keyAlt: 't5', label: 'AT5', title: 'Atividade Teórica 5' },
    anatomia: { id: 'APA5', keyAlt: 'a5', label: 'APA5', title: 'Atividade Prática Anatomia 5' },
    histologia: { id: 'APH5', keyAlt: 'h5', label: 'APH5', title: 'Atividade Prática Histologia 5' },
  },
];

export type FilterViewMode = 
  | 'cycles_all'    // Todos os ciclos distribuídos: AT1, APA1, APH1, Média 1, AT2...
  | 'teoricas'      // Apenas Teóricas (AT1 a AT5 + Média Teórica)
  | 'praticas_all'  // Todas as Práticas (Anatomia + Histologia)
  | 'anatomia'      // Apenas Anatomia (APA1 a APA5 + Média Anatomia)
  | 'histologia'    // Apenas Histologia (APH1 a APH5 + Média Histologia)
  | 'cycle_1'       // Foco no Ciclo 1
  | 'cycle_2'       // Foco no Ciclo 2
  | 'cycle_3'       // Foco no Ciclo 3
  | 'cycle_4'       // Foco no Ciclo 4
  | 'cycle_5';      // Foco no Ciclo 5

export const GradesManagement: React.FC = () => {
  const { 
    classes, 
    selectedClassId, 
    setSelectedClassId,
    students, 
    activeProfessor,
    playBeep 
  } = useLab();

  // Storage key for student grades per class
  const gradesStorageKey = `bmf4_grades_${selectedClassId}`;

  // Grades State: { [studentId]: { [activityKey]: number | null } }
  const [grades, setGrades] = useState<Record<string, Record<string, number | null>>>(() => {
    try {
      const saved = localStorage.getItem(`bmf4_grades_${selectedClassId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Local raw input buffer for smooth decimal typing (supports typing "7." or "8," without dropping the dot)
  const [rawInputMap, setRawInputMap] = useState<Record<string, string>>({});

  // Reload grades whenever selectedClassId changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bmf4_grades_${selectedClassId}`);
      setGrades(saved ? JSON.parse(saved) : {});
      setRawInputMap({});
    } catch {
      setGrades({});
    }
  }, [selectedClassId]);

  const [searchTerm, setSearchTerm] = useState('');
  const [viewFilter, setViewFilter] = useState<FilterViewMode>('cycles_all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'aprovados' | 'recuperacao' | 'pendentes'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mobile quick grade modal state
  const [quickGradeStudent, setQuickGradeStudent] = useState<Student | null>(null);
  const [quickGradeActivity, setQuickGradeActivity] = useState<string>('AT1');

  // Synchronized scroll references for top and table scrollbars
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleTableScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollContainerRef.current && tableContainerRef.current) {
      topScrollContainerRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
    setTimeout(() => { isSyncingScroll.current = false; }, 20);
  };

  const handleTopScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (tableContainerRef.current && topScrollContainerRef.current) {
      tableContainerRef.current.scrollLeft = topScrollContainerRef.current.scrollLeft;
    }
    setTimeout(() => { isSyncingScroll.current = false; }, 20);
  };

  const scrollTable = (offset: number) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const scrollToCycle = (cycleNum: number) => {
    if (tableContainerRef.current) {
      const approxOffset = (cycleNum - 1) * 190;
      tableContainerRef.current.scrollTo({ left: approxOffset, behavior: 'smooth' });
    }
  };

  const selectedClass = classes.find(c => c.id === selectedClassId) || classes[0];

  // Students strictly sorted alphabetically A-Z
  const classStudents = useMemo(() => {
    return students
      .filter(s => s.classGroupId === selectedClassId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClassId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper to get grade value with backwards compatibility
  const getGradeValue = (studentId: string, actId: string, altKey?: string): number | null => {
    const studentGrades = grades[studentId] || {};
    if (studentGrades[actId] !== undefined && studentGrades[actId] !== null) {
      return studentGrades[actId];
    }
    if (altKey && studentGrades[altKey] !== undefined && studentGrades[altKey] !== null) {
      return studentGrades[altKey];
    }
    return null;
  };

  // Save grade value to state and persistent localStorage
  const saveGrade = (studentId: string, activityKey: string, numVal: number | null) => {
    setGrades(prev => {
      const studentGrades = { ...(prev[studentId] || {}) };
      if (numVal === null) {
        delete studentGrades[activityKey];
      } else {
        studentGrades[activityKey] = numVal;
      }
      const next = { ...prev, [studentId]: studentGrades };
      try {
        localStorage.setItem(gradesStorageKey, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save grades', err);
      }
      return next;
    });
  };

  // Display value for cell: uses active raw input string if editing, otherwise formatted grade
  const getDisplayValue = (studentId: string, actId: string, altKey?: string): string => {
    const cellKey = `${studentId}_${actId}`;
    if (rawInputMap[cellKey] !== undefined) {
      return rawInputMap[cellKey];
    }
    const val = getGradeValue(studentId, actId, altKey);
    return val !== null ? String(val) : '';
  };

  // Handle keystroke in cell (accepts dot and comma, numbers from 0.0 to 10.0)
  const handleRawChange = (studentId: string, actId: string, val: string) => {
    const cellKey = `${studentId}_${actId}`;
    // Replace non-numeric chars except dot and comma
    const clean = val.replace(/[^0-9.,]/g, '');
    
    // Prevent multiple dots/commas
    const dotCount = (clean.match(/[.,]/g) || []).length;
    if (dotCount > 1) return;
    if (clean.length > 4) return;

    setRawInputMap(prev => ({ ...prev, [cellKey]: clean }));

    // If completely empty, remove grade
    if (clean.trim() === '') {
      saveGrade(studentId, actId, null);
      return;
    }

    // If user is currently typing a trailing dot/comma (e.g. "7." or "8,"), keep raw text without truncating
    const normalized = clean.replace(',', '.');
    if (!normalized.endsWith('.')) {
      const num = parseFloat(normalized);
      if (!isNaN(num)) {
        const clamped = Math.min(10, Math.max(0, Math.round(num * 10) / 10));
        saveGrade(studentId, actId, clamped);
      }
    }
  };

  // Commit on blur: normalize and clear buffer
  const handleBlur = (studentId: string, actId: string) => {
    const cellKey = `${studentId}_${actId}`;
    const raw = rawInputMap[cellKey];
    if (raw !== undefined) {
      if (raw.trim() === '') {
        saveGrade(studentId, actId, null);
      } else {
        const normalized = raw.replace(',', '.');
        const num = parseFloat(normalized);
        if (!isNaN(num)) {
          const clamped = Math.min(10, Math.max(0, Math.round(num * 10) / 10));
          saveGrade(studentId, actId, clamped);
        } else {
          saveGrade(studentId, actId, null);
        }
      }
      setRawInputMap(prev => {
        const copy = { ...prev };
        delete copy[cellKey];
        return copy;
      });
    }
  };

  // Navigation via Enter / Up / Down arrow keys for high-speed grading
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    studentIdx: number, 
    activityId: string
  ) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = studentIdx + 1;
      if (nextIdx < displayedStudents.length) {
        const nextStudent = displayedStudents[nextIdx];
        const nextInput = document.getElementById(`grade-input-${nextStudent.id}-${activityId}`);
        nextInput?.focus();
        (nextInput as HTMLInputElement)?.select?.();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = studentIdx - 1;
      if (prevIdx >= 0) {
        const prevStudent = displayedStudents[prevIdx];
        const prevInput = document.getElementById(`grade-input-${prevStudent.id}-${activityId}`);
        prevInput?.focus();
        (prevInput as HTMLInputElement)?.select?.();
      }
    }
  };

  // 1. Média de um Ciclo Específico (Teórica + Prática Anatomia + Histologia)
  const getCycleAverage = (studentId: string, cycle: GradeCycle): number | null => {
    const vTeo = getGradeValue(studentId, cycle.teorica.id, cycle.teorica.keyAlt);
    const vAnat = getGradeValue(studentId, cycle.anatomia.id, cycle.anatomia.keyAlt);
    const vHist = getGradeValue(studentId, cycle.histologia.id, cycle.histologia.keyAlt);

    const values = [vTeo, vAnat, vHist].filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  };

  // 2. Média de Práticas de um Ciclo (Anatomia + Histologia)
  const getCyclePracticalAverage = (studentId: string, cycle: GradeCycle): number | null => {
    const vAnat = getGradeValue(studentId, cycle.anatomia.id, cycle.anatomia.keyAlt);
    const vHist = getGradeValue(studentId, cycle.histologia.id, cycle.histologia.keyAlt);

    const values = [vAnat, vHist].filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  };

  // 3. Média Geral Teórica (AT1 a AT5)
  const getTeoricaAverage = (studentId: string): number | null => {
    const vals = GRADE_CYCLES.map(c => getGradeValue(studentId, c.teorica.id, c.teorica.keyAlt)).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  // 4. Média Geral Anatomia (APA1 a APA5)
  const getAnatomiaAverage = (studentId: string): number | null => {
    const vals = GRADE_CYCLES.map(c => getGradeValue(studentId, c.anatomia.id, c.anatomia.keyAlt)).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  // 5. Média Geral Histologia (APH1 a APH5)
  const getHistologiaAverage = (studentId: string): number | null => {
    const vals = GRADE_CYCLES.map(c => getGradeValue(studentId, c.histologia.id, c.histologia.keyAlt)).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  // 6. Média Geral de Práticas (Anatomia + Histologia)
  const getAllPracticalsAverage = (studentId: string): number | null => {
    const anatVals = GRADE_CYCLES.map(c => getGradeValue(studentId, c.anatomia.id, c.anatomia.keyAlt)).filter((v): v is number => v !== null);
    const histVals = GRADE_CYCLES.map(c => getGradeValue(studentId, c.histologia.id, c.histologia.keyAlt)).filter((v): v is number => v !== null);
    const all = [...anatVals, ...histVals];
    if (all.length === 0) return null;
    return Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10;
  };

  // 7. Média Geral BMF4 (todas as 15 atividades ou média consolidada)
  const getStudentAverage = (studentId: string): number | null => {
    const allValues: number[] = [];
    GRADE_CYCLES.forEach(cycle => {
      const vTeo = getGradeValue(studentId, cycle.teorica.id, cycle.teorica.keyAlt);
      const vAnat = getGradeValue(studentId, cycle.anatomia.id, cycle.anatomia.keyAlt);
      const vHist = getGradeValue(studentId, cycle.histologia.id, cycle.histologia.keyAlt);

      if (vTeo !== null) allValues.push(vTeo);
      if (vAnat !== null) allValues.push(vAnat);
      if (vHist !== null) allValues.push(vHist);
    });

    if (allValues.length === 0) return null;
    const sum = allValues.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / allValues.length) * 10) / 10;
  };

  // Filtered Students with Search & Status filter
  const displayedStudents = useMemo(() => {
    return classStudents.filter(st => {
      const matchesSearch = (
        st.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        st.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase().trim())
      );
      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;

      const avg = getStudentAverage(st.id);
      if (statusFilter === 'aprovados') return avg !== null && avg >= 6.0;
      if (statusFilter === 'recuperacao') return avg !== null && avg < 6.0;
      if (statusFilter === 'pendentes') return avg === null;

      return true;
    });
  }, [classStudents, searchTerm, statusFilter, grades]);

  // Overall Statistics for this Class
  const classStats = useMemo(() => {
    const total = classStudents.length;
    if (total === 0) {
      return { total: 0, withGrades: 0, approved: 0, recuperation: 0, classAvg: null, completionRate: 0 };
    }

    let sumAvg = 0;
    let countWithGrades = 0;
    let approved = 0;
    let recuperation = 0;
    let totalAssignedSlots = 0;
    const totalPossibleSlots = total * 15;

    classStudents.forEach(st => {
      const avg = getStudentAverage(st.id);
      if (avg !== null) {
        countWithGrades++;
        sumAvg += avg;
        if (avg >= 6.0) approved++;
        else recuperation++;
      }

      GRADE_CYCLES.forEach(cycle => {
        if (getGradeValue(st.id, cycle.teorica.id, cycle.teorica.keyAlt) !== null) totalAssignedSlots++;
        if (getGradeValue(st.id, cycle.anatomia.id, cycle.anatomia.keyAlt) !== null) totalAssignedSlots++;
        if (getGradeValue(st.id, cycle.histologia.id, cycle.histologia.keyAlt) !== null) totalAssignedSlots++;
      });
    });

    const classAvg = countWithGrades > 0 ? Math.round((sumAvg / countWithGrades) * 10) / 10 : null;
    const completionRate = totalPossibleSlots > 0 ? Math.round((totalAssignedSlots / totalPossibleSlots) * 100) : 0;

    return {
      total,
      withGrades: countWithGrades,
      approved,
      recuperation,
      classAvg,
      completionRate
    };
  }, [classStudents, grades]);

  // Export Grades to Modern Colored Excel with Sequential Cycle Distribution
  const handleExportGradesExcel = async () => {
    if (!selectedClass) return;

    try {
      await exportModernGradesExcel({
        selectedClass,
        students: classStudents,
        activeProfessor,
        grades,
        gradeCycles: GRADE_CYCLES,
        getGradeValue,
        getCycleAverage,
        getTeoricaAverage,
        getAnatomiaAverage,
        getHistologiaAverage,
        getStudentAverage
      });
      playBeep('success');
      showToast('Planilha colorida de notas (.xlsx) exportada com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar notas para Excel:', err);
      showToast('Erro ao exportar planilha de notas. Tente novamente.');
    }
  };

  // Quick grading preset buttons for Mobile Drawer
  const quickGradesPreset = [10.0, 9.5, 9.0, 8.5, 8.0, 7.5, 7.0, 6.5, 6.0, 5.0, 0.0];

  // Activities list for Quick Picker selector
  const allActivitiesList = useMemo(() => {
    const list: { id: string; label: string; name: string; type: string }[] = [];
    GRADE_CYCLES.forEach(c => {
      list.push({ id: c.teorica.id, label: c.teorica.label, name: `C${c.cycleNumber} - ${c.teorica.title}`, type: 'teorica' });
      list.push({ id: c.anatomia.id, label: c.anatomia.label, name: `C${c.cycleNumber} - ${c.anatomia.title}`, type: 'anatomia' });
      list.push({ id: c.histologia.id, label: c.histologia.label, name: `C${c.cycleNumber} - ${c.histologia.title}`, type: 'histologia' });
    });
    return list;
  }, []);

  const currentQuickGradeVal = quickGradeStudent ? getGradeValue(quickGradeStudent.id, quickGradeActivity) : null;

  // Move to next student in quick grade drawer
  const handleQuickNextStudent = () => {
    if (!quickGradeStudent) return;
    const currentIdx = displayedStudents.findIndex(s => s.id === quickGradeStudent.id);
    if (currentIdx !== -1 && currentIdx < displayedStudents.length - 1) {
      setQuickGradeStudent(displayedStudents[currentIdx + 1]);
      playBeep('click');
    }
  };

  // Move to previous student in quick grade drawer
  const handleQuickPrevStudent = () => {
    if (!quickGradeStudent) return;
    const currentIdx = displayedStudents.findIndex(s => s.id === quickGradeStudent.id);
    if (currentIdx > 0) {
      setQuickGradeStudent(displayedStudents[currentIdx - 1]);
      playBeep('click');
    }
  };

  return (
    <div className="space-y-4 max-w-full pb-20 sm:pb-8">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white hover:text-emerald-100 cursor-pointer">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header Card with Class Selector and Summary Stats */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2.5 rounded-2xl bg-sky-50 text-sky-700 border border-sky-200">
                <Award className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Quadro de Notas: Ciclos 1 a 5 (Teórica + Anatomia + Histologia)
                </h2>
                <p className="text-xs text-slate-500">
                  Distribuição modular: <strong>Atividade Teórica N</strong> + <strong>Prática Anatomia N</strong> + <strong>Histologia N</strong> + <strong>Média N</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Class Selector Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl">
              <label htmlFor="select-class-grades" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Turma:
              </label>
              <select
                id="select-class-grades"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  playBeep('confirm');
                }}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
              >
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cls.discipline ? `- ${cls.discipline}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Export Excel */}
            <button
              id="btn-export-grades-excel"
              onClick={handleExportGradesExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>

        </div>

        {/* Statistical Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold mb-1">
              <span>Alunos na Turma</span>
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-slate-900">{classStats.total}</span>
              <span className="text-[10px] text-slate-500">matriculados</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80">
            <div className="flex items-center justify-between text-sky-700 text-[11px] font-semibold mb-1">
              <span>Média da Turma</span>
              <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-sky-900">
                {classStats.classAvg !== null ? classStats.classAvg.toFixed(1) : '-'}
              </span>
              <span className="text-[10px] text-sky-700">escala 0 - 10</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
            <div className="flex items-center justify-between text-emerald-700 text-[11px] font-semibold mb-1">
              <span>Aprovados (≥ 6.0)</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-emerald-800">{classStats.approved}</span>
              <span className="text-[10px] text-emerald-600">
                ({classStats.withGrades > 0 ? Math.round((classStats.approved / classStats.withGrades) * 100) : 0}%)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/80">
            <div className="flex items-center justify-between text-rose-700 text-[11px] font-semibold mb-1">
              <span>Recuperação (&lt; 6.0)</span>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-rose-800">{classStats.recuperation}</span>
              <span className="text-[10px] text-rose-600">
                ({classStats.withGrades > 0 ? Math.round((classStats.recuperation / classStats.withGrades) * 100) : 0}%)
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* 2. Filters & Navigation Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs space-y-3">
        
        {/* Search and Status filter */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-grades"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Buscar aluno por nome ou RA (Ordem A-Z)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">Status:</span>
            
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({classStudents.length})
            </button>
            <button
              onClick={() => setStatusFilter('aprovados')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'aprovados' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Aprovados ({classStats.approved})
            </button>
            <button
              onClick={() => setStatusFilter('recuperacao')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'recuperacao' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Recuperação ({classStats.recuperation})
            </button>
          </div>

        </div>

        {/* Category & Cycle Filters (Teóricas, Práticas, Anatomia, Histologia, Ciclos) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Exibição:
            </span>

            {/* Todos os Ciclos Sequenciais */}
            <button
              onClick={() => setViewFilter('cycles_all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewFilter === 'cycles_all'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Exibir todos os 5 Ciclos sequenciais (Teórica + Anatomia + Histologia + Média)"
            >
              Todos os Ciclos (1 a 5)
            </button>

            {/* Apenas Teóricas */}
            <button
              onClick={() => setViewFilter('teoricas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewFilter === 'teoricas'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/60'
              }`}
            >
              Apenas Teóricas (AT1 a AT5)
            </button>

            {/* Todas as Práticas */}
            <button
              onClick={() => setViewFilter('praticas_all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewFilter === 'praticas_all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              Todas as Práticas (Anat + Histo)
            </button>

            {/* Práticas - Anatomia */}
            <button
              onClick={() => setViewFilter('anatomia')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewFilter === 'anatomia'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60'
              }`}
            >
              Prática Anatomia (APA1 a APA5)
            </button>

            {/* Práticas - Histologia */}
            <button
              onClick={() => setViewFilter('histologia')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewFilter === 'histologia'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
              }`}
            >
              Prática Histologia (APH1 a APH5)
            </button>
          </div>

          {/* Quick Cycle Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Ciclos:</span>
            {GRADE_CYCLES.map(c => (
              <button
                key={c.cycleNumber}
                onClick={() => setViewFilter(`cycle_${c.cycleNumber}` as FilterViewMode)}
                className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                  viewFilter === `cycle_${c.cycleNumber}`
                    ? 'bg-slate-900 text-amber-300 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={`Focar somente no Ciclo ${c.cycleNumber} (AT${c.cycleNumber} + APA${c.cycleNumber} + APH${c.cycleNumber} + Média ${c.cycleNumber})`}
              >
                C{c.cycleNumber}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* 3. Main Grades Matrix Table */}
      <div className="bg-white rounded-3xl p-3 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
        
        {/* Helper subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Exibindo <strong>{displayedStudents.length}</strong> alunos ordenados alfabeticamente A-Z. <span className="hidden sm:inline">Use <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-[10px]">Enter</kbd> ou <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-[10px]">↓</kbd> para avançar ao próximo aluno.</span>
          </span>
          <div className="flex items-center gap-2.5 text-[10px] sm:text-[11px] flex-wrap">
            <span className="inline-flex items-center gap-1 text-sky-800 font-bold">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-sky-500"></span> Teórica (AT)
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500"></span> Anatomia (APA)
            </span>
            <span className="inline-flex items-center gap-1 text-purple-800 font-bold">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-500"></span> Histologia (APH)
            </span>
            <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400"></span> Média Parcial
            </span>
          </div>
        </div>

        {/* Top Lateral Scroll & Cycle Quick Navigation Bar */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            
            {/* Quick Cycle Navigation Jump Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 hidden xs:inline">
                Ir para:
              </span>
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={`quick-jump-c${num}`}
                  onClick={() => scrollToCycle(num)}
                  className="px-2 sm:px-2.5 py-1 rounded-xl bg-white hover:bg-slate-200 border border-slate-200 text-slate-800 text-[10px] sm:text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
                  title={`Rolar diretamente para as colunas do Ciclo ${num}`}
                >
                  Ciclo {num}
                </button>
              ))}
              <button
                onClick={() => scrollTable(1000)}
                className="px-2 sm:px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[10px] sm:text-xs font-black transition-all active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
                title="Rolar para a Média Final"
              >
                Média Final
              </button>
            </div>

            {/* Left / Right Scroll Step Buttons */}
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <button
                onClick={() => scrollTable(-200)}
                className="p-1 sm:p-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs flex items-center gap-1"
                title="Rolar para a esquerda"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline">Esquerda</span>
              </button>

              <button
                onClick={() => scrollTable(200)}
                className="p-1 sm:p-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs flex items-center gap-1"
                title="Rolar para a direita"
              >
                <span className="text-[10px] hidden sm:inline">Direita</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

          {/* Synchronized Top Scrollbar Track */}
          <div
            ref={topScrollContainerRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto overflow-y-hidden h-2.5 sm:h-3 rounded-full bg-slate-200/90 cursor-ew-resize border border-slate-300/60"
            title="Arraste para rolar a tabela lateralmente"
          >
            <div className="w-[1450px] sm:w-[1700px] h-1" />
          </div>
        </div>

        {/* Responsive Table */}
        <div 
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto border border-slate-200 rounded-2xl max-w-full"
        >
          <table className="w-full text-left text-xs border-collapse">
            
            {/* Top Multi-Header (Categorias e Ciclos) */}
            <thead>
              
              {/* Row 1: Section Super Headers */}
              <tr className="bg-slate-950 text-white font-extrabold uppercase text-[9.5px] sm:text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-2 px-1.5 sm:px-3 text-center sticky left-0 bg-slate-950 z-20 w-7 sm:w-10" rowSpan={2}>Nº</th>
                <th className="py-2 px-2 sm:px-3.5 min-w-[125px] sm:min-w-[200px] max-w-[135px] sm:max-w-[220px] sticky left-7 sm:left-10 bg-slate-950 z-20" rowSpan={2}>Nome do Aluno</th>
                <th className="py-2 px-1.5 sm:px-3 min-w-[55px] sm:min-w-[95px]" rowSpan={2}>RA</th>

                {/* VIEW MODE: ALL CYCLES (Sequencial: Ciclo 1 -> Ciclo 2 -> Ciclo 3 -> Ciclo 4 -> Ciclo 5) */}
                {viewFilter === 'cycles_all' && (
                  GRADE_CYCLES.map(c => (
                    <th key={`super-${c.cycleNumber}`} colSpan={4} className="py-2 px-2 text-center border-l-2 border-slate-800 bg-slate-900 text-amber-300 font-black">
                      {c.label.toUpperCase()} (TEÓRICA + ANATOMIA + HISTOLOGIA)
                    </th>
                  ))
                )}

                {/* VIEW MODE: INDIVIDUAL CYCLE FOCUS */}
                {viewFilter.startsWith('cycle_') && (() => {
                  const cycleNum = parseInt(viewFilter.replace('cycle_', ''), 10);
                  const c = GRADE_CYCLES.find(item => item.cycleNumber === cycleNum) || GRADE_CYCLES[0];
                  return (
                    <th colSpan={4} className="py-2 px-2 text-center border-l-2 border-slate-800 bg-slate-900 text-amber-300 font-black">
                      {c.label.toUpperCase()} (TEÓRICA + ANATOMIA + HISTOLOGIA)
                    </th>
                  );
                })()}

                {/* VIEW MODE: TEÓRICAS APENAS */}
                {viewFilter === 'teoricas' && (
                  <th colSpan={5} className="py-2 px-2 text-center border-l-2 border-slate-800 bg-sky-950 text-sky-300 font-black">
                    AVALIAÇÕES TEÓRICAS (AT1 A AT5)
                  </th>
                )}

                {/* VIEW MODE: TODAS AS PRÁTICAS */}
                {viewFilter === 'praticas_all' && (
                  GRADE_CYCLES.map(c => (
                    <th key={`super-p-${c.cycleNumber}`} colSpan={3} className="py-2 px-2 text-center border-l-2 border-slate-800 bg-emerald-950 text-emerald-300 font-black">
                      PRÁTICAS {c.label.toUpperCase()} (ANAT + HISTO)
                    </th>
                  ))
                )}

                {/* VIEW MODE: ANATOMIA APENAS */}
                {viewFilter === 'anatomia' && (
                  <th colSpan={5} className="py-2 px-2 text-center border-l-2 border-slate-800 bg-emerald-950 text-emerald-300 font-black">
                    PRÁTICAS DE ANATOMIA (APA1 A APA5)
                  </th>
                )}

                {/* VIEW MODE: HISTOLOGIA APENAS */}
                {viewFilter === 'histologia' && (
                  <th colSpan={5} className="py-2 px-2 text-center border-l-2 border-slate-800 bg-purple-950 text-purple-300 font-black">
                    PRÁTICAS DE HISTOLOGIA (APH1 A APH5)
                  </th>
                )}

                {/* Summary Headers */}
                <th className="py-2 px-2 text-center min-w-[70px] bg-slate-900 text-amber-300 border-l-2 border-slate-800" rowSpan={2}>
                  Média Final
                </th>
                <th className="py-2 px-2 text-center min-w-[85px] bg-slate-900 text-white" rowSpan={2}>
                  Situação
                </th>
                <th className="py-2 px-2 text-center w-10 bg-slate-950 text-slate-400 sm:hidden" rowSpan={2}>
                  Rápido
                </th>
              </tr>

              {/* Row 2: Sub-Column Headers */}
              <tr className="bg-slate-900 text-slate-200 font-bold text-[10px] border-b border-slate-700">
                
                {/* ALL CYCLES */}
                {viewFilter === 'cycles_all' && (
                  GRADE_CYCLES.map(c => (
                    <React.Fragment key={`sub-${c.cycleNumber}`}>
                      <th className="py-2 px-1 text-center w-12 bg-sky-950/80 text-sky-200 border-l-2 border-slate-800" title={c.teorica.title}>
                        {c.teorica.label}
                      </th>
                      <th className="py-2 px-1 text-center w-12 bg-emerald-950/80 text-emerald-200 border-l border-slate-800" title={c.anatomia.title}>
                        {c.anatomia.label}
                      </th>
                      <th className="py-2 px-1 text-center w-12 bg-purple-950/80 text-purple-200 border-l border-slate-800" title={c.histologia.title}>
                        {c.histologia.label}
                      </th>
                      <th className="py-2 px-1.5 text-center min-w-[48px] bg-amber-950/80 text-amber-300 border-l border-slate-800 font-black" title={`Média das notas lançadas no Ciclo ${c.cycleNumber}`}>
                        Média {c.cycleNumber}
                      </th>
                    </React.Fragment>
                  ))
                )}

                {/* INDIVIDUAL CYCLE */}
                {viewFilter.startsWith('cycle_') && (() => {
                  const cycleNum = parseInt(viewFilter.replace('cycle_', ''), 10);
                  const c = GRADE_CYCLES.find(item => item.cycleNumber === cycleNum) || GRADE_CYCLES[0];
                  return (
                    <React.Fragment key={`sub-ind-${c.cycleNumber}`}>
                      <th className="py-2 px-1 text-center w-16 bg-sky-950/80 text-sky-200 border-l-2 border-slate-800" title={c.teorica.title}>
                        {c.teorica.label} (Teórica)
                      </th>
                      <th className="py-2 px-1 text-center w-16 bg-emerald-950/80 text-emerald-200 border-l border-slate-800" title={c.anatomia.title}>
                        {c.anatomia.label} (Anatomia)
                      </th>
                      <th className="py-2 px-1 text-center w-16 bg-purple-950/80 text-purple-200 border-l border-slate-800" title={c.histologia.title}>
                        {c.histologia.label} (Histologia)
                      </th>
                      <th className="py-2 px-2 text-center min-w-[65px] bg-amber-950/80 text-amber-300 border-l border-slate-800 font-black" title={`Média das notas do Ciclo ${c.cycleNumber}`}>
                        Média {c.cycleNumber}
                      </th>
                    </React.Fragment>
                  );
                })()}

                {/* TEÓRICAS ONLY */}
                {viewFilter === 'teoricas' && (
                  GRADE_CYCLES.map(c => (
                    <th key={c.teorica.id} className="py-2 px-1 text-center w-14 bg-sky-950/80 text-sky-200 border-l border-slate-800" title={c.teorica.title}>
                      {c.teorica.label}
                    </th>
                  ))
                )}

                {/* TODAS AS PRÁTICAS */}
                {viewFilter === 'praticas_all' && (
                  GRADE_CYCLES.map(c => (
                    <React.Fragment key={`sub-p-${c.cycleNumber}`}>
                      <th className="py-2 px-1 text-center w-14 bg-emerald-950/80 text-emerald-200 border-l-2 border-slate-800" title={c.anatomia.title}>
                        {c.anatomia.label}
                      </th>
                      <th className="py-2 px-1 text-center w-14 bg-purple-950/80 text-purple-200 border-l border-slate-800" title={c.histologia.title}>
                        {c.histologia.label}
                      </th>
                      <th className="py-2 px-1.5 text-center min-w-[48px] bg-teal-950/80 text-teal-300 border-l border-slate-800 font-black" title={`Média Prática Ciclo ${c.cycleNumber}`}>
                        M.Prát {c.cycleNumber}
                      </th>
                    </React.Fragment>
                  ))
                )}

                {/* ANATOMIA ONLY */}
                {viewFilter === 'anatomia' && (
                  GRADE_CYCLES.map(c => (
                    <th key={c.anatomia.id} className="py-2 px-1 text-center w-14 bg-emerald-950/80 text-emerald-200 border-l border-slate-800" title={c.anatomia.title}>
                      {c.anatomia.label}
                    </th>
                  ))
                )}

                {/* HISTOLOGIA ONLY */}
                {viewFilter === 'histologia' && (
                  GRADE_CYCLES.map(c => (
                    <th key={c.histologia.id} className="py-2 px-1 text-center w-14 bg-purple-950/80 text-purple-200 border-l border-slate-800" title={c.histologia.title}>
                      {c.histologia.label}
                    </th>
                  ))
                )}

              </tr>

            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={27} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">Nenhum aluno encontrado.</p>
                      <p className="text-xs text-slate-400">Verifique a busca ou o filtro de status selecionado.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedStudents.map((st, idx) => {
                  const finalAvg = getStudentAverage(st.id);
                  const isApproved = finalAvg !== null && finalAvg >= 6.0;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors group">
                      
                      {/* 1. Index Nº */}
                      <td className="py-2 px-1.5 sm:px-3 text-center font-mono text-slate-400 font-bold sticky left-0 bg-white group-hover:bg-slate-50 z-10 w-7 sm:w-10 text-[10px] sm:text-xs">
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      {/* 2. Student Name */}
                      <td className="py-2 px-2 sm:px-3.5 font-bold text-slate-900 sticky left-7 sm:left-10 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 min-w-[125px] sm:min-w-[200px] max-w-[135px] sm:max-w-[220px]">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="hidden sm:block shrink-0">
                            <StudentAvatar name={st.name} size="sm" />
                          </div>
                          <span 
                            className="truncate text-[11px] sm:text-xs cursor-pointer hover:text-sky-600 font-bold block" 
                            title={st.name}
                            onClick={() => setQuickGradeStudent(st)}
                          >
                            {st.name}
                          </span>
                        </div>
                      </td>

                      {/* 3. RA */}
                      <td className="py-2 px-1.5 sm:px-3 font-mono text-slate-600 font-semibold text-[10px] sm:text-[11px] min-w-[55px] sm:min-w-[95px] whitespace-nowrap">
                        {st.registrationNumber}
                      </td>

                      {/* VIEW 1: ALL CYCLES SEQUENTIAL (AT1, APA1, APH1, Média 1, AT2...) */}
                      {viewFilter === 'cycles_all' && (
                        GRADE_CYCLES.map(c => {
                          const vTeo = getGradeValue(st.id, c.teorica.id, c.teorica.keyAlt);
                          const vAnat = getGradeValue(st.id, c.anatomia.id, c.anatomia.keyAlt);
                          const vHist = getGradeValue(st.id, c.histologia.id, c.histologia.keyAlt);
                          const avgCycle = getCycleAverage(st.id, c);

                          return (
                            <React.Fragment key={`cell-${c.cycleNumber}`}>
                              
                              {/* Teórica N */}
                              <td className="py-1 px-0.5 text-center border-l-2 border-slate-200 bg-sky-50/20">
                                <input
                                  id={`grade-input-${st.id}-${c.teorica.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]*[.,]?[0-9]*"
                                  enterKeyHint="next"
                                  maxLength={4}
                                  value={getDisplayValue(st.id, c.teorica.id, c.teorica.keyAlt)}
                                  onChange={(e) => handleRawChange(st.id, c.teorica.id, e.target.value)}
                                  onBlur={() => handleBlur(st.id, c.teorica.id)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, c.teorica.id)}
                                  className={`w-10 text-center py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all ${
                                    vTeo !== null
                                      ? vTeo >= 6 ? 'bg-sky-50 text-sky-900 border-sky-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                      : 'bg-white text-slate-500 border-slate-200'
                                  }`}
                                  placeholder="-"
                                  title={`${c.teorica.title}: ${st.name}`}
                                />
                              </td>

                              {/* Prática Anatomia N */}
                              <td className="py-1 px-0.5 text-center border-l border-slate-100 bg-emerald-50/20">
                                <input
                                  id={`grade-input-${st.id}-${c.anatomia.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]*[.,]?[0-9]*"
                                  enterKeyHint="next"
                                  maxLength={4}
                                  value={getDisplayValue(st.id, c.anatomia.id, c.anatomia.keyAlt)}
                                  onChange={(e) => handleRawChange(st.id, c.anatomia.id, e.target.value)}
                                  onBlur={() => handleBlur(st.id, c.anatomia.id)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, c.anatomia.id)}
                                  className={`w-10 text-center py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                                    vAnat !== null
                                      ? vAnat >= 6 ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                      : 'bg-white text-slate-500 border-slate-200'
                                  }`}
                                  placeholder="-"
                                  title={`${c.anatomia.title}: ${st.name}`}
                                />
                              </td>

                              {/* Prática Histologia N */}
                              <td className="py-1 px-0.5 text-center border-l border-slate-100 bg-purple-50/20">
                                <input
                                  id={`grade-input-${st.id}-${c.histologia.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]*[.,]?[0-9]*"
                                  enterKeyHint="next"
                                  maxLength={4}
                                  value={getDisplayValue(st.id, c.histologia.id, c.histologia.keyAlt)}
                                  onChange={(e) => handleRawChange(st.id, c.histologia.id, e.target.value)}
                                  onBlur={() => handleBlur(st.id, c.histologia.id)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, c.histologia.id)}
                                  className={`w-10 text-center py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                                    vHist !== null
                                      ? vHist >= 6 ? 'bg-purple-50 text-purple-900 border-purple-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                      : 'bg-white text-slate-500 border-slate-200'
                                  }`}
                                  placeholder="-"
                                  title={`${c.histologia.title}: ${st.name}`}
                                />
                              </td>

                              {/* Média do Ciclo N */}
                              <td className="py-1 px-1 text-center border-l border-slate-200 bg-amber-50/40">
                                {avgCycle !== null ? (
                                  <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                                    avgCycle >= 6.0 ? 'text-amber-950 bg-amber-100 border border-amber-200' : 'text-rose-700 bg-rose-100 border border-rose-200'
                                  }`}>
                                    {avgCycle.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono text-xs">-</span>
                                )}
                              </td>

                            </React.Fragment>
                          );
                        })
                      )}

                      {/* VIEW 2: INDIVIDUAL CYCLE FOCUS */}
                      {viewFilter.startsWith('cycle_') && (() => {
                        const cycleNum = parseInt(viewFilter.replace('cycle_', ''), 10);
                        const c = GRADE_CYCLES.find(item => item.cycleNumber === cycleNum) || GRADE_CYCLES[0];
                        const vTeo = getGradeValue(st.id, c.teorica.id, c.teorica.keyAlt);
                        const vAnat = getGradeValue(st.id, c.anatomia.id, c.anatomia.keyAlt);
                        const vHist = getGradeValue(st.id, c.histologia.id, c.histologia.keyAlt);
                        const avgCycle = getCycleAverage(st.id, c);

                        return (
                          <React.Fragment key={`cell-ind-${c.cycleNumber}`}>
                            
                            <td className="py-2 px-2 text-center border-l-2 border-slate-200 bg-sky-50/20">
                              <input
                                id={`grade-input-${st.id}-${c.teorica.id}`}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]*"
                                enterKeyHint="next"
                                maxLength={4}
                                value={getDisplayValue(st.id, c.teorica.id, c.teorica.keyAlt)}
                                onChange={(e) => handleRawChange(st.id, c.teorica.id, e.target.value)}
                                onBlur={() => handleBlur(st.id, c.teorica.id)}
                                onKeyDown={(e) => handleKeyDown(e, idx, c.teorica.id)}
                                className={`w-14 text-center py-1.5 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all ${
                                  vTeo !== null
                                    ? vTeo >= 6 ? 'bg-sky-50 text-sky-900 border-sky-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                                placeholder="0.0"
                              />
                            </td>

                            <td className="py-2 px-2 text-center border-l border-slate-100 bg-emerald-50/20">
                              <input
                                id={`grade-input-${st.id}-${c.anatomia.id}`}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]*"
                                enterKeyHint="next"
                                maxLength={4}
                                value={getDisplayValue(st.id, c.anatomia.id, c.anatomia.keyAlt)}
                                onChange={(e) => handleRawChange(st.id, c.anatomia.id, e.target.value)}
                                onBlur={() => handleBlur(st.id, c.anatomia.id)}
                                onKeyDown={(e) => handleKeyDown(e, idx, c.anatomia.id)}
                                className={`w-14 text-center py-1.5 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                                  vAnat !== null
                                    ? vAnat >= 6 ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                                placeholder="0.0"
                              />
                            </td>

                            <td className="py-2 px-2 text-center border-l border-slate-100 bg-purple-50/20">
                              <input
                                id={`grade-input-${st.id}-${c.histologia.id}`}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]*"
                                enterKeyHint="next"
                                maxLength={4}
                                value={getDisplayValue(st.id, c.histologia.id, c.histologia.keyAlt)}
                                onChange={(e) => handleRawChange(st.id, c.histologia.id, e.target.value)}
                                onBlur={() => handleBlur(st.id, c.histologia.id)}
                                onKeyDown={(e) => handleKeyDown(e, idx, c.histologia.id)}
                                className={`w-14 text-center py-1.5 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                                  vHist !== null
                                    ? vHist >= 6 ? 'bg-purple-50 text-purple-900 border-purple-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                                placeholder="0.0"
                              />
                            </td>

                            <td className="py-2 px-2 text-center border-l border-slate-200 bg-amber-50/40">
                              {avgCycle !== null ? (
                                <span className={`text-xs font-black px-2 py-1 rounded-lg border ${
                                  avgCycle >= 6.0 ? 'text-amber-950 bg-amber-100 border-amber-300' : 'text-rose-700 bg-rose-100 border-rose-300'
                                }`}>
                                  {avgCycle.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono text-xs">-</span>
                              )}
                            </td>

                          </React.Fragment>
                        );
                      })()}

                      {/* VIEW 3: TEÓRICAS ONLY */}
                      {viewFilter === 'teoricas' && (
                        GRADE_CYCLES.map(c => {
                          const vTeo = getGradeValue(st.id, c.teorica.id, c.teorica.keyAlt);
                          return (
                            <td key={c.teorica.id} className="py-1 px-1 text-center border-l border-slate-200 bg-sky-50/20">
                              <input
                                id={`grade-input-${st.id}-${c.teorica.id}`}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]*"
                                enterKeyHint="next"
                                maxLength={4}
                                value={getDisplayValue(st.id, c.teorica.id, c.teorica.keyAlt)}
                                onChange={(e) => handleRawChange(st.id, c.teorica.id, e.target.value)}
                                onBlur={() => handleBlur(st.id, c.teorica.id)}
                                onKeyDown={(e) => handleKeyDown(e, idx, c.teorica.id)}
                                className={`w-12 text-center py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all ${
                                  vTeo !== null
                                    ? vTeo >= 6 ? 'bg-sky-50 text-sky-900 border-sky-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                                placeholder="-"
                              />
                            </td>
                          );
                        })
                      )}

                      {/* VIEW 4: TODAS AS PRÁTICAS */}
                      {viewFilter === 'praticas_all' && (
                        GRADE_CYCLES.map(c => {
                          const vAnat = getGradeValue(st.id, c.anatomia.id, c.anatomia.keyAlt);
                          const vHist = getGradeValue(st.id, c.histologia.id, c.histologia.keyAlt);
                          const pAvg = getCyclePracticalAverage(st.id, c);

                          return (
                            <React.Fragment key={`cell-p-${c.cycleNumber}`}>
                              <td className="py-1 px-1 text-center border-l-2 border-slate-200 bg-emerald-50/20">
                                <input
                                  id={`grade-input-${st.id}-${c.anatomia.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]*[.,]?[0-9]*"
                                  enterKeyHint="next"
                                  maxLength={4}
                                  value={getDisplayValue(st.id, c.anatomia.id, c.anatomia.keyAlt)}
                                  onChange={(e) => handleRawChange(st.id, c.anatomia.id, e.target.value)}
                                  onBlur={() => handleBlur(st.id, c.anatomia.id)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, c.anatomia.id)}
                                  className={`w-11 text-center py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                                    vAnat !== null
                                      ? vAnat >= 6 ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                      : 'bg-white text-slate-500 border-slate-200'
                                  }`}
                                  placeholder="-"
                                />
                              </td>
                              <td className="py-1 px-1 text-center border-l border-slate-100 bg-purple-50/20">
                                <input
                                  id={`grade-input-${st.id}-${c.histologia.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]*[.,]?[0-9]*"
                                  enterKeyHint="next"
                                  maxLength={4}
                                  value={getDisplayValue(st.id, c.histologia.id, c.histologia.keyAlt)}
                                  onChange={(e) => handleRawChange(st.id, c.histologia.id, e.target.value)}
                                  onBlur={() => handleBlur(st.id, c.histologia.id)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, c.histologia.id)}
                                  className={`w-11 text-center py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                                    vHist !== null
                                      ? vHist >= 6 ? 'bg-purple-50 text-purple-900 border-purple-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                      : 'bg-white text-slate-500 border-slate-200'
                                  }`}
                                  placeholder="-"
                                />
                              </td>
                              <td className="py-1 px-1 text-center border-l border-slate-200 bg-teal-50/40">
                                {pAvg !== null ? (
                                  <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                                    pAvg >= 6.0 ? 'text-teal-950 bg-teal-100 border border-teal-200' : 'text-rose-700 bg-rose-100 border border-rose-200'
                                  }`}>
                                    {pAvg.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono text-xs">-</span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })
                      )}

                      {/* VIEW 5: ANATOMIA ONLY */}
                      {viewFilter === 'anatomia' && (
                        GRADE_CYCLES.map(c => {
                          const vAnat = getGradeValue(st.id, c.anatomia.id, c.anatomia.keyAlt);
                          return (
                            <td key={c.anatomia.id} className="py-1 px-1 text-center border-l border-slate-200 bg-emerald-50/20">
                              <input
                                id={`grade-input-${st.id}-${c.anatomia.id}`}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]*"
                                enterKeyHint="next"
                                maxLength={4}
                                value={getDisplayValue(st.id, c.anatomia.id, c.anatomia.keyAlt)}
                                onChange={(e) => handleRawChange(st.id, c.anatomia.id, e.target.value)}
                                onBlur={() => handleBlur(st.id, c.anatomia.id)}
                                onKeyDown={(e) => handleKeyDown(e, idx, c.anatomia.id)}
                                className={`w-12 text-center py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                                  vAnat !== null
                                    ? vAnat >= 6 ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                                placeholder="-"
                              />
                            </td>
                          );
                        })
                      )}

                      {/* VIEW 6: HISTOLOGIA ONLY */}
                      {viewFilter === 'histologia' && (
                        GRADE_CYCLES.map(c => {
                          const vHist = getGradeValue(st.id, c.histologia.id, c.histologia.keyAlt);
                          return (
                            <td key={c.histologia.id} className="py-1 px-1 text-center border-l border-slate-200 bg-purple-50/20">
                              <input
                                id={`grade-input-${st.id}-${c.histologia.id}`}
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*[.,]?[0-9]*"
                                enterKeyHint="next"
                                maxLength={4}
                                value={getDisplayValue(st.id, c.histologia.id, c.histologia.keyAlt)}
                                onChange={(e) => handleRawChange(st.id, c.histologia.id, e.target.value)}
                                onBlur={() => handleBlur(st.id, c.histologia.id)}
                                onKeyDown={(e) => handleKeyDown(e, idx, c.histologia.id)}
                                className={`w-12 text-center py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                                  vHist !== null
                                    ? vHist >= 6 ? 'bg-purple-50 text-purple-900 border-purple-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                                    : 'bg-white text-slate-500 border-slate-200'
                                }`}
                                placeholder="-"
                              />
                            </td>
                          );
                        })
                      )}

                      {/* Summary: Média Final */}
                      <td className="py-2 px-2 text-center border-l-2 border-slate-200 bg-slate-50 font-black">
                        {finalAvg !== null ? (
                          <span className={`px-2 py-1 rounded-lg text-xs font-black inline-block ${
                            isApproved 
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            {finalAvg.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Summary: Situação */}
                      <td className="py-2 px-2 text-center border-l border-slate-200">
                        {finalAvg !== null ? (
                          isApproved ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">Aprovado</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-black flex items-center justify-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span className="truncate">Recuperação</span>
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Mobile Action Button: Quick Grade Modal */}
                      <td className="py-2 px-1 text-center border-l border-slate-200 sm:hidden">
                        <button
                          type="button"
                          onClick={() => setQuickGradeStudent(st)}
                          className="p-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 cursor-pointer"
                          title="Lançamento Rápido no Celular"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

      </div>

      {/* 4. Mobile Quick-Grade Floating Drawer / Modal */}
      {quickGradeStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4">
            
            {/* Header with Student Name, RA and Close */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <StudentAvatar name={quickGradeStudent.name} size="md" />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                    {quickGradeStudent.name}
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    RA: {quickGradeStudent.registrationNumber}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setQuickGradeStudent(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Select Activity */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Selecione a Atividade para Lançar:
              </label>
              <select
                value={quickGradeActivity}
                onChange={(e) => setQuickGradeActivity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                {allActivitiesList.map(act => (
                  <option key={act.id} value={act.id}>
                    {act.name} ({act.label})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Grade Indicator with Steppers */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Nota Atual</span>
                <div className="text-2xl font-black text-slate-900">
                  {currentQuickGradeVal !== null ? (
                    <span className={currentQuickGradeVal >= 6.0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {currentQuickGradeVal.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Sem Nota</span>
                  )}
                </div>
              </div>

              {/* Incremental Steppers (+0.5 / -0.5) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cur = currentQuickGradeVal ?? 5.0;
                    const next = Math.max(0, Math.round((cur - 0.5) * 10) / 10);
                    saveGrade(quickGradeStudent.id, quickGradeActivity, next);
                    playBeep('click');
                  }}
                  className="p-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 font-bold transition-all cursor-pointer"
                  title="Diminuir 0.5"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = currentQuickGradeVal ?? 5.0;
                    const next = Math.min(10, Math.round((cur + 0.5) * 10) / 10);
                    saveGrade(quickGradeStudent.id, quickGradeActivity, next);
                    playBeep('click');
                  }}
                  className="p-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 font-bold transition-all cursor-pointer"
                  title="Aumentar 0.5"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {currentQuickGradeVal !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      saveGrade(quickGradeStudent.id, quickGradeActivity, null);
                      playBeep('warning');
                    }}
                    className="p-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 active:scale-95 text-rose-700 font-bold transition-all cursor-pointer"
                    title="Limpar Nota"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Touch Keypad for Cellphone Grading */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Lançamento Rápido com 1 Toque:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {quickGradesPreset.map(preset => {
                  const isSelected = currentQuickGradeVal === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        saveGrade(quickGradeStudent.id, quickGradeActivity, preset);
                        playBeep('success');
                      }}
                      className={`py-3 rounded-2xl font-black text-sm transition-all active:scale-95 cursor-pointer shadow-xs ${
                        isSelected
                          ? 'bg-sky-600 text-white ring-2 ring-sky-600 ring-offset-2'
                          : preset >= 6.0
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {preset.toFixed(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Student Navigation Controls (Previous / Next Student) */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleQuickPrevStudent}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Aluno Anterior</span>
              </button>

              <button
                type="button"
                onClick={handleQuickNextStudent}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Próximo Aluno</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
