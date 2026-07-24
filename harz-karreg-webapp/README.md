# Harz Karreg Webapp

MVP local de gestion transport pour conducteurs, remorques, tournees et planning hebdomadaire.

## Installation

1. Ouvrir le dossier `harz-karreg-webapp`.
2. Lancer `index.html` avec Live Server.
3. Utiliser l'application dans le navigateur.

Aucun backend, aucune base de donnees et aucune dependance ne sont requis.

## Structure

```text
harz-karreg-webapp/
  index.html
  planning.html
  conducteurs.html
  camions.html
  bennes.html
  remorques.html
  tournees.html
  css/
    variables.css
    global.css
    sidebar.css
    cards.css
    planning.css
    modal.css
  js/
    app.js
    storage.js
    dashboard.js
    planning.js
    conducteurs.js
    camions.js
    bennes.js
    remorques.js
    tournees.js
    calendar.js
    modal.js
    ui.js
  assets/
    images/
    icons/
```

## Fonctionnement

- `storage.js` est la seule couche autorisee a lire ou ecrire dans LocalStorage.
- Les pages partagent le meme shell: sidebar, topbar, workspace et footer.
- Chaque domaine possede son module JavaScript: conducteurs, remorques, tournees et planning.
- Les tournees datees sont automatiquement visibles dans la vue semaine.
- Le planning supporte le drag and drop pour changer le jour d'une tournee.

## Donnees

Au premier lancement, l'application cree un jeu de donnees local:

- conducteurs
- remorques
- tournees

Les donnees restent dans le navigateur. Pour repartir de zero, vider le LocalStorage du site.

## Roadmap

- Filtres et recherche globale.
- Vue mensuelle et capacite multi-equipes.
- Affectation par conducteur lors du drag and drop.
- Export CSV.
- Synchronisation backend optionnelle.
- Migration progressive vers React avec conservation des modules metier.
