/// <reference path="./global.d.ts" />

class TupHomeRewards extends HTMLElement {
  constructor() {
    super();
    /** @type {HTMLElement | null} */
    this.carousel = null;
    /** @type {Element[]} */
    this.cards = [];
    /** @type {number} */
    this.currentIndex = 0;
    /** @type {number | null} */
    this.intervalId = null;
    /** @type {MediaQueryList} */
    this.mobileQuery = window.matchMedia('(max-width: 749px)');
    /** @type {MediaQueryList} */
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    /** @type {() => void} */
    this.handleModeChange = () => {};
    /** @type {() => void} */
    this.pause = () => {};
    /** @type {() => void} */
    this.resume = () => {};
  }

  connectedCallback() {
    const carousel = this.querySelector('[data-tup-home-rewards-carousel]');
    this.carousel = carousel instanceof HTMLElement ? carousel : null;
    this.cards = this.carousel ? Array.from(this.carousel.children) : [];
    this.currentIndex = 0;
    this.intervalId = null;

    if (!this.carousel || this.cards.length < 2) return;

    this.handleModeChange = this.handleModeChangeImpl.bind(this);
    this.pause = this.pauseImpl.bind(this);
    this.resume = this.resumeImpl.bind(this);

    this.mobileQuery.addEventListener('change', this.handleModeChange);
    this.reducedMotionQuery.addEventListener('change', this.handleModeChange);
    this.carousel.addEventListener('pointerenter', this.pause);
    this.carousel.addEventListener('pointerleave', this.resume);
    this.carousel.addEventListener('focusin', this.pause);
    this.carousel.addEventListener('focusout', this.resume);
    this.carousel.addEventListener('touchstart', this.pause, { passive: true });
    this.carousel.addEventListener('touchend', this.resume, { passive: true });

    this.handleModeChange();
  }

  disconnectedCallback() {
    this.stop();
    this.mobileQuery.removeEventListener('change', this.handleModeChange);
    this.reducedMotionQuery.removeEventListener('change', this.handleModeChange);
    this.carousel?.removeEventListener('pointerenter', this.pause);
    this.carousel?.removeEventListener('pointerleave', this.resume);
    this.carousel?.removeEventListener('focusin', this.pause);
    this.carousel?.removeEventListener('focusout', this.resume);
    this.carousel?.removeEventListener('touchstart', this.pause);
    this.carousel?.removeEventListener('touchend', this.resume);
  }

  handleModeChangeImpl() {
    if (this.mobileQuery.matches && !this.reducedMotionQuery.matches) {
      this.start();
    } else {
      this.stop();
      this.carousel?.scrollTo({ left: 0, behavior: 'auto' });
    }
  }

  start() {
    if (this.intervalId != null) return;

    this.intervalId = window.setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.cards.length;
      this.cards[this.currentIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }, 3200);
  }

  stop() {
    if (this.intervalId != null) {
      window.clearInterval(this.intervalId);
    }
    this.intervalId = null;
  }

  pauseImpl() {
    this.stop();
  }

  resumeImpl() {
    if (this.mobileQuery.matches && !this.reducedMotionQuery.matches) {
      this.start();
    }
  }
}

if (!customElements.get('tup-home-rewards')) {
  customElements.define('tup-home-rewards', TupHomeRewards);
}
