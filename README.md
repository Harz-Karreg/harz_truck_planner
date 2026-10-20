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

### Application desktop Electron

Prerequis : Node.js 20 ou une version LTS plus recente.

```powershell
npm install
npm start
```

La fenetre de demarrage propose trois interfaces :

- ADMIN ouvre l'application de gestion existante ;
- COMPANION ouvre la premiere structure de consultation en lecture seule ;
- DRIVER ouvre la premiere structure responsive du chauffeur.

COMPANION et DRIVER n'affichent encore aucune donnee metier. La selection d'un mode ne cree aucun droit et ne remplace pas la future authentification.

L'application web historique reste utilisable independamment d'Electron. Ses donnees navigateur ne sont ni supprimees, ni importees automatiquement dans le profil Electron a ce stade.

## Verification

```powershell
npm test
npm run check
```

Les tests protegent actuellement la presence des pages et collections historiques, la separation des trois modes et les options de securite essentielles de la fenetre Electron.

## Packaging Windows

Construction locale non installable :

```powershell
npm run pack:win
```

Creation de l'installateur NSIS :

```powershell
npm run dist:win
```

Les fichiers generes sont places dans `dist/`. Les versions de developpement ne sont pas signees. La signature de production sera activee lorsqu'un certificat sera disponible.

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
