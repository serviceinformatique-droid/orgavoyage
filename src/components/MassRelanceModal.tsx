import React, { useState, useMemo, useEffect } from 'react';
import { Voyage, Inscription } from '../types.js';
import {
  X,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Users,
  ExternalLink,
  ShieldCheck,
  Filter
} from 'lucide-react';

interface MassRelanceModalProps {
  isOpen: boolean;
  voyage: Voyage;
  inscriptions: Inscription[];
  classesList: string[];
  onClose: () => void;
  onSuccess: () => void;
}

interface MassRelanceResponse {
  success: boolean;
  message: string;
  totalInscriptionsTargeted: number;
  totalParentsToContact: number;
  totalEmailsDocuSealSent: number;
  parentsEmailsList: string[];
  mailToUrl: string;
  emailSubject: string;
  emailBody: string;
  details: Array<{
    inscriptionId: string;
    eleve: string;
    classe: string;
    parents: Array<{
      nom: string;
      email: string;
      parentNum: 1 | 2;
      signingUrl: string;
      sentViaDocuseal: boolean;
      docusealMessage?: string;
    }>;
  }>;
}

export const MassRelanceModal: React.FC<MassRelanceModalProps> = ({
  isOpen,
  voyage,
  inscriptions,
  classesList,
  onClose,
  onSuccess,
}) => {
  const [targetStatus, setTargetStatus] = useState<'all_incomplete' | 'a_finaliser' | 'non_signe'>('all_incomplete');
  const [selectedClasse, setSelectedClasse] = useState<string>('Toutes');
  const [sending, setSending] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [result, setResult] = useState<MassRelanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'docuseal' | 'school_mail'>('docuseal');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute targeted candidates in memory for live count preview
  const candidates = useMemo(() => {
    return inscriptions.filter((item) => {
      if (item.statut === 'COMPLET') return false;
      if (targetStatus === 'a_finaliser' && item.statut !== 'A_FINALISER') return false;
      if (targetStatus === 'non_signe' && item.statut !== 'NON_SIGNE') return false;
      if (selectedClasse !== 'Toutes' && item.classe !== selectedClasse) return false;
      return true;
    });
  }, [inscriptions, targetStatus, selectedClasse]);

  // Calculate unique parents and emails from candidates
  const parentStats = useMemo(() => {
    const emails = new Set<string>();
    let totalUnsignedParents = 0;

    candidates.forEach((c) => {
      if (c.parent1 && c.parent1.statut !== 'signed' && c.parent1.email) {
        emails.add(c.parent1.email.trim());
        totalUnsignedParents++;
      }
      if (c.parent2 && c.parent2.statut !== 'signed' && c.parent2.email) {
        emails.add(c.parent2.email.trim());
        totalUnsignedParents++;
      }
    });

    return {
      uniqueEmailsCount: emails.size,
      totalUnsignedParents,
      emailsList: Array.from(emails),
    };
  }, [candidates]);

  if (!isOpen) return null;

  const etablissementName = voyage.etablissement || "L'établissement scolaire Notre Dame des Missions";
  const defaultSubject = `[${etablissementName}] Voyage à ${voyage.destination || voyage.nom} — Relance signature inscription`;
  const defaultBody = `Madame, Monsieur,\n\nNous vous informons qu'à ce jour, le dossier d'inscription de votre enfant pour le voyage scolaire à ${voyage.destination || voyage.nom} n'est pas encore entièrement signé.\n\nPour rappel, la signature des deux représentants légaux est obligatoire pour valider définitivement la participation de l'élève.\n\nMerci de bien vouloir vérifier votre boîte de messagerie (et vos dossiers de spams/courriers indésirables) afin d'accéder au document DocuSeal et d'apposer votre signature électronique dans les meilleurs délais.\n\nEn cas de question ou de difficulté technique, merci de prendre contact avec l'établissement.\n\nBien cordialement,\nL'équipe organisatrice du voyage scolaire\n${etablissementName}`;

  const mailToUrl = `mailto:?bcc=${encodeURIComponent(parentStats.emailsList.join(','))}&subject=${encodeURIComponent(defaultSubject)}&body=${encodeURIComponent(defaultBody)}`;

  const handleLaunchDocuSealRelance = async () => {
    if (candidates.length === 0) return;
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/voyages/${voyage.id}/relance-masse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus,
          classe: selectedClasse,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
        onSuccess();
      } else {
        setError(data.message || 'Erreur lors de la relance groupée');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau lors de la communication avec le serveur');
    } finally {
      setSending(false);
    }
  };

  const handleCopy = (text: string, setCopiedFn: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopiedFn(true);
    setTimeout(() => setCopiedFn(false), 2500);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-150 relative flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 relative pr-16 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue"
            className="absolute top-4 right-4 z-20 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white border border-slate-600 shadow-md transition-all touch-manipulation cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Mail className="w-3 h-3" /> Relance Groupée
            </span>
            <span className="text-xs text-slate-400">
              Voyage {voyage.nom} ({voyage.destination})
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Relance en masse des parents
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {etablissementName} • Double signature légale eIDAS
          </p>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Target Filters */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>1. Définir les familles à relancer</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Type de dossiers */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Statut des dossiers à cibler :
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
                    <input
                      type="radio"
                      name="targetStatus"
                      checked={targetStatus === 'all_incomplete'}
                      onChange={() => setTargetStatus('all_incomplete')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Tous les dossiers incomplets (0 ou 1 signature)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition-colors">
                    <input
                      type="radio"
                      name="targetStatus"
                      checked={targetStatus === 'a_finaliser'}
                      onChange={() => setTargetStatus('a_finaliser')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      🟠 À finaliser uniquement (1 signature manquante)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-rose-300 transition-colors">
                    <input
                      type="radio"
                      name="targetStatus"
                      checked={targetStatus === 'non_signe'}
                      onChange={() => setTargetStatus('non_signe')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      🔴 Non signés uniquement (0 signature reçue)
                    </span>
                  </label>
                </div>
              </div>

              {/* Classe filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Filtrer par classe :
                </label>
                <select
                  value={selectedClasse}
                  onChange={(e) => setSelectedClasse(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Toutes">Toutes les classes du voyage</option>
                  {classesList.map((c) => (
                    <option key={c} value={c}>
                      Classe {c}
                    </option>
                  ))}
                </select>

                {/* Counter box */}
                <div className="mt-3 p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl">
                  <div className="text-xs text-indigo-900 font-bold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>Sélection active :</span>
                  </div>
                  <div className="mt-1 text-xs text-indigo-800 font-medium">
                    <strong>{candidates.length}</strong> élève(s) concerné(s) •{' '}
                    <strong>{parentStats.totalUnsignedParents}</strong> parent(s) à relancer ({parentStats.uniqueEmailsCount} emails uniques)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Success / Result Banner */}
          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold text-emerald-900">
                    Relance en masse effectuée avec succès !
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    {result.message}
                  </p>
                </div>
              </div>

              {result.details && result.details.length > 0 && (
                <div className="max-h-44 overflow-y-auto bg-white rounded-xl border border-emerald-200 p-2.5 text-xs space-y-1.5 font-mono">
                  {result.details.map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-1 px-2 rounded hover:bg-emerald-50/50">
                      <span>
                        <strong>{d.eleve}</strong> (Cl. {d.classe})
                      </span>
                      <span className="text-[11px] text-emerald-700">
                        {d.parents.map((p) => p.email).join(', ') || 'Parent notifié'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Une erreur est survenue :</span>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Method Selection Tabs */}
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('docuseal')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'docuseal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Mode 1 : Envoi direct via DocuSeal</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('school_mail')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'school_mail'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Mode 2 : Messagerie Établissement (Pronote / Outlook)</span>
              </button>
            </div>

            {/* TAB 1: DocuSeal Direct API Automation */}
            {activeTab === 'docuseal' && (
              <div className="mt-4 p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Envoi automatique par le serveur DocuSeal
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      DocuSeal génère et transmet directement un email officiel sécurisé à chaque signataire non signé, contenant son lien personnalisé pour apposer sa signature sans mot de passe.
                    </p>
                  </div>
                  <span className="shrink-0 p-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1 border border-indigo-100">
                    <ShieldCheck className="w-4 h-4" /> API DocuSeal
                  </span>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                  <div className="text-xs text-slate-600">
                    {candidates.length > 0 ? (
                      <span>
                        Prêt à relancer <strong>{candidates.length}</strong> élève(s) ({parentStats.totalUnsignedParents} parent(s)).
                      </span>
                    ) : (
                      <span className="text-slate-400">Aucun élève incomplet pour ce filtre.</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleLaunchDocuSealRelance}
                    disabled={sending || candidates.length === 0}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Envoi des relances en cours...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>🚀 Envoyer les relances via DocuSeal</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: School Mail / Pronote copy list */}
            {activeTab === 'school_mail' && (
              <div className="mt-4 p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Envoi groupé depuis votre messagerie ou Pronote
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Copiez tous les emails en un clic pour les coller dans le champ <strong>Cci (Copie cachée)</strong> afin de préserver la confidentialité des familles.
                  </p>
                </div>

                {/* Email address list action */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Liste des adresses emails des parents ({parentStats.emailsList.length} adresses) :
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(parentStats.emailsList.join(', '), setCopiedEmails)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      {copiedEmails ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copier tous les emails (Cci)</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-200 max-h-20 overflow-y-auto break-all">
                    {parentStats.emailsList.length > 0
                      ? parentStats.emailsList.join(', ')
                      : 'Aucun email trouvé pour cette sélection.'}
                  </div>
                </div>

                {/* Email template model */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Modèle de message officiel :
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(defaultBody, setCopiedBody)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      {copiedBody ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copier le texte du message</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans max-h-36 overflow-y-auto">
                    <div className="font-bold text-slate-900 mb-1">
                      Objet : {defaultSubject}
                    </div>
                    {defaultBody}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  {parentStats.emailsList.length > 0 && (
                    <a
                      href={mailToUrl}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Ouvrir dans ma messagerie (Cci prérempli)</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
            <span>Fermer la fenêtre</span>
          </button>

          <span className="hidden sm:inline text-[11px] text-slate-500 font-medium">
            {etablissementName}
          </span>
        </div>
      </div>
    </div>
  );
};
