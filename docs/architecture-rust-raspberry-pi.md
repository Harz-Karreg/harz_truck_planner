# Architecture cible Rust et Raspberry Pi

## Statut du document

Ce document consigne la décision d'architecture cible. Il distingue l'existant de la trajectoire prévue et ne signifie pas que le backend Rust est déjà implémenté.

## État vérifié avant cette évolution

- L'application desktop utilise Electron et conserve les interfaces HTML, CSS et JavaScript existantes.
- ADMIN reste l'application historique située dans `harz-karreg-webapp/`.
- COMPANION est situé dans `src/renderer/companion/` et lit les tournées publiées depuis le stockage legacy grâce à `src/renderer/shared/legacy-read-service.js`.
- DRIVER est encore une structure d'interface sans données métier opérationnelles.
- Les données métier partagées reposent encore sur `localStorage`. Il n'existe ni serveur réseau ni synchronisation entre appareils.
- La distribution Windows est configurée par `package.json` et l'auto-update Windows par `electron/main/updater.js`.

## Décision cible

Le cœur serveur sera un monolithe modulaire Rust indépendant d'Electron :

- Tokio pour l'exécution asynchrone ;
- Axum pour l'API HTTP ;
- Serde pour les contrats JSON ;
- SQLx pour la persistance ;
- SQLite pour le premier déploiement local, avec une trajectoire possible vers PostgreSQL.

La structure envisagée est :

```text
rust/
  Cargo.toml
  crates/
    hk-domain/
    hk-api/
    hk-storage/
    hk-contracts/
```

Cette structure est une cible, pas un état actuel. Aucun crate Rust n'est créé pendant la phase A.

## Topologie cible

```text
Electron ADMIN (Windows) -> API HTTP Rust -> SQLite
                                      |
                                      v
                         Electron COMPANION (Raspberry Pi 5)
```

L'adresse de l'API devra être configurable. Le serveur pourra fonctionner sur le Raspberry Pi ou sur une autre machine du réseau sans que le client en dépende structurellement.

## Migration incrémentale

1. **Phase A — Companion Raspberry Pi autonome** : lancement direct, kiosque Linux, paquet Debian ARM64, démarrage automatique et maintien du stockage legacy.
2. **Phase B — Backend Rust** : workspace Cargo, endpoint de santé, modèles, SQLite, migrations et API de lecture des publications.
3. **Phase C — Companion connecté** : adaptateur REST, configuration serveur, statut de connexion, cache local et rafraîchissement toutes les 30 secondes.
4. **Phase D — Admin connecté** : migration progressive des écritures et des publications, puis retrait de `localStorage` comme source de vérité après validation.

## Sécurité et compatibilité

Les options Electron `contextIsolation`, `sandbox`, `webSecurity` et la désactivation de `nodeIntegration` restent obligatoires. Le choix du mode ne confère aucun droit. L'API devra appliquer les permissions de lecture et d'écriture, identifier les appareils et isoler les données.

La migration des données legacy devra commencer par une sauvegarde, être rejouable et préserver les identifiants existants. Les tournées en brouillon ne devront jamais être exposées à COMPANION.

## Publications futures

Le champ actuel `publicationStatut` reste compatible pendant la migration. La cible est un snapshot versionné par semaine et dépôt afin d'assurer cohérence, historique, reprise après coupure et traçabilité.

## Hors périmètre immédiat

- WebSocket et MQTT ;
- firmwares ESP32 ou STM32 ;
- télémétrie embarquée ;
- migration PostgreSQL ;
- suppression du service legacy.
