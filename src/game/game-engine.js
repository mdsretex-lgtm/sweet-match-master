export class GameEngine {
  constructor({ gridSize, timeLimit, onStateChange, onGameOver }) {
    this.gridSize = gridSize;
    this.timeLimit = timeLimit;
    this.remainingTime = timeLimit;
    this.moves = 0;
    this.cards = [];
    this.matched = [];
    this.firstIndex = null;
    this.secondIndex = null;
    this.isProcessing = false;
    this.timer = null;
    this.mismatchTimeout = null;
    this.isDisposed = false;
    this.isGameOver = false;
    this.onStateChange = onStateChange;
    this.onGameOver = onGameOver;

    this.emojis = [
      "🍭","🍬","🧁","🍩","🍦","🍪","🍓","🍒",
      "🍇","🍉","🍎","🍑","🍍","🥝","🍋","🥑",
      "🥐","🥯","🥨","🥞","🧇","🧀","🍖","🍗"
    ];

    this.init();
  }

  init() {
    this.isGameOver = false;
    const pairCount = (this.gridSize * this.gridSize) / 2;
    const shuffled = [...this.emojis].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, pairCount);
    
    this.cards = [...selected, ...selected].sort(() => 0.5 - Math.random());
    this.matched = new Array(this.cards.length).fill(false);
    this.firstIndex = null;
    this.secondIndex = null;
    this.moves = 0;
    this.remainingTime = this.timeLimit;
    this.isProcessing = false;

    this.startTimer();
  }

  startTimer() {
    if (this.isDisposed || this.isGameOver) return;

    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isDisposed || this.isGameOver) {
        this.stopTimer();
        return;
      }

      this.remainingTime--;
      this.onStateChange({ remainingTime: this.remainingTime, moves: this.moves });
      if (this.remainingTime <= 0) {
        this.isGameOver = true;
        this.stopTimer();
        this.onGameOver({
          win: false,
          reason: 'timeout',
          score: 0,
          moves: this.moves
        });
      }
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timer);
    this.timer = null;
  }

  handleCardTap(index) {
    if (
      this.isDisposed ||
      this.isGameOver ||
      this.isProcessing ||
      this.remainingTime <= 0 ||
      this.matched[index] ||
      index === this.firstIndex ||
      index === this.secondIndex
    ) {
      return null;
    }

    if (this.firstIndex === null) {
      this.firstIndex = index;
      return { type: 'FLIP_FIRST', index };
    }

    this.secondIndex = index;
    this.moves++;
    this.isProcessing = true;

    const isMatch = this.cards[this.firstIndex] === this.cards[this.secondIndex];

    if (isMatch) {
      this.matched[this.firstIndex] = true;
      this.matched[this.secondIndex] = true;
      const idx1 = this.firstIndex;
      const idx2 = this.secondIndex;
      this.firstIndex = null;
      this.secondIndex = null;
      this.isProcessing = false;

      const allMatched = this.matched.every(m => m);
      if (allMatched) {
        this.isGameOver = true;
        this.stopTimer();
        const score = this.remainingTime * 10;
        this.onGameOver({ win: true, score, moves: this.moves });
      }

      return { type: 'MATCH', indices: [idx1, idx2] };
    } else {
      const idx1 = this.firstIndex;
      const idx2 = this.secondIndex;
      
      this.mismatchTimeout = setTimeout(() => {
        this.mismatchTimeout = null;

        if (this.isDisposed || this.isGameOver) {
          return;
        }

        this.firstIndex = null;
        this.secondIndex = null;
        this.isProcessing = false;

        this.onStateChange({ resetIndices: [idx1, idx2] });
      }, 600);

      return { type: 'MISMATCH', indices: [idx1, idx2] };
    }
  }

  dispose() {
    this.isDisposed = true;
    this.stopTimer();

    if (this.mismatchTimeout) {
      clearTimeout(this.mismatchTimeout);
      this.mismatchTimeout = null;
    }
  }
}