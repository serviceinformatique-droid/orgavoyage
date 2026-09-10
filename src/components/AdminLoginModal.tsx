import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, AlertCircle, X, ShieldCheck, Eye, Shield, Calculator } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, role: 'admin' | 'consultation') => void;
  initialMode?: 'admin' | 'consultation';
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'admin',
}) => {
  const [activeMode, setActiveMode] = useState<'admin' | 'consultation'>(initialMode);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
      setPassword('');
      setError(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeMode, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.token, activeMode);
        onClose();
      } else {
        setError(
          data.message ||
            (activeMode === 'admin'
              ? 'Mot de passe administrateur incorrect'
              : 'Mot de passe de consultation incorrect')
        );
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header with Mode Switcher */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30">
              {activeMode === 'admin' ? <Shield className="w-5 h-5 text-emerald-400" /> : <Eye className="w-5 h-5 text-sky-400" />}
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
                {activeMode === 'admin' ? 'Espace Administration' : 'Consultation Comptabilité'}
              </span>
            </div>
          </div>

          <h3 className="text-xl font-bold tracking-tight">
            {activeMode === 'admin' ? 'Accès Administrateur DocuSeal' : 'Accès Consultation (Comptable)'}
          </h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {activeMode === 'admin'
              ? 'Gestion des instances DocuSeal, paramétrage des clés API, synchronisation et voyages.'
              : 'Consultation libre de tous les voyages et de la liste des élèves inscrits (lecture seule).'}
          </p>

          {/* Mode toggle pills */}
          <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 bg-slate-800/80 rounded-xl border border-slate-700">
            <button
              type="button"
              id="tab-mode-admin"
              onClick={() => {
                setActiveMode('admin');
                setError(null);
                setPassword('');
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'admin'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Administrateur</span>
            </button>

            <button
              type="button"
              id="tab-mode-consultation"
              onClick={() => {
                setActiveMode('consultation');
                setError(null);
                setPassword('');
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'consultation'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Comptabilité</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {activeMode === 'admin' ? 'Mot de passe administrateur' : 'Mot de passe consultation (Comptable)'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="input-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Saisissez votre mot de passe..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
                autoFocus
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {activeMode === 'admin'
                  ? 'Autorise la configuration globale et la gestion des instances.'
                  : 'Donne accès à tous les voyages et inscrits avec le menu déroulant.'}
              </span>
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 ${
                activeMode === 'admin'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-sky-600 hover:bg-sky-700'
              }`}
            >
              {loading
                ? 'Vérification...'
                : activeMode === 'admin'
                ? 'Déverrouiller l’espace Admin'
                : 'Accéder en consultation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
