/**
 * AudioManager for Sweet Match Playable
 * Handles audio preloading and playback safely without background music or extra dependencies.
 */
export class AudioManager {
  constructor() {
    this.sounds = {};
    this.STORAGE_KEY = 'sweetMatchSoundEnabled';
    this.enabled = this._loadSavedState();
    this.youtubeAudioEnabled = true;

    // Safely query YouTube Playables system audio state
    if (
      window.ytgame &&
      window.ytgame.system &&
      typeof window.ytgame.system.isAudioEnabled === 'function'
    ) {
      try {
        this.youtubeAudioEnabled = window.ytgame.system.isAudioEnabled();
      } catch (error) {
        console.warn('[AudioManager] Unable to query YouTube isAudioEnabled state:', error);
      }
    }

    // Register listener for YouTube system audio state updates
    if (
      window.ytgame &&
      window.ytgame.system &&
      typeof window.ytgame.system.onAudioEnabledChange === 'function'
    ) {
      try {
        window.ytgame.system.onAudioEnabledChange((enabled) => {
          this.youtubeAudioEnabled = Boolean(enabled);
        });
      } catch (error) {
        console.warn('[AudioManager] Unable to bind YouTube onAudioEnabledChange listener:', error);
      }
    }
  }

  /**
   * Safely reads saved sound settings from localStorage.
   * Defaults to sound ON (enabled = true) if unavailable or unset.
   * Checks if stored value is "false" to mute, otherwise defaults to true.
   * @private
   * @returns {boolean}
   */
  _loadSavedState() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved !== null) {
        return saved !== 'false';
      }
    } catch (error) {
      console.warn('[AudioManager] Unable to access localStorage for reading sound preference:', error);
    }
    return true; // Default sound ON for first-time players
  }

  /**
   * Safely persists sound settings to localStorage.
   * @private
   * @param {boolean} isEnabled
   */
  _saveState(isEnabled) {
    try {
      localStorage.setItem(this.STORAGE_KEY, String(isEnabled));
    } catch (error) {
      console.warn('[AudioManager] Unable to access localStorage for saving sound preference:', error);
    }
  }

  /**
   * Sets whether the game's SFX preference is muted.
   * setMuted(true) mutes all sounds, setMuted(false) restores all sounds.
   * @param {boolean} muted - Pass true to mute, false to unmute.
   */
  setMuted(muted) {
    const isMuted = Boolean(muted);
    this.setEnabled(!isMuted);
  }

  /**
   * Returns whether sound is currently muted by the user's game SFX preference.
   * @returns {boolean}
   */
  isMuted() {
    return !this.enabled;
  }

  /**
   * Safely preloads an audio asset into memory.
   * @param {string} key - Identifier key for the sound effect.
   * @param {string} src - Path to the audio file.
   */
  loadSound(key, src) {
    try {
      const audio = new Audio();
      audio.preload = 'auto';

      // Error handling to prevent missing asset crashes
      audio.onerror = () => {
        console.warn(`[AudioManager] Failed to load sound asset at: ${src}`);
      };

      audio.src = src;
      this.sounds[key] = audio;
    } catch (error) {
      console.warn(`[AudioManager] Error initializing audio object for key "${key}":`, error);
    }
  }

  /**
   * Plays a preloaded sound effect.
   * Respects both the game SFX preference and YouTube system audio state.
   * @param {string} key - Identifier key of the sound to play.
   */
  play(key) {
    // Both user SFX setting and YouTube global state must be enabled to play
    if (!this.enabled) return;
    if (!this.youtubeAudioEnabled) return;

    const sound = this.sounds[key];
    if (!sound) {
      console.warn(`[AudioManager] Sound key "${key}" is not loaded.`);
      return;
    }

    try {
      // Reset position so rapid repeated triggers play immediately
      sound.currentTime = 0;

      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // Gracefully swallow browser autoplay restrictions / interruptions
          console.warn(`[AudioManager] Playback prevented for key "${key}":`, error);
        });
      }
    } catch (error) {
      console.warn(`[AudioManager] Unexpected error playing key "${key}":`, error);
    }
  }

  /**
   * Toggles sound effect playback enablement and persists preference to localStorage.
   * @param {boolean} enabled 
   */
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this._saveState(this.enabled);
  }

  /**
   * Cleans up all audio elements and releases references.
   */
  dispose() {
    Object.keys(this.sounds).forEach((key) => {
      const sound = this.sounds[key];
      if (sound) {
        try {
          sound.pause();
          sound.currentTime = 0;
          sound.onerror = null;
          sound.removeAttribute('src');
          sound.load();
        } catch (e) {
          // Ignore disposal errors
        }
      }
    });

    this.sounds = {};
  }
}