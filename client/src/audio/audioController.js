/**
 * AudioController: background music, volume control and mute.
 */
export class AudioController {
  constructor() {
    // Initialize audio element
    this.audio = new Audio('/assets/audio/main1.wav');
    this.audio.loop = true;
    // Load saved settings or defaults
    const savedVolume = parseFloat(localStorage.getItem('volume'));
    this.volume = (isNaN(savedVolume) ? 0.5 : savedVolume);
    this.muted = (localStorage.getItem('muted') === 'true');
    this.audio.volume = this.volume;
    this.audio.muted = this.muted;
    // Play audio on first user interaction
    const playAudio = () => {
      this.audio.play().catch(() => {});
      window.removeEventListener('click', playAudio);
    };
    window.addEventListener('click', playAudio);
  }

  /**
   * Update mute button icon
   */
  updateMuteButton() {
    if (!this.muteButton) return;
    this.muteButton.textContent = this.audio.muted ? '🔇' : '🔊';
  }

  /**
   * Toggle mute/unmute
   */
  toggleMute() {
    this.audio.muted = !this.audio.muted;
    localStorage.setItem('muted', this.audio.muted);
    this.updateMuteButton();
  }

  /**
   * Set volume (0.0 to 1.0)
   * @param {number} v
   */
  setVolume(v) {
    this.volume = v;
    this.audio.volume = v;
    localStorage.setItem('volume', String(v));
    if (this.volumeSlider) this.volumeSlider.value = v;
  }
}
