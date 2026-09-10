import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Check, RefreshCw } from 'lucide-react';
import { Voyage } from '../types.js';

interface PurgeStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voyages: Voyage[];
  selectedVoyageId?: string;
  adminToken: string;
  onSuccess: () => void;
}

export const PurgeStudentsModal: React.FC<PurgeStudentsModalProps> = ({
  isOpen,
  onClose,
  voyages,
  selectedVoyageId,
  adminToken,
  onSuccess,
}) => {
  const [targetVoyageId, setTargetVoyageId] = useState<string>(selectedVoyageId || 'all');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurge = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let res: Response;
      if (targetVoyageId === 'all') {
        res = await fetch('/api/admin/purge-all-inscriptions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
        });
      } else {
        res = await fetch(`/api/voyages/${targetVoyageId}/purge-inscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message || 'Dossiers fictifs supprimés avec succès.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError(data.message || 'Erreur lors de la suppression des élèves');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const handleFullReset = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reset-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Base de données entièrement remise à zéro.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError(data.message || 'Erreur lors de la réinitialisation');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center border border-rose-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
              Nettoyage de la base
            </span>
          </div>

          <h3 className="text-xl font-bold tracking-tight">Supprimer les dossiers fictifs</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Supprimez les élèves de démonstration pour démarrer avec des listes propres et prêtes pour la synchronisation réelle DocuSeal.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Périmètre de nettoyage :
            </label>
            <select
              id="select-purge-scope"
              value={targetVoyageId}
              onChange={(e) => setTargetVoyageId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
            >
              <option value="all">Tous les voyages ({voyages.length} voyages — vider tous les élèves)</option>
              {voyages.map((v) => (
                <option key={v.id} value={v.id}>
                  Voyage "{v.nom}" uniquement ({v.total_inscrits} inscrit{v.total_inscrits > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Conservation de vos configurations</span>
            </p>
            <p className="leading-relaxed text-amber-800/90">
              Vos voyages, leurs URL DocuSeal et clés API seront <strong>conservés intacts</strong>. Seuls les dossiers d'élèves actuels seront supprimés et remis à 0.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              id="btn-full-reset-db"
              onClick={handleFullReset}
              disabled={loading}
              className="text-xs text-slate-500 hover:text-rose-700 underline transition-colors"
            >
              Remise à zéro complète (effacer tout)
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                id="btn-confirm-purge-students"
                onClick={handlePurge}
                disabled={loading}
                className="px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Purger les élèves fictifs</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
