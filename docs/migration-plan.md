# Plan de migration incremental

## Regles de conservation

- Ne supprimer aucune collection ou fonctionnalite existante pendant la transition.
- Creer un export JSON brut avant toute migration de donnees.
- Conserver les identifiants historiques dans `legacy_id` ou une table de correspondance.
- Rendre chaque migration versionnee, relancable et verifiable.
- Comparer les volumes et references avant de desactiver une ancienne source.
- Ne jamais migrer le mot de passe de verrouillage en clair vers le backend.

## Increments proposes

### 1. Documentation et garde-fous

Documenter l'architecture, le modele de securite, la migration et les criteres d'acceptation. Aucun changement de comportement.

### 2. Outillage JavaScript

Ajouter `package.json`, un verrou de dependances, le formatage, le lint et un premier lanceur de tests. L'application statique doit continuer a s'ouvrir comme avant.

### 3. Contrats de repositories

Introduire des interfaces pour les conducteurs, vehicules, remorques, bennes, tournees, disponibilites et parametres. Implementer un adaptateur legacy qui delegue encore a `HKStorage`.

### 4. Shell Electron securise

Ajouter le processus principal, le preload, les fenetres et le packaging Windows. Charger dans un premier temps l'interface actuelle sans lui donner acces a Node.

Scripts cibles :

- `npm run dev` ;
- `npm run start` ;
- `npm run test` ;
- `npm run test:e2e` ;
- `npm run dist:win`.

Le packaging de developpement reste non signe pour fonctionner sans certificat ni privileges Windows speciaux. Le packaging de production activera l'edition et la signature de l'executable lorsqu'un certificat de signature sera disponible.

### 5. Selection des modes

Creer l'ecran premium ADMIN, COMPANION et DRIVER. La preference peut etre memorisee par appareil, mais l'ouverture effective depend des capacites de la session authentifiee.

### 6. SQLite et import legacy

Ajouter le schema local et un assistant d'import : export brut, validation, simulation, import transactionnel, rapport et possibilite de reprise. L'adaptateur legacy reste disponible tant que la parite n'est pas confirmee.

### 7. ADMIN et publications

Brancher progressivement les ecrans actuels sur les services communs. Separer les statuts operationnels de l'etat brouillon/publie et ajouter la publication versionnee d'un planning.

Premiere etape implementee dans le stockage legacy : les nouvelles tournees sont des brouillons, les donnees historiques sont considerees publiees et l'administrateur peut publier les brouillons d'une semaine. La version de publication partagee sera ajoutee avec le futur stockage structure.

### 8. Supabase et isolation

Ajouter les migrations PostgreSQL, Supabase Auth, les organisations, memberships et politiques RLS. Les tests doivent prouver qu'un utilisateur ne peut jamais lire les donnees d'une autre entreprise.

### 9. Synchronisation

Ajouter l'outbox SQLite, les reprises, les versions de donnees, Supabase Realtime et les etats de synchronisation visibles. Aucune mutation ne doit etre perdue silencieusement.

### 10. COMPANION

Ajouter la vue hebdomadaire 16:9, le plein ecran, les filtres depot/vehicule/chauffeur/equipe, les colonnes configurables, les preferences par appareil et l'actualisation automatique. Cette interface reste strictement en lecture seule.

### 11. DRIVER

Ajouter les vues quotidienne et hebdomadaire personnelles, les details des tournees et les affectations vehicule/remorque. Les donnees sont limitees au chauffeur et aux vehicules explicitement autorises.

### 12. Durcissement et livraison

Finaliser CSP, IPC, assainissement DOM, journaux d'audit, sauvegarde/restauration, tests E2E et documentation d'installation. Tester l'installateur sur un poste Windows vierge.

## Strategie de tests

- Unitaires : calendriers, disponibilites, affectations, statuts et filtres.
- Contrats : meme comportement des repositories legacy, SQLite et Supabase.
- Migration : fixtures representatives et verification des references.
- Integration : preload, IPC, base locale et synchronisation.
- Securite : RLS, isolation interentreprises et refus des roles insuffisants.
- Fonctionnels Electron : parcours ADMIN, COMPANION et DRIVER.
- Packaging : installation, lancement, mise a jour et desinstallation Windows.

## Conditions avant mise en production

- Import legacy teste sur une copie des donnees reelles.
- Sauvegarde et restauration validees.
- RLS active et testee sur toutes les tables partagees.
- Aucun secret ou mot de passe en clair dans le renderer ou le stockage local.
- COMPANION incapable d'ecrire, y compris par appel direct aux API.
- DRIVER incapable de lire une affectation hors de son perimetre.
- Installateur Windows teste sur une machine sans environnement de developpement.
