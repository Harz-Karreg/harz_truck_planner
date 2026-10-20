# HARZ KARREG

Application locale de gestion transport pour conducteurs, remorques, tournees et planning hebdomadaire.

Le MVP complet se trouve dans [`harz-karreg-webapp/`](harz-karreg-webapp/).

Le projet evolue progressivement vers une application desktop Electron proposant trois interfaces :

- **ADMIN** pour administrer les ressources, les tournees et publier les plannings ;
- **COMPANION** pour consulter les plannings autorises sur un ecran d'affichage ;
- **DRIVER** pour consulter les affectations autorisees d'un chauffeur.

Le choix d'une interface ne confere aucun droit. Les autorisations seront determinees par l'identite connectee et appliquees dans la base de donnees.

## Demarrage

Ouvrir `harz-karreg-webapp/index.html` avec Live Server.

## Contraintes

- HTML5, CSS3 et JavaScript ES6.
- Aucune dependance.
- Aucun backend.
- Aucune base de donnees.
- Persistance locale via LocalStorage uniquement.

Ces contraintes decrivent le MVP actuel. Pendant la migration, les ecrans et donnees existants sont conserves. `localStorage` sera remplace progressivement comme source des donnees metier partagees, sans suppression automatique des donnees historiques.

## Architecture et migration

- [Audit et architecture cible](docs/architecture-electron.md)
- [Plan de migration incremental](docs/migration-plan.md)
