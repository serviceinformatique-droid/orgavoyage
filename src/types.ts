export type TripStatus = 'preparation' | 'inscriptions_ouvertes' | 'inscriptions_fermees' | 'termine';
export type SyncConnectionStatus = 'connected' | 'error' | 'testing' | 'untested';
export type InscriptionStatus = 'COMPLET' | 'A_FINALISER' | 'NON_SIGNE';

export interface SignataireInfo {
  nom: string;
  email: string;
  telephone?: string;
  statut: 'signed' | 'pending' | 'not_sent';
  date_signature?: string;
  submitter_id?: string;
  slug?: string;
}

export interface Inscription {
  id: string;
  voyage_id: string;
  eleve_nom: string;
  eleve_prenom: string;
  classe: string;
  docuseal_submission_id: string;
  date_creation: string;
  date_derniere_synchronisation: string;
  parent1: SignataireInfo;
  parent2: SignataireInfo;
  nombre_signatures: 0 | 1 | 2;
  statut: InscriptionStatus;
  document_url?: string;
  derniere_relance?: string;
  remarques?: string;
}

export interface Voyage {
  id: string;
  nom: string;
  description: string;
  destination: string;
  date_depart: string;
  date_retour: string;
  etablissement: string;
  classes_concernees: string[];
  statut: TripStatus;
  
  // DocuSeal configuration
  docuseal_instance_name: string;
  docuseal_url: string;
  docuseal_api_key_masked?: string;
  docuseal_api_key?: string; // Stored server-side only
  docuseal_template_id: string;
  
  // Sync state
  connection_status: SyncConnectionStatus;
  last_test_at?: string;
  last_test_message?: string;
  last_sync_at?: string;
  last_sync_message?: string;
  
  // Access control
  mot_de_passe?: string; // Stored server-side, visible to admin only
  has_password?: boolean; // Exposed to public so UI knows if password is required

  // Stats
  total_inscrits: number;
  total_complets: number;
  total_a_finaliser: number;
  total_non_signes: number;
  
  created_at: string;
  updated_at: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  voyage_id: string;
  voyage_nom: string;
  type: 'manual_sync' | 'auto_sync' | 'webhook' | 'connection_test';
  status: 'success' | 'warning' | 'error';
  message: string;
  inscriptions_count?: number;
  new_signatures?: number;
  new_inscriptions?: number;
}

export type SyncLog = SyncLogEntry;

export interface UserSession {
  role: 'admin' | 'professeur';
  nom: string;
  email: string;
  isAdmin: boolean;
}
