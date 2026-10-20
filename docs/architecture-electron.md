# Architecture Electron cible

## Objectifs

La cible est une application desktop Electron partageant les memes donnees entre trois interfaces : ADMIN, COMPANION et DRIVER. Le MVP HTML/CSS/JavaScript existant reste la base du mode ADMIN et doit continuer a fonctionner pendant la migration.

La selection d'un mode est une preference d'interface. Elle ne constitue jamais une autorisation. Une session authentifiee et les politiques de la base determinent les donnees et actions accessibles.

## Audit du MVP

Le repertoire `harz-karreg-webapp/` contient des pages HTML autonomes qui chargent les memes scripts avec `defer`. `js/app.js` initialise le shell commun, puis chaque module decide s'il doit rendre la page active.

Les modules sont exposes sur `window` :

- `HKStorage` : stockage et donnees initiales ;
- `HKUI` et `HKModal` : shell, controles d'affichage et boites de dialogue ;
- `HKDashboard` et `HKPlanning` : tableaux de bord et planning ;
- `HKDrivers`, `HKTrucks`, `HKBins`, `HKTrailers`, `HKRoutes` : ressources metier ;
- `HKSettings` et `HKCalendar` : parametres et calculs calendaires.

Toutes les donnees metier sont aujourd'hui stockees dans `localStorage` sous l'espace `harz-karreg` : conducteurs, camions, bennes, remorques, tournees, disponibilites, matieres, adresses et configuration.

Les tournees referencent les ressources avec des identifiants texte. Il n'existe ni contrainte de cle etrangere, ni transaction, ni gestion de conflit. Le module planning melange actuellement rendu, calendrier, glisser-deposer, disponibilites, affectations, exports et diaporama ; il devra etre decoupe derriere des services, sans reecriture immediate de l'interface.

## Cible modulaire

```text
electron/
  main/                 Processus principal, fenetres et IPC
  preload/              API minimale exposee aux renderers
src/
  renderer/
    startup/            Selection du mode et connexion
    admin/              Ecrans de gestion existants reutilises
    companion/          Consultation plein ecran en lecture seule
    driver/             Planning personnel responsive
    shared-ui/          Composants et styles HARZ KARREG
  domain/
    fleet/              Chauffeurs, vehicules, remorques et bennes
    tours/              Tournees, affectations et statuts
    planning/           Semaines, disponibilites et publications
    authorization/      Capacites calculees depuis la session
  services/             Cas d'usage independants de l'interface
  infrastructure/
    repositories/       Contrats de persistence
    legacy/             Adaptateur localStorage temporaire
    sqlite/             Cache local et file de synchronisation
    supabase/           Authentification et source partagee
migrations/             Migrations locales et distantes versionnees
tests/                  Tests unitaires, integration, securite et E2E
```

## Flux de donnees

```text
Interface ADMIN / COMPANION / DRIVER
                 |
          Services metier
                 |
       Contrats de repositories
          /             \
 SQLite local       Supabase distant
 cache + outbox     source de verite
```

Le renderer n'accede jamais directement au systeme de fichiers, a SQLite ou aux secrets. Il appelle une API etroite exposee par le preload. Le processus principal valide chaque message IPC avant d'appeler les services locaux.

## Modele de donnees

Les collections actuelles sont conservees et normalisees. Les tables partagees portent toutes un `organization_id` afin d'isoler les entreprises.

Entites principales :

- `organizations`, `profiles`, `memberships` ;
- `depots`, `teams`, `device_preferences` ;
- `drivers`, `vehicles`, `trailers`, `bins` ;
- `materials`, `addresses`, `driver_availability` ;
- `tours`, `tour_assignments`, `planning_publications` ;
- `authorized_vehicles` pour les perimetres DRIVER.

Le statut d'une tournee est separe en deux dimensions :

- `operational_status` : planifiee, en cours, terminee ou annulee ;
- `publication_status` : brouillon ou publiee.

Une publication de planning est versionnee par entreprise, depot et semaine. COMPANION et DRIVER ne consultent que les versions publiees autorisees.

## Authentification et autorisations

Supabase Auth est la cible d'authentification. Les roles applicatifs appartiennent aux memberships, pas au choix realise sur l'ecran de demarrage.

- ADMIN : gestion et publication dans son organisation ;
- COMPANION : lecture des publications correspondant a son perimetre ;
- DRIVER : lecture de ses affectations publiees et des vehicules autorises.

Les politiques Row Level Security filtrent chaque requete selon l'organisation, le role et le perimetre. L'interface masque les commandes indisponibles, mais ne constitue pas un controle de securite.

## Securite Electron

Les fenetres Electron utilisent au minimum :

- `contextIsolation: true` ;
- `nodeIntegration: false` ;
- `sandbox: true` ;
- un preload minimal sans primitive generique d'execution ;
- une Content Security Policy stricte ;
- une validation de schema pour tous les messages IPC ;
- le refus par defaut des navigations et ouvertures de fenetres externes ;
- l'assainissement des valeurs injectees dans le DOM.

Le verrouillage visuel actuel ne constitue pas une authentification. Son mot de passe en clair ne sera jamais transfere vers Supabase. Il sera remplace par l'authentification, puis retire uniquement apres validation de la migration.

## Synchronisation

Supabase PostgreSQL devient la source de verite. SQLite sert de cache desktop et de file d'attente hors connexion. Chaque mutation possede un identifiant stable, une version et des horodatages. Les conflits sont detectes plutot qu'ecrases silencieusement.

Supabase Realtime actualise les plannings publies. Un rafraichissement periodique reste disponible comme mecanisme de reprise pour COMPANION.

Les preferences d'interface propres a un appareil peuvent rester locales ou etre stockees dans `device_preferences`. Les donnees metier partagees ne doivent plus avoir `localStorage` comme source de verite.
