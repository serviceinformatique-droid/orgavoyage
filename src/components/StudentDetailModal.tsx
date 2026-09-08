import React, { useState } from 'react';
import { Inscription, Voyage } from '../types.js';
import {
  X,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download,
  Mail,
  Copy,
  Check,
  Phone,
  User,
  ShieldCheck,
  Calendar,
  Sparkles
} from 'lucide-react';

interface StudentDetailModalProps {
  inscription: Inscription | null;
  voyage: Voyage | null;
  onClose: () => void;
  onRelanceSent: () => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  inscription,
  voyage,
  onClose,
  onRelanceSent,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [relanceSending, setRelanceSending] = useState(false);
  const [relanceSuccess, setRelanceSuccess] = useState<string | null>(null);

  if (!inscription || !voyage) return null;

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendRelance = async (parentNum?: 1 | 2) => {
    setRelanceSending(true);
    setRelanceSuccess(null);
    try {
      const res = await fetch(`/api/inscriptions/${inscription.id}/relance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentNum }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRelanceSuccess(data.message);
        onRelanceSent();
      } else {
        alert(data.message || 'Erreur lors de l’envoi de la relance');
      }
    } catch {
      alert('Erreur réseau lors de la relance');
    } finally {
      setRelanceSending(false);
    }
  };

  const docusealBase = voyage.docuseal_url || 'https://docuseal.ndmissions.fr';
  const signingLink = `${docusealBase}/s/${inscription.docuseal_submission_id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Fiche Dossier DocuSeal
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Réf : {inscription.docuseal_submission_id}
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {inscription.eleve_prenom} {inscription.eleve_nom}
          </h2>
          <p className="text-sm text-slate-300 mt-0.5">
            Classe <strong className="text-white font-semibold">{inscription.classe}</strong> • {voyage.nom}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Status highlight banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              inscription.statut === 'COMPLET'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : inscription.statut === 'A_FINALISER'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                  inscription.statut === 'COMPLET'
                    ? 'bg-emerald-200 text-emerald-800'
                    : inscription.statut === 'A_FINALISER'
                    ? 'bg-amber-200 text-amber-800'
                    : 'bg-rose-200 text-rose-800'
                }`}
              >
                {inscription.nombre_signatures}/2
              </div>
              <div>
                <div className="font-extrabold text-sm tracking-wide">
                  {inscription.statut === 'COMPLET' && '🟢 INSCRIPTION COMPLÈTE'}
                  {inscription.statut === 'A_FINALISER' && '🟠 INSCRIPTION INCOMPLÈTE (1 SIGNATURE SUR 2)'}
                  {inscription.statut === 'NON_SIGNE' && '🔴 AUCUNE SIGNATURE (0 SUR 2)'}
                </div>
                <div className="text-xs opacity-80 mt-0.5">
                  {inscription.statut === 'COMPLET' && 'Le dossier est légalement et administrativement finalisé.'}
                  {inscription.statut === 'A_FINALISER' && 'Un second représentant légal doit encore signer électroniquement.'}
                  {inscription.statut === 'NON_SIGNE' && 'Le formulaire a été envoyé mais aucun parent n’a signé.'}
                </div>
              </div>
            </div>

            {/* Visual signature indicators */}
            <div className="flex items-center gap-1.5 shrink-0 ml-4">
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  inscription.parent1.statut === 'signed' ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title="Parent 1"
              />
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  inscription.parent2.statut === 'signed' ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title="Parent 2"
              />
            </div>
          </div>

          {relanceSuccess && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{relanceSuccess}</span>
            </div>
          )}

          {/* Detailed Signers section */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              État des Signataires Requis
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Parent 1 */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  inscription.parent1.statut === 'signed'
                    ? 'bg-slate-50/70 border-emerald-200'
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    Parent 1
                  </span>
                  {inscription.parent1.statut === 'signed' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Signé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      En attente
                    </span>
                  )}
                </div>

                <div className="text-sm font-bold text-slate-900">{inscription.parent1.nom}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{inscription.parent1.email}</span>
                </div>
                {inscription.parent1.telephone && (
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{inscription.parent1.telephone}</span>
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] text-slate-500">
                  {inscription.parent1.statut === 'signed' ? (
                    <span className="text-emerald-700 font-medium">
                      Horodaté le {inscription.parent1.date_signature}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSendRelance(1)}
                      disabled={relanceSending}
                      className="text-amber-700 hover:text-amber-900 font-bold underline"
                    >
                      Relancer Parent 1 →
                    </button>
                  )}
                </div>
              </div>

              {/* Parent 2 */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  inscription.parent2.statut === 'signed'
                    ? 'bg-slate-50/70 border-emerald-200'
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    Parent 2
                  </span>
                  {inscription.parent2.statut === 'signed' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Signé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      En attente
                    </span>
                  )}
                </div>

                <div className="text-sm font-bold text-slate-900">{inscription.parent2.nom}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{inscription.parent2.email}</span>
                </div>
                {inscription.parent2.telephone && (
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{inscription.parent2.telephone}</span>
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] text-slate-500">
                  {inscription.parent2.statut === 'signed' ? (
                    <span className="text-emerald-700 font-medium">
                      Horodaté le {inscription.parent2.date_signature}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSendRelance(2)}
                      disabled={relanceSending}
                      className="text-amber-700 hover:text-amber-900 font-bold underline"
                    >
                      Relancer Parent 2 →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sync dates & Technical details */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-600 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Date de première création :</span>
              <span className="font-semibold text-slate-700">{inscription.date_creation}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Dernière synchronisation API :</span>
              <span className="font-semibold text-slate-700">{inscription.date_derniere_synchronisation}</span>
            </div>
            {inscription.derniere_relance && (
              <div className="flex justify-between text-amber-700">
                <span>Dernière relance envoyée :</span>
                <span className="font-semibold">{inscription.derniere_relance}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Instance DocuSeal source :</span>
              <span className="font-semibold text-slate-700 truncate max-w-[260px]">{voyage.docuseal_instance_name}</span>
            </div>
          </div>

          {/* Actions toolbar */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyLink(signingLink)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                title="Copier le lien direct vers le formulaire DocuSeal"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedLink ? 'Lien copié !' : 'Copier le lien'}</span>
              </button>

              {inscription.statut !== 'COMPLET' && (
                <button
                  onClick={() => handleSendRelance()}
                  disabled={relanceSending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-700" />
                  <span>{relanceSending ? 'Envoi...' : 'Envoyer une relance'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <a
                href={signingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Voir DocuSeal</span>
              </a>

              {inscription.statut === 'COMPLET' ? (
                <a
                  href={`/api/inscriptions/${inscription.id}/document`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Document signé</span>
                </a>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-100 rounded-xl cursor-not-allowed"
                  title="Disponible lorsque les 2 signatures sont complétées"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Document (en attente)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
