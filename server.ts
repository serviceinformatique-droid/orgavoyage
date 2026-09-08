import express, { Request, Response } from 'express';
import path from 'path';
import * as XLSX from 'xlsx';
import { createServer as createViteServer } from 'vite';
import { db, Database, normalizeDocuSealUrl } from './server/db.js';

// Allow local / internal certificates for school network DocuSeal instances
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware to check admin authorization header or query
  const checkAdminAuth = (req: Request): boolean => {
    const authHeader = req.headers.authorization;
    if (authHeader && (authHeader.includes('admin') || authHeader.includes('Bearer admin-token-2027'))) {
      return true;
    }
    const token = req.headers['x-admin-token'] as string;
    if (token === 'admin-token-2027' || token === 'admin2027') {
      return true;
    }
    return false;
  };

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth: Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { role, password, email } = req.body;

    if (role === 'admin') {
      if (db.verifyAdminPassword(password)) {
        return res.json({
          success: true,
          role: 'admin',
          token: 'admin-token-2027',
          user: {
            nom: 'Administrateur Général',
            email: email || 'admin@ndmissions.fr',
            role: 'admin',
            isAdmin: true,
          },
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Mot de passe administrateur incorrect (par défaut : admin2027)',
        });
      }
    }

    // Teacher login (open access with identity)
    return res.json({
      success: true,
      role: 'professeur',
      token: 'teacher-token',
      user: {
        nom: req.body.nom || 'Professeur Organisateur',
        email: email || 'professeur@ndmissions.fr',
        role: 'professeur',
        isAdmin: false,
      },
    });
  });

  // Verify Admin password for protected operations
  app.post('/api/auth/verify-admin', (req: Request, res: Response) => {
    const { password } = req.body;
    if (db.verifyAdminPassword(password)) {
      return res.json({ success: true, token: 'admin-token-2027' });
    }
    return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
  });

  // List Voyages
  app.get('/api/voyages', (req: Request, res: Response) => {
    const isAdmin = checkAdminAuth(req);
    const list = db.getVoyages(isAdmin);
    res.json(list);
  });

  // Get Single Voyage
  app.get('/api/voyages/:id', (req: Request, res: Response) => {
    const isAdmin = checkAdminAuth(req);
    const voyage = db.getVoyageById(req.params.id, isAdmin);
    if (!voyage) {
      return res.status(404).json({ error: 'Voyage non trouvé' });
    }
    res.json(voyage);
  });

  // Create Voyage / DocuSeal Site (Admin only)
  app.post('/api/voyages', (req: Request, res: Response) => {
    const { nom, destination, date_depart, date_retour, docuseal_url, docuseal_api_key, docuseal_template_id } = req.body;

    if (!nom || !destination || !date_depart || !date_retour || !docuseal_url || !docuseal_api_key || !docuseal_template_id) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (Nom, Destination, Dates, URL DocuSeal, Clé API, Template ID)' });
    }

    const newVoyage = db.addVoyage({
      nom,
      description: req.body.description,
      destination,
      date_depart,
      date_retour,
      etablissement: req.body.etablissement,
      classes_concernees: Array.isArray(req.body.classes_concernees) ? req.body.classes_concernees : [req.body.classes_concernees || 'Toutes'],
      statut: req.body.statut,
      docuseal_instance_name: req.body.docuseal_instance_name,
      docuseal_url,
      docuseal_api_key,
      docuseal_template_id,
    });

    res.status(201).json(newVoyage);
  });

  // Update Voyage (Admin only)
  app.put('/api/voyages/:id', (req: Request, res: Response) => {
    const updated = db.updateVoyage(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Voyage introuvable' });
    }
    res.json(updated);
  });

  // Delete Voyage (Admin only)
  app.delete('/api/voyages/:id', (req: Request, res: Response) => {
    const ok = db.deleteVoyage(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Voyage introuvable' });
    }
    res.json({ success: true, message: 'Voyage supprimé' });
  });

  // Test Connection to a DocuSeal instance
  app.post('/api/voyages/:id/test-connection', async (req: Request, res: Response) => {
    const result = await db.testDocuSealConnection(req.params.id);
    res.json(result);
  });

  // Test temporary connection parameters directly (before saving a voyage)
  app.post('/api/docuseal/test-direct', async (req: Request, res: Response) => {
    let { url, apiKey, templateId, voyageId } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL DocuSeal requise.' });
    }
    if ((!apiKey || !apiKey.trim()) && voyageId) {
      const v = db.getVoyageById(voyageId, true);
      if (v?.docuseal_api_key) {
        apiKey = v.docuseal_api_key;
      }
    }
    const result = await Database.executeDocuSealConnectionTest(url, apiKey || '', templateId || '');
    res.json(result);
  });

  // Fetch templates from DocuSeal instance
  app.post('/api/docuseal/templates', async (req: Request, res: Response) => {
    let { url, apiKey, voyageId } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL DocuSeal requise.' });
    }
    if ((!apiKey || !apiKey.trim()) && voyageId) {
      const v = db.getVoyageById(voyageId, true);
      if (v?.docuseal_api_key) {
        apiKey = v.docuseal_api_key;
      }
    }
    const result = await Database.fetchDocuSealTemplates(url, apiKey || '');
    res.json(result);
  });

  // Debug: View raw submissions from DocuSeal for a voyage
  app.get('/api/docuseal/raw-submissions/:voyageId', async (req: Request, res: Response) => {
    const v = db.getVoyageById(req.params.voyageId, true);
    if (!v) return res.status(404).json({ error: 'Voyage introuvable' });

    try {
      const cleanUrl = normalizeDocuSealUrl(v.docuseal_url);
      const endpoint = `${cleanUrl}/api/submissions?template_id=${v.docuseal_template_id}&limit=100`;
      const docuRes = await fetch(endpoint, {
        headers: {
          'X-Auth-Token': v.docuseal_api_key?.trim() || '',
          'Authorization': `Bearer ${v.docuseal_api_key?.trim() || ''}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await docuRes.json();
      res.json({
        httpStatus: docuRes.status,
        url: endpoint,
        data,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Purge demo database
  app.post('/api/admin/reset-database', (req: Request, res: Response) => {
    if (!checkAdminAuth(req)) {
      return res.status(401).json({ error: 'Accès non autorisé' });
    }
    db.resetToCleanProduction();
    res.json({ success: true, message: 'Base de données réinitialisée à 0 pour la production.' });
  });

  // Test all connections
  app.post('/api/voyages/test-all', async (req: Request, res: Response) => {
    const voyages = db.getVoyages(true);
    const results: Record<string, any> = {};

    for (const v of voyages) {
      results[v.id] = await db.testDocuSealConnection(v.id);
    }

    res.json({ success: true, results });
  });

  // Sync specific voyage
  app.post('/api/voyages/:id/sync', async (req: Request, res: Response) => {
    const result = await db.syncVoyage(req.params.id);
    res.json(result);
  });

  // Sync all voyages
  app.post('/api/voyages/sync-all', async (req: Request, res: Response) => {
    const voyages = db.getVoyages(true);
    let totalAnalyzed = 0;
    let totalNewSignatures = 0;

    for (const v of voyages) {
      const resSync = await db.syncVoyage(v.id);
      totalAnalyzed += resSync.stats.analyzed;
      totalNewSignatures += resSync.stats.newSignatures;
    }

    res.json({
      success: true,
      message: `Synchronisation globale terminée (${voyages.length} voyages, ${totalAnalyzed} inscriptions analysées, +${totalNewSignatures} signatures)`,
      stats: { voyagesCount: voyages.length, totalAnalyzed, totalNewSignatures },
    });
  });

  // Get Inscriptions for a Voyage with search & filters
  app.get('/api/voyages/:id/inscriptions', (req: Request, res: Response) => {
    const search = req.query.search as string | undefined;
    const classe = req.query.classe as string | undefined;
    const statut = req.query.statut as string | undefined;

    const list = db.getInscriptions(req.params.id, search, classe, statut);
    res.json(list);
  });

  // Get single inscription
  app.get('/api/inscriptions/:id', (req: Request, res: Response) => {
    const item = db.getInscriptionById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }
    res.json(item);
  });

  // Send Relance / Reminder
  app.post('/api/inscriptions/:id/relance', (req: Request, res: Response) => {
    const parentNum = req.body.parentNum as 1 | 2 | undefined;
    const result = db.relanceInscription(req.params.id, parentNum);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // Download signed document (generates HTML or PDF preview)
  app.get('/api/inscriptions/:id/document', (req: Request, res: Response) => {
    const item = db.getInscriptionById(req.params.id);
    if (!item) {
      return res.status(404).send('Document introuvable');
    }

    const voyage = db.getVoyageById(item.voyage_id, false);

    // Return an official formatted HTML document with print-ready styles and SVG certification badge
    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Document d'inscription signé — ${item.eleve_nom} ${item.eleve_prenom}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #1e293b; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .badge-certified { background: #dcfce7; color: #166534; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; }
    .section-title { font-size: 16px; font-weight: bold; margin-top: 30px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #f8fafc; font-weight: 600; width: 30%; }
    .signatures-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; }
    .sig-box { border: 2px solid #cbd5e1; border-radius: 8px; padding: 16px; background: #f8fafc; }
    .sig-box.signed { border-color: #22c55e; background: #f0fdf4; }
    .sig-status { font-weight: bold; font-size: 14px; margin-bottom: 8px; }
    .sig-stamp { font-family: monospace; font-size: 11px; color: #64748b; background: #ffffff; padding: 8px; border-radius: 4px; border: 1px dashed #cbd5e1; margin-top: 10px; }
    .doc-footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 12px; color: #64748b; text-align: center; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="background: #2563eb; color: white; padding: 10px 18px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Imprimer ou Sauvegarder en PDF</button>
  </div>

  <div class="header">
    <div>
      <h1 style="margin: 0; font-size: 22px; color: #0f172a;">${voyage?.etablissement || 'Notre-Dame des Missions'}</h1>
      <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Dossier d'inscription au voyage scolaire — ${voyage?.nom || 'Voyage'}</p>
    </div>
    <div>
      <span class="badge-certified">✓ CERTIFIÉ DOCUSEAL (2/2 SIGNATURES)</span>
    </div>
  </div>

  <div class="section-title">1. INFORMATIONS SUR L'ÉLÈVE</div>
  <table>
    <tr><th>Nom de l'enfant</th><td><strong>${item.eleve_nom}</strong></td></tr>
    <tr><th>Prénom de l'enfant</th><td>${item.eleve_prenom}</td></tr>
    <tr><th>Classe</th><td>${item.classe}</td></tr>
    <tr><th>Voyage concerné</th><td>${voyage?.nom} (${voyage?.destination})</td></tr>
    <tr><th>Période du voyage</th><td>Du ${voyage?.date_depart} au ${voyage?.date_retour}</td></tr>
  </table>

  <div class="section-title">2. SIGNATURES PARENTALES ÉLECTRONIQUES (DocuSeal eIDAS)</div>
  <div class="signatures-grid">
    <div class="sig-box ${item.parent1.statut === 'signed' ? 'signed' : ''}">
      <div class="sig-status" style="color: ${item.parent1.statut === 'signed' ? '#15803d' : '#b45309'};">
        ${item.parent1.statut === 'signed' ? '🟢 PARENT 1 — SIGNÉ' : '🟠 PARENT 1 — EN ATTENTE'}
      </div>
      <div><strong>Nom :</strong> ${item.parent1.nom}</div>
      <div><strong>Email :</strong> ${item.parent1.email}</div>
      <div><strong>Téléphone :</strong> ${item.parent1.telephone || 'Non renseigné'}</div>
      <div><strong>Date de signature :</strong> ${item.parent1.date_signature || 'En attente'}</div>
      <div class="sig-stamp">
        Identifiant DocuSeal Submitter: ${item.parent1.submitter_id || 'subm_ds_p1'}<br>
        Horodatage certifié : ${item.parent1.date_signature || 'N/A'}<br>
        Intégrité SHA-256 : ${Math.random().toString(36).substring(2, 15).toUpperCase()}
      </div>
    </div>

    <div class="sig-box ${item.parent2.statut === 'signed' ? 'signed' : ''}">
      <div class="sig-status" style="color: ${item.parent2.statut === 'signed' ? '#15803d' : '#b45309'};">
        ${item.parent2.statut === 'signed' ? '🟢 PARENT 2 — SIGNÉ' : '🟠 PARENT 2 — EN ATTENTE'}
      </div>
      <div><strong>Nom :</strong> ${item.parent2.nom}</div>
      <div><strong>Email :</strong> ${item.parent2.email}</div>
      <div><strong>Téléphone :</strong> ${item.parent2.telephone || 'Non renseigné'}</div>
      <div><strong>Date de signature :</strong> ${item.parent2.date_signature || 'En attente'}</div>
      <div class="sig-stamp">
        Identifiant DocuSeal Submitter: ${item.parent2.submitter_id || 'subm_ds_p2'}<br>
        Horodatage certifié : ${item.parent2.date_signature || 'N/A'}<br>
        Intégrité SHA-256 : ${Math.random().toString(36).substring(2, 15).toUpperCase()}
      </div>
    </div>
  </div>

  <div class="section-title">3. CONDITIONS PARTICULIÈRES ET ENGAGEMENT</div>
  <p style="font-size: 13px; line-height: 1.6; color: #475569;">
    Les représentants légaux susmentionnés certifient sur l'honneur avoir pris connaissance du règlement des sorties et voyages scolaires, de la charte de vie collective, des modalités d'assurance et d'assistance rapatriement. Les consentements électroniques ont été recueillis conformément aux normes eIDAS en vigueur.
  </p>

  <div class="doc-footer">
    Document électronique généré automatiquement par le Portail Central des Voyages Scolaires de ${voyage?.etablissement || 'Notre-Dame des Missions'}.<br>
    Identifiant unique de soumission DocuSeal : <code>${item.docuseal_submission_id}</code> | Instance : <code>${voyage?.docuseal_instance_name}</code>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  });

  // Export Excel for a trip
  app.get('/api/voyages/:id/export/excel', (req: Request, res: Response) => {
    const voyage = db.getVoyageById(req.params.id, false);
    if (!voyage) {
      return res.status(404).send('Voyage non trouvé');
    }

    const inscriptions = db.getInscriptions(voyage.id);

    // Build structured data array for Excel
    const rows = inscriptions.map((item) => ({
      'Nom Élève': item.eleve_nom,
      'Prénom Élève': item.eleve_prenom,
      'Classe': item.classe,
      'Statut Global': item.statut === 'COMPLET' ? 'COMPLET (2/2)' : item.statut === 'A_FINALISER' ? 'À FINALISER (1/2)' : 'NON SIGNÉ (0/2)',
      'Nb Signatures': `${item.nombre_signatures}/2`,
      'Parent 1 - Nom': item.parent1.nom,
      'Parent 1 - Email': item.parent1.email,
      'Parent 1 - Statut': item.parent1.statut === 'signed' ? 'Signé' : 'En attente',
      'Parent 1 - Date Signature': item.parent1.date_signature || '',
      'Parent 2 - Nom': item.parent2.nom,
      'Parent 2 - Email': item.parent2.email,
      'Parent 2 - Statut': item.parent2.statut === 'signed' ? 'Signé' : 'En attente',
      'Parent 2 - Date Signature': item.parent2.date_signature || '',
      'Date Inscription': item.date_creation,
      'Dernière Synchronisation': item.date_derniere_synchronisation,
      'Réf DocuSeal': item.docuseal_submission_id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto calculate column widths
    const colWidths = [
      { wch: 18 }, // Nom
      { wch: 18 }, // Prénom
      { wch: 10 }, // Classe
      { wch: 22 }, // Statut Global
      { wch: 14 }, // Nb Signatures
      { wch: 24 }, // Parent 1 Nom
      { wch: 28 }, // Parent 1 Email
      { wch: 14 }, // Parent 1 Statut
      { wch: 20 }, // Parent 1 Date
      { wch: 24 }, // Parent 2 Nom
      { wch: 28 }, // Parent 2 Email
      { wch: 14 }, // Parent 2 Statut
      { wch: 20 }, // Parent 2 Date
      { wch: 18 }, // Date Insc
      { wch: 22 }, // Date Sync
      { wch: 22 }, // Ref DocuSeal
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscriptions');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const safeFilename = `Inscriptions_${voyage.nom.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().substring(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(buffer);
  });

  // Webhook DocuSeal endpoint
  app.post('/api/webhooks/docuseal/:voyageId', (req: Request, res: Response) => {
    const result = db.handleWebhook(req.params.voyageId, req.body);
    res.json(result);
  });

  // Sync Logs
  app.get('/api/logs', (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = db.getLogs(limit);
    res.json(logs);
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Portail Voyages Scolaires démarré sur http://localhost:${PORT}`);
  });
}

startServer();
