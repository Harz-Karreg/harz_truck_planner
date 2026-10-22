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

Pour ouvrir directement COMPANION :

```powershell
npm start -- --companion
```

Sous Linux, ce lancement active le mode kiosque destiné au Raspberry Pi. Le lancement normal continue d'afficher le sélecteur des trois modes.

La fenetre de demarrage propose trois interfaces :

- ADMIN ouvre l'application de gestion existante ;
- COMPANION affiche les tournées publiées dans un planning hebdomadaire en lecture seule, avec filtres, colonnes configurables, plein écran et actualisation automatique ;
- DRIVER ouvre la premiere structure responsive du chauffeur.

COMPANION lit uniquement les données publiées du stockage legacy en attendant le backend partagé. DRIVER n'affiche encore aucune donnée métier. La sélection d'un mode ne crée aucun droit et ne remplace pas la future authentification.

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

## Packaging Raspberry Pi 5

La cible Raspberry Pi OS 64 bits produit un paquet Debian ARM64 :

```powershell
npm run dist:pi
```

Les instructions de déploiement, d'autostart et les vérifications matérielles sont décrites dans [docs/raspberry-pi-companion.md](docs/raspberry-pi-companion.md).

Un déploiement Docker/Nginx permet également d'ouvrir COMPANION depuis le réseau local sur le port `8080` :

```bash
docker compose --env-file /opt/harzkarreg/config/harzkarreg.env \
  -f deployment/raspberry-pi/compose.yaml up -d --build
```

Cette première exposition web reste basée sur le stockage local du navigateur. Le partage effectif des publications entre ADMIN et COMPANION nécessitera l'API Rust prévue dans la phase suivante.

## Mises a jour automatiques

Les installations Windows verifient automatiquement les nouvelles versions publiees dans le depot public [`Harz-Karreg/harz_truck_planner-releases`](https://github.com/Harz-Karreg/harz_truck_planner-releases). Le code source reste dans ce depot prive et aucun token GitHub n'est integre a l'application.

Une version telechargee est proposee au redemarrage. Si l'utilisateur choisit « Plus tard », elle est installee a la fermeture suivante de l'application. Les controles sont desactives avec `npm start` et ne fonctionnent que dans une application packagee.

Dans ADMIN, le panneau **Parametres > Mises a jour** permet egalement de lancer une verification manuelle. Le bouton consulte uniquement les releases publiees et ne telecharge jamais directement les commits du depot source.

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
- [Architecture cible Rust et Raspberry Pi](docs/architecture-rust-raspberry-pi.md)
- [Déploiement COMPANION sur Raspberry Pi 5](docs/raspberry-pi-companion.md)
