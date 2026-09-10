import React, { useState, useMemo, useEffect } from 'react';
import { Inscription, Voyage } from '../types.js';
import {
  X,
  Printer,
  Download,
  FileText,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import { downloadInscriptionsPdf, printInscriptionsPdf, PdfExportOptions } from '../utils/pdfGenerator.js';

interface PdfExportModalProps {
  voyage: Voyage | null;
  inscriptions: Inscription[];
  classesList?: string[];
  onClose: () => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  voyage,
  inscriptions,
  classesList = [],
  onClose,
}) => {
  const [selectedClasse, setSelectedClasse] = useState<string>('Toutes');
  const [selectedStatut, setSelectedStatut] = useState<'ALL' | 'COMPLET' | 'A_FINALISER' | 'DOUBLONS' | 'NON_SIGNE' | 'INCOMPLET'>('ALL');
  const [sortBy, setSortBy] = useState<'nom' | 'classe' | 'statut'>('nom');
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // If classesList prop is empty, derive from inscriptions
  const availableClasses = useMemo(() => {
    if (classesList && classesList.length > 0) return classesList;
    const set = new Set<string>();
    inscriptions.forEach((i) => {
      if (i.classe) set.add(i.classe);
    });
    return Array.from(set).sort();
  }, [classesList, inscriptions]);

  // Compute filtered & sorted students for preview
  const filteredInscriptions = useMemo(() => {
    let list = [...inscriptions];

    if (selectedClasse !== 'Toutes') {
      list = list.filter((i) => i.classe === selectedClasse);
    }

    if (selectedStatut === 'COMPLET') {
      list = list.filter((i) => i.statut === 'COMPLET');
    } else if (selectedStatut === 'A_FINALISER') {
      list = list.filter((i) => i.statut === 'A_FINALISER');
    } else if (selectedStatut === 'DOUBLONS') {
      const counts = new Map<string, number>();
      for (const item of inscriptions) {
        const k = `${(item.eleve_nom || '').trim().toLowerCase()}___${(item.eleve_prenom || '').trim().toLowerCase()}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      list = list.filter((i) => {
        const k = `${(i.eleve_nom || '').trim().toLowerCase()}___${(i.eleve_prenom || '').trim().toLowerCase()}`;
        return (counts.get(k) || 0) > 1;
      });
    } else if (selectedStatut === 'NON_SIGNE') {
      list = list.filter((i) => i.statut === 'NON_SIGNE');
    } else if (selectedStatut === 'INCOMPLET') {
      list = list.filter((i) => i.statut !== 'COMPLET');
    }

    list.sort((a, b) => {
      if (sortBy === 'classe') {
        const cmp = (a.classe || '').localeCompare(b.classe || '');
        if (cmp !== 0) return cmp;
        return (a.eleve_nom || '').localeCompare(b.eleve_nom || '');
      }
      if (sortBy === 'statut') {
        const order: Record<string, number> = { NON_SIGNE: 0, A_FINALISER: 1, COMPLET: 2 };
        const diff = (order[a.statut] ?? 0) - (order[b.statut] ?? 0);
        if (diff !== 0) return diff;
        return (a.eleve_nom || '').localeCompare(b.eleve_nom || '');
      }
      const cmpNom = (a.eleve_nom || '').localeCompare(b.eleve_nom || '');
      if (cmpNom !== 0) return cmpNom;
      return (a.eleve_prenom || '').localeCompare(b.eleve_prenom || '');
    });

    return list;
  }, [inscriptions, selectedClasse, selectedStatut, sortBy]);

  // Stats for filtered set
  const total = filteredInscriptions.length;
  const complets = filteredInscriptions.filter((i) => i.statut === 'COMPLET').length;
  const aFinaliser = filteredInscriptions.filter((i) => i.statut === 'A_FINALISER').length;
  const nonSignes = filteredInscriptions.filter((i) => i.statut === 'NON_SIGNE').length;

  // Estimated pages in A4 landscape (~28-30 rows per page)
  const estimatedPages = Math.max(1, Math.ceil((total + (includeStats ? 6 : 0)) / 26));

  if (!voyage) return null;

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    try {
      downloadInscriptionsPdf(voyage, inscriptions, {
        filterClasse: selectedClasse,
        filterStatut: selectedStatut,
        sortBy,
        includeStats,
      });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Erreur génération PDF:', err);
      alert('Une erreur est survenue lors de la génération du fichier PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectPrint = () => {
    try {
      printInscriptionsPdf(voyage, inscriptions, {
        filterClasse: selectedClasse,
        filterStatut: selectedStatut,
        sortBy,
        includeStats,
      });
    } catch (err) {
      console.error('Erreur impression directe PDF:', err);
      // Fallback to window.print if iframe print is restricted
      window.print();
    }
  };

  const etablissementTitle = voyage.etablissement || "L'établissement scolaire Notre Dame des Missions";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden my-4 sm:my-8 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 relative"
      >
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 shrink-0 pr-16 relative">
          {/* Close button with large touch target */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-3.5 right-3.5 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white border border-slate-600 shadow-md transition-all cursor-pointer"
            title="Fermer la fenêtre (Échap)"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Export Officiel PDF
              </span>
              <span className="text-xs text-slate-400">
                {etablissementTitle}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>Génération du PDF — Voyage à {voyage.destination || voyage.nom}</span>
            </h2>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating || total === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="Télécharger le fichier PDF sur votre appareil"
            >
              {isGenerating ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Génération...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>PDF téléchargé !</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Télécharger le PDF (.pdf)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={total === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Imprimer directement le document généré"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>
          </div>
        </div>

        {/* Filter & Options Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Classe Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600">Classe :</span>
                <select
                  value={selectedClasse}
                  onChange={(e) => setSelectedClasse(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Toutes">Toutes ({inscriptions.length})</option>
                  {availableClasses.map((c) => (
                    <option key={c} value={c}>
                      Classe {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Statut Filter */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600">Statut :</span>
                <select
                  value={selectedStatut}
                  onChange={(e) => setSelectedStatut(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="COMPLET">🟢 Complets (2/2) uniquement</option>
                  <option value="A_FINALISER">🟠 À finaliser (1/2) uniquement</option>
                  <option value="DOUBLONS">⚠️ Doublons (même nom et prénom)</option>
                  <option value="NON_SIGNE">🔴 Non signés (0/2) uniquement</option>
                  <option value="INCOMPLET">⚠️ Tous les dossiers incomplets</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-600">Tri :</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="nom">Nom alphabétique</option>
                  <option value="classe">Par Classe</option>
                  <option value="statut">Par Statut de signature</option>
                </select>
              </div>

              {/* Stats checkbox */}
              <label className="flex items-center gap-1.5 cursor-pointer ml-1 select-none">
                <input
                  type="checkbox"
                  checked={includeStats}
                  onChange={(e) => setIncludeStats(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 font-medium">Inclure le bloc statistiques</span>
              </label>
            </div>

            {/* Selection info badge */}
            <div className="text-xs text-slate-600 font-medium">
              <span className="font-bold text-slate-900">{total}</span> élève(s) dans l'export •{' '}
              <span className="text-slate-500">~{estimatedPages} page(s) paysage</span>
            </div>
          </div>
        </div>

        {/* Download Notice Banner */}
        {downloadSuccess && (
          <div className="bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Le fichier PDF a été généré et téléchargé sur votre ordinateur avec succès !</span>
            </div>
            <button
              onClick={() => setDownloadSuccess(false)}
              className="text-white hover:text-emerald-100 text-xs underline"
            >
              Masquer
            </button>
          </div>
        )}

        {/* Document Preview Body */}
        <div className="p-6 sm:p-8 overflow-y-auto bg-white font-sans text-slate-900 printable-container" id="printable-report">
          {/* Header block conforming to specifications */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                  Établissement Scolaire
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {etablissementTitle}
                </h1>
                <p className="text-sm font-bold text-indigo-950 mt-1">
                  Voyage scolaire : {voyage.nom} — Destination : {voyage.destination}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Dates : du {voyage.date_depart} au {voyage.date_retour} • Classes : {voyage.classes_concernees.join(', ')}
                </p>
              </div>

              <div className="text-right text-xs text-slate-500 shrink-0 font-mono">
                <div>Extrait officiel le {new Date().toLocaleDateString('fr-FR')}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Instance : {voyage.docuseal_instance_name}</div>
              </div>
            </div>
          </div>

          {/* Statistics summary */}
          {includeStats && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <div className="font-extrabold text-xs text-slate-900 uppercase tracking-wider mb-2.5">
                Bilan des {total} élèves sélectionnés
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-emerald-800">🟢 Inscriptions complètes</div>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">{complets} élèves</div>
                  <div className="text-[11px] text-emerald-600">2 / 2 signatures obtenues</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-amber-800">🟠 Avec une signature</div>
                  <div className="text-lg font-black text-amber-700 mt-0.5">{aFinaliser} élèves</div>
                  <div className="text-[11px] text-amber-600">1 / 2 (relance en cours)</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-rose-800">🔴 Sans signature</div>
                  <div className="text-lg font-black text-rose-700 mt-0.5">{nonSignes} élèves</div>
                  <div className="text-[11px] text-rose-600">0 / 2 signatures</div>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          {total === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Aucun élève ne correspond aux critères de filtre sélectionnés.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                  <th className="py-2 px-2 text-center w-10">N°</th>
                  <th className="py-2 px-3">Nom</th>
                  <th className="py-2 px-3">Prénom</th>
                  <th className="py-2 px-2 text-center">Classe</th>
                  <th className="py-2 px-3 text-center">Statut DocuSeal</th>
                  <th className="py-2 px-3">Parent 1</th>
                  <th className="py-2 px-3">Parent 2</th>
                  <th className="py-2 px-3">Contact Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInscriptions.map((eleve, idx) => (
                  <tr key={eleve.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{eleve.eleve_nom}</td>
                    <td className="py-2 px-3 text-slate-800">{eleve.eleve_prenom}</td>
                    <td className="py-2 px-2 text-center font-bold text-slate-700">{eleve.classe}</td>
                    <td className="py-2 px-3 text-center">
                      {eleve.statut === 'COMPLET' && (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                          🟢 Complet (2/2)
                        </span>
                      )}
                      {eleve.statut === 'A_FINALISER' && (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                          🟠 À finaliser (1/2)
                        </span>
                      )}
                      {eleve.statut === 'NON_SIGNE' && (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded text-[11px]">
                          🔴 Non signé (0/2)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className={eleve.parent1?.statut === 'signed' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-medium'}>
                        {eleve.parent1?.statut === 'signed' ? '✓ Signé' : '— En attente'}
                      </span>
                      <span className="block text-[10px] text-slate-500 truncate max-w-[130px]">{eleve.parent1?.nom}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={eleve.parent2?.statut === 'signed' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-medium'}>
                        {eleve.parent2?.statut === 'signed' ? '✓ Signé' : '— En attente'}
                      </span>
                      <span className="block text-[10px] text-slate-500 truncate max-w-[130px]">{eleve.parent2?.nom}</span>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-600 font-mono truncate max-w-[160px]">
                      {eleve.parent1?.email || eleve.parent2?.email || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Footer certification */}
          <div className="mt-8 pt-4 border-t border-slate-300 text-[11px] text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>
              {etablissementTitle} • DocuSeal officiel eIDAS
            </div>
            <div>
              Génération vectorielle multipage certifiée • {total} élèves listés
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
            <span>Fermer la fenêtre</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={total === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating || total === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Télécharger le PDF (.pdf)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
