# Jeu 2D Multijoueur

Ce dépôt contient un jeu 2D multijoueur en temps réel, développé en JavaScript/HTML5 pour le client et Node.js (Express + Socket.io) pour le serveur.

## Fonctionnalités implémentées
- Consultez `AlreadyDone.md` pour un récapitulatif des fonctionnalités déjà réalisées, notamment :
- Inventory & Drops (20 slots, drag & drop, sync serveur, drops sur map, ramassage auto, tooltips)
- Audio (musique de fond, volume & mute persistés, contrôles UI)
- Stats & leveling (vie, mana, XP, level, progression XP, régénération)
- Spells avec coûts en mana et dégâts, gestion server-authoritative
- Death & Game Over (écran de fin, rejouer/quitter, blocage d’actions)

## Feuille de route
Consultez `Todo.md` pour la liste des tâches et améliorations à venir.

## Installation
```bash
git clone <url-du-repo>
cd <nom-du-repo>
npm install
```

## Lancement
- `npm start` : démarre le serveur et sert le client (ouvrir http://localhost:3000)
- `npm run dev` : lance l’application en mode Electron (si configuré)

## Structure du projet
- `client/` : code source du client (HTML, ES6 modules, Canvas, assets)
- `server/` : code source du serveur (Express, Socket.io, utils)
- `AlreadyDone.md` : liste des fonctionnalités implémentées
- `Todo.md` : tâches restantes

## Contribution
Les contributions sont les bienvenues !
1. Forkez ce dépôt
2. Créez une branche (feature/ma-fonctionnalite)
3. Soumettez un pull request