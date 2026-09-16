#!/usr/bin/env bash
# ==============================================================================
# Script de mise à jour automatique - Portail Centralisé des Voyages Scolaires
# Emplacement recommandé sur le conteneur LXC : /opt/portail-voyages/app/update.sh
# ==============================================================================

set -e

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================================${NC}"
echo -e "${BLUE}🔄 Mise à jour du Portail des Voyages Scolaires (LXC)${NC}"
echo -e "${BLUE}==========================================================${NC}"

# 1. Vérification du répertoire
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
echo -e "📂 Répertoire cible : ${YELLOW}$APP_DIR${NC}"

# 2. Sécurité : Sauvegarde préalable de la base de données
if [ -f "$APP_DIR/data/database.json" ]; then
  mkdir -p "$APP_DIR/backups"
  BACKUP_FILE="$APP_DIR/backups/database_$(date +%Y%m%d_%H%M%S).json"
  cp "$APP_DIR/data/database.json" "$BACKUP_FILE"
  echo -e "${GREEN}✓ Sauvegarde de sécurité créée : $BACKUP_FILE${NC}"
fi

# 3. Récupération des dernières sources Git
echo -e "\n${BLUE}[1/4] Récupération des mises à jour Git...${NC}"
# Évite de bloquer si des fichiers temporaires ou package-lock ont été modifiés localement
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git stash >/dev/null 2>&1 || true
  
  # Détecte la branche active (main ou master)
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  echo "Branche actuelle : $CURRENT_BRANCH"
  
  if ! git pull origin "$CURRENT_BRANCH"; then
    echo -e "${YELLOW}⚠️ 'git pull origin $CURRENT_BRANCH' a échoué, tentative d'un git pull générique...${NC}"
    git pull || {
      echo -e "${RED}❌ Erreur lors du git pull.${NC}"
      echo "Vérifiez votre connexion internet ou vos identifiants git."
      exit 1
    }
  fi
  echo -e "${GREEN}✓ Code source mis à jour avec succès.${NC}"
else
  echo -e "${YELLOW}ℹ️ Ce répertoire n'est pas un dépôt Git direct. Étape git pull ignorée.${NC}"
fi

# 4. Installation des dépendances
echo -e "\n${BLUE}[2/4] Installation des dépendances npm...${NC}"
# NOTE : En environnement LXC où NODE_ENV=production pourrait être actif,
# l'option --include=dev garantit que Vite et esbuild sont bien installés pour la compilation.
npm install --include=dev

# 5. Compilation de la production (Vite + esbuild pour server.cjs)
echo -e "\n${BLUE}[3/4] Compilation du projet (Frontend + Backend)...${NC}"
npm run build

# 6. Permissions et redémarrage du service
echo -e "\n${BLUE}[4/4] Finalisation des permissions et redémarrage...${NC}"

# Rétablir la propriété à l'utilisateur système portail-voyages s'il existe
if id "portail-voyages" >/dev/null 2>&1; then
  chown -R portail-voyages:portail-voyages "$APP_DIR"
  chmod -R 750 "$APP_DIR"
  # S'assurer que le dossier data est accessible en écriture
  chmod -R 770 "$APP_DIR/data" 2>/dev/null || true
  echo -e "${GREEN}✓ Droits d'accès accordés à l'utilisateur portail-voyages.${NC}"
fi

# Redémarrage automatique du service systemd
if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files 2>/dev/null | grep -q "portail-voyages.service"; then
    echo "Redémarrage du service systemd 'portail-voyages'..."
    systemctl daemon-reload 2>/dev/null || true
    systemctl restart portail-voyages
    sleep 2
    
    if systemctl is-active --quiet portail-voyages; then
      echo -e "${GREEN}✅ Le service 'portail-voyages' est actif et tourne normalement !${NC}"
    else
      echo -e "${RED}⚠️ Le service ne semble pas avoir redémarré correctement.${NC}"
      echo "Logs récents (journalctl -u portail-voyages) :"
      journalctl -u portail-voyages -n 15 --no-pager || true
    fi
  else
    echo -e "${YELLOW}ℹ️ Le service systemd 'portail-voyages.service' n'est pas installé.${NC}"
    echo "Si vous utilisez PM2 ou docker, redémarrez votre processus manuellement."
  fi
else
  echo -e "${YELLOW}ℹ️ systemctl n'est pas disponible dans cet environnement.${NC}"
fi

echo -e "\n${GREEN}==========================================================${NC}"
echo -e "${GREEN}✨ Mise à jour terminée avec succès !${NC}"
echo -e "${GREEN}==========================================================${NC}"
