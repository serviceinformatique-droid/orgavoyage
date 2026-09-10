import React, { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, Copy, Check, AlertCircle, X, Shield, Calculator } from 'lucide-react';

interface ConsultationPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminToken: string;
  onSuccessNotice?: (message: string) => void;
}

export const ConsultationPasswordModal: React.FC<ConsultationPasswordModalProps> = ({
  isOpen,
  onClose,
  adminToken,
  onSuccessNotice,
}) => {
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current consultation password from server
  const fetchCurrentPassword = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/consultation-password', {
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentPassword(data.password || 'Compta2027');
      } else {
        setError(data.message || 'Impossible de récupérer le mot de passe actuel');
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCurrentPassword();
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setSuccess(null);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!currentPassword) return;
    navigator.clipboard.writeText(currentPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = newPassword.trim();
    if (trimmed.length < 3) {
      setError('Le mot de passe doit comporter au moins 3 caractères.');
      return;
    }

    if (trimmed !== confirmPassword.trim()) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/change-consultation-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ newPassword: trimmed }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentPassword(data.password || trimmed);
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('✓ Le mot de passe de consultation a été mis à jour avec succès.');
        if (onSuccessNotice) {
          onSuccessNotice('✓ Mot de passe consultation (comptable) mis à jour.');
        }
      } else {
        setError(data.message || 'Erreur lors de la mise à jour du mot de passe');
      }
    } catch {
      setError('Erreur réseau lors de la communication avec le serveur.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center border border-sky-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60">
              Accès Lecture Seule • Service Comptabilité
            </span>
          </div>

          <h3 className="text-xl font-extrabold tracking-tight">
            Mot de Passe Consultation (Comptable)
          </h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Permet à la comptable ou au service financier de visualiser l'intégralité des voyages scolaires et des élèves inscrits en conservant le menu déroulant, sans droits de modification.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Current Password View */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Mot de passe actuel en vigueur :
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? 'Masquer' : 'Afficher'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 bg-white border border-slate-300 rounded-xl px-4 py-2.5">
              <div className="font-mono text-base font-extrabold tracking-wide text-slate-900">
                {loading ? (
                  <span className="text-xs text-slate-400 font-sans">Chargement...</span>
                ) : showPassword ? (
                  currentPassword || 'Non configuré'
                ) : (
                  '••••••••••••'
                )}
              </div>

              <button
                type="button"
                id="btn-copy-consultation-password"
                onClick={handleCopy}
                disabled={loading || !currentPassword}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                title="Copier le mot de passe dans le presse-papier"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mt-2 leading-normal">
              Communiquez ce mot de passe à la comptable. Lors de sa connexion via le bouton <strong>Accès Admin</strong>, elle choisira l'onglet <strong>Comptabilité</strong> pour déverrouiller tous les voyages.
            </p>
          </div>

          {/* Form to change password */}
          <form onSubmit={handleSave} className="space-y-4 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-sky-600" />
              <span>Définir un nouveau mot de passe de consultation</span>
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nouveau mot de passe de consultation
                </label>
                <input
                  id="input-new-consultation-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ex: ComptaNDM2027"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  id="input-confirm-consultation-password"
                  type="text"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ressaisissez le mot de passe..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Fermer
              </button>
              <button
                id="btn-save-consultation-password"
                type="submit"
                disabled={saving || !newPassword.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? 'Enregistrement...' : 'Mettre à jour le mot de passe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
