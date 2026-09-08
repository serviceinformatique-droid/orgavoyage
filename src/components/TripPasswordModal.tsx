import React, { useState } from 'react';
import { Voyage } from '../types.js';
import { Lock, KeyRound, Eye, EyeOff, ArrowRight, ShieldAlert, ArrowLeft } from 'lucide-react';

interface TripPasswordModalProps {
  voyage: Voyage;
  isOpen: boolean;
  onUnlock: (password: string) => void;
  onCancel?: () => void;
}

export const TripPasswordModal: React.FC<TripPasswordModalProps> = ({
  voyage,
  isOpen,
  onUnlock,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Veuillez saisir le mot de passe.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/voyages/${voyage.id}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        onUnlock(password.trim());
      } else {
        setError(data.message || 'Mot de passe incorrect pour ce voyage.');
      }
    } catch {
      setError('Erreur réseau lors de la vérification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 text-center relative">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 mb-3 shadow-inner">
            <Lock className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Accès restreint au voyage</h2>
          <p className="text-sm font-semibold text-indigo-200 mt-1">{voyage.nom}</p>
          <div className="text-xs text-slate-400 mt-0.5">
            {voyage.destination} • {voyage.etablissement}
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
          <p className="text-xs text-slate-600 leading-relaxed text-center">
            Les listes des élèves et signatures de ce voyage sont protégées. Saisissez le mot de passe enseignant transmis par l’organisateur ou l’administration.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in duration-150">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mot de passe du voyage
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Entrez le mot de passe..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Vérification...' : 'Déverrouiller le voyage'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Choisir un autre voyage</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
