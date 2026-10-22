# HARZ KARREG — Contexte technique

> Document d’audit destiné à une reprise par un autre assistant IA ou à une revue d’architecture indépendante.
>
> État du dépôt audité : version applicative `0.3.5`, branche locale `main`, commit observé `2eaa917`.

## Convention de lecture

- **Vérifié** : constat directement corroboré par le code, la configuration ou les tests du dépôt.
- **Cible documentée** : intention explicitement décrite dans les documents d’architecture, mais pas nécessairement implémentée.
- **Hypothèse** : interprétation ou proposition qui ne doit pas être considérée comme une décision acquise.
- Aucun secret, jeton ou contenu de variable sensible n’est reproduit dans ce document.

## 1. Présentation du projet

### 1.1 Objectif

**Vérifié.** HARZ KARREG est une application de gestion et de planification de transport. Le MVP gère des conducteurs, camions, bennes, remorques, matières, adresses et tournées, avec un planning hebdomadaire. Le projet évolue vers une application desktop Electron à trois interfaces : ADMIN, COMPANION et DRIVER. Références : `README.md`, `docs/architecture-electron.md`, `src/renderer/startup/index.html`.

### 1.2 Utilisateurs et modes

| Mode | Utilisateur visé | État vérifié |
|---|---|---|
| ADMIN | Exploitant ou administrateur de flotte | Fonctionnel, réutilise la webapp historique dans `harz-karreg-webapp/`. |
| COMPANION | Écran de consultation d’un planning publié | Première version fonctionnelle en lecture seule dans `src/renderer/companion/`. |
| DRIVER | Chauffeur consultant ses propres affectations | Structure d’interface seulement ; aucune donnée métier affichée. |

Le sélecteur se trouve dans `src/renderer/startup/index.html`. Le choix d’un mode est actuellement une navigation d’interface, pas un contrôle d’accès. Cette limite est également déclarée dans `README.md` et `docs/architecture-electron.md`.

### 1.3 Fonctionnalités existantes

**ADMIN — vérifié :**

- tableau de bord avec compteurs et dernières tournées : `harz-karreg-webapp/js/dashboard.js` ;
- CRUD conducteurs : `harz-karreg-webapp/js/conducteurs.js` ;
- CRUD camions, avec types `Tracteur` et `Porteur` : `harz-karreg-webapp/js/camions.js` ;
- CRUD bennes : `harz-karreg-webapp/js/bennes.js` ;
- CRUD remorques : `harz-karreg-webapp/js/remorques.js` ;
- CRUD tournées, affectations, horaires, journée entière, saisies libres ou référencées des adresses et matières, consignes de 80 caractères : `harz-karreg-webapp/js/tournees.js` ;
- planning hebdomadaire avec déplacement de tournées, disponibilités, vues journée/semaine, bennes/semi-remorques/porteurs, diaporama, archives et exports PDF/ZIP : `harz-karreg-webapp/js/planning.js` ;
- publication des brouillons d’une semaine : `publishWeek` dans `harz-karreg-webapp/js/planning.js` ;
- référentiel matières, import CSV et carnet d’adresses ordonnable : `harz-karreg-webapp/js/settings.js` ;
- logo, fond et mot de passe de verrouillage, réglages de diaporama : `harz-karreg-webapp/js/settings.js` et `harz-karreg-webapp/js/ui.js` ;
- sauvegarde, validation, restauration et remise à zéro des données métier : `harz-karreg-webapp/js/settings.js` ;
- vérification manuelle et automatique des mises à jour Electron : `electron/main/updater.js`, `electron/preload/index.js`, `harz-karreg-webapp/js/settings.js`.

**COMPANION — vérifié :**

- lecture des tournées publiées uniquement ;
- navigation hebdomadaire ;
- filtres départ, chauffeur et véhicule ;
- colonnes configurables ;
- plein écran ;
- rafraîchissement toutes les 30 secondes et à la demande ;
- préférences locales par appareil.

Références : `src/renderer/companion/index.html`, `src/renderer/companion/app.js`, `src/renderer/shared/legacy-read-service.js`, `tests/companion.test.js`.

**DRIVER — vérifié :** page de présentation uniquement dans `src/renderer/driver/index.html`. Les vues quotidienne/hebdomadaire, affectations et véhicules autorisés y sont annoncés, mais non implémentés.

## 2. Architecture actuelle

### 2.1 Vue d’ensemble

```text
Electron main process
  electron/main/main.js
  electron/main/updater.js
          |
          | preload limité : runtime + updates.check()
          v
Renderer startup
  src/renderer/startup/
      |                 |                    |
      v                 v                    v
ADMIN legacy       COMPANION             DRIVER
harz-karreg-       src/renderer/          src/renderer/
webapp/            companion/             driver/
      |                 |
      v                 v
HKRepositories     HKCompanionData
      |                 |
      +------ localStorage harz-karreg:* --+
```

**Vérifié.** Le processus principal ouvre `src/renderer/startup/index.html`, puis les liens chargent les interfaces locales. Référence : `electron/main/main.js` et `src/renderer/startup/index.html`.

### 2.2 Structure des dossiers

| Chemin | Responsabilité actuelle |
|---|---|
| `electron/main/` | Cycle de vie Electron, fenêtre sécurisée et mises à jour. |
| `electron/preload/` | API renderer minimale via `contextBridge`. |
| `src/renderer/startup/` | Sélection ADMIN / COMPANION / DRIVER. |
| `src/renderer/companion/` | Planning publié en lecture seule. |
| `src/renderer/driver/` | Placeholder du futur espace chauffeur. |
| `src/renderer/shared/` | Styles des modes et adaptateur de lecture Companion. |
| `harz-karreg-webapp/` | Webapp historique utilisée comme mode ADMIN. |
| `harz-karreg-webapp/js/` | Modules globaux du MVP, stockage, UI et logique métier. |
| `harz-karreg-webapp/css/` | Design system et styles par zone. |
| `tests/` | Tests statiques et unitaires Node. |
| `docs/` | Architecture cible et plan de migration. |
| `.github/workflows/` | Construction et publication Windows sur tag. |
| `scripts/` | Contrôle syntaxique JavaScript. |
| `dist/` | Artefacts locaux de packaging ; non source. |

### 2.3 Composition de la webapp Admin

**Vérifié.** Chaque page HTML charge les scripts classiques avec `defer`. `harz-karreg-webapp/js/app.js` :

1. appelle `HKStorage.seedIfEmpty()` ;
2. injecte le shell produit par `HKUI.shell(page)` ;
3. initialise sidebar, affichage et verrouillage ;
4. appelle tous les renderers, lesquels ignorent les pages qui ne les concernent pas via `body.dataset.page` ;
5. installe les actions spécifiques à la page.

Les modules sont des IIFE exposant des objets globaux : `HKStorage`, `HKRepositories`, `HKUI`, `HKModal`, `HKDashboard`, `HKPlanning`, `HKDrivers`, `HKTrucks`, `HKBins`, `HKTrailers`, `HKRoutes`, `HKSettings`, `HKCalendar`. Références : tous les fichiers de `harz-karreg-webapp/js/`.

### 2.4 Services et abstractions

- `HKStorage` fournit CRUD synchrone sur `localStorage` : `harz-karreg-webapp/js/storage.js`.
- `HKRepositories` est une façade temporaire qui délègue sans transformation à `HKStorage` : `harz-karreg-webapp/js/repositories.js`.
- `HKCompanionData` est une façade de lecture limitée à sept collections et filtre les tournées publiées : `src/renderer/shared/legacy-read-service.js`.
- Le preload n’expose que la version/runtime et `updates.check()` : `electron/preload/index.js`.

**Vérifié.** La migration vers les repositories est partielle : `tournees.js` et `planning.js` passent par `HKRepositories`, tandis que plusieurs modules Admin utilisent encore directement `HKStorage`, notamment `settings.js`, `dashboard.js`, `conducteurs.js`, `camions.js`, `bennes.js`, `remorques.js` et `ui.js`.

### 2.5 Dépendances entre modules

- Tous les écrans Admin dépendent du chargement préalable de `storage.js` puis `repositories.js`; ce contrat est testé par `tests/repositories.test.js`.
- `planning.js` dépend de `HKCalendar`, `HKRoutes`, `HKModal`, `HKUI` et des repositories.
- `settings.js` dépend simultanément de `HKStorage`, `HKRepositories`, `HKModal` et `HKUI`.
- Companion dépend uniquement du DOM, de `localStorage` via `HKCompanionData` et des API navigateur de plein écran/minuterie.
- Les mises à jour dépendent de l’IPC étroit `updates:check` entre renderer, preload et main.

## 3. Stack technique

### 3.1 Langages et plateforme

- HTML5, CSS3, JavaScript ES6 sans transpilation : `harz-karreg-webapp/`, `src/renderer/`.
- CommonJS côté Electron et tests Node : `electron/`, `tests/`, `scripts/`.
- Electron `38.8.6` : `package.json`.
- Node.js 20 ou LTS plus récent demandé par `README.md`; GitHub Actions configure Node 20 dans `.github/workflows/release-windows.yml`.

### 3.2 Dépendances npm vérifiées

| Dépendance | Version | Usage |
|---|---:|---|
| `electron` | `38.8.6` | Runtime desktop, dépendance de développement. |
| `electron-builder` | `26.0.12` | Packaging Windows NSIS. |
| `electron-updater` | `6.8.9` | Vérification, téléchargement et installation des releases. |

Source : `package.json` et verrouillage exact dans `package-lock.json`.

### 3.3 Scripts et packaging

- `npm start` / `npm run dev` : `electron .` ;
- `npm test` : tests natifs `node --test` ;
- `npm run check` : analyse syntaxique par `scripts/check-js.js` ;
- `npm run pack:win` : répertoire Windows non installable ;
- `npm run dist:win` : installateur NSIS x64 ;
- `npm run release:win` : publication electron-builder directe.

La configuration produit un installateur `HARZ-KARREG-${version}-Setup.exe`, une installation au choix de l’utilisateur et des raccourcis bureau/menu Démarrer. L’exécutable n’est pas signé (`signAndEditExecutable: false`). Source : `package.json`.

### 3.4 CI/CD et mises à jour

**Vérifié dans le code.** Un tag `v*` déclenche `.github/workflows/release-windows.yml`. Le workflow installe, teste, vérifie la concordance tag/version, construit avec `--publish never`, puis envoie les artefacts vers le dépôt public de releases à l’aide d’un secret configuré dans GitHub Actions. Aucune valeur de secret n’est présente dans le dépôt.

**Vérifié.** L’application packagée consulte les releases au démarrage différé puis toutes les quatre heures. Une mise à jour téléchargée peut être installée immédiatement ou à la fermeture. Le développement désactive ce mécanisme. Source : `electron/main/updater.js`.

## 4. Modèle de données actuel

### 4.1 Persistance

**Vérifié.** La source de vérité actuelle est `window.localStorage`, avec le namespace `harz-karreg`. Les clés sont définies dans `harz-karreg-webapp/js/storage.js` :

- `harz-karreg:conducteurs` ;
- `harz-karreg:camions` ;
- `harz-karreg:bennes` ;
- `harz-karreg:remorques` ;
- `harz-karreg:tournees` ;
- `harz-karreg:disponibilites` ;
- `harz-karreg:matieres` ;
- `harz-karreg:adresses` ;
- `harz-karreg:configuration`.

Chaque collection est un tableau JSON. Les identifiants sont des chaînes, générées par `uid(prefix)` pour les nouveaux éléments. Le seed n’est écrit que si la clé n’existe pas. Il n’existe pas de version de schéma ni de migration automatique dans `HKStorage`.

### 4.2 Schémas observés

Les types ci-dessous sont déduits des formulaires et du seed ; JavaScript ne les impose pas à l’exécution.

```text
Conducteur
  id, prenom, nom, telephone, permis, validite, statut, photo

Camion
  id, marque, modele, immatriculation, type (Tracteur | Porteur)

Benne
  id, nom, statut (Petite | Moyenne | Grande)

Remorque
  id, immatriculation, type, statut, photo, observations

Matiere
  id, code?, nom

Adresse
  id, nom, adresse, ordre

Disponibilite
  id, driverId, weekStart, days: Record<dateISO, boolean>

Tournee
  id, nom, depart, arrivee, date, heure, heureFin?, journeeEntiere?
  conducteurId?, camionId?, remorqueId?, benneId?, matiereId?
  description?, consignes?, statut, publicationStatut

Configuration (singleton attendu, id = "general")
  logo, planningVerrouille, planningVue, planningDuree, planningEcrans
  verrouillageMotDePasse, verrouillageFond
```

Références : `harz-karreg-webapp/js/storage.js`, formulaires dans `conducteurs.js`, `camions.js`, `bennes.js`, `remorques.js`, `tournees.js`, et paramètres dans `settings.js`.

### 4.3 Relations

Les relations sont des références textuelles non contraintes :

- `tournee.conducteurId -> conducteur.id` ;
- `tournee.camionId -> camion.id` ;
- `tournee.remorqueId -> remorque.id` ;
- `tournee.benneId -> benne.id` ;
- `tournee.matiereId -> matiere.id` ;
- `disponibilite.driverId -> conducteur.id`.

**Vérifié.** Il n’existe ni clé étrangère, ni cascade, ni transaction générale. La validation de sauvegarde détecte seulement certaines références de tournées absentes. Source : `validateBackup` dans `harz-karreg-webapp/js/settings.js`.

### 4.4 Compatibilité historique

- Une tournée sans `publicationStatut` est traitée comme publiée : `publicationStatus` dans `planning.js` et `publishedTours` dans `legacy-read-service.js`.
- Une tournée sans `matiereId` conserve son ancien libellé dans `description` : `routeMaterialDisplay` dans `tournees.js` et `routeMaterialLabel` dans `planning.js`.
- Supprimer une matière copie son libellé dans les tournées concernées avant suppression : `removeMaterial` dans `settings.js`.
- Supprimer une adresse ne modifie pas les chaînes `depart`/`arrivee` déjà copiées dans les tournées.

### 4.5 Sauvegarde et restauration

**Vérifié.** L’export JSON utilise le format `harz-karreg-backup`, version 1. Il exporte toutes les collections mais retire `verrouillageMotDePasse` de la configuration. La restauration remplace uniquement les huit collections métier, conserve la configuration locale, vérifie structure, IDs dupliqués et références principales, puis tente un rollback en mémoire en cas d’exception. Source : `buildBackup`, `validateBackup`, `replaceBusinessData` dans `settings.js`.

Limite : cette restauration n’est pas transactionnelle au sens base de données. Une interruption brutale du processus pendant les écritures successives peut laisser un état partiel.

## 5. Flux fonctionnels

### 5.1 Démarrage et navigation

1. Electron acquiert un verrou d’instance unique.
2. Il crée une `BrowserWindow` et charge `src/renderer/startup/index.html`.
3. L’utilisateur choisit ADMIN, COMPANION ou DRIVER.
4. ADMIN charge `harz-karreg-webapp/index.html`; Companion et Driver chargent leurs renderers dédiés.
5. Le logo HK ramène au sélecteur depuis les trois interfaces.

Références : `electron/main/main.js`, `src/renderer/startup/index.html`, `harz-karreg-webapp/js/ui.js`, `src/renderer/companion/index.html`, `src/renderer/driver/index.html`.

### 5.2 Authentification et autorisation

**Vérifié : aucune authentification n’est implémentée.** Il n’existe ni session utilisateur, ni rôle vérifié, ni backend, ni politique d’accès aux données. Les trois modes sont accessibles par liens locaux. Le mot de passe de verrouillage n’est qu’un verrou visuel de session et reste stocké dans la configuration locale. Références : `src/renderer/startup/index.html`, `harz-karreg-webapp/js/ui.js`, `harz-karreg-webapp/js/settings.js`.

**Cible documentée :** Supabase Auth, memberships par organisation et Row Level Security sont prévus dans `docs/architecture-electron.md` et `docs/migration-plan.md`.

### 5.3 Création et publication d’une tournée

1. `HKRoutes.openForm()` construit le formulaire depuis les ressources locales.
2. Les adresses et matières peuvent être choisies dans un référentiel ou saisies librement.
3. Une nouvelle tournée prend par défaut `publicationStatut = Brouillon`.
4. Le formulaire écrit immédiatement la tournée dans `localStorage` via `HKRepositories`.
5. `publishWeek(days)` change les brouillons de la semaine en `Publiee` après confirmation.
6. Companion filtre les tournées sur `Publiee` et ignore les brouillons.

Références : `harz-karreg-webapp/js/tournees.js`, `harz-karreg-webapp/js/planning.js`, `src/renderer/shared/legacy-read-service.js`.

**Important.** La publication actuelle est une modification de champ sur chaque tournée. Il n’existe pas encore de snapshot, numéro de version, date de publication, auteur ou journal d’audit.

### 5.4 Planning Admin

`harz-karreg-webapp/js/planning.js` concentre : calendrier, disponibilités, calcul de placement temporel, drag-and-drop, affectations, création/édition/suppression, publication, vues modales, diaporama, verrouillage, archives, PDF et ZIP. Les écritures sont synchrones dans le même renderer.

### 5.5 Companion

1. `legacy-read-service.js` lit directement les mêmes clés `localStorage`.
2. `publishedTours()` filtre les données publiées.
3. `app.js` joint les ressources par ID, filtre la semaine et génère les cartes.
4. Les préférences (`departure`, `driver`, `truck`, `visibleColumns`) sont enregistrées sous `harz-karreg:companion-preferences`.
5. Un intervalle relit les données toutes les 30 secondes ; l’événement `storage` déclenche aussi un rendu.

**Vérifié.** Le service Companion n’expose aucune méthode CRUD. **Limite :** ce n’est pas une frontière de sécurité, car le renderer a toujours accès aux API navigateur et au même stockage local.

### 5.6 Échanges de données

- Aucun échange réseau métier n’existe.
- La webapp ouverte dans un navigateur et l’application Electron utilisent des profils de stockage différents ; aucune importation automatique n’est implémentée. Source : `README.md`.
- Le seul échange réseau intégré concerne les mises à jour GitHub via `electron-updater`.
- Le seul IPC applicatif est `updates:check`.

## 6. Décisions techniques vérifiables

### 6.1 Préserver le MVP et migrer progressivement

**Cible documentée et partiellement réalisée.** Le mode Admin réutilise la webapp au lieu de la réécrire. Une façade `HKRepositories` a été introduite avant SQLite. Motif explicite : conserver fonctions et données pendant la transition. Références : `docs/architecture-electron.md`, `docs/migration-plan.md`, `harz-karreg-webapp/js/repositories.js`.

Compromis : la duplication des accès `HKStorage`/`HKRepositories` subsiste et le domaine reste couplé au DOM et au stockage synchrone.

### 6.2 Sélection de mode distincte des privilèges

**Décision explicitement documentée mais sécurité non implémentée.** Le mode choisi adapte l’interface sans conférer de droit. Références : `README.md`, `docs/architecture-electron.md`, texte de `src/renderer/startup/index.html`.

### 6.3 Electron sécurisé par défaut

**Vérifié.** `contextIsolation`, `sandbox`, `webSecurity` sont activés et `nodeIntegration` est désactivé. Les nouvelles fenêtres sont refusées et les navigations sont limitées aux fichiers internes. Le preload est étroit. Source : `electron/main/main.js`, `electron/preload/index.js`, tests dans `tests/electron-shell.test.js`.

### 6.4 Publication séparée du statut opérationnel

**Vérifié.** Une tournée possède un statut opérationnel (`Planifiee`, `En cours`, `Terminee`, `Annulee`) et un statut de publication (`Brouillon`, `Publiee`). Source : `tournees.js`, `planning.js`. Cette séparation est aussi définie comme cible dans `docs/architecture-electron.md`.

### 6.5 Données historiques considérées publiées

**Vérifié.** L’absence de `publicationStatut` vaut `Publiee` pour préserver les données antérieures. Références : `planning.js`, `legacy-read-service.js`, `tests/admin-publication-reset.test.js`, `tests/companion.test.js`.

### 6.6 Mises à jour via releases, jamais via commits

**Vérifié.** L’application consomme un dépôt public de releases configuré dans `package.json`. Le bouton de paramètres invoque un canal IPC limité. Références : `electron/main/updater.js`, `electron/preload/index.js`, `tests/auto-update.test.js`.

### 6.7 Cible Supabase + SQLite

**Cible documentée, non implémentée.** Supabase/PostgreSQL doit devenir source de vérité et SQLite un cache/outbox local. Rien dans `package.json` ou le code courant n’ajoute encore ces technologies. Références : `docs/architecture-electron.md`, `docs/migration-plan.md`.

## 7. État du développement

### 7.1 Fonctionnel

- Webapp Admin utilisable hors Electron et dans Electron.
- CRUD des principales ressources et tournées.
- Planning hebdomadaire riche avec publication simple.
- Export PDF/ZIP implémenté sans bibliothèque externe dans `planning.js`.
- Paramètres, import CSV, logo, écran de verrouillage et diaporama.
- Sauvegarde/restauration JSON et remise à zéro encadrée.
- Companion local en lecture seule des tournées publiées.
- Shell Electron Windows, installateur NSIS et auto-update.
- Suite de 28 tests Node lors du dernier passage rapporté par le développement ; les fichiers concernés sont dans `tests/`.

### 7.2 Incomplet

- DRIVER : placeholder uniquement (`src/renderer/driver/index.html`).
- Authentification et autorisation : absentes.
- Backend, réseau local, Supabase, Realtime et synchronisation : absents.
- SQLite, migrations et import transactionnel legacy : absents.
- Publication versionnée par semaine/dépôt/organisation : absente.
- Dépôts, équipes et filtres Companion associés : non modélisés.
- Préférences Companion sauvegardées localement, sans identité d’appareil gérée.
- Tests E2E Electron, tests d’installation et tests visuels : absents du dépôt.
- Signature de code Windows : désactivée.
- Packaging Raspberry Pi/Linux : absent de `package.json`.

### 7.3 Fonctionnalités simulées ou déclaratives

- La notion de rôles est textuelle ; elle ne protège aucune donnée.
- DRIVER annonce des véhicules autorisés et un planning personnel sans les charger.
- Le bouton de publication ne publie vers aucun autre poste : il change un champ local.
- L’actualisation Companion relit le stockage local ; elle ne reçoit aucun événement distant.
- Le verrouillage visuel n’est pas une authentification.

## 8. Dette technique et risques

### 8.1 Sécurité

**Risque critique pour un usage multi-utilisateur :** aucune authentification, autorisation ou isolation d’entreprise.

**Risque élevé :** `verrouillageMotDePasse` est stocké en clair dans `localStorage` (`settings.js`, `storage.js`, `ui.js`). L’export l’exclut, mais le stockage courant reste lisible par le renderer.

**Risque élevé :** plusieurs vues Admin interpolent directement des données utilisateur dans `innerHTML` sans échappement systématique, par exemple les cartes de ressources dans `conducteurs.js`, `camions.js`, `remorques.js`, `bennes.js` et certaines cellules de `tournees.js`. Companion dispose d’un `escapeHtml`, mais cette protection n’est pas généralisée.

**Risque modéré :** les photos et logos acceptent des URL/data URL et sont injectés dans le DOM. Les contrôles MIME/taille existent pour les imports de logo/fond, mais les champs Photo URL des ressources sont libres.

**Point positif vérifié :** l’isolation Electron et le preload minimal réduisent l’exposition de Node.

### 8.2 Fiabilité et intégrité

- `localStorage` ne fournit ni transaction multi-collection, ni verrouillage concurrent, ni reprise robuste.
- Les suppressions de conducteurs/camions/remorques/bennes ne vérifient pas systématiquement les références existantes.
- Les données sont sans schéma runtime ; les formulaires assurent seulement une validation HTML limitée.
- `JSON.parse` dans `HKStorage.read` n’est pas protégé contre une valeur corrompue, contrairement au lecteur Companion.
- La publication de semaine effectue plusieurs mises à jour indépendantes.
- La restauration tente un rollback applicatif, vulnérable à une fermeture brutale.
- La distinction entre `bennes` et certaines remorques de type benne repose sur des champs et règles implicites dans `routeMatchesPlanningMode`.

### 8.3 Performance

- Chaque lecture reparcourt et parse une collection complète ; chaque écriture sérialise le tableau complet.
- `planning.js` effectue de nombreuses recherches linéaires et rerenders complets. Cela convient à de petits volumes, mais aucun benchmark ne définit une capacité maximale.
- Les images encodées en base64 dans `localStorage` réduisent rapidement le quota disponible.
- `planning.js` est un module monolithique de plus de mille lignes regroupant trop de responsabilités.

### 8.4 Évolutivité

- Aucun modèle d’organisation, dépôt, équipe ou appareil.
- Aucun protocole de synchronisation, version de données ou résolution de conflit.
- Les IDs générés par timestamp/aléatoire ne constituent pas une stratégie distribuée formellement garantie.
- Les interfaces globales `window.HK*` compliquent l’isolation, le typage et les tests unitaires fins.
- Le stockage navigateur et Electron n’est pas partagé entre postes ni profils.

### 8.5 Maintenabilité et tests

- Aucun TypeScript, schéma JSON, lint sémantique ou formatteur n’est configuré ; `npm run check` vérifie essentiellement la syntaxe JavaScript.
- Les tests vérifient souvent la présence de motifs dans les sources plutôt que des comportements UI réels.
- Il n’existe pas de test de bout en bout, de capture visuelle, de test de mise à jour installé ou de test réseau.
- Les documents cibles sont utiles mais peuvent diverger du code ; par exemple, Companion est plus avancé que certaines formulations anciennes de `docs/migration-plan.md`.

### 8.6 Livraison

- L’installateur n’est pas signé et peut déclencher SmartScreen.
- Le workflow dépend d’un secret GitHub Actions externe au dépôt ; son existence et ses droits doivent être contrôlés dans la configuration GitHub, sans les documenter en clair.
- La cible de packaging actuelle est Windows x64 uniquement.

## 9. Travaux à venir

### 9.1 Priorités recommandées

1. **Définir le modèle partagé et les frontières de sécurité** : organisations, utilisateurs, rôles, dépôts, équipes, appareils et publications versionnées.
2. **Choisir le mode de déploiement** : backend cloud Supabase, serveur local LAN, ou architecture hybride ; cette décision conditionne SQLite et la synchronisation.
3. **Introduire des contrats de repository asynchrones** et terminer le retrait des accès directs à `HKStorage`.
4. **Ajouter une validation de schéma** à chaque frontière : formulaires, import, IPC, base et réseau.
5. **Créer la migration legacy** avec sauvegarde, dry-run, import transactionnel et rapport.
6. **Implémenter l’authentification et les contrôles côté données**, avant de considérer les modes comme privés.
7. **Versionner les publications** au lieu de muter uniquement les tournées.
8. **Brancher Companion sur la source partagée** et prouver qu’il ne peut effectuer aucune mutation.
9. **Implémenter DRIVER** avec périmètre utilisateur et véhicules autorisés.
10. **Découper `planning.js`** en calendrier, layout, affectations, publication, export et présentation.
11. **Généraliser l’échappement DOM** ou utiliser des APIs DOM sûres.
12. **Ajouter tests contractuels, intégration IPC/base, E2E Electron, sécurité et packaging.**

### 9.2 Travaux déjà planifiés dans le dépôt

`docs/migration-plan.md` prévoit explicitement SQLite/import legacy, Supabase/isolation, synchronisation, Companion, Driver puis durcissement/livraison. `docs/architecture-electron.md` propose les futurs dossiers `domain/`, `services/`, `infrastructure/`, `migrations/`; ces dossiers n’existent pas encore.

### 9.3 Problèmes ouverts déduits du code

- formaliser l’adresse manuelle par rapport au référentiel sans perdre l’identité du site ;
- distinguer matière libre et matière référencée dans le futur schéma ;
- décider si les consignes doivent appartenir à la tournée, à une étape ou à une affectation ;
- définir la durée de conservation et l’immutabilité des archives ;
- décider comment synchroniser les modifications concurrentes ;
- traiter les références lors de la suppression d’une ressource ;
- migrer le verrouillage local vers une vraie session sans réutiliser le mot de passe en clair.

## 10. Questions architecturales à arbitrer

Les points suivants sont des **questions**, pas des décisions existantes :

1. **Source de vérité :** Supabase cloud reste-t-il la cible, ou faut-il privilégier un serveur local sur le réseau du client avec réplication facultative ?
2. **Disponibilité hors ligne :** quelles opérations ADMIN doivent fonctionner sans réseau et quelle politique de conflits appliquer au retour en ligne ?
3. **Publication :** publie-t-on un snapshot immuable d’une semaine ou le dernier état mutable des tournées ? Une correction publiée crée-t-elle une nouvelle version ?
4. **Topologie client :** l’ordinateur ADMIN peut-il servir de serveur, ou faut-il un service permanent séparé, par exemple sur Raspberry Pi ?
5. **Authentification LAN :** comment associer un Companion à une organisation/dépôt sans transformer le choix de mode en autorisation ?
6. **Isolation :** une base par entreprise, un schéma partagé avec `organization_id`, ou les deux selon le déploiement ?
7. **Modèle véhicule :** faut-il unifier tracteurs, porteurs, semi-remorques et bennes sous une hiérarchie d’équipements, ou conserver des tables distinctes ?
8. **Tournées multi-étapes :** le couple `depart`/`arrivee` suffit-il à moyen terme, ou faut-il modéliser des étapes, chargements, matières et consignes par étape ?
9. **Affectations :** les liens conducteur/camion/remorque doivent-ils rester sur la tournée ou devenir des entités historisées avec période de validité ?
10. **Archivage légal et audit :** quelles données doivent être immuables, pendant combien de temps, et qui peut republier ou corriger ?
11. **Mise à jour desktop :** quelle stratégie de signature de code, canaux stable/bêta et rollback adopter ?
12. **Webapp :** doit-elle rester une cible supportée au même niveau qu’Electron, ou devenir uniquement un renderer embarqué ?
13. **Companion :** quelles préférences appartiennent à l’appareil, à l’utilisateur, au dépôt ou à l’organisation ?
14. **DRIVER :** le client chauffeur sera-t-il Electron, web responsive/PWA ou application mobile distincte ?
15. **Données personnelles :** quelles obligations de rétention, export, suppression et journalisation s’appliquent aux conducteurs ?

## 11. Carte de traçabilité

| Sujet | Sources principales |
|---|---|
| Objectifs et modes | `README.md`, `src/renderer/startup/index.html` |
| Architecture cible | `docs/architecture-electron.md` |
| Migration | `docs/migration-plan.md` |
| Shell Electron | `electron/main/main.js`, `electron/preload/index.js` |
| Mises à jour | `electron/main/updater.js`, `package.json`, `.github/workflows/release-windows.yml` |
| Stockage et seed | `harz-karreg-webapp/js/storage.js` |
| Façade repository | `harz-karreg-webapp/js/repositories.js` |
| Initialisation Admin | `harz-karreg-webapp/js/app.js` |
| Shell/UI/verrouillage | `harz-karreg-webapp/js/ui.js` |
| Planning/publication/export | `harz-karreg-webapp/js/planning.js` |
| Tournées et affectations | `harz-karreg-webapp/js/tournees.js` |
| Paramètres/import/backup | `harz-karreg-webapp/js/settings.js` |
| Companion | `src/renderer/companion/`, `src/renderer/shared/legacy-read-service.js` |
| Driver | `src/renderer/driver/index.html` |
| Garanties testées | `tests/*.test.js` |

## 12. Limites de cet audit

- Le document décrit le contenu versionné du dépôt et les comportements déductibles statiquement.
- Il ne confirme pas la configuration réelle des secrets, protections de branches, droits GitHub, certificat de signature ou machines clientes.
- Il ne mesure pas les performances sur des volumes réels.
- Il ne constitue pas un audit de sécurité complet ni un test d’intrusion.
- Les propositions futures restent à valider avec les exigences métier, réglementaires et d’exploitation.
