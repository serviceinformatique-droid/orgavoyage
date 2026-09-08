import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.token);
        onClose();
      } else {
        setError(data.message || 'Mot de passe administrateur incorrect');
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
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mb-3 border border-indigo-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">Accès Administration DocuSeal</h3>
          <p className="text-xs text-slate-300 mt-1">
            Gestion sécurisée des instances DocuSeal, des clés API et de la configuration des voyages.
          </p>
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
              Mot de passe administrateur
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
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
              <span>Accès réservé aux administrateurs du portail DocuSeal.</span>
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
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? 'Vérification...' : 'Déverrouiller l’espace Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
