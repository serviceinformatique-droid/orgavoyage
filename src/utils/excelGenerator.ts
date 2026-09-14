import * as XLSX from 'xlsx';
import { Inscription, Voyage } from '../types.js';

export interface ExcelExportOptions {
  includeFilteredOnly?: boolean;
}

/**
 * Generate and trigger download of an Excel (.xlsx) file for a school trip
 */
export function exportInscriptionsToExcel(
  voyage: Voyage,
  inscriptions: Inscription[],
  options: ExcelExportOptions = {}
): { success: boolean; filename: string; count: number; error?: string } {
  try {
    if (!inscriptions || inscriptions.length === 0) {
      throw new Error('Aucun dossier d\'inscription à exporter.');
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const dateFrStr = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Detect duplicates in list to mark in Excel
    const nameMap = new Map<string, number>();
    inscriptions.forEach((i) => {
      const key = `${(i.eleve_nom || '').trim().toLowerCase()}_${(i.eleve_prenom || '').trim().toLowerCase()}`;
      nameMap.set(key, (nameMap.get(key) || 0) + 1);
    });

    // 1. DATA SHEET: All Inscriptions
    const rows = inscriptions.map((item, index) => {
      const key = `${(item.eleve_nom || '').trim().toLowerCase()}_${(item.eleve_prenom || '').trim().toLowerCase()}`;
      const isDoublon = (nameMap.get(key) || 0) > 1;

      let statutLabel = 'NON SIGNÉ (0/2)';
      if (item.statut === 'COMPLET' || item.nombre_signatures === 2) {
        statutLabel = 'COMPLET (2/2)';
      } else if (item.statut === 'A_FINALISER' || item.nombre_signatures === 1) {
        statutLabel = 'À FINALISER (1/2)';
      }

      return {
        'N°': index + 1,
        'Nom de l\'Élève': (item.eleve_nom || '').toUpperCase(),
        'Prénom de l\'Élève': item.eleve_prenom || '',
        'Classe': item.classe || 'Non spécifiée',
        'Statut Inscription': statutLabel,
        'Signatures': `${item.nombre_signatures ?? 0}/2`,
        'Alerte Doublon': isDoublon ? '⚠️ DOUBLON' : 'Unique',
        // Parent 1
        'Parent 1 - Nom': item.parent1?.nom || '',
        'Parent 1 - Statut': item.parent1?.statut === 'signed' ? '✓ Signé' : 'En attente',
        'Parent 1 - Email': item.parent1?.email || '',
        'Parent 1 - Téléphone': item.parent1?.telephone || '',
        'Parent 1 - Date Signature': item.parent1?.date_signature || '',
        // Parent 2
        'Parent 2 - Nom': item.parent2?.nom || '',
        'Parent 2 - Statut': item.parent2?.statut === 'signed' ? '✓ Signé' : 'En attente',
        'Parent 2 - Email': item.parent2?.email || '',
        'Parent 2 - Téléphone': item.parent2?.telephone || '',
        'Parent 2 - Date Signature': item.parent2?.date_signature || '',
        // Metadata
        'Date de Soumission': item.date_creation || '',
        'Dernière Sync': item.date_derniere_synchronisation || '',
        'Remarques': item.remarques || '',
        'ID DocuSeal': item.docuseal_submission_id || '',
      };
    });

    const worksheetInscriptions = XLSX.utils.json_to_sheet(rows);

    // Column widths for Inscriptions sheet
    worksheetInscriptions['!cols'] = [
      { wch: 6 },  // N°
      { wch: 20 }, // Nom Élève
      { wch: 18 }, // Prénom Élève
      { wch: 10 }, // Classe
      { wch: 20 }, // Statut Inscription
      { wch: 12 }, // Signatures
      { wch: 14 }, // Alerte Doublon
      { wch: 24 }, // Parent 1 Nom
      { wch: 12 }, // Parent 1 Statut
      { wch: 30 }, // Parent 1 Email
      { wch: 16 }, // Parent 1 Téléphone
      { wch: 22 }, // Parent 1 Date Signature
      { wch: 24 }, // Parent 2 Nom
      { wch: 12 }, // Parent 2 Statut
      { wch: 30 }, // Parent 2 Email
      { wch: 16 }, // Parent 2 Téléphone
      { wch: 22 }, // Parent 2 Date Signature
      { wch: 18 }, // Date de Soumission
      { wch: 18 }, // Dernière Sync
      { wch: 25 }, // Remarques
      { wch: 22 }, // ID DocuSeal
    ];

    // 2. SUMMARY SHEET: Trip Overview & Statistics
    const completsCount = inscriptions.filter(
      (i) => i.statut === 'COMPLET' || i.nombre_signatures === 2
    ).length;
    const aFinaliserCount = inscriptions.filter(
      (i) => i.statut === 'A_FINALISER' || i.nombre_signatures === 1
    ).length;
    const nonSignesCount = inscriptions.filter(
      (i) => i.statut === 'NON_SIGNE' || i.nombre_signatures === 0
    ).length;
    const doublonsCount = Array.from(nameMap.values()).filter((c) => c > 1).length;
    const totalCount = inscriptions.length;
    const tauxCompletion = totalCount > 0 ? Math.round((completsCount / totalCount) * 100) : 0;

    const summaryData = [
      ['RÉCAPITULATIF OFFICIEL DES INSCRIPTIONS'],
      ['Établissement', voyage.etablissement || 'Notre Dame des Missions'],
      ['Nom du Voyage', voyage.nom],
      ['Destination', voyage.destination],
      ['Dates du séjour', `Du ${voyage.date_depart} au ${voyage.date_retour}`],
      ['Classes concernées', (voyage.classes_concernees || []).join(', ')],
      ['Date de l\'export', dateFrStr],
      [],
      ['INDICATEURS CLÉS', 'VALEUR', 'POURCENTAGE'],
      ['Total des dossiers inscrits', totalCount, '100%'],
      ['Dossiers complets (2/2 signatures)', completsCount, `${tauxCompletion}%`],
      ['Dossiers à finaliser (1/2 signatures)', aFinaliserCount, `${totalCount > 0 ? Math.round((aFinaliserCount / totalCount) * 100) : 0}%`],
      ['Dossiers non signés (0/2 signatures)', nonSignesCount, `${totalCount > 0 ? Math.round((nonSignesCount / totalCount) * 100) : 0}%`],
      ['Doublons d\'inscriptions détectés', doublonsCount, ''],
      [],
      ['Instance DocuSeal', voyage.docuseal_instance_name || 'DocuSeal NDM'],
      ['URL DocuSeal', voyage.docuseal_url || ''],
      ['ID Modèle', voyage.docuseal_template_id || ''],
    ];

    const worksheetSummary = XLSX.utils.aoa_to_sheet(summaryData);
    worksheetSummary['!cols'] = [
      { wch: 36 },
      { wch: 30 },
      { wch: 15 },
    ];

    // 3. CLASS BREAKDOWN SHEET
    const classes = Array.from(new Set(inscriptions.map((i) => i.classe || 'Non spécifiée'))).sort();
    const classRows = classes.map((classeName) => {
      const inClass = inscriptions.filter((i) => (i.classe || 'Non spécifiée') === classeName);
      const compl = inClass.filter((i) => i.statut === 'COMPLET' || i.nombre_signatures === 2).length;
      const afin = inClass.filter((i) => i.statut === 'A_FINALISER' || i.nombre_signatures === 1).length;
      const nons = inClass.filter((i) => i.statut === 'NON_SIGNE' || i.nombre_signatures === 0).length;
      return {
        'Classe': classeName,
        'Total Élèves': inClass.length,
        'Dossiers Complets (2/2)': compl,
        'À Finaliser (1/2)': afin,
        'Non Signés (0/2)': nons,
        'Taux de complétion': inClass.length > 0 ? `${Math.round((compl / inClass.length) * 100)}%` : '0%',
      };
    });

    const worksheetClasses = XLSX.utils.json_to_sheet(classRows);
    worksheetClasses['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
    ];

    // Assemble Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheetInscriptions, 'Inscriptions');
    XLSX.utils.book_append_sheet(workbook, worksheetSummary, 'Synthèse');
    XLSX.utils.book_append_sheet(workbook, worksheetClasses, 'Par Classe');

    // Generate binary buffer
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    // Clean safe filename
    const safeVoyageNom = (voyage.nom || 'Voyage')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Inscriptions_${safeVoyageNom}_${todayStr}.xlsx`;

    // Create blob and trigger download
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Native trigger with fallback
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);

    return {
      success: true,
      filename,
      count: inscriptions.length,
    };
  } catch (err: any) {
    console.error('Erreur lors de la génération du fichier Excel:', err);
    return {
      success: false,
      filename: '',
      count: 0,
      error: err.message || 'Erreur inconnue lors de l\'exportation Excel',
    };
  }
}
