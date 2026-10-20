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

### Sauvegarde locale

Dans ADMIN, ouvrez **Parametres**, puis **Sauvegarder et restaurer** :

- **Exporter une sauvegarde** telecharge un fichier JSON contenant les donnees metier ;
- **Controler et restaurer** valide le fichier, affiche les volumes et les references incoherentes, puis exige la saisie de `RESTAURER` ;
- la configuration d'interface et le mot de passe de verrouillage ne sont pas remplaces par une restauration ;
- en cas d'erreur pendant le remplacement, l'application tente de remettre les donnees presentes avant l'import.

Conservez les sauvegardes sur un support distinct du poste utilise par l'application.

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

## Mises a jour automatiques

Les installations Windows verifient automatiquement les nouvelles versions publiees dans le depot public [`Harz-Karreg/harz_truck_planner-releases`](https://github.com/Harz-Karreg/harz_truck_planner-releases). Le code source reste dans ce depot prive et aucun token GitHub n'est integre a l'application.

Une version telechargee est proposee au redemarrage. Si l'utilisateur choisit « Plus tard », elle est installee a la fermeture suivante de l'application. Les controles sont desactives avec `npm start` et ne fonctionnent que dans une application packagee.

Pour publier automatiquement une version :

1. creer dans ce depot un secret GitHub Actions nomme `RELEASES_TOKEN`, limite au depot public de releases et autorise a gerer ses Releases ;
2. mettre a jour `version` dans `package.json` et executer les tests ;
3. committer et pousser les changements ;
4. creer et pousser le tag correspondant, par exemple `v0.3.0`.

Le workflow `.github/workflows/release-windows.yml` construit alors l'installateur, `latest.yml` et le fichier blockmap, puis les publie dans le depot public. En attendant la mise en place d'un certificat, les versions restent non signees et peuvent declencher un avertissement Windows SmartScreen.

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
