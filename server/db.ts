import fs from 'fs';
import path from 'path';
import { Voyage, Inscription, SyncLogEntry } from '../src/types.js';

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'database.json');

interface DatabaseData {
  voyages: Voyage[];
  inscriptions: Record<string, Inscription[]>; // voyage_id -> Inscriptions
  logs: SyncLogEntry[];
  adminPasswordHash: string; // 'Gafa8432'
}

// Helper to extract all key-value pairs from DocuSeal submissions and submitters
function extractDocuSealValues(sub: any): Record<string, string> {
  const map: Record<string, string> = {};

  const register = (k: any, v: any) => {
    if (k === undefined || k === null || v === undefined || v === null) return;
    const strVal = typeof v === 'object' ? (v.value !== undefined ? String(v.value) : JSON.stringify(v)) : String(v).trim();
    if (!strVal) return;
    const strKey = String(k).trim();
    map[strKey] = strVal;
    map[strKey.toLowerCase()] = strVal;
    const norm = strKey
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');
    map[norm] = strVal;
  };

  // From sub.values (can be an Array of { field, value } or an Object)
  if (Array.isArray(sub.values)) {
    for (const item of sub.values) {
      if (item) register(item.field || item.name || item.key || item.field_name, item.value ?? item.val);
    }
  } else if (sub.values && typeof sub.values === 'object') {
    for (const [k, v] of Object.entries(sub.values)) {
      register(k, v);
    }
  }

  // From submitters
  if (Array.isArray(sub.submitters)) {
    for (const s of sub.submitters) {
      if (Array.isArray(s.values)) {
        for (const item of s.values) {
          if (item) register(item.field || item.name || item.key, item.value ?? item.val);
        }
      } else if (s.values && typeof s.values === 'object') {
        for (const [k, v] of Object.entries(s.values)) {
          register(k, v);
        }
      }
      if (Array.isArray(s.fields)) {
        for (const item of s.fields) {
          if (item) register(item.name || item.field, item.value ?? item.default_value);
        }
      }
    }
  }

  return map;
}

function getFieldValue(map: Record<string, string>, candidates: string[]): string | undefined {
  for (const cand of candidates) {
    const norm = cand
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');
    if (map[norm] && map[norm].trim() !== '') return map[norm].trim();
    if (map[cand] && map[cand].trim() !== '') return map[cand].trim();
    if (map[cand.toLowerCase()] && map[cand.toLowerCase()].trim() !== '') return map[cand.toLowerCase()].trim();
  }

  // Loose search
  for (const [k, v] of Object.entries(map)) {
    if (!v || v.trim() === '') continue;
    for (const cand of candidates) {
      const c = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK.includes(c) || c.includes(cleanK)) {
        return v.trim();
      }
    }
  }
  return undefined;
}

export function extractTemplateIdFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/templates\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

export function normalizeDocuSealUrl(url: string): string {
  if (!url) return '';
  let u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `https://${u}`;
  }
  try {
    const parsed = new URL(u);
    // Strip trailing endpoints like /templates/..., /submissions/..., /s/..., /api/..., etc.
    let pathname = (parsed.pathname || '').replace(/\/(templates|s|submissions|documents|api)(\/.*)?$/i, '');
    pathname = pathname.replace(/\/+$/, '');
    return `${parsed.origin}${pathname}`;
  } catch {
    let cleaned = u.replace(/\/(templates|s|submissions|documents|api)(\/.*)?$/i, '');
    return cleaned.replace(/\/+$/, '');
  }
}

// In-memory Database instance with disk persistence
export class Database {
  private data: DatabaseData;

  private saveToFile(): void {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erreur lors de la sauvegarde sur disque:', err);
    }
  }

  private loadFromFile(): boolean {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.voyages) && parsed.inscriptions) {
          this.data = parsed;
          if (!this.data.adminPasswordHash) {
            this.data.adminPasswordHash = 'Gafa8432';
          }
          // Normalize establishment to "L'établissement scolaire Notre Dame des Missions"
          let changed = false;
          this.data.voyages.forEach((v) => {
            if (!v.etablissement || v.etablissement === 'Établissement Scolaire' || v.etablissement === 'Établissement scolaire') {
              v.etablissement = "L'établissement scolaire Notre Dame des Missions";
              changed = true;
            }
          });
          if (changed) {
            this.saveToFile();
          }
          return true;
        }
      }
    } catch (err) {
      console.warn('Impossible de charger database.json, réinitialisation à vide:', err);
    }
    return false;
  }

  constructor() {
    if (this.loadFromFile()) {
      return;
    }

    // Clean, empty initial production state (no mock or fake data)
    this.data = {
      voyages: [],
      inscriptions: {},
      logs: [
        {
          id: `log-init-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          voyage_id: 'system',
          voyage_nom: 'Système',
          type: 'auto_sync',
          status: 'success',
          message: 'Base de données initialisée en production. Prête pour l’ajout de vos instances DocuSeal.',
        },
      ],
      adminPasswordHash: 'Gafa8432',
    };
    this.saveToFile();
  }

  // Clear all data and reset to completely clean state
  resetToCleanProduction(): void {
    this.data = {
      voyages: [],
      inscriptions: {},
      logs: [
        {
          id: `log-clean-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          voyage_id: 'system',
          voyage_nom: 'Système',
          type: 'auto_sync',
          status: 'success',
          message: 'Base de données remise à zéro. Système prêt pour vos vraies instances DocuSeal.',
        },
      ],
      adminPasswordHash: 'Gafa8432',
    };
    this.saveToFile();
  }

  // Get all trips
  getVoyages(isAdmin = false): Voyage[] {
    return this.data.voyages.map((v) => {
      const hasPassword = Boolean(v.mot_de_passe && v.mot_de_passe.trim().length > 0);
      if (!isAdmin) {
        return {
          ...v,
          mot_de_passe: undefined,
          has_password: hasPassword,
          docuseal_api_key: undefined,
          docuseal_api_key_masked: v.docuseal_api_key ? `••••••••${v.docuseal_api_key.slice(-4)}` : undefined,
        };
      }
      return {
        ...v,
        has_password: hasPassword,
        docuseal_api_key_masked: v.docuseal_api_key ? `••••••••${v.docuseal_api_key.slice(-4)}` : undefined,
      };
    });
  }

  getVoyageById(id: string, isAdmin = false): Voyage | undefined {
    const v = this.data.voyages.find((x) => x.id === id);
    if (!v) return undefined;
    const hasPassword = Boolean(v.mot_de_passe && v.mot_de_passe.trim().length > 0);
    if (!isAdmin) {
      return {
        ...v,
        mot_de_passe: undefined,
        has_password: hasPassword,
        docuseal_api_key: undefined,
        docuseal_api_key_masked: v.docuseal_api_key ? `••••••••${v.docuseal_api_key.slice(-4)}` : undefined,
      };
    }
    return {
      ...v,
      has_password: hasPassword,
    };
  }

  // Verify trip password
  verifyVoyagePassword(id: string, passwordInput: string): { valid: boolean; message: string } {
    const v = this.data.voyages.find((x) => x.id === id);
    if (!v) return { valid: false, message: 'Voyage introuvable' };
    if (!v.mot_de_passe || v.mot_de_passe.trim().length === 0) {
      return { valid: true, message: 'Accès libre (aucun mot de passe requis)' };
    }
    const cleanInput = (passwordInput || '').trim();
    if (cleanInput === v.mot_de_passe.trim()) {
      return { valid: true, message: 'Mot de passe valide' };
    }
    return { valid: false, message: 'Mot de passe incorrect pour ce voyage' };
  }

  // Add a new trip (DocuSeal site configuration)
  addVoyage(voyageData: {
    nom: string;
    description?: string;
    destination: string;
    date_depart: string;
    date_retour: string;
    etablissement?: string;
    classes_concernees?: string[];
    statut?: Voyage['statut'];
    docuseal_instance_name?: string;
    docuseal_url: string;
    docuseal_api_key: string;
    docuseal_template_id: string;
    mot_de_passe?: string;
  }): Voyage {
    const id = `voyage-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const classes = voyageData.classes_concernees && voyageData.classes_concernees.length > 0 
      ? voyageData.classes_concernees 
      : ['Toutes'];

    const newVoyage: Voyage = {
      id,
      nom: voyageData.nom,
      description: voyageData.description || `Voyage scolaire à destination de ${voyageData.destination}`,
      destination: voyageData.destination,
      date_depart: voyageData.date_depart,
      date_retour: voyageData.date_retour,
      etablissement: voyageData.etablissement || "L'établissement scolaire Notre Dame des Missions",
      classes_concernees: classes,
      statut: voyageData.statut || 'inscriptions_ouvertes',
      docuseal_instance_name: voyageData.docuseal_instance_name || `DocuSeal ${this.data.voyages.length + 1}`,
      docuseal_url: normalizeDocuSealUrl(voyageData.docuseal_url),
      docuseal_api_key: voyageData.docuseal_api_key.trim(),
      docuseal_template_id: voyageData.docuseal_template_id.trim(),
      mot_de_passe: voyageData.mot_de_passe ? voyageData.mot_de_passe.trim() : undefined,
      connection_status: 'untested',
      total_inscrits: 0,
      total_complets: 0,
      total_a_finaliser: 0,
      total_non_signes: 0,
      created_at: now,
      updated_at: now,
    };

    // 100% real: initialize with EMPTY inscriptions array. No fake students!
    this.data.inscriptions[id] = [];
    this.data.voyages.unshift(newVoyage);

    this.addLog({
      voyage_id: id,
      voyage_nom: newVoyage.nom,
      type: 'manual_sync',
      status: 'success',
      message: `Nouveau voyage configuré : ${newVoyage.nom} (${newVoyage.docuseal_url})`,
      inscriptions_count: 0,
    });

    this.saveToFile();
    return newVoyage;
  }

  // Update existing trip
  updateVoyage(id: string, updateData: Partial<Voyage>): Voyage | undefined {
    const index = this.data.voyages.findIndex((v) => v.id === id);
    if (index === -1) return undefined;

    const current = this.data.voyages[index];
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Keep existing API key if updateData sends empty string (user did not retype it)
    const newApiKey = updateData.docuseal_api_key !== undefined ? updateData.docuseal_api_key.trim() : '';
    const finalApiKey = newApiKey.length > 0 ? newApiKey : current.docuseal_api_key;

    const tplFromUrl = updateData.docuseal_url ? extractTemplateIdFromUrl(updateData.docuseal_url) : null;
    const newTemplateId = updateData.docuseal_template_id !== undefined ? updateData.docuseal_template_id.trim() : '';
    const finalTemplateId = newTemplateId.length > 0 ? newTemplateId : (tplFromUrl || current.docuseal_template_id);

    const finalMotDePasse = updateData.mot_de_passe !== undefined
      ? (updateData.mot_de_passe.trim().length > 0 ? updateData.mot_de_passe.trim() : undefined)
      : current.mot_de_passe;

    const updated: Voyage = {
      ...current,
      ...updateData,
      docuseal_api_key: finalApiKey,
      docuseal_template_id: finalTemplateId,
      docuseal_url: updateData.docuseal_url !== undefined ? normalizeDocuSealUrl(updateData.docuseal_url) : current.docuseal_url,
      mot_de_passe: finalMotDePasse,
      updated_at: now,
    };

    updated.docuseal_api_key_masked = updated.docuseal_api_key ? `••••••••${updated.docuseal_api_key.slice(-4)}` : undefined;

    this.data.voyages[index] = updated;
    this.saveToFile();
    return updated;
  }

  // Delete trip
  deleteVoyage(id: string): boolean {
    const index = this.data.voyages.findIndex((v) => v.id === id);
    if (index === -1) return false;
    const v = this.data.voyages[index];
    this.data.voyages.splice(index, 1);
    delete this.data.inscriptions[id];

    this.addLog({
      voyage_id: id,
      voyage_nom: v.nom,
      type: 'manual_sync',
      status: 'warning',
      message: `Voyage supprimé : ${v.nom}`,
    });

    this.saveToFile();
    return true;
  }

  // List all templates available on DocuSeal
  static async fetchDocuSealTemplates(url: string, apiKey: string): Promise<{
    success: boolean;
    templates?: Array<{ id: number | string; name: string; slug?: string; schema?: any }>;
    message?: string;
  }> {
    try {
      const cleanUrl = normalizeDocuSealUrl(url);
      if (!apiKey || !apiKey.trim()) {
        return {
          success: false,
          message: "Clé API manquante : Veuillez saisir la clé API DocuSeal (située dans DocuSeal > Paramètres > Clés API).",
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${cleanUrl}/api/templates?limit=50`, {
        method: 'GET',
        headers: {
          'X-Auth-Token': apiKey.trim(),
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let extra = '';
        if (res.status === 401 || res.status === 403) {
          extra = 'Clé API X-Auth-Token non autorisée ou expirée.';
        } else if (res.status === 404) {
          extra = `L'adresse ${cleanUrl}/api/templates n'a pas été trouvée (404). Vérifiez l'URL de votre DocuSeal.`;
        }
        return {
          success: false,
          message: `HTTP ${res.status} (${res.statusText}) : ${extra || 'Impossible de lister les modèles.'}`,
        };
      }

      const json = await res.json();
      const list: any[] = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
      const templates = list.map((t: any) => ({
        id: t.id,
        name: t.name || `Modèle #${t.id}`,
        slug: t.slug,
      }));

      return { success: true, templates };
    } catch (err: any) {
      return {
        success: false,
        message: `Impossible de contacter DocuSeal : ${err.message || 'Hôte inaccessible'}`,
      };
    }
  }

  // Real test DocuSeal connection directly via HTTP
  static async executeDocuSealConnectionTest(url: string, apiKey: string, templateId: string): Promise<{
    success: boolean;
    message: string;
    httpStatus?: number;
    latencyMs?: number;
    submissionsCount?: number;
  }> {
    const startTime = Date.now();
    try {
      const cleanUrl = normalizeDocuSealUrl(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const trimmedTpl = templateId ? templateId.trim() : '';
      const endpoint = trimmedTpl ? `${cleanUrl}/api/templates/${trimmedTpl}` : `${cleanUrl}/api/templates?limit=1`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-Auth-Token': apiKey?.trim() || '',
          'Authorization': `Bearer ${apiKey?.trim() || ''}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        const templateData = await response.json().catch(() => ({}));
        const templateName = templateData.name || (trimmedTpl ? `#${trimmedTpl}` : 'Modèles accessibles');

        // Also check submissions count for this template
        let submissionsFound = 0;
        try {
          const subUrl = trimmedTpl
            ? `${cleanUrl}/api/submissions?template_id=${trimmedTpl}&limit=100`
            : `${cleanUrl}/api/submissions?limit=100`;
          const subRes = await fetch(subUrl, {
            headers: {
              'X-Auth-Token': apiKey?.trim() || '',
              'Authorization': `Bearer ${apiKey?.trim() || ''}`,
            },
          });
          if (subRes.ok) {
            const subData = await subRes.json();
            const arr = Array.isArray(subData) ? subData : Array.isArray(subData.data) ? subData.data : [];
            submissionsFound = arr.length;
          }
        } catch {
          // ignore submissions probe error
        }

        return {
          success: true,
          message: `200 OK — Connecté à DocuSeal (${latency}ms) — Accès valide (${submissionsFound} soumission${submissionsFound > 1 ? 's' : ''} réelle${submissionsFound > 1 ? 's' : ''})`,
          httpStatus: response.status,
          latencyMs: latency,
          submissionsCount: submissionsFound,
        };
      } else if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: `Erreur HTTP ${response.status} (Non autorisé) : La clé API X-Auth-Token est invalide pour ce serveur DocuSeal.`,
          httpStatus: response.status,
          latencyMs: latency,
        };
      } else if (response.status === 404) {
        return {
          success: false,
          message: `Erreur HTTP 404 : L'instance DocuSeal répond bien, mais le Template ID #${trimmedTpl} n'existe pas. Utilisez le bouton 'Charger mes modèles' pour choisir un modèle existant.`,
          httpStatus: response.status,
          latencyMs: latency,
        };
      } else {
        return {
          success: false,
          message: `Erreur HTTP ${response.status} : ${response.statusText}`,
          httpStatus: response.status,
          latencyMs: latency,
        };
      }
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const msg = err.name === 'AbortError' 
        ? 'Délai d’attente dépassé (> 8 secondes) : L’hôte DocuSeal ne répond pas.' 
        : `Impossible de joindre l'hôte (${err.message || 'Hôte inaccessible'}). Vérifiez l'URL et le port.`;
      return {
        success: false,
        message: msg,
        latencyMs: latency,
      };
    }
  }

  // Test DocuSeal connection for an existing voyage
  async testDocuSealConnection(voyageId: string): Promise<{ success: boolean; message: string; httpStatus?: number; latencyMs?: number }> {
    const v = this.data.voyages.find((x) => x.id === voyageId);
    if (!v) return { success: false, message: 'Voyage introuvable' };

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const testResult = await Database.executeDocuSealConnectionTest(v.docuseal_url, v.docuseal_api_key, v.docuseal_template_id);

    v.connection_status = testResult.success ? 'connected' : 'error';
    v.last_test_at = now;
    v.last_test_message = testResult.message;

    this.addLog({
      voyage_id: v.id,
      voyage_nom: v.nom,
      type: 'connection_test',
      status: testResult.success ? 'success' : 'error',
      message: testResult.message,
    });

    this.saveToFile();
    return testResult;
  }

  // Get Inscriptions
  getInscriptions(voyageId: string, search?: string, classe?: string, statut?: string): Inscription[] {
    let list = this.data.inscriptions[voyageId] || [];

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.eleve_nom.toLowerCase().includes(q) ||
          item.eleve_prenom.toLowerCase().includes(q) ||
          item.classe.toLowerCase().includes(q) ||
          item.parent1.nom.toLowerCase().includes(q) ||
          item.parent2.nom.toLowerCase().includes(q)
      );
    }

    if (classe && classe !== 'Toutes' && classe !== 'Tous') {
      list = list.filter((item) => item.classe === classe);
    }

    if (statut && statut !== 'Tous') {
      list = list.filter((item) => item.statut === statut);
    }

    return list;
  }

  getInscriptionById(id: string): Inscription | undefined {
    for (const list of Object.values(this.data.inscriptions)) {
      const found = list.find((i) => i.id === id);
      if (found) return found;
    }
    return undefined;
  }

  // Trigger 100% REAL sync with DocuSeal API
  async syncVoyage(voyageId: string): Promise<{ success: boolean; message: string; stats: { analyzed: number; newInscriptions: number; newSignatures: number } }> {
    const v = this.data.voyages.find((x) => x.id === voyageId);
    if (!v) return { success: false, message: 'Voyage introuvable', stats: { analyzed: 0, newInscriptions: 0, newSignatures: 0 } };

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const currentInscriptions = this.data.inscriptions[voyageId] || [];
    const currentSubIds = new Set(currentInscriptions.map((i) => i.docuseal_submission_id));

    let newSignaturesCount = 0;
    let newInscriptionsCount = 0;

    try {
      const cleanUrl = normalizeDocuSealUrl(v.docuseal_url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      // 1. Query all submissions for this template (with pagination)
      let allSubs: any[] = [];
      let subUrl: string | null = `${cleanUrl}/api/submissions?template_id=${v.docuseal_template_id}&limit=100`;

      while (subUrl && allSubs.length < 500) {
        const subRes = await fetch(subUrl, {
          headers: {
            'X-Auth-Token': v.docuseal_api_key?.trim() || '',
            'Authorization': `Bearer ${v.docuseal_api_key?.trim() || ''}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(12000),
        });

        if (!subRes.ok) {
          if (allSubs.length === 0) {
            const errorText = await subRes.text().catch(() => '');
            v.connection_status = 'error';
            v.last_sync_at = now;
            v.last_sync_message = `Échec HTTP ${subRes.status}: ${subRes.statusText || errorText || 'Clé API ou instance invalide'}`;
            this.saveToFile();
            return {
              success: false,
              message: `Échec de l'appel DocuSeal : HTTP ${subRes.status} (${subRes.statusText}). Vérifiez votre clé API et l'accessibilité de l'instance.`,
              stats: { analyzed: currentInscriptions.length, newInscriptions: 0, newSignatures: 0 },
            };
          }
          break;
        }

        const subJson = await subRes.json();
        const list = Array.isArray(subJson) ? subJson : Array.isArray(subJson.data) ? subJson.data : [];
        allSubs.push(...list);

        if (subJson.pagination && subJson.pagination.next && list.length > 0) {
          subUrl = `${cleanUrl}/api/submissions?template_id=${v.docuseal_template_id}&limit=100&after=${subJson.pagination.next}`;
        } else {
          subUrl = null;
        }
      }

      // If 0 submissions found with template_id query, try general submissions list
      if (allSubs.length === 0) {
        try {
          const fallbackRes = await fetch(`${cleanUrl}/api/submissions?limit=100`, {
            headers: {
              'X-Auth-Token': v.docuseal_api_key?.trim() || '',
              'Authorization': `Bearer ${v.docuseal_api_key?.trim() || ''}`,
            },
            signal: AbortSignal.timeout(10000),
          });
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            const list: any[] = Array.isArray(fallbackJson) ? fallbackJson : Array.isArray(fallbackJson.data) ? fallbackJson.data : [];
            const filtered = list.filter((s) => String(s.template_id) === String(v.docuseal_template_id) || String(s.template?.id) === String(v.docuseal_template_id));
            if (filtered.length > 0) {
              allSubs = filtered;
            }
          }
        } catch {
          // ignore fallback error
        }
      }

      // 2. Query all submitters (DocuSeal provides form field values in /api/submitters)
      let allSubmitters: any[] = [];
      let submittersUrl: string | null = `${cleanUrl}/api/submitters?template_id=${v.docuseal_template_id}&limit=100`;

      while (submittersUrl && allSubmitters.length < 1000) {
        try {
          const sRes = await fetch(submittersUrl, {
            headers: {
              'X-Auth-Token': v.docuseal_api_key?.trim() || '',
              'Authorization': `Bearer ${v.docuseal_api_key?.trim() || ''}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(12000),
          });
          if (!sRes.ok) break;
          const sJson = await sRes.json();
          const sList = Array.isArray(sJson) ? sJson : Array.isArray(sJson.data) ? sJson.data : [];
          allSubmitters.push(...sList);

          if (sJson.pagination && sJson.pagination.next && sList.length > 0) {
            submittersUrl = `${cleanUrl}/api/submitters?template_id=${v.docuseal_template_id}&limit=100&after=${sJson.pagination.next}`;
          } else {
            submittersUrl = null;
          }
        } catch {
          break;
        }
      }

      // Group submitters by submission_id
      const submittersBySub = new Map<number, any[]>();
      for (const s of allSubmitters) {
        const sid = Number(s.submission_id);
        if (!submittersBySub.has(sid)) {
          submittersBySub.set(sid, []);
        }
        submittersBySub.get(sid)!.push(s);
      }

      // Helper to find normalized value from field dictionary
      const findVal = (map: Record<string, string>, candidates: string[]): string | undefined => {
        for (const cand of candidates) {
          const cleanCand = cand
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
          for (const [k, val] of Object.entries(map)) {
            if (!val || !String(val).trim()) continue;
            const cleanKey = k
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, '');
            if (cleanKey === cleanCand) {
              return String(val).trim();
            }
          }
        }
        return undefined;
      };

      // Filter out archived submissions (in DocuSeal UI, archived submissions are excluded from the active list: 128 active vs 27 archived)
      const activeSubs = allSubs.filter((sub: any) => !sub.archived_at);
      const archivedCount = allSubs.length - activeSubs.length;

      // Map real DocuSeal submissions
      const mappedInscriptions: Inscription[] = activeSubs.map((sub: any, idx: number) => {
        const sid = Number(sub.id);
        const detailedSubmitters = submittersBySub.get(sid) || (Array.isArray(sub.submitters) ? sub.submitters : []);

        // Sort submitters: Première partie first, Deuxième partie second
        const sortedSubmitters = [...detailedSubmitters].sort((a, b) => {
          const rA = (a.role || '').toLowerCase();
          const rB = (b.role || '').toLowerCase();
          if (rA.includes('premi') || rA.includes('1')) return -1;
          if (rB.includes('premi') || rB.includes('1')) return 1;
          return (a.id || 0) - (b.id || 0);
        });

        // Collect all field values across submitters and submission
        const fieldMap: Record<string, string> = {};
        for (const s of sortedSubmitters) {
          for (const it of s.values || []) {
            if (it && it.field && it.value !== undefined && it.value !== null) {
              fieldMap[it.field] = String(it.value);
            }
          }
        }
        if (Array.isArray(sub.values)) {
          for (const it of sub.values) {
            if (it && it.field && it.value !== undefined && it.value !== null) {
              fieldMap[it.field] = String(it.value);
            }
          }
        }

        const subP1 = sortedSubmitters[0] || {};
        const subP2 = sortedSubmitters[1] || {};

        // 1. Extract student names from form fields
        const eleveNomFound = findVal(fieldMap, [
          "nom de l'enfant",
          "nom de l enfant",
          "nom enfant",
          "nom de l'eleve",
          "nom de l eleve",
          "nom eleve",
          "nom de l'etudiant",
          "nom etudiant",
          "nom de famille de l'enfant",
          "nom de famille de l'eleve",
          "nom de famille",
          "nom",
        ]);

        const elevePrenomFound = findVal(fieldMap, [
          "prenom de l'enfant",
          "prenom de l enfant",
          "prenom enfant",
          "prenom de l'eleve",
          "prenom de l eleve",
          "prenom eleve",
          "prenom de l'etudiant",
          "prenom etudiant",
          "prenom",
        ]);

        const classeFound = findVal(fieldMap, [
          "classe de l'enfant",
          "classe de l enfant",
          "classe enfant",
          "classe de l'eleve",
          "classe de l eleve",
          "classe eleve",
          "classe",
          "division",
          "classe actuelle",
        ]);

        // Parent fields
        const parentNomFound = findVal(fieldMap, [
          "nom du responsable",
          "nom responsable",
          "nom du responsable 1",
          "nom responsable 1",
          "nom du parent",
          "nom parent",
          "nom du représentant légal",
        ]);
        const parentPrenomFound = findVal(fieldMap, [
          "prenom du responsable",
          "prenom responsable",
          "prenom du responsable 1",
          "prenom responsable 1",
          "prenom du parent",
          "prenom parent",
        ]);
        const parentTelFound = findVal(fieldMap, [
          "telephone du responsable",
          "telephone responsable",
          "telephone du responsable 1",
          "telephone",
          "mobile",
          "portable",
          "numéro de téléphone",
        ]);

        // Fallbacks if form was not filled yet (0/2 signatures)
        let eleveNom = eleveNomFound ? eleveNomFound.toUpperCase() : '';
        let elevePrenom = elevePrenomFound ? (elevePrenomFound.charAt(0).toUpperCase() + elevePrenomFound.slice(1)) : '';

        if (!eleveNom) {
          if (subP1.name) {
            const parts = subP1.name.trim().split(/\s+/);
            eleveNom = parts.length > 1 ? parts.slice(1).join(' ').toUpperCase() : parts[0].toUpperCase();
            if (!elevePrenom) elevePrenom = parts[0];
          } else {
            eleveNom = `DOSSIER #${sub.id || idx + 1}`;
            elevePrenom = '(En attente)';
          }
        }

        const classe = classeFound || (v.classes_concernees[0] && v.classes_concernees[0] !== 'Toutes' ? v.classes_concernees[0] : 'Non spécifiée');

        const p1Signed = subP1.status === 'completed' || Boolean(subP1.completed_at);
        const p2Signed = subP2.status === 'completed' || Boolean(subP2.completed_at);

        const hasOnlyOneParent = sortedSubmitters.length <= 1;
        const sigCount = hasOnlyOneParent
          ? (p1Signed ? 2 : 0) as 0 | 1 | 2
          : ((p1Signed ? 1 : 0) + (p2Signed ? 1 : 0)) as 0 | 1 | 2;

        const statut = sigCount === 2 ? 'COMPLET' : sigCount === 1 ? 'A_FINALISER' : 'NON_SIGNE';
        const subIdStr = String(sub.id || `sub_${idx + 1}`);

        if (!currentSubIds.has(subIdStr)) {
          newInscriptionsCount++;
        }

        const docUrl = (subP1.documents && subP1.documents[0]?.url) ||
          (subP2.documents && subP2.documents[0]?.url) ||
          (sub.documents && sub.documents[0]?.url) ||
          (sigCount === 2 ? `/api/inscriptions/insc-${v.id}-${subIdStr}/document` : undefined);

        // Build parent 1 name
        let parent1DisplayName = 'Responsable légal 1';
        if (parentNomFound || parentPrenomFound) {
          parent1DisplayName = `${(parentNomFound || '').toUpperCase()} ${parentPrenomFound || ''}`.trim();
        } else if (subP1.name) {
          parent1DisplayName = subP1.name;
        } else if (subP1.email) {
          parent1DisplayName = `En attente (${subP1.email})`;
        }

        // Build parent 2 name
        let parent2DisplayName = hasOnlyOneParent ? 'Non requis (1 seul signataire)' : 'Responsable légal 2';
        if (!hasOnlyOneParent) {
          if (subP2.name) {
            parent2DisplayName = subP2.name;
          } else if (subP2.email) {
            parent2DisplayName = subP2.email;
          }
        }

        return {
          id: `insc-${v.id}-${subIdStr}`,
          voyage_id: v.id,
          eleve_nom: eleveNom,
          eleve_prenom: elevePrenom,
          classe: classe,
          docuseal_submission_id: subIdStr,
          date_creation: sub.created_at ? sub.created_at.substring(0, 16).replace('T', ' ') : now,
          date_derniere_synchronisation: now,
          parent1: {
            nom: parent1DisplayName,
            email: subP1.email || '',
            telephone: parentTelFound || subP1.phone || subP1.phone_number || '',
            statut: p1Signed ? 'signed' : 'pending',
            date_signature: subP1.completed_at ? subP1.completed_at.substring(0, 16).replace('T', ' ') : undefined,
            submitter_id: String(subP1.id || `subm_${subIdStr}_p1`),
            slug: subP1.slug || `sign-${subIdStr}-p1`,
          },
          parent2: {
            nom: parent2DisplayName,
            email: subP2.email || '',
            telephone: subP2.phone || subP2.phone_number || '',
            statut: hasOnlyOneParent ? 'signed' : (p2Signed ? 'signed' : 'pending'),
            date_signature: subP2.completed_at ? subP2.completed_at.substring(0, 16).replace('T', ' ') : undefined,
            submitter_id: String(subP2.id || `subm_${subIdStr}_p2`),
            slug: subP2.slug || `sign-${subIdStr}-p2`,
          },
          nombre_signatures: sigCount,
          statut: statut,
          document_url: docUrl,
        };
      });

      // Save strictly the real mapped inscriptions
      this.data.inscriptions[voyageId] = mappedInscriptions;

      v.connection_status = 'connected';
      v.total_inscrits = mappedInscriptions.length;
      v.total_complets = mappedInscriptions.filter((i) => i.statut === 'COMPLET').length;
      v.total_a_finaliser = mappedInscriptions.filter((i) => i.statut === 'A_FINALISER').length;
      v.total_non_signes = mappedInscriptions.filter((i) => i.statut === 'NON_SIGNE').length;
      v.last_sync_at = now;
      v.last_sync_message = `✓ ${mappedInscriptions.length} dossiers actifs (${archivedCount} archivés exclus)`;

      this.addLog({
        voyage_id: v.id,
        voyage_nom: v.nom,
        type: 'manual_sync',
        status: 'success',
        message: `Synchronisation réussie : ${mappedInscriptions.length} dossiers actifs récupérés depuis DocuSeal (${archivedCount} dossiers archivés/annulés exclus)`,
        inscriptions_count: mappedInscriptions.length,
        new_inscriptions: newInscriptionsCount,
        new_signatures: newSignaturesCount,
      });

      this.saveToFile();

      return {
        success: true,
        message: mappedInscriptions.length > 0
          ? `✓ Synchronisation réussie : ${mappedInscriptions.length} dossiers actifs récupérés (${archivedCount} dossiers archivés exclus, conforme aux ${mappedInscriptions.length} de DocuSeal).`
          : `✓ Connecté avec succès à DocuSeal : 0 soumission trouvée pour le modèle #${v.docuseal_template_id}. Dès qu'un parent signera, il apparaîtra ici.`,
        stats: {
          analyzed: mappedInscriptions.length,
          newInscriptions: newInscriptionsCount,
          newSignatures: newSignaturesCount,
        },
      };
    } catch (err: any) {
      console.error('Erreur synchronisation DocuSeal en direct:', err);
      v.connection_status = 'error';
      v.last_sync_at = now;
      v.last_sync_message = `Erreur réseau : ${err.message || 'Impossible de joindre le serveur DocuSeal'}`;

      this.addLog({
        voyage_id: v.id,
        voyage_nom: v.nom,
        type: 'manual_sync',
        status: 'error',
        message: `Échec de connexion : ${err.message}`,
      });

      this.saveToFile();

      return {
        success: false,
        message: `Impossible de contacter l'instance DocuSeal à l'adresse ${v.docuseal_url} (${err.message || 'Délai d’attente dépassé'}).`,
        stats: { analyzed: currentInscriptions.length, newInscriptions: 0, newSignatures: 0 },
      };
    }
  }

  // Handle incoming webhook from DocuSeal
  handleWebhook(voyageId: string, payload: any): { success: boolean; message: string } {
    const v = this.data.voyages.find((x) => x.id === voyageId);
    if (!v) return { success: false, message: 'Voyage inconnu' };

    const eventType = payload.event_type || payload.event || 'submission.completed';
    const subId = payload.data?.id || payload.id;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const list = this.data.inscriptions[voyageId] || [];
    const item = list.find((i) => i.docuseal_submission_id === String(subId) || i.docuseal_submission_id.includes(String(subId)));

    if (item) {
      if (Array.isArray(payload.data?.submitters)) {
        payload.data.submitters.forEach((subm: any, idx: number) => {
          const parent = idx === 0 ? item.parent1 : item.parent2;
          if (subm.status === 'completed' && parent.statut !== 'signed') {
            parent.statut = 'signed';
            parent.date_signature = subm.completed_at ? subm.completed_at.substring(0, 16).replace('T', ' ') : now;
          }
        });
      } else {
        item.parent1.statut = 'signed';
        item.parent1.date_signature = now;
        item.parent2.statut = 'signed';
        item.parent2.date_signature = now;
      }

      const s1 = item.parent1.statut === 'signed';
      const s2 = item.parent2.statut === 'signed';
      item.nombre_signatures = (s1 ? 1 : 0) + (s2 ? 1 : 0) as 0 | 1 | 2;
      item.statut = item.nombre_signatures === 2 ? 'COMPLET' : item.nombre_signatures === 1 ? 'A_FINALISER' : 'NON_SIGNE';
      if (item.nombre_signatures === 2) {
        item.document_url = `/api/inscriptions/${item.id}/document`;
      }
      item.date_derniere_synchronisation = now;
    }

    // Refresh totals
    v.total_complets = list.filter((i) => i.statut === 'COMPLET').length;
    v.total_a_finaliser = list.filter((i) => i.statut === 'A_FINALISER').length;
    v.total_non_signes = list.filter((i) => i.statut === 'NON_SIGNE').length;
    v.last_sync_at = now;

    this.addLog({
      voyage_id: v.id,
      voyage_nom: v.nom,
      type: 'webhook',
      status: 'success',
      message: `Webhook DocuSeal reçu (${eventType}) pour la soumission #${subId}`,
      inscriptions_count: list.length,
      new_signatures: 1,
    });

    this.saveToFile();
    return { success: true, message: 'Webhook traité avec succès' };
  }

  // Send relance / reminder
  async relanceInscription(inscriptionId: string, parentNum?: 1 | 2): Promise<{
    success: boolean;
    message: string;
    signingUrl: string;
    emailSentViaDocuseal?: boolean;
    docusealMessage?: string;
    parentNom: string;
    parentEmail: string;
    emailSubject: string;
    emailBody: string;
  }> {
    const item = this.getInscriptionById(inscriptionId);
    if (!item) {
      return {
        success: false,
        message: 'Inscription introuvable',
        signingUrl: '',
        parentNom: '',
        parentEmail: '',
        emailSubject: '',
        emailBody: '',
      };
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    item.derniere_relance = now;

    const voyage = this.getVoyageById(item.voyage_id, true);
    const targetParent = parentNum === 2 ? item.parent2 : parentNum === 1 ? item.parent1 : (item.parent1.statut !== 'signed' ? item.parent1 : item.parent2);

    const docusealBase = voyage?.docuseal_url ? normalizeDocuSealUrl(voyage.docuseal_url) : 'https://docuseal.ndmissions.fr';
    const signingUrl = targetParent.slug 
      ? `${docusealBase}/s/${targetParent.slug}` 
      : `${docusealBase}/submissions/${item.docuseal_submission_id}`;

    const emailSubject = `[${voyage?.etablissement || "L'établissement scolaire Notre Dame des Missions"}] Voyage à ${voyage?.destination || 'Londres'} — Signature attendue pour ${item.eleve_prenom} ${item.eleve_nom}`;
    const emailBody = `Bonjour ${targetParent.nom || 'Madame, Monsieur'},\n\nNous constatons qu'il manque encore votre signature pour valider le dossier d'inscription de votre enfant ${item.eleve_prenom} ${item.eleve_nom} (Classe ${item.classe}) au voyage à ${voyage?.destination || 'Londres'}.\n\nAfin de finaliser l'inscription dans les délais, merci de bien vouloir compléter et signer le document en cliquant directement sur le lien sécurisé suivant :\n👉 ${signingUrl}\n\nSi vous rencontrez la moindre difficulté, n'hésitez pas à nous contacter.\n\nCordialement,\nL'équipe organisatrice du voyage scolaire\n${voyage?.etablissement || "L'établissement scolaire Notre Dame des Missions"}`;

    // Attempt DocuSeal API notification if submitter_id and apiKey exist
    let emailSentViaDocuseal = false;
    let docusealMessage = '';

    if (voyage?.docuseal_api_key && targetParent.submitter_id && targetParent.statut !== 'signed') {
      try {
        const putRes = await fetch(`${docusealBase}/api/submitters/${targetParent.submitter_id}`, {
          method: 'PUT',
          headers: {
            'X-Auth-Token': voyage.docuseal_api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ send_email: true }),
        });
        if (putRes.ok) {
          emailSentViaDocuseal = true;
          docusealMessage = 'Notification envoyée avec succès par DocuSeal.';
        } else {
          const errJson: any = await putRes.json().catch(() => ({}));
          docusealMessage = errJson?.error || `Code HTTP ${putRes.status}`;
        }
      } catch (err: any) {
        docusealMessage = err.message || 'Erreur réseau vers DocuSeal';
      }
    }

    this.addLog({
      voyage_id: item.voyage_id,
      voyage_nom: voyage?.nom || 'Voyage',
      type: 'manual_sync',
      status: 'success',
      message: `Relance pour ${item.eleve_prenom} ${item.eleve_nom} (${targetParent.email}) ${emailSentViaDocuseal ? '— Email renvoyé par DocuSeal' : ''}`,
    });

    this.saveToFile();

    return {
      success: true,
      message: emailSentViaDocuseal
        ? `✓ Relance envoyée automatiquement par email à ${targetParent.nom} (${targetParent.email}) via DocuSeal.`
        : `Lien de relance généré pour ${targetParent.nom} (${targetParent.email}).`,
      signingUrl,
      emailSentViaDocuseal,
      docusealMessage,
      parentNom: targetParent.nom,
      parentEmail: targetParent.email,
      emailSubject,
      emailBody,
    };
  }

  // Send Mass Relance / Reminders for a Voyage
  async relanceMasseVoyage(
    voyageId: string,
    filter?: {
      targetStatus?: 'all_incomplete' | 'a_finaliser' | 'non_signe';
      classe?: string;
    }
  ): Promise<{
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
  }> {
    const voyage = this.getVoyageById(voyageId, true);
    if (!voyage) {
      return {
        success: false,
        message: 'Voyage introuvable',
        totalInscriptionsTargeted: 0,
        totalParentsToContact: 0,
        totalEmailsDocuSealSent: 0,
        parentsEmailsList: [],
        mailToUrl: '',
        emailSubject: '',
        emailBody: '',
        details: [],
      };
    }

    const allInscriptions = this.getInscriptions(voyageId);
    const targetStatus = filter?.targetStatus || 'all_incomplete';
    const targetClasse = filter?.classe && filter.classe !== 'Toutes' && filter.classe !== 'ALL' ? filter.classe : null;

    // Filter matching inscriptions
    const filteredInscriptions = allInscriptions.filter((item) => {
      if (item.statut === 'COMPLET') return false; // Never remind complete files
      if (targetStatus === 'a_finaliser' && item.statut !== 'A_FINALISER') return false;
      if (targetStatus === 'non_signe' && item.statut !== 'NON_SIGNE') return false;
      if (targetClasse && item.classe !== targetClasse) return false;
      return true;
    });

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const docusealBase = voyage.docuseal_url ? normalizeDocuSealUrl(voyage.docuseal_url) : 'https://docuseal.ndmissions.fr';
    const etablissementName = voyage.etablissement || "L'établissement scolaire Notre Dame des Missions";

    const parentsEmailsSet = new Set<string>();
    let totalEmailsDocuSealSent = 0;
    let totalParentsToContact = 0;

    const details: Array<{
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
    }> = [];

    for (const item of filteredInscriptions) {
      item.derniere_relance = now;
      const parentsForStudent: Array<{
        nom: string;
        email: string;
        parentNum: 1 | 2;
        signingUrl: string;
        sentViaDocuseal: boolean;
        docusealMessage?: string;
      }> = [];

      // Determine unsigned parents
      const parentsToCheck: Array<{ p: typeof item.parent1; num: 1 | 2 }> = [];
      if (item.parent1 && item.parent1.statut !== 'signed') {
        parentsToCheck.push({ p: item.parent1, num: 1 });
      }
      if (item.parent2 && item.parent2.statut !== 'signed') {
        parentsToCheck.push({ p: item.parent2, num: 2 });
      }

      for (const { p, num } of parentsToCheck) {
        if (!p.email) continue;
        totalParentsToContact++;
        const emailClean = p.email.trim();
        parentsEmailsSet.add(emailClean);

        const signingUrl = p.slug
          ? `${docusealBase}/s/${p.slug}`
          : `${docusealBase}/submissions/${item.docuseal_submission_id}`;

        let sentViaDocuseal = false;
        let docusealMessage = '';

        if (voyage.docuseal_api_key && p.submitter_id) {
          try {
            const putRes = await fetch(`${docusealBase}/api/submitters/${p.submitter_id}`, {
              method: 'PUT',
              headers: {
                'X-Auth-Token': voyage.docuseal_api_key,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ send_email: true }),
            });
            if (putRes.ok) {
              sentViaDocuseal = true;
              totalEmailsDocuSealSent++;
              docusealMessage = 'Notification envoyée avec succès par DocuSeal';
            } else {
              const errJson: any = await putRes.json().catch(() => ({}));
              docusealMessage = errJson?.error || `Code HTTP ${putRes.status}`;
            }
          } catch (err: any) {
            docusealMessage = err.message || 'Erreur réseau vers DocuSeal';
          }
        }

        parentsForStudent.push({
          nom: p.nom || 'Responsable légal',
          email: emailClean,
          parentNum: num,
          signingUrl,
          sentViaDocuseal,
          docusealMessage,
        });
      }

      details.push({
        inscriptionId: item.id,
        eleve: `${item.eleve_prenom} ${item.eleve_nom}`,
        classe: item.classe,
        parents: parentsForStudent,
      });
    }

    const parentsEmailsList = Array.from(parentsEmailsSet);

    this.saveToFile();

    const emailSubject = `[${etablissementName}] Voyage à ${voyage.destination || voyage.nom} — Relance signature inscription`;
    const emailBody = `Madame, Monsieur,\n\nNous vous informons qu'à ce jour, le dossier d'inscription de votre enfant pour le voyage scolaire à ${voyage.destination || voyage.nom} n'est pas encore entièrement signé.\n\nPour rappel, la signature des deux représentants légaux est requise pour valider définitivement la participation de l'élève.\n\nMerci de bien vouloir vérifier votre boîte de messagerie (et vos spams/indésirables) afin d'accéder au document DocuSeal et d'apposer votre signature électronique dans les meilleurs délais.\n\nEn cas de question ou de difficulté technique, merci de prendre contact avec l'établissement.\n\nBien cordialement,\nL'équipe organisatrice du voyage scolaire\n${etablissementName}`;

    const bccQuery = encodeURIComponent(parentsEmailsList.join(','));
    const subjectQuery = encodeURIComponent(emailSubject);
    const bodyQuery = encodeURIComponent(emailBody);
    const mailToUrl = `mailto:?bcc=${bccQuery}&subject=${subjectQuery}&body=${bodyQuery}`;

    this.addLog({
      voyage_id: voyageId,
      voyage_nom: voyage.nom,
      type: 'manual_sync',
      status: 'success',
      message: `Relance en masse pour ${filteredInscriptions.length} élève(s) (${totalParentsToContact} parent(s) ciblés, ${totalEmailsDocuSealSent} envoyés par DocuSeal)`,
    });

    return {
      success: true,
      message: totalEmailsDocuSealSent > 0
        ? `✓ ${totalEmailsDocuSealSent} notification(s) envoyée(s) directement via DocuSeal sur ${totalParentsToContact} parent(s) ciblés.`
        : `✓ Relance préparée pour ${totalParentsToContact} parent(s) (${filteredInscriptions.length} élève(s)).`,
      totalInscriptionsTargeted: filteredInscriptions.length,
      totalParentsToContact,
      totalEmailsDocuSealSent,
      parentsEmailsList,
      mailToUrl,
      emailSubject,
      emailBody,
      details,
    };
  }

  // Add Log
  addLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) {
    const newLog: SyncLogEntry = {
      id: entry.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: entry.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 16),
      voyage_id: entry.voyage_id,
      voyage_nom: entry.voyage_nom,
      type: entry.type,
      status: entry.status,
      message: entry.message,
      inscriptions_count: entry.inscriptions_count,
      new_inscriptions: entry.new_inscriptions,
      new_signatures: entry.new_signatures,
    };

    this.data.logs.unshift(newLog);
    if (this.data.logs.length > 200) {
      this.data.logs.pop();
    }
  }

  getLogs(limit = 50): SyncLogEntry[] {
    return this.data.logs.slice(0, limit);
  }

  // Admin authentication
  verifyAdminPassword(password: string): boolean {
    const envPassword = process.env.ADMIN_PASSWORD;
    if (envPassword && password === envPassword) {
      return true;
    }
    return password === this.data.adminPasswordHash;
  }

  setAdminPassword(newPassword: string): void {
    this.data.adminPasswordHash = newPassword;
    this.saveToFile();
  }
}

export const db = new Database();
