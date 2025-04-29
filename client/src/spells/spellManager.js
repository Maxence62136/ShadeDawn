import { findReachable } from '../pathfinding/bfs.js';
import { hasLineOfSight } from '../pathfinding/los.js';
/**
 * SpellManager: selection, range preview, casting and active spells display.
 */
export class SpellManager {
  /**
   * @param {SocketIOClient.Socket} socket
   * @param {Object<string, any>} players - reference to players state
   */
  constructor(socket, players) {
    this.socket = socket;
    this.players = players;
    this.mapData = null;
    this.cooldowns = {};
    // Spell UI slots
    this.slots = {};
    document.querySelectorAll('.spell-slot').forEach(el => {
      const sid = parseInt(el.dataset.spell, 10);
      this.slots[sid] = el;
      el.addEventListener('click', () => this.selectSpell(sid));
    });
    this.selected = null;
    this.reachable = [];
    this.activeSpells = [];
    // Listen for spell selection keys (Digit1–Digit8)
    window.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Digit')) {
        const d = parseInt(e.code.slice(5), 10);
        if (d >= 1 && d <= 8) {
          this.selectSpell(d);
        }
      }
    });
  }
  /**
   * Set map data (must be called after map is received)
   */
  setMapData(mapData) {
    this.mapData = mapData;
  }
  /**
   * Select a spell by ID (1-8). Only spell 1 implemented.
   */
  selectSpell(id) {
    // Prevent selecting spells when dead
    if (window.isDead) return;
    // Toggle off if already selected
    if (this.selected === id) {
      this.selected = null;
      this.reachable = [];
      Object.values(this.slots).forEach(el => el.classList.remove('selected'));
      return;
    }
    // Cannot select if on cooldown
    const cd = this.cooldowns[id];
    if (cd && Date.now() < cd) return;
    // Select this spell
    this.selected = id;
    // Update UI selection
    Object.values(this.slots).forEach(el => el.classList.remove('selected'));
    if (this.slots[id]) this.slots[id].classList.add('selected');
    this.reachable = [];
    if (id === 1 && this.mapData) {
      // Compute BFS range = 4 tiles and filter LOS
      const player = this.players[this.socket.id];
      if (player) {
        const start = { x: Math.floor(player.x / 40), y: Math.floor(player.y / 40) };
        const raw = findReachable(start, 4, this.mapData.tiles);
        this.reachable = raw.filter(pt => hasLineOfSight(start, pt, this.mapData.tiles));
      }
    }
    else if (id === 2 && this.mapData) {
      // Buff on self: only allow casting on own tile
      const player = this.players[this.socket.id];
      if (player) {
        const tx = Math.floor(player.x / 40);
        const ty = Math.floor(player.y / 40);
        this.reachable = [{ x: tx, y: ty }];
      }
    }
  }
  /**
   * Cast the selected spell at a tile coordinate.
   */
  cast(tileX, tileY) {
    // Recompute reachable range at moment of cast
    let valid = false;
    const player = this.players[this.socket.id];
    if (this.selected === 1 && this.mapData && player) {
      const start = { x: Math.floor(player.x / 40), y: Math.floor(player.y / 40) };
      const raw = findReachable(start, 4, this.mapData.tiles);
      const reach = raw.filter(pt => hasLineOfSight(start, pt, this.mapData.tiles));
      valid = reach.some(p => p.x === tileX && p.y === tileY);
      if (valid) {
        this.socket.emit('castSpell', { spellId: 1, x: tileX * 40, y: tileY * 40 });
        this.startCooldown(1);
      }
    }
    else if (this.selected === 2 && player) {
      const px = Math.floor(player.x / 40);
      const py = Math.floor(player.y / 40);
      if (tileX === px && tileY === py) {
        this.socket.emit('castSpell', { spellId: 2, x: tileX * 40, y: tileY * 40 });
        this.startCooldown(2);
        valid = true;
      }
    }
    // If cast succeeded, clear selection and reachable preview
    if (valid) {
      this.selected = null;
      this.reachable = [];
    }
    return valid;
  }
  /**
   * Receive a spell event from server
   */
  spawnSpell({ id, spellId, x, y }) {
    // Add to active spells with timestamp
    const now = Date.now();
    // Store orb with caster and unique id if provided
    const orbId = id || Date.now();
    // Default duration: 5000ms for spell 1
    const duration = spellId === 1 ? 5000 : 0;
    this.activeSpells.push({ orbId, caster: id, spellId, x, y, start: now, duration });
    // Handle buff effect for spell 2 on all clients
    if (spellId === 2) {
      const player = this.players[id];
      if (player) {
        // Buff lasts 10 seconds
        player.buffEnd = now + 10000;
      }
    }
    // Start cooldown for caster on local UI
    if (id === this.socket.id) {
      this.startCooldown(spellId);
    }
  }
  /**
   * Remove an active spell (orb) by its ID.
   * @param {number|string} orbId
   */
  removeOrb(orbId) {
    this.activeSpells = this.activeSpells.filter(sp => sp.orbId !== orbId);
  }
  /**
   * Draw preview overlay and active spells.
   */
  draw(ctx, TILE_SIZE) {
    // Dynamic preview range follows player movement
    if (this.selected === 1 && this.mapData) {
      const player = this.players[this.socket.id];
      if (player) {
        const start = { x: Math.floor(player.x / TILE_SIZE), y: Math.floor(player.y / TILE_SIZE) };
        const raw = findReachable(start, 4, this.mapData.tiles);
        const reach = raw.filter(pt => hasLineOfSight(start, pt, this.mapData.tiles));
        // Update internal reachable for consistency
        this.reachable = reach;
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        reach.forEach(({ x, y }) => {
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        });
      }
    }
    // Draw active spells
    const now = Date.now();
    this.activeSpells = this.activeSpells.filter(sp => {
      const age = now - sp.start;
      if (sp.spellId === 1 && age < sp.duration) {
        // draw orb
        ctx.fillStyle = 'rgba(255,0,0,0.7)';
        ctx.beginPath();
        ctx.arc(sp.x + TILE_SIZE/2, sp.y + TILE_SIZE/2, TILE_SIZE/3, 0, Math.PI*2);
        ctx.fill();
        return true;
      }
      return false;
    });
  }
  /**
   * Start cooldown for a spell: disable selection and show UI overlay.
   * @param {number} spellId - ID of the spell.
   */
  startCooldown(spellId) {
    const duration = spellId === 1 ? 5000 : spellId === 2 ? 10000 : 0;
    if (!duration || !this.slots[spellId]) return;
    const el = this.slots[spellId];
    // Remove selection highlight
    el.classList.remove('selected');
    // Record cooldown end
    this.cooldowns[spellId] = Date.now() + duration;
    // Create overlay animation
    const overlay = document.createElement('div');
    overlay.className = 'cooldown-overlay';
    overlay.style.animation = `cooldown ${duration/1000}s linear forwards`;
    el.appendChild(overlay);
    overlay.addEventListener('animationend', () => {
      overlay.remove();
      delete this.cooldowns[spellId];
    });
  }
}