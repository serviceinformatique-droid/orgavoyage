import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { StudentDetailModal } from './StudentDetailModal.js';
import { PdfExportModal } from './PdfExportModal.js';
import { MassRelanceModal } from './MassRelanceModal.js';

interface TeacherDashboardProps {
  voyages: Voyage[];
  selectedVoyageId: string;
  onSelectVoyage: (id: string) => void;
  onRefreshVoyages: () => void;
  voyagePassword?: string;
  onRequestUnlock?: () => void;
  onLockVoyage?: () => void;
  isAdmin?: boolean;
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
}) => {
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLockedByPassword, setIsLockedByPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClasse, setSelectedClasse] = useState('Toutes');
  const [selectedStatut, setSelectedStatut] = useState('Tous');
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Modals state
  const [activeStudent, setActiveStudent] = useState<Inscription | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showMassRelanceModal, setShowMassRelanceModal] = useState(false);

  const currentVoyage = voyages.find((v) => v.id === selectedVoyageId) || voyages[0];

  // Fetch inscriptions for current trip
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
  }, [selectedVoyageId, searchQuery, selectedClasse, selectedStatut, voyagePassword, isAdmin]);

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
        await fetchInscriptions();
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

  const handleExportExcel = () => {
    if (!currentVoyage) return;
    if (currentVoyage.has_password && !isAdmin && !voyagePassword) {
      if (onRequestUnlock) onRequestUnlock();
      return;
    }
    const params = new URLSearchParams();
    if (voyagePassword) params.append('password', voyagePassword);
    const token = sessionStorage.getItem('ndm_admin_token');
    if (isAdmin && token) params.append('adminToken', token);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    window.location.href = `/api/voyages/${currentVoyage.id}/export/excel${queryStr}`;
  };

  // Available classes for dropdown: dynamically include individual classes from inscriptions
  const extractedClasses = Array.from(
    new Set(
      inscriptions
        .map((i) => i.classe)
        .filter((c) => Boolean(c) && c !== 'Non spécifiée' && c !== 'En attente')
    )
  );

  const configuredClasses = (currentVoyage?.classes_concernees || []).flatMap((c) =>
    c.includes('-') ? c.split('-').map((x) => x.trim()) : [c.trim()]
  ).filter((c) => c && c !== 'Toutes');

  const classesList = ['Toutes', ...Array.from(new Set([...configuredClasses, ...extractedClasses])).sort()];

  if (voyages.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-8">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
          <Calendar className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Aucun voyage scolaire configuré</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
          La base de démonstration a été effacée. Pour commencer à suivre les signatures de vos élèves, connectez-vous à l'espace <strong>Administration DocuSeal</strong> pour configurer vos voyages et vos clés API.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
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
                    {v.has_password ? '🔒 ' : ''}{v.nom} ({v.total_complets}/{v.total_inscrits})
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
                  isLockedByPassword || (!voyagePassword && !isAdmin)
                    ? 'bg-amber-100/80 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {isLockedByPassword || (!voyagePassword && !isAdmin)
                      ? 'Accès Verrouillé'
                      : 'Accès Déverrouillé'}
                  </span>
                  {(isLockedByPassword || (!voyagePassword && !isAdmin)) && onRequestUnlock && (
                    <button
                      onClick={onRequestUnlock}
                      className="ml-1 text-xs font-bold underline text-amber-900 hover:text-indigo-900"
                    >
                      (Déverrouiller)
                    </button>
                  )}
                  {voyagePassword && !isAdmin && onLockVoyage && (
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

      {/* 3 Prominent Metric Cards (Section 7: 10 seconds understanding) */}
      {currentVoyage && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Inscrits */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Inscrits
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {currentVoyage.total_inscrits}
              </span>
              <span className="text-xs font-semibold text-slate-400">élèves</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Dossiers créés dans DocuSeal
            </div>
          </div>

          {/* Card: Complets (🟢 2/2) */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Inscriptions Complètes</span>
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
                ? `${Math.round((currentVoyage.total_complets / currentVoyage.total_inscrits) * 100)}% des familles au complet`
                : 'Aucun inscrit'}
            </div>
          </div>

          {/* Card: À Finaliser (🟠 1/2) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>À Finaliser</span>
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
              1 signature manquante (à relancer)
            </div>
          </div>

          {/* Card: Non Signés (🔴 0/2) */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-extrabold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Non Signés</span>
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
              Aucune signature reçue
            </div>
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
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Toutes">Toutes les classes</option>
                {classesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Statut filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Statut :</span>
              <select
                id="select-filter-statut"
                value={selectedStatut}
                onChange={(e) => setSelectedStatut(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Tous">Tous les statuts</option>
                <option value="COMPLET">🟢 Complets (2/2)</option>
                <option value="A_FINALISER">🟠 À finaliser (1/2)</option>
                <option value="NON_SIGNE">🔴 Non signés (0/2)</option>
              </select>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Export Excel */}
            <button
              id="btn-export-excel"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors"
              title="Télécharger la liste sous format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel (.xlsx)</span>
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
            Affichage de <strong>{inscriptions.length}</strong> élève(s) correspondant aux filtres
          </span>
          {currentVoyage?.last_sync_at && (
            <span className="font-mono text-[11px]">
              Dernière synchro DocuSeal : {currentVoyage.last_sync_at}
            </span>
          )}
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Élève</th>
                <th className="py-3 px-3 text-center">Classe</th>
                <th className="py-3 px-3 text-center">Signatures</th>
                <th className="py-3 px-3">Statut</th>
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
              ) : isLockedByPassword || (currentVoyage?.has_password && !isAdmin && !voyagePassword) ? (
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
              ) : inscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="text-sm font-semibold">Aucun élève ne correspond à votre recherche.</div>
                    <div className="text-xs text-slate-400 mt-1">Modifiez vos filtres de recherche ou sélectionnez une autre classe.</div>
                  </td>
                </tr>
              ) : (
                inscriptions.map((eleve) => {
                  const p1Signed = eleve.parent1.statut === 'signed';
                  const p2Signed = eleve.parent2.statut === 'signed';

                  return (
                    <tr
                      key={eleve.id}
                      onClick={() => setActiveStudent(eleve)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Student Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-black shrink-0 border border-slate-200">
                            {eleve.eleve_nom.startsWith('DOSSIER') ? '#' : `${eleve.eleve_prenom.charAt(0)}${eleve.eleve_nom.charAt(0)}`}
                          </span>
                          <div>
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              <span>{eleve.eleve_nom} {eleve.eleve_prenom !== '(En attente)' ? eleve.eleve_prenom : ''}</span>
                              {eleve.eleve_prenom === '(En attente)' && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  En attente saisie
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
                        <span className="inline-block px-2.5 py-0.5 rounded-md font-bold text-xs bg-slate-100 text-slate-700 border border-slate-200">
                          {eleve.classe}
                        </span>
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
          onClose={() => setActiveStudent(null)}
          onRelanceSent={() => {
            fetchInscriptions();
            onRefreshVoyages();
          }}
        />
      )}

      {/* PDF Export Modal */}
      {showPdfModal && currentVoyage && (
        <PdfExportModal
          voyage={currentVoyage}
          inscriptions={inscriptions}
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
    </div>
  );
};
