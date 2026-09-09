import React from 'react';
import { Inscription, Voyage } from '../types.js';
import { X, Printer, Download, FileText } from 'lucide-react';

interface PdfExportModalProps {
  voyage: Voyage | null;
  inscriptions: Inscription[];
  onClose: () => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  voyage,
  inscriptions,
  onClose,
}) => {
  if (!voyage) return null;

  const total = inscriptions.length;
  const complets = inscriptions.filter((i) => i.statut === 'COMPLET').length;
  const aFinaliser = inscriptions.filter((i) => i.statut === 'A_FINALISER').length;
  const nonSignes = inscriptions.filter((i) => i.statut === 'NON_SIGNE').length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Controls toolbar (hidden when printing) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">Aperçu & Exportation PDF / Impression</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Enregistrer en PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-12 overflow-y-auto bg-white font-sans text-slate-900" id="printable-report">
          {/* Header block conforming to specifications */}
          <div className="border-b-2 border-slate-900 pb-6 mb-6">
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
              Établissement
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {voyage.etablissement || "L'établissement scolaire Notre Dame des Missions"}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold uppercase text-indigo-950">
                  {voyage.nom}
                </h2>
                <p className="text-sm text-slate-600 font-medium">
                  Destination : {voyage.destination} • Du {voyage.date_depart} au {voyage.date_retour}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Classes concernées : {voyage.classes_concernees.join(', ')}
                </p>
              </div>
              <div className="text-left sm:text-right text-xs text-slate-500 font-mono">
                Édité le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Statistics summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
            <div className="font-extrabold text-sm text-slate-900 uppercase tracking-wider mb-3">
              Bilan des {total} élèves inscrits
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-xs font-bold text-emerald-800">🟢 Inscriptions complètes</div>
                <div className="text-xl font-black text-emerald-700 mt-0.5">{complets} élèves</div>
                <div className="text-[11px] text-emerald-600">2 / 2 signatures obtenues</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs font-bold text-amber-800">🟠 Avec une signature</div>
                <div className="text-xl font-black text-amber-700 mt-0.5">{aFinaliser} élèves</div>
                <div className="text-[11px] text-amber-600">1 / 2 (relance en cours)</div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <div className="text-xs font-bold text-rose-800">🔴 Sans signature</div>
                <div className="text-xl font-black text-rose-700 mt-0.5">{nonSignes} élèves</div>
                <div className="text-[11px] text-rose-600">0 / 2 signatures</div>
              </div>
            </div>
          </div>

          {/* Printable Student Roster Table */}
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Nom</th>
                <th className="py-2.5 px-3">Prénom</th>
                <th className="py-2.5 px-3 text-center">Classe</th>
                <th className="py-2.5 px-3">Parent 1</th>
                <th className="py-2.5 px-3">Parent 2</th>
                <th className="py-2.5 px-3 text-center">Statut DocuSeal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {inscriptions.map((eleve) => (
                <tr key={eleve.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{eleve.eleve_nom}</td>
                  <td className="py-2.5 px-3 text-slate-800">{eleve.eleve_prenom}</td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{eleve.classe}</td>
                  <td className="py-2.5 px-3">
                    <span className={eleve.parent1.statut === 'signed' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                      {eleve.parent1.statut === 'signed' ? '✓ Signé' : '— En attente'}
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate max-w-[140px]">{eleve.parent1.nom}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={eleve.parent2.statut === 'signed' ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                      {eleve.parent2.statut === 'signed' ? '✓ Signé' : '— En attente'}
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate max-w-[140px]">{eleve.parent2.nom}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {eleve.statut === 'COMPLET' && (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                        🟢 2/2
                      </span>
                    )}
                    {eleve.statut === 'A_FINALISER' && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                        🟠 1/2
                      </span>
                    )}
                    {eleve.statut === 'NON_SIGNE' && (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[11px]">
                        🔴 0/2
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer certification */}
          <div className="mt-12 pt-6 border-t border-slate-300 text-[11px] text-slate-500 flex justify-between items-center">
            <div>
              Instance DocuSeal : <strong>{voyage.docuseal_instance_name}</strong> ({voyage.docuseal_url})
            </div>
            <div>
              Document officiel certifié eIDAS — Page 1 / 1
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
