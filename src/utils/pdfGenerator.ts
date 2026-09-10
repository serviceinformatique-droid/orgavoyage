import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Inscription, Voyage } from '../types.js';

export interface PdfExportOptions {
  filterClasse?: string;
  filterStatut?: 'ALL' | 'COMPLET' | 'A_FINALISER' | 'DOUBLONS' | 'NON_SIGNE' | 'INCOMPLET';
  sortBy?: 'nom' | 'classe' | 'statut';
  includeStats?: boolean;
}

export function generateInscriptionsPdf(
  voyage: Voyage,
  inscriptions: Inscription[],
  options: PdfExportOptions = {}
): jsPDF {
  const {
    filterClasse = 'Toutes',
    filterStatut = 'ALL',
    sortBy = 'nom',
    includeStats = true,
  } = options;

  // Filter inscriptions
  let filtered = [...inscriptions];

  if (filterClasse && filterClasse !== 'Toutes') {
    filtered = filtered.filter((i) => i.classe === filterClasse);
  }

  if (filterStatut === 'COMPLET') {
    filtered = filtered.filter((i) => i.statut === 'COMPLET');
  } else if (filterStatut === 'A_FINALISER') {
    filtered = filtered.filter((i) => i.statut === 'A_FINALISER');
  } else if (filterStatut === 'DOUBLONS') {
    const counts = new Map<string, number>();
    for (const item of inscriptions) {
      const k = `${(item.eleve_nom || '').trim().toLowerCase()}___${(item.eleve_prenom || '').trim().toLowerCase()}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    filtered = filtered.filter((i) => {
      const k = `${(i.eleve_nom || '').trim().toLowerCase()}___${(i.eleve_prenom || '').trim().toLowerCase()}`;
      return (counts.get(k) || 0) > 1;
    });
  } else if (filterStatut === 'NON_SIGNE') {
    filtered = filtered.filter((i) => i.statut === 'NON_SIGNE');
  } else if (filterStatut === 'INCOMPLET') {
    filtered = filtered.filter((i) => i.statut !== 'COMPLET');
  }

  // Sort
  filtered.sort((a, b) => {
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

  // Calculate statistics for the current selection
  const total = filtered.length;
  const complets = filtered.filter((i) => i.statut === 'COMPLET').length;
  const aFinaliser = filtered.filter((i) => i.statut === 'A_FINALISER').length;
  const nonSignes = filtered.filter((i) => i.statut === 'NON_SIGNE').length;

  // Landscape A4 for optimal table width and readability
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const etablissementName = voyage.etablissement || "L'établissement scolaire Notre Dame des Missions";
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // --- HEADER SECTION ---
  // Top brand bar
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(margin, 10, pageWidth - margin * 2, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(etablissementName.toUpperCase(), margin + 6, 17);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(
    `Voyage scolaire : ${voyage.nom} (${voyage.destination}) • Dates : du ${voyage.date_depart} au ${voyage.date_retour}`,
    margin + 6,
    24
  );

  // Right-aligned edition date
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Document officiel extrait le ${dateStr} à ${timeStr}`, pageWidth - margin - 6, 17, { align: 'right' });
  doc.text(`Instance : ${voyage.docuseal_instance_name || 'DocuSeal'}`, pageWidth - margin - 6, 24, { align: 'right' });

  // --- SUB-HEADER / SUMMARY CARDS ---
  let startY = 36;

  if (includeStats) {
    const cardWidth = (pageWidth - margin * 2 - 9) / 4;
    const cardHeight = 15;

    // Card 1: Total
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, startY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL ÉLÈVES LISTÉS', margin + 4, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${total} élève${total > 1 ? 's' : ''}`, margin + 4, startY + 11.5);

    // Card 2: Complets
    const x2 = margin + cardWidth + 3;
    doc.setFillColor(236, 253, 245); // Emerald-50
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(x2, startY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('DOSSIERS COMPLETS (2/2)', x2 + 4, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(4, 120, 87);
    const pctComplet = total > 0 ? Math.round((complets / total) * 100) : 0;
    doc.text(`${complets} (${pctComplet}%)`, x2 + 4, startY + 11.5);

    // Card 3: À finaliser
    const x3 = x2 + cardWidth + 3;
    doc.setFillColor(254, 243, 199); // Amber-50
    doc.setDrawColor(252, 211, 77);
    doc.roundedRect(x3, startY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(217, 119, 6);
    doc.setFont('helvetica', 'bold');
    doc.text('À FINALISER (1/2)', x3 + 4, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9);
    const pctAfin = total > 0 ? Math.round((aFinaliser / total) * 100) : 0;
    doc.text(`${aFinaliser} (${pctAfin}%)`, x3 + 4, startY + 11.5);

    // Card 4: Non signés
    const x4 = x3 + cardWidth + 3;
    doc.setFillColor(255, 241, 242); // Rose-50
    doc.setDrawColor(254, 205, 211);
    doc.roundedRect(x4, startY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(225, 29, 72);
    doc.setFont('helvetica', 'bold');
    doc.text('NON SIGNÉS (0/2)', x4 + 4, startY + 5);
    doc.setFontSize(11);
    doc.setTextColor(190, 18, 60);
    const pctNon = total > 0 ? Math.round((nonSignes / total) * 100) : 0;
    doc.text(`${nonSignes} (${pctNon}%)`, x4 + 4, startY + 11.5);

    startY += 19;
  }

  // --- DATA TABLE ---
  const tableData = filtered.map((eleve, idx) => {
    let statutLabel = 'Non signé (0/2)';
    if (eleve.statut === 'COMPLET') statutLabel = 'Complet (2/2)';
    else if (eleve.statut === 'A_FINALISER') statutLabel = 'À finaliser (1/2)';

    const p1Status = eleve.parent1?.statut === 'signed' ? 'Signé' : 'En attente';
    const p1Info = `${eleve.parent1?.nom || '—'}\n[${p1Status}]`;

    const p2Status = eleve.parent2?.statut === 'signed' ? 'Signé' : 'En attente';
    const p2Info = `${eleve.parent2?.nom || '—'}\n[${p2Status}]`;

    return [
      String(idx + 1),
      (eleve.eleve_nom || '').toUpperCase(),
      eleve.eleve_prenom || '',
      eleve.classe || '—',
      statutLabel,
      p1Info,
      p2Info,
      eleve.parent1?.email || '—',
    ];
  });

  autoTable(doc, {
    startY: startY,
    head: [
      ['N°', 'Nom', 'Prénom', 'Classe', 'Statut Global', 'Parent 1 (Légal)', 'Parent 2 (Légal)', 'Email de contact'],
    ],
    body: tableData,
    theme: 'grid',
    margin: { left: margin, right: margin, top: 12, bottom: 16 },
    headStyles: {
      fillColor: [51, 65, 85], // Slate-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 2.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' }, // N°
      1: { cellWidth: 38, fontStyle: 'bold' }, // Nom
      2: { cellWidth: 36 }, // Prénom
      3: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, // Classe
      4: { cellWidth: 30, halign: 'center' }, // Statut Global
      5: { cellWidth: 46 }, // Parent 1
      6: { cellWidth: 46 }, // Parent 2
      7: { cellWidth: 'auto' }, // Email
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate-50
    },
    didParseCell: (data) => {
      // Color cell based on global status
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw);
        if (text.includes('Complet')) {
          data.cell.styles.textColor = [4, 120, 87]; // Emerald-700
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [236, 253, 245];
        } else if (text.includes('À finaliser')) {
          data.cell.styles.textColor = [180, 83, 9]; // Amber-700
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 243, 199];
        } else if (text.includes('Non signé')) {
          data.cell.styles.textColor = [190, 18, 60]; // Rose-700
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [255, 241, 242];
        }
      }
    },
    didDrawPage: (data) => {
      // Add page header if on page 2+
      const pageNum = data.pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();

      if (pageNum > 1) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${etablissementName} — Liste des inscriptions : ${voyage.nom} (${voyage.destination})`,
          margin,
          8
        );
        doc.text(`Édité le ${dateStr}`, pageWidth - margin, 8, { align: 'right' });
      }

      // Add page footer on every page
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Document certifié DocuSeal • Conforme eIDAS • ${etablissementName}`,
        margin,
        pageHeight - 6
      );
      doc.text(
        `Page ${pageNum} sur ${totalPages}`,
        pageWidth - margin,
        pageHeight - 6,
        { align: 'right' }
      );
    },
  });

  // Re-run the footer page counts now that totalPages is finalized
  const totalPagesCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPagesCount; i++) {
    doc.setPage(i);
    // Overwrite bottom right with actual total pages
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - margin - 30, pageHeight - 9, 30, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} sur ${totalPagesCount}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  return doc;
}

export function downloadInscriptionsPdf(
  voyage: Voyage,
  inscriptions: Inscription[],
  options: PdfExportOptions = {}
): void {
  const doc = generateInscriptionsPdf(voyage, inscriptions, options);
  const cleanNom = (voyage.nom || 'voyage').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDest = (voyage.destination || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filterLabel = options.filterClasse && options.filterClasse !== 'Toutes' ? `_Cl_${options.filterClasse}` : '';
  const filename = `Liste_Inscrits_${cleanNom}_${cleanDest}${filterLabel}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

export function printInscriptionsPdf(
  voyage: Voyage,
  inscriptions: Inscription[],
  options: PdfExportOptions = {}
): void {
  const doc = generateInscriptionsPdf(voyage, inscriptions, options);
  doc.autoPrint();
  const blobUrl = doc.output('bloburl');
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = blobUrl as any;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print iframe error:', err);
      }
    }, 300);
  };
}
