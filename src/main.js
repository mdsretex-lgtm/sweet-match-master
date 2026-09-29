import { GameEngine } from './game/game-engine.js';
import { AudioManager } from './audio/audio-manager.js';

class PlayableApp {
  constructor() {
    this.audio = new AudioManager();

    this.audio.loadSound('flip', 'assets/sounds/flip.wav');
    this.audio.loadSound('mismatch', 'assets/sounds/mis_match.wav');
    this.audio.loadSound('record', 'assets/sounds/perfect.wav');
    this.audio.loadSound('win', 'assets/sounds/win.wav');
    this.audio.loadSound('match', 'assets/sounds/sweet.wav');
    this.engine = null;
    this.currentGridSize = 4;
    this.currentTimeLimit = 60;

    this.savedData = {
      highScores: {}
    };
    this.saveDataLoaded = false;

    this.dom = {
      menuScreen: document.getElementById('menu-screen'),
      gameScreen: document.getElementById('game-screen'),
      cardGrid: document.getElementById('card-grid'),
      timerBar: document.getElementById('timer-progress'),
      statTime: document.getElementById('stat-time'),
      statMoves: document.getElementById('stat-moves'),
      hudHighScore: document.getElementById('hud-high-score'),
      resultOverlay: document.getElementById('result-overlay'),
      resultTitle: document.getElementById('result-title'),
      resScore: document.getElementById('res-score'),
      resMoves: document.getElementById('res-moves'),
      resHighScore: document.getElementById('res-highscore'),
      resultStar: document.getElementById('result-star')
    };

    this.setupSoundToggle();
  }

  async initialize() {
    await this.loadSavedData();
    this.bindEvents();
    this.initSDK();
  }

  async loadSavedData() {
    this.savedData = {
      highScores: {}
    };

    // When running outside YouTube Playables, keep the default data.
    if (!window.ytgame?.game?.loadData) {
      this.saveDataLoaded = true;
      return;
    }

    try {
      const serialized = await window.ytgame.game.loadData();

      if (typeof serialized === 'string' && serialized.length > 0) {
        const parsed = JSON.parse(serialized);

        if (parsed && typeof parsed === 'object') {
          this.savedData = parsed;
        }
      }

      if (!this.savedData.highScores || typeof this.savedData.highScores !== 'object') {
        this.savedData.highScores = {};
      }

      this.saveDataLoaded = true;
    } catch (error) {
      console.warn('Unable to load Playables save data:', error);

      this.savedData = {
        highScores: {}
      };

      this.saveDataLoaded = true;
    }
  }

  async saveGameData() {
    if (!this.saveDataLoaded) {
      console.warn('Save skipped because Playables data has not finished loading.');
      return;
    }

    if (!window.ytgame?.game?.saveData) {
      return;
    }

    try {
      const serialized = JSON.stringify(this.savedData);

      await window.ytgame.game.saveData(serialized);
    } catch (error) {
      console.warn('Unable to save Playables data:', error);
    }
  }

  initSDK() {
    if (!window.ytgame) return;

    if (
      window.ytgame.game &&
      typeof window.ytgame.game.firstFrameReady === 'function'
    ) {
      window.ytgame.game.firstFrameReady();
    }

    if (
      window.ytgame.game &&
      typeof window.ytgame.game.gameReady === 'function'
    ) {
      window.ytgame.game.gameReady();
    }

    if (
      window.ytgame.system &&
      typeof window.ytgame.system.onPause === 'function'
    ) {
      window.ytgame.system.onPause(() => {
        if (this.engine) {
          this.engine.stopTimer();
        }
      });
    }

    if (
      window.ytgame.system &&
      typeof window.ytgame.system.onResume === 'function'
    ) {
      window.ytgame.system.onResume(() => {
        if (this.engine && this.engine.remainingTime > 0) {
          this.engine.startTimer();
        }
      });
    }
  }

  setupSoundToggle() {
    const soundToggle = document.getElementById('sound-toggle');

    if (!soundToggle || !this.audio) return;

    const updateSoundButton = () => {
      const muted = this.audio.isMuted();

      soundToggle.textContent = muted ? '🔇' : '🔊';
      soundToggle.setAttribute('aria-pressed', String(muted));
      soundToggle.setAttribute(
        'aria-label',
        muted ? 'Unmute sound' : 'Mute sound'
      );
    };

    soundToggle.addEventListener('click', (event) => {
      event.stopPropagation();

      this.audio.setMuted(!this.audio.isMuted());
      updateSoundButton();
    });

    updateSoundButton();
  }

  getHighScore(gridSize) {
    const scores = this.savedData?.highScores;

    if (!scores || typeof scores !== 'object') {
      return 0;
    }

    return Number(scores[String(gridSize)] || 0);
  }

  saveHighScore(gridSize, score) {
    const current = this.getHighScore(gridSize);

    if (score > current) {
      if (!this.savedData.highScores) {
        this.savedData.highScores = {};
      }
      this.savedData.highScores[String(gridSize)] = score;

      this.saveGameData();

      return true;
    }

    return false;
  }

  bindEvents() {
    document.querySelectorAll('.btn-diff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const button = e.currentTarget;
        this.currentGridSize = parseInt(button.dataset.size, 10);
        this.currentTimeLimit = parseInt(button.dataset.time, 10);
        this.startGame();
      });
    });

    document.getElementById('btn-back').addEventListener('click', () => this.showMenu());
    document.getElementById('btn-menu').addEventListener('click', () => this.showMenu());
    document.getElementById('btn-play-again').addEventListener('click', () => this.startGame());
  }

  showMenu() {
    if (this.engine) this.engine.dispose();
    this.dom.gameScreen.classList.remove('active');
    this.dom.resultOverlay.classList.add('hidden');
    this.dom.menuScreen.classList.add('active');
  }

  startGame() {
    this.dom.menuScreen.classList.remove('active');
    this.dom.resultOverlay.classList.add('hidden');
    this.dom.gameScreen.classList.add('active');

    const hs = this.getHighScore(this.currentGridSize);
    this.dom.hudHighScore.textContent = hs;

    if (this.engine) this.engine.dispose();

    this.engine = new GameEngine({
      gridSize: this.currentGridSize,
      timeLimit: this.currentTimeLimit,
      onStateChange: (state) => this.updateUI(state),
      onGameOver: (result) => this.handleGameOver(result)
    });

    this.renderGrid();

    this.updateUI({
      remainingTime: this.currentTimeLimit,
      moves: 0
    });
  }

  renderGrid() {
    this.dom.cardGrid.innerHTML = '';
    this.dom.cardGrid.style.gridTemplateColumns = `repeat(${this.currentGridSize}, 1fr)`;

    this.engine.cards.forEach((emoji, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.index = idx;

      cardEl.innerHTML = `
        <div class="card-inner">
          <div class="card-back">✨</div>
          <div class="card-front">${emoji}</div>
        </div>
      `;

      cardEl.addEventListener('click', () => this.handleCardClick(idx));
      this.dom.cardGrid.appendChild(cardEl);
    });
  }

  handleCardClick(index) {
    if (!this.engine) return;

    const action = this.engine.handleCardTap(index);
    if (!action) return;

    const cards = this.dom.cardGrid.children;
    if (!cards[index]) return;

    if (action.type === 'FLIP_FIRST') {
      cards[index].classList.add('flipped');
      this.audio.play('flip');
    } else if (action.type === 'MATCH') {
      cards[index].classList.add('flipped');
      action.indices.forEach(i => {
        if (cards[i]) cards[i].classList.add('matched');
      });
      this.audio.play('match');
    } else if (action.type === 'MISMATCH') {
      cards[index].classList.add('flipped');
      this.audio.play('mismatch');
    }
  }

  updateUI(state) {
    if (state.remainingTime !== undefined) {
      this.dom.statTime.textContent = state.remainingTime;
      const pct = (state.remainingTime / this.currentTimeLimit) * 100;
      this.dom.timerBar.style.width = `${pct}%`;
      this.dom.timerBar.style.backgroundColor = pct > 30 ? 'var(--accent-cyan)' : 'var(--accent-pink)';
    }

    if (state.moves !== undefined) {
      this.dom.statMoves.textContent = state.moves;
    }

    if (state.resetIndices) {
      const cards = this.dom.cardGrid.children;
      state.resetIndices.forEach(i => {
        if (cards[i]) cards[i].classList.remove('flipped');
      });
    }
  }

  handleGameOver({ win, score = 0, moves = 0 }) {
    const isNewRecord = win && this.saveHighScore(this.currentGridSize, score);
    const hs = this.getHighScore(this.currentGridSize);

    this.dom.hudHighScore.textContent = hs;

    this.dom.resScore.textContent = score;
    this.dom.resMoves.textContent = moves;
    this.dom.resHighScore.textContent = hs;

    if (!win) {
      this.dom.resultTitle.textContent = "TIME'S UP!";
      this.dom.resultStar.classList.add('hidden');
      this.audio.play('mismatch');
    } else if (isNewRecord) {
      this.dom.resultTitle.textContent = "NEW RECORD!";
      this.dom.resultStar.classList.remove('hidden');
      this.audio.play('record');
    } else {
      this.dom.resultTitle.textContent = "WELL DONE!";
      this.dom.resultStar.classList.add('hidden');
      this.audio.play('win');
    }

    this.dom.resultOverlay.classList.remove('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new PlayableApp();
  app.initialize();
});