# Portail Centralisé des Voyages Scolaires — Connecteur DocuSeal

Solution complète d'unification, de pilotage et de suivi en temps réel des inscriptions et signatures parentales électroniques multi-instances DocuSeal pour les établissements scolaires.

---

## 1. État du projet : Squelette ou Clé en main ?

**L'application est 100 % opérationnelle, complète et prête pour la production.** Il ne s'agit pas d'un squelette vide ou d'une maquette statique :

- **Backend Express autonome** :
  - Connexion dynamique à **n'importe quel nombre d'instances DocuSeal** (1 à 20+ instances indépendantes).
  - Synchronisation en direct via l'API REST DocuSeal (`/api/submissions` et `/api/templates/:id`).
  - Récepteur de **Webhooks DocuSeal en temps réel** pour actualisation instantanée dès qu'un parent signe.
  - Base de données persistée automatiquement sur disque (`data/database.json`), résistant aux redémarrages de la machine ou du service.
  - Générateur d'exportation tableur **Excel natif (`.xlsx`)** avec calculs automatiques et colonnes calibrées.
  - Générateur d'**attestations certifiées imprimables / PDF** avec horodatage eIDAS, signatures et empreintes de contrôle.
  - Sécurité des identifiants : masquage des clés API, authentification de l'administration par mot de passe ou variable d'environnement (`ADMIN_PASSWORD`).
- **Interface Utilisateur Moderne (React 19 + Tailwind CSS)** :
  - Tableau de bord enseignant ergonomique (« comprendre l'état d'un voyage en moins de 10 secondes »).
  - Indicateurs visuels tricolores : Inscriptions complètes (2/2), À finaliser (1/2), Non signées (0/2).
  - Moteur de recherche et filtres combinés instantanés (par classe, nom d'élève ou statut de signature).
  - Fiche élève détaillée avec état de chaque représentant légal, date et heure de signature eIDAS, identifiants DocuSeal.
  - Bouton de **relance par email** avec copie immédiate du lien de signature directe pour les parents retardataires.
  - Espace d'administration protégé pour ajouter/modifier des instances DocuSeal, tester la connectivité (latence réseau, code HTTP 200) et consulter les logs d'audit.

---

## 2. Prérequis recommandés pour Proxmox LXC

Créez un conteneur LXC dans votre cluster Proxmox avec les paramètres suivants :

| Paramètre | Valeur recommandée |
| :--- | :--- |
| **OS Template** | `debian-12-standard` (Bookworm 64 bits) |
| **Cores CPU** | 1 à 2 vCPU |
| **Mémoire RAM** | 1 Go (minimum 512 Mo, 2 Go confortables) |
| **Swap** | 512 Mo |
| **Disque racine** | 8 Go à 15 Go (SSD ou ZFS conseillé) |
| **Réseau** | DHCP ou IP statique sur votre VLAN serveurs/DMZ |
| **Type de conteneur** | Non privilégié (*Unprivileged LXC*) recommandé |

---

## 3. Procédure d'installation étape par étape sur Debian 12

Toutes les commandes ci-dessous sont à exécuter dans la console / terminal SSH de votre conteneur LXC Debian 12 en tant que `root`.

### Étape 1 : Mise à jour du conteneur et paquets de base

```bash
apt update && apt upgrade -y
apt install -y curl wget git gnupg lsb-release build-essential ufw nginx
```

---

### Étape 2 : Installation de Node.js 20 LTS (ou Node.js 22)

Node.js v20+ est requis pour exécuter le serveur et compiler l'application :

```bash
# Ajout du dépôt officiel NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Installation de Node.js et npm
apt install -y nodejs

# Vérification des versions
node -v   # Doit afficher v20.x ou supérieur
npm -v    # Doit afficher v10.x ou supérieur
```

---

### Étape 3 : Création d'un utilisateur système dédié

Par bonne pratique de sécurité, le serveur web ne doit pas s'exécuter sous le compte `root` :

```bash
adduser --system --group --home /opt/portail-voyages portail-voyages
```

---

### Étape 4 : Déploiement des fichiers de l'application

Placez les sources de l'application dans `/opt/portail-voyages` :

```bash
# Exemple si vous clonez depuis votre dépôt Git interne :
# git clone https://votre-gitlab-ou-github.com/ecole/portail-voyages.git /opt/portail-voyages/app

# Ou si vous transférez le dossier via SCP / SFTP / rsync :
# rsync -avz ./ root@<IP_LXC>:/opt/portail-voyages/app/

cd /opt/portail-voyages/app
```

---

### Étape 5 : Installation des dépendances npm

Dans le dossier `/opt/portail-voyages/app` :

```bash
npm install
```

---

### Étape 6 : Compilation de l'application pour la production

Cette commande compile le frontend React avec Vite dans le dossier `dist/` et compile le backend Express en un fichier unique `dist/server.cjs` :

```bash
npm run build
```

---

### Étape 7 : Configuration de l'environnement (`.env`)

Créez le fichier de configuration de l'application :

```bash
nano /opt/portail-voyages/app/.env
```

Ajoutez-y les variables suivantes (adaptez le mot de passe admin et votre URL) :

```env
# Port d'écoute du serveur Node (3000 par défaut)
PORT=3000

# Environnement de production
NODE_ENV=production

# Mot de passe sécurisé pour l'accès Administration
ADMIN_PASSWORD="VotreMotDePasseAdminTresSecurise2027"

# URL publique de votre portail (utilisée pour les webhooks et partages)
APP_URL="https://voyages.mon-etablissement.fr"
```

Sauvegardez avec `Ctrl + O` puis quittez avec `Ctrl + X`.

---

### Étape 8 : Attribution des droits d'accès

Assurez-vous que l'utilisateur `portail-voyages` a les droits d'écriture sur le dossier `data/` pour que la base de données JSON se persiste automatiquement :

```bash
mkdir -p /opt/portail-voyages/app/data
chown -R portail-voyages:portail-voyages /opt/portail-voyages
chmod -R 750 /opt/portail-voyages
```

---

### Étape 9 : Création du service Systemd (démarrage automatique au boot)

Créez le fichier de service systemd :

```bash
nano /etc/systemd/system/portail-voyages.service
```

Insérez la configuration suivante :

```ini
[Unit]
Description=Portail Centralisé des Voyages Scolaires (DocuSeal)
After=network.target

[Service]
Type=simple
User=portail-voyages
Group=portail-voyages
WorkingDirectory=/opt/portail-voyages/app
EnvironmentFile=/opt/portail-voyages/app/.env
ExecStart=/usr/bin/node /opt/portail-voyages/app/dist/server.cjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=portail-voyages

# Durcissement de sécurité
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Activez et démarrez le service :

```bash
systemctl daemon-reload
systemctl enable portail-voyages
systemctl start portail-voyages

# Vérifier le bon fonctionnement
systemctl status portail-voyages
```

Vous devriez voir `Active: active (running)` avec la mention :
`Portail Voyages Scolaires démarré sur http://localhost:3000`.

---

### Étape 10 : Configuration de Nginx en Reverse Proxy et HTTPS

Créez une configuration de site Nginx :

```bash
nano /etc/nginx/sites-available/portail-voyages.conf
```

Collez la configuration suivante (remplacez `voyages.mon-etablissement.fr` par votre nom de domaine ou l'adresse IP du conteneur) :

```nginx
server {
    listen 80;
    server_name voyages.mon-etablissement.fr;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activez le site et redémarrez Nginx :

```bash
ln -s /etc/nginx/sites-available/portail-voyages.conf /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### Optionnel mais fortement recommandé : Activer le HTTPS gratuit avec Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d voyages.mon-etablissement.fr
```

---

### Étape 11 : Configuration du pare-feu (UFW)

```bash
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP Nginx
ufw allow 443/tcp    # HTTPS Nginx
ufw enable
```

---

## 4. Liaison avec vos instances DocuSeal

### A. Obtenir la clé API DocuSeal
1. Connectez-vous sur votre instance DocuSeal en tant qu'administrateur.
2. Allez dans **Settings** > **API & Webhooks** > **API Keys**.
3. Créez une nouvelle clé nommée par exemple `Portail Centralisé` et copiez le token généré.

### B. Obtenir le Template ID du formulaire d'inscription
1. Ouvrez le template de formulaire de voyage dans DocuSeal.
2. L'identifiant se trouve soit dans l'URL de votre navigateur (`https://docuseal.mon-ecole.fr/templates/81042`), soit sur la fiche du modèle.

### C. Déclarer le voyage dans le Portail
1. Rendez-vous sur votre portail web : `https://voyages.mon-etablissement.fr`.
2. Cliquez sur l'onglet **« Administration »** (icône bouclier / cadenas) et saisissez votre mot de passe administrateur.
3. Remplissez le formulaire **« Ajouter un voyage & instance DocuSeal »** :
   - Nom du voyage, destination, dates, classes concernées.
   - URL complète de l'instance DocuSeal (ex: `https://docuseal-voyage01.mon-ecole.fr`).
   - Clé API DocuSeal (`X-Auth-Token`).
   - ID du Template DocuSeal.
4. Cliquez sur **« Tester la connexion »** : le portail vérifie immédiatement que l'instance répond `200 OK` et mesure la latence.
5. Cliquez sur **« Enregistrer le voyage »**.

### D. Configurer les Webhooks DocuSeal (Mise à jour en direct)
Pour que le portail se mette à jour dès qu'un parent appose sa signature :
1. Dans votre instance DocuSeal, allez dans **Settings** > **API & Webhooks** > **Webhooks**.
2. Ajoutez un webhook avec l'URL fournie dans l'onglet Administration du portail :
   `https://voyages.mon-etablissement.fr/api/webhooks/docuseal/<id_voyage>`
3. Cochez les événements `submission.completed` et `submitter.completed`.

---

## 5. Sauvegarde et Maintenance

### Sauvegarde des données
Toutes les données (voyages, inscriptions, signatures, logs) sont enregistrées dans un unique fichier JSON :
```bash
/opt/portail-voyages/app/data/database.json
```
- Vous pouvez sauvegarder ce fichier automatiquement via une tâche Cron ou rsync vers votre NAS.
- Grâce à Proxmox, vous pouvez également planifier des **Snapshots ou Backups VZDump** quotidiens de votre conteneur LXC.

### Procédure de mise à jour du code
Pour déployer une mise à jour :
```bash
cd /opt/portail-voyages/app
git pull
npm install
npm run build
systemctl restart portail-voyages
```

### Consultation des logs en direct
```bash
journalctl -u portail-voyages -f
```
