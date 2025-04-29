# Développements réalisés

- Architecture client/serveur (Express + Socket.io + Canvas)
- Scaffolding du projet avec structure claire (client/, server/, utils/)

**Serveur**
 - Gestion des joueurs (connexion, déconnexion, stockage en mémoire)
 - Gestion multi-maps et téléporteurs (maps.json, rooms Socket.io)
 - Validation des déplacements (alignement grille, obstacles)
 - Auto-pickup sécurisé des drops à l’arrivée (côté serveur)
- Pathfinding serveur : portée Manhattan, ligne de vue (LOS)
 - Stats serveur : vie, mana, XP, level, progression XP, régénération de vie/mana
 - Validation des coûts en mana et gestion des dégâts des sorts (sort1 inflige 10 dégâts)
 - Gestion des orbes de sort1 côté serveur (spawn, expiration, collision)
 - Gestion de la mort : playerDied, blocage d’actions, broadcast Game Over

**Client**
 - Rendu Canvas responsive + conversion pointer↔canvas
 - Conversions pixels↔tuiles
 - Pathfinding client : A* pour mouvements, BFS pour portée, LOS (Bresenham)
 - Déplacement click-to-move avec queue de mouvements et interpolation fluide
 - UI des sorts : barre, slots 1–4, icônes, sélection clavier/clic
   - Sort 1 (orb) : portée 4 tuiles, BFS+LOS, orb visible 3 s, cooldown 5 s
   - Sort 2 (buff) : double taille 10 s, cooldown 10 s
 - Cooldowns visuels animés (overlay CSS sur les slots)
 - Inventaire : 20 slots, drag & drop, synchronisation serveur (move, drop, pickup), fusion items identiques
 - Drops : représentation visuelle sur la map, gestion sécurisée, ramassage automatique à l’arrivée
 - Tooltips : affichage type/quantité pour items et drops
 - Sprites 16×16 (idle/walk) : animation 3 frames @100 ms, interpolation et buff size
 - AudioController : musique de fond en boucle, volume/mute persistés, contrôles UI
 - Modale HTML/CSS pour saisie du pseudo (remplace prompt)
- Téléporteurs et transitions de carte (fade-out/in) via rooms Socket.io
 - Aperçu de pathfinding en hover (affichage du chemin cliquable)
 - Rendu pixel art sans lissage (ctx.imageSmoothingEnabled=false, CSS pixelated)
 - Icônes d’items au sol et dans l’inventaire (apple, stone, potion)
 - Stats panel (barres HP/mana/XP, level)
 - Pop-up Settings et Game Over (Rejouer/Quitter)
  - AudioController : musique de fond en boucle, volume/mute (persistés), contrôles UI (slider & bouton)
  - Modal HTML/CSS pour saisie du pseudo (remplace prompt)