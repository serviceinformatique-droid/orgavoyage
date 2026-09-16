import React, { useState, useEffect, useMemo } from 'react';
import { Voyage, Inscription } from '../types.js';
import {
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Eye,
  Mail,
  Download,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ChevronDown,
  Lock,
  KeyRound,
  Trash2,
  Copy,
  ArrowUpDown,
  Calculator,
  GraduationCap,
  Users,
  Pencil,
  X,
} from 'lucide-react';
import { StudentDetailModal } from './StudentDetailModal.js';
import { PdfExportModal } from './PdfExportModal.js';
import { MassRelanceModal } from './MassRelanceModal.js';
import { exportInscriptionsToExcel } from '../utils/excelGenerator.js';

interface TeacherDashboardProps {
  voyages: Voyage[];
  selectedVoyageId: string;
  onSelectVoyage: (id: string) => void;
  onRefreshVoyages: () => void;
  voyagePassword?: string;
  onRequestUnlock?: () => void;
  onLockVoyage?: () => void;
  isAdmin?: boolean;
  isConsultation?: boolean;
  consultationToken?: string;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  voyages,
  selectedVoyageId,
  onSelectVoyage,
  onRefreshVoyages,
  voyagePassword,
  onRequestUnlock,
  onLockVoyage,
  isAdmin,
  isConsultation,
  consultationToken,
}) => {
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [allTripInscriptions, setAllTripInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLockedByPassword, setIsLockedByPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClasse, setSelectedClasse] = useState('Toutes');
  const [selectedStatut, setSelectedStatut] = useState('Tous');
  const [sortColumn, setSortColumn] = useState<'nom' | 'classe' | 'statut'>('nom');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Modals state
  const [activeStudent, setActiveStudent] = useState<Inscription | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showMassRelanceModal, setShowMassRelanceModal] = useState(false);
  const [editingClasseStudent, setEditingClasseStudent] = useState<Inscription | null>(null);
  const [newClasseValue, setNewClasseValue] = useState<string>('');
  const [isSavingClasse, setIsSavingClasse] = useState<boolean>(false);

  const handleSaveClasse = async () => {
    if (!editingClasseStudent || !newClasseValue.trim()) return;
    setIsSavingClasse(true);
    const targetClass = newClasseValue.trim();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const adminToken = sessionStorage.getItem('ndm_admin_token');
      if (adminToken) headers['x-admin-token'] = adminToken;
      const cToken = consultationToken || sessionStorage.getItem('ndm_consultation_token');
      if (cToken) headers['x-consultation-token'] = cToken;
      if (voyagePassword) headers['x-voyage-password'] = voyagePassword;

      const res = await fetch(`/api/inscriptions/${encodeURIComponent(editingClasseStudent.id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ classe: targetClass, classe_modifiee_manuellement: true }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.success || data.inscription)) {
        const updatedItem = data.inscription || {
          ...editingClasseStudent,
          classe: targetClass,
          classe_modifiee_manuellement: true,
        };

        setInscriptions((prev) =>
          prev.map((i) => (i.id === editingClasseStudent.id ? { ...i, ...updatedItem, classe: targetClass, classe_modifiee_manuellement: true } : i))
        );
        setAllTripInscriptions((prev) =>
          prev.map((i) => (i.id === editingClasseStudent.id ? { ...i, ...updatedItem, classe: targetClass, classe_modifiee_manuellement: true } : i))
        );
        if (activeStudent && activeStudent.id === editingClasseStudent.id) {
          setActiveStudent((prev) => (prev ? { ...prev, ...updatedItem, classe: targetClass, classe_modifiee_manuellement: true } : null));
        }

        setSyncNotice(`✓ Classe mise à jour : ${editingClasseStudent.eleve_prenom} ${editingClasseStudent.eleve_nom} est désormais en classe ${targetClass}. Cette modification est verrouillée et sera conservée lors des synchronisations.`);
        setEditingClasseStudent(null);
        if (onRefreshVoyages) onRefreshVoyages();
      } else {
        alert(data.error || data.message || 'Erreur lors de l’enregistrement de la classe sur le serveur.');
      }
    } catch (err: any) {
      console.error('Erreur mise à jour classe:', err);
      alert(`Erreur réseau lors de la modification de classe : ${err?.message || 'Serveur injoignable'}`);
    } finally {
      setIsSavingClasse(false);
      setTimeout(() => setSyncNotice((curr) => (curr?.startsWith('✓ Classe mise à jour') ? null : curr)), 6000);
    }
  };

  const currentVoyage = voyages.find((v) => v.id === selectedVoyageId) || voyages[0];

  // Fetch full trip inscriptions (unfiltered) for duplicates detection and modal context
  const fetchAllTripInscriptions = async () => {
    if (!currentVoyage) return;
    try {
      const headers: Record<string, string> = {};
      if (voyagePassword) headers['x-voyage-password'] = voyagePassword;
      const adminToken = sessionStorage.getItem('ndm_admin_token');
      if (isAdmin && adminToken) headers['x-admin-token'] = adminToken;
      const cToken = consultationToken || sessionStorage.getItem('ndm_consultation_token') || (isConsultation ? 'consultation-token-active' : '');
      if (isConsultation && cToken) headers['x-consultation-token'] = cToken;

      const res = await fetch(`/api/voyages/${currentVoyage.id}/inscriptions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAllTripInscriptions(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAllTripInscriptions();
  }, [selectedVoyageId, voyagePassword, isAdmin, isConsultation, consultationToken]);

  // Fetch inscriptions for current trip according to user filters
  const fetchInscriptions = async () => {
    if (!currentVoyage) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedClasse && selectedClasse !== 'Toutes') params.append('classe', selectedClasse);
      if (selectedStatut && selectedStatut !== 'Tous') params.append('statut', selectedStatut);

      const headers: Record<string, string> = {};
      if (voyagePassword) {
        headers['x-voyage-password'] = voyagePassword;
      }
      const adminToken = sessionStorage.getItem('ndm_admin_token');
      if (isAdmin && adminToken) {
        headers['x-admin-token'] = adminToken;
      }
      const cToken = consultationToken || sessionStorage.getItem('ndm_consultation_token') || (isConsultation ? 'consultation-token-active' : '');
      if (isConsultation && cToken) {
        headers['x-consultation-token'] = cToken;
      }

      const res = await fetch(`/api/voyages/${currentVoyage.id}/inscriptions?${params.toString()}`, {
        headers,
      });

      if (res.status === 403) {
        setIsLockedByPassword(true);
        setInscriptions([]);
      } else if (res.ok) {
        setIsLockedByPassword(false);
        const data = await res.json();
        setInscriptions(data);
      }
    } catch (err) {
      console.error('Failed to load inscriptions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInscriptions();
  }, [selectedVoyageId, searchQuery, selectedClasse, selectedStatut, voyagePassword, isAdmin, isConsultation, consultationToken]);

  // Synchronize now
  const handleSyncNow = async () => {
    if (!currentVoyage) return;
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await fetch(`/api/voyages/${currentVoyage.id}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncNotice(data.message);
        await Promise.all([fetchInscriptions(), fetchAllTripInscriptions()]);
        onRefreshVoyages();
      } else {
        alert(data.message || 'Erreur lors de la synchronisation');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncNotice(null), 5000);
    }
  };

  // Export Excel
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!currentVoyage) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const adminToken = sessionStorage.getItem('ndm_admin_token') || '';
      let res = await fetch(`/api/voyages/${currentVoyage.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
      });

      if (!res.ok && res.status !== 404) {
        res = await fetch(`/api/voyages/${currentVoyage.id}/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
        });
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.success || res.status === 200)) {
        setShowDeleteModal(false);
        onRefreshVoyages();
      } else {
        setDeleteError(data.error || data.message || 'Erreur lors de la suppression.');
      }
    } catch (err: any) {
      setDeleteError(`Erreur réseau : ${err.message || 'Impossible de joindre le serveur'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!currentVoyage) return;
    if (currentVoyage.has_password && !isAdmin && !isConsultation && !voyagePassword) {
      if (onRequestUnlock) onRequestUnlock();
      return;
    }

    setIsExportingExcel(true);
    setSyncNotice('Préparation de l\'export Excel en cours...');

    try {
      // 1. Determine list to export (prefer allTripInscriptions or current inscriptions)
      let dataToExport = allTripInscriptions.length > 0 ? allTripInscriptions : inscriptions;

      // If data is empty in state, fetch fresh from server
      if (!dataToExport || dataToExport.length === 0) {
        const headers: Record<string, string> = {};
        const adminToken = sessionStorage.getItem('ndm_admin_token');
        if (isAdmin && adminToken) headers['x-admin-token'] = adminToken;
        const cToken = consultationToken || sessionStorage.getItem('ndm_consultation_token');
        if (isConsultation && cToken) headers['x-consultation-token'] = cToken;
        if (voyagePassword) headers['x-voyage-password'] = voyagePassword;

        const res = await fetch(`/api/voyages/${currentVoyage.id}/inscriptions`, { headers });
        if (res.ok) {
          const freshData = await res.json();
          if (Array.isArray(freshData) && freshData.length > 0) {
            dataToExport = freshData;
          }
        }
      }

      if (dataToExport && dataToExport.length > 0) {
        const exportResult = exportInscriptionsToExcel(currentVoyage, dataToExport);
        if (exportResult.success) {
          setSyncNotice(`✓ Fichier Excel téléchargé avec succès : ${exportResult.filename} (${exportResult.count} dossiers)`);
          setTimeout(() => setSyncNotice(null), 6000);
          return;
        }
      }

      // 2. Fallback: fetch blob from server endpoint
      const params = new URLSearchParams();
      if (voyagePassword) params.append('password', voyagePassword);
      const token = sessionStorage.getItem('ndm_admin_token');
      if (isAdmin && token) params.append('adminToken', token);
      const cToken = consultationToken || sessionStorage.getItem('ndm_consultation_token');
      if (isConsultation && cToken) params.append('consultationToken', cToken);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const serverRes = await fetch(`/api/voyages/${currentVoyage.id}/export/excel${queryStr}`);
      if (!serverRes.ok) {
        const errorText = await serverRes.text();
        throw new Error(errorText || `Erreur serveur ${serverRes.status}`);
      }

      const blob = await serverRes.blob();
      const safeVoyageNom = (currentVoyage.nom || 'Voyage')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Inscriptions_${safeVoyageNom}_${new Date().toISOString().substring(0, 10)}.xlsx`;

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      setSyncNotice(`✓ Fichier Excel téléchargé : ${filename}`);
      setTimeout(() => setSyncNotice(null), 6000);
    } catch (err: any) {
      console.error('Erreur export Excel:', err);
      setSyncNotice(`⚠️ Échec de l'export Excel : ${err.message || 'Erreur inconnue'}`);
      setTimeout(() => setSyncNotice(null), 6000);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Normalized key helper for matching duplicates
  const normalizeKey = (nom?: string, prenom?: string) => {
    const cleanNom = (nom || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const cleanPrenom = (prenom || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    if (!cleanNom && !cleanPrenom) return '';
    return `${cleanNom}___${cleanPrenom}`;
  };

  // Set of normalized keys of students with identical last name and first name in the trip
  const duplicateNameKeys = useMemo(() => {
    const listToScan = allTripInscriptions.length > 0 ? allTripInscriptions : inscriptions;
    const counts = new Map<string, number>();
    for (const item of listToScan) {
      const key = normalizeKey(item.eleve_nom, item.eleve_prenom);
      if (key) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const dupes = new Set<string>();
    for (const [key, count] of counts.entries()) {
      if (count > 1) dupes.add(key);
    }
    return dupes;
  }, [allTripInscriptions, inscriptions]);

  // Total count of duplicate inscriptions in the trip
  const totalDoublonsCount = useMemo(() => {
    if (typeof currentVoyage?.total_doublons === 'number') {
      return currentVoyage.total_doublons;
    }
    const listToScan = allTripInscriptions.length > 0 ? allTripInscriptions : inscriptions;
    return listToScan.filter((item) => {
      const key = normalizeKey(item.eleve_nom, item.eleve_prenom);
      return duplicateNameKeys.has(key);
    }).length;
  }, [currentVoyage?.total_doublons, allTripInscriptions, inscriptions, duplicateNameKeys]);

  // Headcount and detailed statistics per class for the current trip
  const classStatistics = useMemo(() => {
    if (!currentVoyage) return [];
    const listToScan = allTripInscriptions.length > 0 ? allTripInscriptions : inscriptions;

    // Configured classes from trip metadata
    const configClasses = (currentVoyage.classes_concernees || [])
      .flatMap((c) => (c.includes('-') ? c.split('-').map((x) => x.trim()) : [c.trim()]))
      .filter((c) => Boolean(c) && c !== 'Toutes');

    // Dynamically extracted classes from student inscriptions
    const extracted = Array.from(
      new Set(
        listToScan
          .map((i) => (i.classe || '').trim())
          .filter((c) => Boolean(c) && c !== 'Non spécifiée' && c !== 'En attente')
      )
    );

    // Merge and natural sort
    const uniqueClasses = Array.from(new Set([...configClasses, ...extracted])).sort((a, b) =>
      a.localeCompare(b, 'fr', { numeric: true })
    );

    return uniqueClasses.map((classeName) => {
      const classStudents = listToScan.filter((i) => (i.classe || '').trim() === classeName);
      const total = classStudents.length;
      const complets = classStudents.filter((i) => i.statut === 'COMPLET' || i.nombre_signatures === 2).length;
      const aFinaliser = classStudents.filter((i) => i.statut === 'A_FINALISER' || i.nombre_signatures === 1).length;
      const nonSignes = classStudents.filter((i) => i.statut === 'NON_SIGNE' || i.nombre_signatures === 0).length;
      const tauxCompletion = total > 0 ? Math.round((complets / total) * 100) : 0;

      // Count duplicates within this class
      const keyCount = new Map<string, number>();
      for (const st of classStudents) {
        const k = normalizeKey(st.eleve_nom, st.eleve_prenom);
        if (k) keyCount.set(k, (keyCount.get(k) || 0) + 1);
      }
      let doublonsCount = 0;
      for (const cnt of keyCount.values()) {
        if (cnt > 1) doublonsCount += cnt;
      }

      return {
        classe: classeName,
        total,
        complets,
        aFinaliser,
        nonSignes,
        tauxCompletion,
        doublons: doublonsCount,
      };
    });
  }, [currentVoyage, allTripInscriptions, inscriptions]);

  // List of classes for dropdown
  const classesList = useMemo(() => {
    return ['Toutes', ...classStatistics.map((c) => c.classe)];
  }, [classStatistics]);

  // Alphabetical sorting of students (last name ASC, then first name ASC)
  const sortedInscriptions = useMemo(() => {
    const list = [...inscriptions];
    list.sort((a, b) => {
      if (sortColumn === 'classe') {
        const cmp = (a.classe || '').localeCompare(b.classe || '', 'fr', { numeric: true });
        if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
      } else if (sortColumn === 'statut') {
        const order: Record<string, number> = { COMPLET: 0, A_FINALISER: 1, NON_SIGNE: 2 };
        const diff = (order[a.statut] ?? 3) - (order[b.statut] ?? 3);
        if (diff !== 0) return sortDirection === 'asc' ? diff : -diff;
      }
      // Default: Alphabetical order by student last name ASC then first name ASC
      const nomA = (a.eleve_nom || '').trim();
      const nomB = (b.eleve_nom || '').trim();
      const cmpNom = nomA.localeCompare(nomB, 'fr', { sensitivity: 'base', numeric: true });
      if (cmpNom !== 0) return sortDirection === 'asc' ? cmpNom : -cmpNom;
      const prenomA = (a.eleve_prenom || '').trim();
      const prenomB = (b.eleve_prenom || '').trim();
      return sortDirection === 'asc'
        ? prenomA.localeCompare(prenomB, 'fr', { sensitivity: 'base', numeric: true })
        : prenomB.localeCompare(prenomA, 'fr', { sensitivity: 'base', numeric: true });
    });
    return list;
  }, [inscriptions, sortColumn, sortDirection]);

  if (voyages.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-8">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
          <Calendar className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Aucun voyage scolaire configuré</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
          La base de démonstration a été effacée. Vous pouvez créer un voyage depuis l'Administration DocuSeal ou charger le voyage test avec élèves et doublons.
        </p>
        <button
          type="button"
          id="btn-seed-demo-quick"
          onClick={async () => {
            try {
              await fetch('/api/admin/seed-demo', { method: 'POST' });
              onRefreshVoyages();
            } catch (err) {
              console.error(err);
            }
          }}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
        >
          <span>⚡ Charger le voyage de test (Londres avec élèves et doublons)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Consultation Banner for Accountant */}
      {isConsultation && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-sky-900">
                  Accès Consultation Comptabilité
                </span>
                <span className="text-[10px] font-extrabold bg-sky-200 text-sky-900 px-2 py-0.5 rounded-full">
                  Lecture seule
                </span>
              </div>
              <p className="text-xs text-sky-900 mt-1 leading-relaxed">
                Vous visualisez l'ensemble des <strong>{voyages.length} voyages scolaires</strong> et la liste complète de tous les élèves inscrits. Le menu déroulant ci-dessous vous permet de basculer instantanément d'un voyage à un autre.
              </p>
            </div>
          </div>
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs shrink-0 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title="Télécharger l'export Excel complet du voyage sélectionné"
          >
            <FileSpreadsheet className={`w-4 h-4 ${isExportingExcel ? 'animate-spin' : ''}`} />
            <span>{isExportingExcel ? 'Génération en cours...' : 'Télécharger l\'Export Excel'}</span>
          </button>
        </div>
      )}

      {/* Top Banner: Voyage Selector & Quick Info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Sélectionner le Voyage Scolaire</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span className="text-indigo-600 font-mono">
                {voyages.length > 0 ? `${voyages.length} voyage${voyages.length > 1 ? 's' : ''} disponible${voyages.length > 1 ? 's' : ''}` : 'Aucun voyage'}
              </span>
            </div>

            <div className="relative inline-block w-full sm:w-auto">
              <select
                id="select-voyage-active"
                value={currentVoyage?.id || ''}
                onChange={(e) => onSelectVoyage(e.target.value)}
                className="appearance-none bg-slate-50 hover:bg-slate-100 border-2 border-indigo-200 hover:border-indigo-400 text-slate-900 text-lg sm:text-xl font-extrabold rounded-xl py-2 pl-4 pr-10 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all w-full sm:min-w-[320px]"
              >
                {voyages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.has_password && !isConsultation ? '🔒 ' : ''}{v.nom} ({v.total_complets}/{v.total_inscrits})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-700">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Quick trip badges & Sync trigger */}
          {currentVoyage && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold">{currentVoyage.destination}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Du {currentVoyage.date_depart} au {currentVoyage.date_retour}</span>
              </div>

              {currentVoyage.has_password && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium ${
                  isConsultation
                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                    : isLockedByPassword || (!voyagePassword && !isAdmin)
                    ? 'bg-amber-100/80 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  {isConsultation ? (
                    <Eye className="w-3.5 h-3.5 text-sky-600" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isConsultation
                      ? 'Consultation Déverrouillée'
                      : isLockedByPassword || (!voyagePassword && !isAdmin)
                      ? 'Accès Verrouillé'
                      : 'Accès Déverrouillé'}
                  </span>
                  {!isConsultation && (isLockedByPassword || (!voyagePassword && !isAdmin)) && onRequestUnlock && (
                    <button
                      onClick={onRequestUnlock}
                      className="ml-1 text-xs font-bold underline text-amber-900 hover:text-indigo-900"
                    >
                      (Déverrouiller)
                    </button>
                  )}
                  {!isConsultation && voyagePassword && !isAdmin && onLockVoyage && (
                    <button
                      onClick={onLockVoyage}
                      className="ml-1 text-[11px] underline text-slate-500 hover:text-slate-800"
                      title="Verrouiller à nouveau"
                    >
                      (Reverrouiller)
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-xl border border-indigo-100 font-medium">
                <span>DocuSeal : <strong>{currentVoyage.docuseal_instance_name}</strong></span>
              </div>
              <button
                id="btn-sync-now"
                onClick={handleSyncNow}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Synchronisation...' : '🔄 Synchroniser maintenant'}</span>
              </button>

              <button
                id="btn-quick-relance-masse"
                onClick={() => setShowMassRelanceModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl font-bold shadow-xs transition-all text-xs cursor-pointer"
                title="Envoyer une relance en masse aux parents des dossiers incomplets"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>📨 Relance en masse</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 rounded-xl font-bold border border-rose-200 shadow-2xs transition-all text-xs"
                  title="Supprimer ce voyage (Accès Administrateur)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer le voyage</span>
                </button>
              )}
            </div>
          )}
        </div>

        {syncNotice && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{syncNotice}</span>
            </div>
            <span className="text-[11px] text-emerald-700">Dernière mise à jour à l'instant</span>
          </div>
        )}
      </div>

      {/* 5 Prominent Metric Cards (With Clickable Doublons Filter) */}
      {currentVoyage && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Total Dossiers */}
          <button
            type="button"
            id="card-filter-tous"
            onClick={() => setSelectedStatut('Tous')}
            className={`text-left rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer border ${
              selectedStatut === 'Tous'
                ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-500 shadow-sm'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
            title="Cliquer pour afficher tous les élèves"
          >
            <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Total Inscrits</span>
              {selectedStatut === 'Tous' && (
                <span className="text-[10px] font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                  Tous
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {currentVoyage.total_inscrits}
              </span>
              <span className="text-xs font-semibold text-slate-400">élèves</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Dossiers DocuSeal
            </div>
          </button>

          {/* Card 2: Complets (🟢 2/2) */}
          <button
            type="button"
            id="card-filter-complets"
            onClick={() => setSelectedStatut(selectedStatut === 'COMPLET' ? 'Tous' : 'COMPLET')}
            className={`text-left rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer border ${
              selectedStatut === 'COMPLET'
                ? 'bg-emerald-100/90 border-emerald-400 ring-2 ring-emerald-500 shadow-sm'
                : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/60'
            }`}
            title="Cliquer pour filtrer les dossiers complets (2/2 signatures)"
          >
            <div className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Complètes</span>
              </div>
              {selectedStatut === 'COMPLET' && (
                <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                  Actif
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-emerald-700 tracking-tight">
                {currentVoyage.total_complets}
              </span>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                🟢 2 / 2
              </span>
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-2">
              {currentVoyage.total_inscrits > 0
                ? `${Math.round((currentVoyage.total_complets / currentVoyage.total_inscrits) * 100)}% au complet`
                : 'Aucun inscrit'}
            </div>
          </button>

          {/* Card 3: À Finaliser (🟠 1/2) */}
          <button
            type="button"
            id="card-filter-afinaliser"
            onClick={() => setSelectedStatut(selectedStatut === 'A_FINALISER' ? 'Tous' : 'A_FINALISER')}
            className={`text-left rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer border ${
              selectedStatut === 'A_FINALISER'
                ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-500 shadow-sm'
                : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/60'
            }`}
            title="Cliquer pour filtrer les dossiers à finaliser (1/2 signature)"
          >
            <div className="text-xs font-extrabold text-amber-800 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>À Finaliser</span>
              </div>
              {selectedStatut === 'A_FINALISER' && (
                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                  Actif
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-amber-700 tracking-tight">
                {currentVoyage.total_a_finaliser}
              </span>
              <span className="text-xs font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                🟠 1 / 2
              </span>
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-2">
              1 signature manquante
            </div>
          </button>

          {/* Card 4 (NOUVEAU): Doublons (⚠️ Même nom et prénom) - Positionné entre À finaliser et Non signés */}
          <button
            type="button"
            id="card-filter-doublons"
            onClick={() => setSelectedStatut(selectedStatut === 'DOUBLONS' ? 'Tous' : 'DOUBLONS')}
            className={`text-left rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer border ${
              selectedStatut === 'DOUBLONS'
                ? 'bg-purple-100/95 border-purple-400 ring-2 ring-purple-500 shadow-sm'
                : 'bg-purple-50/70 border-purple-200 hover:bg-purple-100/70'
            }`}
            title="Cliquer pour faire remonter la liste des élèves dont le nom et le prénom sont identiques"
          >
            <div className="text-xs font-extrabold text-purple-800 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-purple-600" />
                <span>Doublons</span>
              </div>
              {selectedStatut === 'DOUBLONS' && (
                <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded">
                  Actif
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-purple-700 tracking-tight">
                {totalDoublonsCount}
              </span>
              <span className="text-xs font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                ⚠️ {totalDoublonsCount} dossier{totalDoublonsCount > 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-[11px] text-purple-700 font-medium mt-2">
              {totalDoublonsCount > 0
                ? 'Mêmes nom/prénom (cliquer)'
                : 'Aucun doublon'}
            </div>
          </button>

          {/* Card 5: Non Signés (🔴 0/2) */}
          <button
            type="button"
            id="card-filter-nonsignes"
            onClick={() => setSelectedStatut(selectedStatut === 'NON_SIGNE' ? 'Tous' : 'NON_SIGNE')}
            className={`text-left rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer border ${
              selectedStatut === 'NON_SIGNE'
                ? 'bg-rose-100/90 border-rose-400 ring-2 ring-rose-500 shadow-sm'
                : 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/60'
            }`}
            title="Cliquer pour filtrer les dossiers non signés (0/2 signature)"
          >
            <div className="text-xs font-extrabold text-rose-800 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Non Signés</span>
              </div>
              {selectedStatut === 'NON_SIGNE' && (
                <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">
                  Actif
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-rose-700 tracking-tight">
                {currentVoyage.total_non_signes}
              </span>
              <span className="text-xs font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                🔴 0 / 2
              </span>
            </div>
            <div className="text-[11px] text-rose-700 font-medium mt-2">
              Aucune signature
            </div>
          </button>
        </div>
      )}

      {/* Effectif par classe (Répartition & Roster Headcount) */}
      {currentVoyage && classStatistics.length > 0 && (
        <div id="section-effectif-par-classe" className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Effectif par classe
                  </h3>
                  <span className="text-[11px] font-extrabold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    {classStatistics.length} classe{classStatistics.length > 1 ? 's' : ''} • {currentVoyage.total_inscrits} élève{currentVoyage.total_inscrits > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Répartition des inscriptions par classe • Cliquez sur une classe pour filtrer le tableau ci-dessous
                </p>
              </div>
            </div>

            {selectedClasse !== 'Toutes' && (
              <button
                type="button"
                onClick={() => setSelectedClasse('Toutes')}
                className="self-start sm:self-auto text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Afficher à nouveau toutes les classes"
              >
                <span>✕ Afficher toutes les classes (actuel: {selectedClasse})</span>
              </button>
            )}
          </div>

          {/* Grid of class headcount cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {classStatistics.map((stat) => {
              const isSelected = selectedClasse === stat.classe;
              const percentOfTotal =
                currentVoyage.total_inscrits > 0
                  ? Math.round((stat.total / currentVoyage.total_inscrits) * 100)
                  : 0;

              return (
                <button
                  key={stat.classe}
                  type="button"
                  id={`btn-class-card-${stat.classe}`}
                  onClick={() => setSelectedClasse(isSelected ? 'Toutes' : stat.classe)}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-400 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                  title={`Cliquer pour filtrer la classe ${stat.classe}`}
                >
                  {/* Top line: Class name + selection badge */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-slate-900 tracking-tight bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                      Classe {stat.classe}
                    </span>
                    {isSelected ? (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                        Sélectionnée
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400">
                        {percentOfTotal}%
                      </span>
                    )}
                  </div>

                  {/* Main Headcount number */}
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {stat.total}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      élève{stat.total > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Visual Completion Progress Bar */}
                  <div className="mt-2 w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden flex">
                    {stat.complets > 0 && (
                      <div
                        style={{ width: `${(stat.complets / (stat.total || 1)) * 100}%` }}
                        className="bg-emerald-500 h-full"
                        title={`${stat.complets} complets (2/2)`}
                      />
                    )}
                    {stat.aFinaliser > 0 && (
                      <div
                        style={{ width: `${(stat.aFinaliser / (stat.total || 1)) * 100}%` }}
                        className="bg-amber-500 h-full"
                        title={`${stat.aFinaliser} à finaliser (1/2)`}
                      />
                    )}
                    {stat.nonSignes > 0 && (
                      <div
                        style={{ width: `${(stat.nonSignes / (stat.total || 1)) * 100}%` }}
                        className="bg-rose-500 h-full"
                        title={`${stat.nonSignes} non signés (0/2)`}
                      />
                    )}
                  </div>

                  {/* Detailed counter pills */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-emerald-700 flex items-center gap-0.5" title="Complets (2/2)">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      {stat.complets}
                    </span>
                    <span className="text-amber-700 flex items-center gap-0.5" title="À finaliser (1/2)">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                      {stat.aFinaliser}
                    </span>
                    <span className="text-rose-700 flex items-center gap-0.5" title="Non signés (0/2)">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                      {stat.nonSignes}
                    </span>
                    {stat.doublons > 0 && (
                      <span className="text-purple-700 font-bold" title="Doublons détectés">
                        ⚠️{stat.doublons}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="input-search-eleve"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élève, une classe, un parent..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Filters & Export Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Classe filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Classe :</span>
              <select
                id="select-filter-classe"
                value={selectedClasse}
                onChange={(e) => setSelectedClasse(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Toutes">Toutes les classes ({currentVoyage.total_inscrits})</option>
                {classStatistics.map((c) => (
                  <option key={c.classe} value={c.classe}>
                    Classe {c.classe} ({c.total} élève{c.total > 1 ? 's' : ''} • {c.complets} compl.)
                  </option>
                ))}
              </select>
            </div>

            {/* Statut filter: includes Doublons between A_FINALISER and NON_SIGNE */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Statut :</span>
              <select
                id="select-filter-statut"
                value={selectedStatut}
                onChange={(e) => setSelectedStatut(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Tous">Tous les statuts</option>
                <option value="COMPLET">🟢 Complets (2/2)</option>
                <option value="A_FINALISER">🟠 À finaliser (1/2)</option>
                <option value="DOUBLONS">⚠️ Doublons ({totalDoublonsCount})</option>
                <option value="NON_SIGNE">🔴 Non signés (0/2)</option>
              </select>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Export Excel */}
            <button
              id="btn-export-excel"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              title="Télécharger la liste sous format Excel (.xlsx)"
            >
              <FileSpreadsheet className={`w-4 h-4 text-emerald-600 ${isExportingExcel ? 'animate-spin' : ''}`} />
              <span>{isExportingExcel ? 'Export...' : 'Excel (.xlsx)'}</span>
            </button>

            {/* Export PDF */}
            <button
              id="btn-export-pdf"
              onClick={() => setShowPdfModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors"
              title="Générer une liste imprimable officielle en PDF"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              <span>📄 Exporter PDF</span>
            </button>

            {/* Relance en masse */}
            <button
              id="btn-export-relance-masse"
              onClick={() => setShowMassRelanceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Envoyer un email de rappel / relance en masse aux parents"
            >
              <Mail className="w-4 h-4 text-amber-700" />
              <span>Relance en masse</span>
            </button>
          </div>
        </div>

        {/* Student list summary count */}
        <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
          <span>
            Affichage de <strong>{sortedInscriptions.length}</strong> élève(s) correspondant aux filtres
            {selectedStatut === 'DOUBLONS' && (
              <span className="ml-2 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Filtre Doublons actif
              </span>
            )}
          </span>
          {currentVoyage?.last_sync_at && (
            <span className="font-mono text-[11px]">
              Dernière synchro DocuSeal : {currentVoyage.last_sync_at}
            </span>
          )}
        </div>

        {selectedStatut === 'DOUBLONS' && (
          <div className="p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                Affichage ciblé : <strong>Élèves en doublon</strong> (nom et prénom identiques dans ce voyage).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStatut('Tous')}
              className="text-xs font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
            >
              Afficher tous les statuts
            </button>
          </div>
        )}
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => {
                    if (sortColumn === 'nom') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('nom');
                      setSortDirection('asc');
                    }
                  }}
                  title="Trier par ordre alphabétique"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Élève</span>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                      {sortColumn === 'nom' ? (sortDirection === 'asc' ? 'A → Z' : 'Z → A') : 'A-Z'}
                    </span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => {
                    if (sortColumn === 'classe') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('classe');
                      setSortDirection('asc');
                    }
                  }}
                  title="Trier par classe"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Classe</span>
                    {sortColumn === 'classe' && <span className="text-[10px] text-indigo-600">●</span>}
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Signatures</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  onClick={() => {
                    if (sortColumn === 'statut') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('statut');
                      setSortDirection('asc');
                    }
                  }}
                  title="Trier par statut"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Statut</span>
                    {sortColumn === 'statut' && <span className="text-[10px] text-indigo-600">●</span>}
                  </div>
                </th>
                <th className="py-3 px-4">Parent 1</th>
                <th className="py-3 px-4">Parent 2</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Chargement des inscriptions...</span>
                  </td>
                </tr>
              ) : !isConsultation && (isLockedByPassword || (currentVoyage?.has_password && !isAdmin && !voyagePassword)) ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="max-w-md mx-auto p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">Accès restreint par mot de passe</h3>
                      <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                        L'accès aux inscriptions et coordonnées des familles pour le voyage <strong>{currentVoyage?.nom}</strong> est protégé.
                      </p>
                      {onRequestUnlock && (
                        <button
                          type="button"
                          onClick={onRequestUnlock}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                          <KeyRound className="w-4 h-4" />
                          <span>Saisir le mot de passe enseignant</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : sortedInscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="text-sm font-semibold">
                      {selectedStatut === 'DOUBLONS'
                        ? 'Aucun élève en doublon détecté pour ce voyage.'
                        : 'Aucun élève ne correspond à votre recherche.'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {selectedStatut === 'DOUBLONS'
                        ? 'Tous les noms et prénoms d\'élèves inscrits sont uniques.'
                        : 'Modifiez vos filtres de recherche ou sélectionnez une autre classe.'}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedInscriptions.map((eleve) => {
                  const p1Signed = eleve.parent1.statut === 'signed';
                  const p2Signed = eleve.parent2.statut === 'signed';
                  const isDuplicate = duplicateNameKeys.has(normalizeKey(eleve.eleve_nom, eleve.eleve_prenom));

                  return (
                    <tr
                      key={eleve.id}
                      onClick={() => setActiveStudent(eleve)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors group ${
                        isDuplicate ? 'bg-purple-50/20' : ''
                      }`}
                    >
                      {/* Student Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 border ${
                              isDuplicate
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {eleve.eleve_nom.startsWith('DOSSIER') ? '#' : `${eleve.eleve_prenom.charAt(0)}${eleve.eleve_nom.charAt(0)}`}
                          </span>
                          <div>
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{eleve.eleve_nom} {eleve.eleve_prenom !== '(En attente)' ? eleve.eleve_prenom : ''}</span>
                              {eleve.eleve_prenom === '(En attente)' && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  En attente saisie
                                </span>
                              )}
                              {isDuplicate && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300 px-1.5 py-0.5 rounded-md"
                                  title="Attention : Un autre dossier existe avec le même nom et le même prénom pour ce voyage"
                                >
                                  <Copy className="w-3 h-3 text-purple-600" />
                                  Doublon
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Réf DocuSeal: #{eleve.docuseal_submission_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClasseStudent(eleve);
                            setNewClasseValue(eleve.classe === 'Non spécifiée' ? (currentVoyage.classes_concernees[0] && currentVoyage.classes_concernees[0] !== 'Toutes' ? currentVoyage.classes_concernees[0] : '') : eleve.classe);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-xs border transition-all cursor-pointer group ${
                            eleve.classe === 'Non spécifiée'
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                              : eleve.classe_modifiee_manuellement
                              ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 hover:border-blue-400'
                              : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-200 hover:border-emerald-300'
                          }`}
                          title={eleve.classe_modifiee_manuellement ? "Classe corrigée manuellement sur le portail (cliquer pour modifier)" : "Cliquer pour modifier ou assigner la classe"}
                        >
                          <span>{eleve.classe}</span>
                          <Pencil className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 text-slate-500 group-hover:text-emerald-700" />
                        </button>
                      </td>

                      {/* Signature Dots (● ●, ● ○, ○ ○) */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-full border border-slate-200/80">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              p1Signed ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            title={p1Signed ? 'Parent 1 : Signé' : 'Parent 1 : En attente'}
                          />
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              p2Signed ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            title={p2Signed ? 'Parent 2 : Signé' : 'Parent 2 : En attente'}
                          />
                          <span className="text-[10px] font-bold text-slate-600 ml-1 font-mono">
                            {eleve.nombre_signatures}/2
                          </span>
                        </div>
                      </td>

                      {/* Statut Badge (🟢 COMPLET, 🟠 1/2, 🔴 0/2) */}
                      <td className="py-3.5 px-3">
                        {eleve.statut === 'COMPLET' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            🟢 COMPLET
                          </span>
                        )}
                        {eleve.statut === 'A_FINALISER' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            🟠 1/2
                          </span>
                        )}
                        {eleve.statut === 'NON_SIGNE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            🔴 0/2
                          </span>
                        )}
                      </td>

                      {/* Parent 1 */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-semibold text-slate-900 truncate max-w-[160px]">
                          {eleve.parent1.nom}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span className={p1Signed ? 'text-emerald-700 font-bold' : 'text-amber-600'}>
                            {p1Signed ? '✓ Signé' : '○ En attente'}
                          </span>
                          {eleve.parent1.date_signature && (
                            <span className="text-[10px] text-slate-400">
                              ({eleve.parent1.date_signature.split(' ')[0]})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Parent 2 */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-semibold text-slate-900 truncate max-w-[160px]">
                          {eleve.parent2.nom}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span className={p2Signed ? 'text-emerald-700 font-bold' : 'text-amber-600'}>
                            {p2Signed ? '✓ Signé' : '○ En attente'}
                          </span>
                          {eleve.parent2.date_signature && (
                            <span className="text-[10px] text-slate-400">
                              ({eleve.parent2.date_signature.split(' ')[0]})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setActiveStudent(eleve)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Voir la fiche détaillée"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {eleve.statut === 'COMPLET' ? (
                            <a
                              href={`/api/inscriptions/${eleve.id}/document`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Télécharger le document signé"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          ) : (
                            <button
                              onClick={() => setActiveStudent(eleve)}
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Relancer un parent"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Modal */}
      {activeStudent && (
        <StudentDetailModal
          inscription={activeStudent}
          voyage={currentVoyage}
          allInscriptions={allTripInscriptions.length > 0 ? allTripInscriptions : inscriptions}
          onClose={() => setActiveStudent(null)}
          onRelanceSent={() => {
            fetchInscriptions();
            onRefreshVoyages();
          }}
          onEditClasse={(student) => {
            setEditingClasseStudent(student);
            setNewClasseValue(
              student.classe === 'Non spécifiée'
                ? currentVoyage.classes_concernees[0] && currentVoyage.classes_concernees[0] !== 'Toutes'
                  ? currentVoyage.classes_concernees[0]
                  : ''
                : student.classe
            );
          }}
        />
      )}

      {/* PDF Export Modal */}
      {showPdfModal && currentVoyage && (
        <PdfExportModal
          voyage={currentVoyage}
          inscriptions={allTripInscriptions.length > 0 ? allTripInscriptions : inscriptions}
          classesList={classesList}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* Mass Relance Modal */}
      {showMassRelanceModal && currentVoyage && (
        <MassRelanceModal
          isOpen={showMassRelanceModal}
          voyage={currentVoyage}
          inscriptions={inscriptions}
          classesList={classesList}
          onClose={() => setShowMassRelanceModal(false)}
          onSuccess={() => {
            fetchInscriptions();
            onRefreshVoyages();
          }}
        />
      )}

      {/* Delete Voyage Confirmation Modal (Admin) */}
      {showDeleteModal && currentVoyage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 text-center">
              Supprimer ce voyage ?
            </h3>

            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
              <div className="text-sm font-bold text-slate-900">{currentVoyage.nom}</div>
              <div className="text-xs text-slate-500 mt-1">
                Destination : <strong>{currentVoyage.destination}</strong> • {currentVoyage.total_inscrits} élève(s)
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-slate-500 text-center mt-3 leading-relaxed">
              Cette action retirera ce voyage et le suivi de ses inscriptions de ce portail. 
              Vos modèles et formulaires sur votre serveur DocuSeal distant ne seront pas supprimés.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError(null);
                }}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Oui, supprimer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quick Edit Classe */}
      {editingClasseStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Modifier la classe de l'élève</h3>
                  <p className="text-xs text-slate-500">
                    <span className="font-bold text-slate-800">{editingClasseStudent.eleve_nom} {editingClasseStudent.eleve_prenom}</span> (Réf #{editingClasseStudent.docuseal_submission_id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClasseStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {(() => {
                const availableClasses = Array.from(
                  new Set([
                    ...(currentVoyage.classes_concernees || []),
                    ...classesList,
                  ])
                ).filter((c) => c && c !== 'Toutes' && c !== 'Non spécifiée');

                if (availableClasses.length === 0) return null;

                return (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Classes prévues pour ce voyage :
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableClasses.map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => setNewClasseValue(cls)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            newClasseValue.toUpperCase() === cls.toUpperCase()
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nom ou code de la classe :
                </label>
                <input
                  type="text"
                  value={newClasseValue}
                  onChange={(e) => setNewClasseValue(e.target.value)}
                  placeholder="Ex: T01, 101, 202, 6A..."
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 uppercase"
                  autoFocus
                />
                <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200/70 rounded-lg text-[11px] text-blue-800 leading-relaxed">
                  <strong>ℹ️ À savoir :</strong> Sur DocuSeal, un document déjà signé électroniquement est juridiquement scellé et ne peut plus être altéré. Cette modification manuelle est enregistrée sur votre portail et sera automatiquement préservée lors de toutes les futures synchronisations.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingClasseStudent(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!newClasseValue.trim() || isSavingClasse}
                onClick={handleSaveClasse}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isSavingClasse ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <span>Enregistrer la classe</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
