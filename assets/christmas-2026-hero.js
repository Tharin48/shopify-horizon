(() => {
  const GLOBAL_KEY = 'Christmas2026Hero';

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].boot();
    return;
  }

  const instances = new Map();
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const isIOSDevice = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  class ChristmasHero {
    constructor(root) {
      this.root = root;
      this.sectionId = root.dataset.sectionId;
      this.viewport = root.querySelector('[data-c26-viewport]');
      this.world = root.querySelector('[data-c26-world]');
      this.progressBar = root.querySelector('[data-c26-progress]');
      this.iosContinueCue = root.querySelector('[data-c26-ios-continue]');
      this.iosSkipButton = root.querySelector('[data-c26-ios-skip]');
      this.leftCopy = root.querySelector('.c26-hero__intro');
      this.finale = root.querySelector('[data-c26-finale]');
      this.characters = [...root.querySelectorAll('[data-c26-character]')];
      this.characterTriggers = [...root.querySelectorAll('[data-c26-character-trigger]')];
      this.drawer = root.querySelector('[data-c26-story-drawer]');
      this.drawerCloseButtons = [...(this.drawer?.querySelectorAll('[data-c26-drawer-close]') || [])];
      this.drawerPrevButton = this.drawer?.querySelector('[data-c26-drawer-prev]');
      this.drawerNextButton = this.drawer?.querySelector('[data-c26-drawer-next]');
      this.drawerPrevLabel = this.drawer?.querySelector('[data-c26-drawer-prev-label]');
      this.drawerNextLabel = this.drawer?.querySelector('[data-c26-drawer-next-label]');
      this.drawerChapter = this.drawer?.querySelector('[data-c26-drawer-chapter]');
      this.drawerChapterPrefix = root.dataset.drawerChapterPrefix || 'Chapter';
      this.characterOrder = this.characters.map((character) => ({
        id: character.dataset.characterId,
        name: character.dataset.characterName,
      })).filter((entry) => entry.id);
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.scrollDistance = Number(root.dataset.scrollDistance || 100) / 100;
      this.endHoldDistance = Number(root.dataset.endHoldDistance || 40) / 100;
      this.finaleGapDistance = Number(root.dataset.finaleGapDistance || 10) / 100;
      this.mobileFinaleGapDistance = Number(root.dataset.mobileFinaleGapDistance || 0) / 100;
      this.mobilePanoramaAspectRatio = Number(root.dataset.mobilePanoramaAspectRatio || 3.064);
      this.mobilePanoramaSourceWidth = Number(root.dataset.mobilePanoramaSourceWidth || 0);
      this.mobilePanoramaSourceHeight = Number(root.dataset.mobilePanoramaSourceHeight || 0);
      this.maxTranslate = 0;
      this.horizontalTravelDistance = 0;
      this.finaleStartDistance = 0;
      this.sectionTop = 0;
      this.viewportHeight = 0;
      this.frame = 0;
      this.animationFrame = 0;
      this.targetTranslate = 0;
      this.currentTranslate = 0;
      this.translateDifference = 0;
      this.lastJourneyProgress = 0;
      this.destroyed = false;
      this.activeStoryId = null;
      this.scrollActiveCharacterId = null;
      this.layoutViewportWidth = 0;
      this.stableViewportHeight = 0;
      this.resizeTimer = 0;
      this.debugEnabled = new URLSearchParams(window.location.search).get('c26_debug') === '1';
      this.debugElement = null;
      this.useNativeHorizontalScroll = isIOSDevice() && window.innerWidth < 750;
      this.iosSwipeCompleted = false;
      this.iosSwipeGateObserver = null;
      this.lastDrawerTrigger = null;
      this.drawerPlacement = null;

      this.onScroll = this.onScroll.bind(this);
      this.onNativeHorizontalScroll = this.onNativeHorizontalScroll.bind(this);
      this.onIOSSkip = this.onIOSSkip.bind(this);
      this.onResize = this.onResize.bind(this);
      this.onMotionChange = this.onMotionChange.bind(this);
      this.onCharacterSelect = this.onCharacterSelect.bind(this);
      this.onThemeBlockSelect = this.onThemeBlockSelect.bind(this);
      this.onDrawerClose = this.onDrawerClose.bind(this);
      this.onDrawerKeydown = this.onDrawerKeydown.bind(this);
      this.onDrawerPrev = this.onDrawerPrev.bind(this);
      this.onDrawerNext = this.onDrawerNext.bind(this);
      this.onQuickAddSubmit = this.onQuickAddSubmit.bind(this);

      if (!this.viewport || !this.world) return;
      this.setCharacterExpanded(null);
      this.init();
    }

    init() {
      this.characterTriggers.forEach((trigger) => {
        trigger.addEventListener('click', this.onCharacterSelect);
      });
      this.drawerCloseButtons.forEach((button) => {
        button.addEventListener('click', this.onDrawerClose);
      });
      this.drawerPrevButton?.addEventListener('click', this.onDrawerPrev);
      this.drawerNextButton?.addEventListener('click', this.onDrawerNext);
      this.drawer?.addEventListener('submit', this.onQuickAddSubmit);
      this.iosSkipButton?.addEventListener('click', this.onIOSSkip);
      document.addEventListener('shopify:block:select', this.onThemeBlockSelect);
      this.motionQuery.addEventListener('change', this.onMotionChange);
      window.addEventListener('resize', this.onResize, { passive: true });

      this.root.querySelectorAll('img').forEach((image) => {
        if (!image.complete) image.addEventListener('load', this.onResize, { once: true });
      });

      this.setStableViewportHeight();
      this.updateHorizontalRenderMode();
      this.setupDebugMode();
      this.setMotionMode();
    }

    setStableViewportHeight() {
      if (window.innerWidth >= 750) {
        this.root.style.removeProperty('--c26-app-height');
        this.stableViewportHeight = 0;
        return;
      }

      let largeViewportHeight = 0;
      if (window.CSS?.supports?.('height', '100lvh')) {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;inset:0 auto auto 0;width:1px;height:100lvh;visibility:hidden;pointer-events:none;';
        document.body.append(probe);
        largeViewportHeight = probe.getBoundingClientRect().height;
        probe.remove();
      }

      // Freeze the largest viewport available at initialization/orientation time.
      // This fills the space revealed when mobile browser chrome collapses without
      // resizing the scene during the gesture.
      this.stableViewportHeight = Math.round(Math.max(window.innerHeight, largeViewportHeight));
      this.root.style.setProperty('--c26-app-height', `${this.stableViewportHeight}px`);
      this.root.style.setProperty(
        '--c26-scene-width-mobile',
        `${Math.ceil(Math.max(window.innerWidth, this.stableViewportHeight * this.mobilePanoramaAspectRatio))}px`
      );
    }

    setupDebugMode() {
      if (!this.debugEnabled) return;
      this.debugElement = document.createElement('output');
      this.debugElement.className = 'c26-hero__debug';
      this.debugElement.setAttribute('aria-hidden', 'true');
      this.root.append(this.debugElement);
    }

    updateHorizontalRenderMode() {
      this.useNativeHorizontalScroll = isIOSDevice() && window.innerWidth < 750;
      this.root.classList.toggle('is-ios-swipe-mode', this.useNativeHorizontalScroll);
      this.applyPanoramaPosition(this.currentTranslate);
    }

    applyPanoramaPosition(position) {
      if (this.useNativeHorizontalScroll) {
        this.world.style.removeProperty('transform');
        return;
      }

      if (this.viewport.scrollLeft !== 0) this.viewport.scrollLeft = 0;
      this.world.style.transform = `translate3d(${-position}px, 0, 0)`;
    }

    setMotionMode() {
      window.removeEventListener('scroll', this.onScroll);
      this.viewport.removeEventListener('scroll', this.onNativeHorizontalScroll);
      this.disconnectIOSSwipeGate();
      cancelAnimationFrame(this.frame);
      cancelAnimationFrame(this.animationFrame);
      this.frame = 0;
      this.animationFrame = 0;

      // iPhone/iPad always use the browser's native horizontal scroller. Keep
      // this branch ahead of reduced-motion so iOS is never put back into the
      // tall, pinned cinematic layout.
      if (this.useNativeHorizontalScroll) {
        this.root.classList.remove('is-enhanced', 'is-reduced-motion', 'is-finale-visible');
        this.root.classList.add('is-ios-swipe-mode');
        this.root.classList.toggle('is-swipe-complete', this.iosSwipeCompleted);
        this.iosContinueCue?.setAttribute('aria-hidden', this.iosSwipeCompleted ? 'false' : 'true');
        this.root.style.removeProperty('--c26-scroll-height');
        this.world.style.removeProperty('transform');
        this.viewport.addEventListener('scroll', this.onNativeHorizontalScroll, { passive: true });
        this.refresh();
        this.setupIOSSwipeGate();
        return;
      }

      if (this.motionQuery.matches) {
        this.root.classList.remove(
          'is-enhanced',
          'has-progress',
          'is-left-copy-hidden',
          'is-left-copy-fading',
          'is-finale-visible'
        );
        this.root.classList.add('is-reduced-motion', 'is-finale-visible');
        this.root.style.removeProperty('--c26-scroll-height');
        this.root.style.setProperty('--c26-progress', '0');
        this.root.style.setProperty('--c26-left-copy-opacity', '1');
        this.root.style.setProperty('--c26-finale-opacity', '1');
        this.root.style.setProperty('--c26-character-opacity', '1');
        this.targetTranslate = 0;
        this.currentTranslate = 0;
        this.translateDifference = 0;
        this.applyPanoramaPosition(0);
        this.characters.forEach((character) => {
          character.style.setProperty('--c26-depth-offset', '0px');
        });
        this.setScrollActiveCharacter(null);
        if (this.leftCopy) this.leftCopy.setAttribute('aria-hidden', 'false');
        if (this.finale) this.finale.setAttribute('aria-hidden', 'false');
        return;
      }

      this.root.classList.remove('is-reduced-motion');

      this.root.classList.remove('is-ios-swipe-mode');
      this.root.classList.remove('is-swipe-gate-active', 'is-swipe-complete');
      this.root.classList.add('is-enhanced');
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.refresh();
    }

    refresh() {
      if (this.destroyed || (this.motionQuery.matches && !this.useNativeHorizontalScroll)) return;

      this.viewportHeight = this.viewport.clientHeight || window.innerHeight;
      this.layoutViewportWidth = this.viewport.clientWidth;
      this.maxTranslate = Math.max(0, this.world.scrollWidth - this.viewport.clientWidth);
      this.horizontalTravelDistance = Math.max(1, this.maxTranslate * this.scrollDistance);
      this.finaleStartDistance = this.horizontalTravelDistance;

      if (this.useNativeHorizontalScroll) {
        this.root.style.removeProperty('--c26-scroll-height');
        this.updateNativeHorizontalProgress();
        return;
      }

      if (window.innerWidth < 750 && this.characters.length) {
        const lastCharacter = this.characters[this.characters.length - 1];
        const lastCharacterExitTranslate = clamp(
          lastCharacter.offsetLeft - this.viewport.clientWidth * 0.12,
          0,
          this.maxTranslate
        );
        this.finaleStartDistance = Math.max(
          1,
          lastCharacterExitTranslate * this.scrollDistance
        );
      }

      const finaleGapDistance = window.innerWidth < 750
        ? this.mobileFinaleGapDistance
        : this.finaleGapDistance;
      const finaleFadeDistance = window.innerWidth < 750 ? 0 : 0.12;
      const holdDistance = this.viewportHeight * (
        finaleGapDistance + finaleFadeDistance + this.endHoldDistance
      );
      this.root.style.setProperty(
        '--c26-scroll-height',
        `${Math.ceil(this.viewportHeight + this.finaleStartDistance + holdDistance)}px`
      );

      const rect = this.root.getBoundingClientRect();
      if (window.scrollY <= 2) {
        this.sectionTop = window.scrollY + rect.top;
      } else {
        this.sectionTop = window.scrollY + rect.top;
      }
      this.update(true);
    }

    onResize() {
      const isMobile = window.innerWidth < 750;
      const widthChanged = Math.abs(this.viewport.clientWidth - this.layoutViewportWidth) >= 2;

      // The cinematic controller keeps a frozen height while browser chrome
      // collapses. The native iOS stage is not pinned, so it can safely refresh
      // its height and must do so to avoid exposing the following section.
      if (
        isMobile &&
        this.layoutViewportWidth > 0 &&
        !widthChanged &&
        !this.useNativeHorizontalScroll
      ) return;

      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        this.setStableViewportHeight();
        this.updateHorizontalRenderMode();
        cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = requestAnimationFrame(() => this.setMotionMode());
      }, 180);
    }

    onScroll() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.update();
      });
    }

    onNativeHorizontalScroll() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.updateNativeHorizontalProgress();
      });
    }

    setupIOSSwipeGate() {
      this.disconnectIOSSwipeGate();

      if (
        !this.useNativeHorizontalScroll ||
        this.iosSwipeCompleted ||
        this.motionQuery.matches ||
        !('IntersectionObserver' in window)
      ) return;

      const updateGate = () => {
        if (this.destroyed || this.iosSwipeCompleted || !this.useNativeHorizontalScroll) {
          this.root.classList.remove('is-swipe-gate-active');
          return;
        }

        const rect = this.viewport.getBoundingClientRect();
        const visibleHeight = Math.max(
          0,
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
        );
        const referenceHeight = Math.max(1, Math.min(rect.height, window.innerHeight));
        this.root.classList.toggle('is-swipe-gate-active', visibleHeight / referenceHeight >= 0.85);
      };

      this.iosSwipeGateObserver = new IntersectionObserver(updateGate, {
        threshold: [0, 0.5, 0.75, 0.85, 1],
      });
      this.iosSwipeGateObserver.observe(this.viewport);
      updateGate();
    }

    disconnectIOSSwipeGate() {
      this.iosSwipeGateObserver?.disconnect();
      this.iosSwipeGateObserver = null;
      this.root.classList.remove('is-swipe-gate-active');
    }

    completeIOSSwipe() {
      if (!this.useNativeHorizontalScroll || this.iosSwipeCompleted) return;

      this.iosSwipeCompleted = true;
      this.root.classList.add('is-swipe-complete');
      this.root.classList.remove('is-swipe-gate-active');
      this.iosContinueCue?.setAttribute('aria-hidden', 'false');
      this.disconnectIOSSwipeGate();
    }

    onIOSSkip() {
      if (!this.useNativeHorizontalScroll) return;
      this.completeIOSSwipe();
      this.viewport.focus({ preventScroll: true });
    }

    updateNativeHorizontalProgress() {
      if (!this.useNativeHorizontalScroll) return;

      const maxScroll = Math.max(0, this.viewport.scrollWidth - this.viewport.clientWidth);
      const progress = maxScroll > 0 ? clamp(this.viewport.scrollLeft / maxScroll) : 0;
      const leftCopyFadeStart = 0.14;
      const leftCopyFadeEnd = 0.24;
      const leftCopyOpacity = progress <= leftCopyFadeStart
        ? 1
        : clamp(1 - (progress - leftCopyFadeStart) / (leftCopyFadeEnd - leftCopyFadeStart));
      const isLeftCopyHidden = progress >= leftCopyFadeEnd;

      this.targetTranslate = this.viewport.scrollLeft;
      this.currentTranslate = this.viewport.scrollLeft;
      this.translateDifference = 0;
      this.lastJourneyProgress = progress;
      this.root.style.setProperty('--c26-progress', progress.toFixed(4));
      this.root.style.setProperty('--c26-left-copy-opacity', leftCopyOpacity.toFixed(3));
      this.root.style.setProperty('--c26-finale-opacity', '0');
      this.root.style.setProperty('--c26-character-opacity', '1');
      this.root.classList.toggle('has-progress', progress > 0.03);
      this.root.classList.toggle('is-left-copy-fading', progress > leftCopyFadeStart && !isLeftCopyHidden);
      this.root.classList.toggle('is-left-copy-hidden', isLeftCopyHidden);
      this.root.classList.remove('is-finale-visible');

      if (maxScroll <= 1 || progress >= 0.97) this.completeIOSSwipe();

      if (this.leftCopy) this.leftCopy.setAttribute('aria-hidden', isLeftCopyHidden ? 'true' : 'false');
      if (this.finale) this.finale.setAttribute('aria-hidden', 'true');

      this.updateScrollActiveCharacter(progress, true);
      this.renderDebug();
    }

    update(immediate = false) {
      if (this.destroyed || this.motionQuery.matches) return;

      const scrollOffset = Math.max(0, window.scrollY - this.sectionTop);
      const layoutReady = this.maxTranslate > 0;
      const journeyProgress = layoutReady ? clamp(scrollOffset / this.finaleStartDistance) : 0;
      const panoramaProgress = layoutReady
        ? clamp(Math.min(scrollOffset, this.finaleStartDistance) / this.horizontalTravelDistance)
        : 0;
      const translate = this.maxTranslate * panoramaProgress;
      const postCharacterScroll = layoutReady ? Math.max(0, scrollOffset - this.finaleStartDistance) : 0;
      const finaleGapDistance = window.innerWidth < 750
        ? this.mobileFinaleGapDistance
        : this.finaleGapDistance;
      const finaleGap = this.viewportHeight * finaleGapDistance;
      const isMobile = window.innerWidth < 750;
      const finaleFadeDistance = Math.max(1, this.viewportHeight * 0.12);
      const finaleProgress = isMobile
        ? (postCharacterScroll > finaleGap ? 1 : 0)
        : clamp((postCharacterScroll - finaleGap) / finaleFadeDistance);
      const characterOpacity = 1 - finaleProgress;
      const isFinaleVisible = finaleProgress > 0.04;

      // Theme editor previews and browsers can restore a small scroll offset on
      // load. Keep the welcome copy fully opaque through that initial position;
      // fade it only after the visitor has deliberately progressed into the scene.
      const leftCopyFadeStart = 0.14;
      const leftCopyFadeEnd = 0.24;
      let leftCopyOpacity = 1;
      if (layoutReady && journeyProgress > leftCopyFadeStart) {
        leftCopyOpacity = clamp(1 - (journeyProgress - leftCopyFadeStart) / (leftCopyFadeEnd - leftCopyFadeStart));
      }
      const isLeftCopyFading = layoutReady && journeyProgress > leftCopyFadeStart && journeyProgress < leftCopyFadeEnd;
      const isLeftCopyHidden = layoutReady && journeyProgress >= leftCopyFadeEnd;

      this.targetTranslate = translate;
      this.lastJourneyProgress = journeyProgress;
      if (this.useNativeHorizontalScroll) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = 0;
        this.currentTranslate = this.targetTranslate;
        this.translateDifference = 0;
        this.applyPanoramaPosition(this.currentTranslate);
      } else if (window.innerWidth < 750 && !immediate) {
        this.startSmoothRender();
      } else {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = 0;
        this.currentTranslate = this.targetTranslate;
        this.translateDifference = 0;
        this.applyPanoramaPosition(this.currentTranslate);
      }
      this.root.style.setProperty('--c26-progress', journeyProgress.toFixed(4));
      this.root.style.setProperty('--c26-left-copy-opacity', leftCopyOpacity.toFixed(3));
      this.root.style.setProperty('--c26-finale-opacity', finaleProgress.toFixed(3));
      this.root.style.setProperty('--c26-character-opacity', characterOpacity.toFixed(3));
      this.root.classList.toggle('has-progress', journeyProgress > 0.12);
      this.root.classList.toggle('is-left-copy-fading', isLeftCopyFading);
      this.root.classList.toggle('is-left-copy-hidden', isLeftCopyHidden);
      this.root.classList.toggle('is-left-copy-ready', layoutReady);
      this.root.classList.toggle('is-finale-visible', isFinaleVisible);

      if (this.leftCopy) {
        this.leftCopy.setAttribute('aria-hidden', isLeftCopyHidden ? 'true' : 'false');
      }
      if (this.finale) {
        this.finale.setAttribute('aria-hidden', isFinaleVisible ? 'false' : 'true');
      }

      this.renderDebug();

      this.updateScrollActiveCharacter(journeyProgress, !isFinaleVisible);

      if (window.innerWidth >= 750) {
        this.characters.forEach((character) => {
          const depth = Number(character.style.getPropertyValue('--c26-character-depth') || 0);
          const offset = (panoramaProgress - 0.5) * depth * 2;
          character.style.setProperty('--c26-depth-offset', `${offset.toFixed(2)}px`);
        });
      }
    }

    startSmoothRender() {
      if (this.animationFrame) return;
      this.animationFrame = requestAnimationFrame(() => this.renderSmoothScroll());
    }

    renderSmoothScroll() {
      if (this.destroyed || this.motionQuery.matches) {
        this.animationFrame = 0;
        return;
      }

      this.translateDifference = this.targetTranslate - this.currentTranslate;

      if (Math.abs(this.translateDifference) <= 0.1) {
        this.currentTranslate = this.targetTranslate;
        this.translateDifference = 0;
        this.applyPanoramaPosition(this.currentTranslate);
        this.animationFrame = 0;
        this.renderDebug();
        return;
      }

      this.currentTranslate += this.translateDifference * 0.16;
      this.applyPanoramaPosition(this.currentTranslate);
      this.renderDebug();
      this.animationFrame = requestAnimationFrame(() => this.renderSmoothScroll());
    }

    renderDebug() {
      if (!this.debugElement) return;
      const panoramaImage = this.world.querySelector('.c26-hero__background-image');
      this.debugElement.value = [
        `scrollY ${Math.round(window.scrollY)}`,
        `progress ${this.lastJourneyProgress.toFixed(3)}`,
        `target ${this.targetTranslate.toFixed(2)}`,
        `current ${this.currentTranslate.toFixed(2)}`,
        `difference ${this.translateDifference.toFixed(2)}`,
        `viewport width ${this.viewport.clientWidth}`,
        `stable height ${this.stableViewportHeight}`,
        `world width ${this.world.scrollWidth}`,
        `source ${this.mobilePanoramaSourceWidth}×${this.mobilePanoramaSourceHeight}`,
        `decoded ${panoramaImage?.naturalWidth || 0}×${panoramaImage?.naturalHeight || 0}`,
        `DPR ${window.devicePixelRatio || 1}`,
        `render mode ${this.useNativeHorizontalScroll ? 'ios-native-swipe' : 'transform'}`,
        `RAF running ${this.animationFrame !== 0}`,
        `controllers ${instances.size} · ScrollTriggers 0`,
      ].join('\n');
    }

    updateScrollActiveCharacter(progress, enabled) {
      if (!enabled || !this.characters.length) {
        this.setScrollActiveCharacter(null);
        return;
      }

      const lastIndex = this.characters.length - 1;
      const activeIndex = Math.min(lastIndex, Math.max(0, Math.round(progress * lastIndex)));
      this.setScrollActiveCharacter(this.characters[activeIndex]?.dataset.characterId || null);
    }

    setScrollActiveCharacter(characterId) {
      if (this.scrollActiveCharacterId === characterId) return;
      this.scrollActiveCharacterId = characterId;

      for (const character of this.characters) {
        const isActive = Boolean(characterId) && character.dataset.characterId === characterId;
        character.classList.toggle('is-scroll-active', isActive);
        character.querySelector('[data-c26-character-trigger]')?.toggleAttribute('data-scroll-active', isActive);
      }
    }

    onMotionChange() {
      this.setMotionMode();
    }

    onCharacterSelect(event) {
      const trigger = event.currentTarget;
      const character = trigger.closest('[data-c26-character]');
      if (!character) return;

      if (this.drawer) {
        event.preventDefault();
        this.openStoryDrawer(character.dataset.characterId, trigger);
        return;
      }

      this.root.dispatchEvent(
        new CustomEvent('christmas:character-select', {
          bubbles: true,
          detail: {
            sectionId: this.sectionId,
            blockId: character.dataset.characterId,
            name: character.dataset.characterName,
          },
        })
      );
    }

    rememberDrawerPlacement() {
      if (!this.drawer || this.drawerPlacement) return;
      this.drawerPlacement = {
        parent: this.drawer.parentElement,
        nextSibling: this.drawer.nextElementSibling,
      };
    }

    portalDrawerToBody() {
      if (!this.drawer) return;
      this.rememberDrawerPlacement();
      if (this.drawer.parentElement !== document.body) {
        document.body.appendChild(this.drawer);
      }
    }

    restoreDrawerPlacement() {
      if (!this.drawer || !this.drawerPlacement?.parent) return;
      const { parent, nextSibling } = this.drawerPlacement;
      if (this.drawer.parentElement === parent) return;
      if (nextSibling && nextSibling.parentElement === parent) {
        parent.insertBefore(this.drawer, nextSibling);
      } else {
        parent.appendChild(this.drawer);
      }
    }

    lockStoryScroll() {
      document.documentElement.classList.add('c26-story-drawer-open');
      document.addEventListener('keydown', this.onDrawerKeydown);
    }

    unlockStoryScroll() {
      document.documentElement.classList.remove('c26-story-drawer-open');
      document.removeEventListener('keydown', this.onDrawerKeydown);
    }

    openStoryDrawer(characterId, trigger, options = {}) {
      if (!this.drawer || !characterId) return;

      this.portalDrawerToBody();

      const stories = [...this.drawer.querySelectorAll('[data-c26-story-panel]')];
      const activeStory = stories.find((story) => story.dataset.c26StoryPanel === characterId);
      if (!activeStory) return;
      const spotlights = [...this.drawer.querySelectorAll('[data-c26-spotlight]')];

      window.clearTimeout(this.drawerCloseTimer);
      stories.forEach((story) => {
        story.hidden = story !== activeStory;
      });
      spotlights.forEach((spotlight) => {
        spotlight.hidden = spotlight.dataset.c26Spotlight !== characterId;
      });

      if (!options.fromFooterNav) {
        this.lastDrawerTrigger = trigger;
      }
      this.activeStoryId = characterId;
      this.setCharacterExpanded(characterId);
      this.updateDrawerFooter(characterId);
      this.drawer.hidden = false;
      this.drawer.setAttribute('aria-hidden', 'false');
      this.lockStoryScroll();

      requestAnimationFrame(() => {
        this.drawer.classList.add('is-open');
        this.drawer.querySelector('.c26-story-drawer__content')?.scrollTo({ top: 0 });
        if (options.focusElement instanceof HTMLElement) {
          options.focusElement.focus();
        } else if (!options.fromFooterNav) {
          this.drawer.querySelector('[data-c26-drawer-close]')?.focus();
        }
      });
    }

    onDrawerClose() {
      if (!this.drawer || this.drawer.hidden) return;

      this.drawer.classList.remove('is-open');
      this.unlockStoryScroll();
      this.setCharacterExpanded(null);

      const finish = () => {
        this.drawer.hidden = true;
        this.drawer.setAttribute('aria-hidden', 'true');
        this.restoreDrawerPlacement();
        this.lastDrawerTrigger?.focus();
        this.lastDrawerTrigger = null;
        this.activeStoryId = null;
      };

      if (this.motionQuery.matches) {
        finish();
        return;
      }

      this.drawerCloseTimer = window.setTimeout(finish, 320);
    }

    onDrawerKeydown(event) {
      if (!this.drawer || this.drawer.hidden) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        this.onDrawerClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = [...this.drawer.querySelectorAll(FOCUSABLE)].filter((el) => {
        if (el.disabled || el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
        if (el.closest('[hidden]')) return false;
        return true;
      });
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    updateDrawerFooter(characterId) {
      if (!this.characterOrder.length) return;

      const activeIndex = this.characterOrder.findIndex((entry) => entry.id === characterId);
      if (activeIndex < 0) return;

      const total = this.characterOrder.length;
      const prevEntry = total > 1
        ? this.characterOrder[(activeIndex - 1 + total) % total]
        : null;
      const nextEntry = total > 1
        ? this.characterOrder[(activeIndex + 1) % total]
        : null;

      if (this.drawerChapter) {
        this.drawerChapter.textContent = `${this.drawerChapterPrefix} ${activeIndex + 1} of ${total}`;
        this.drawerChapter.hidden = false;
      }

      if (this.drawerPrevButton && this.drawerPrevLabel) {
        if (prevEntry) {
          this.drawerPrevButton.hidden = false;
          this.drawerPrevLabel.textContent = prevEntry.name;
          this.drawerPrevButton.setAttribute('aria-label', `Previous character: ${prevEntry.name}`);
        } else {
          this.drawerPrevButton.hidden = true;
          this.drawerPrevLabel.textContent = '';
          this.drawerPrevButton.removeAttribute('aria-label');
        }
      }

      if (this.drawerNextButton && this.drawerNextLabel) {
        if (nextEntry) {
          this.drawerNextButton.hidden = false;
          this.drawerNextLabel.textContent = nextEntry.name;
          this.drawerNextButton.setAttribute('aria-label', `Next character: ${nextEntry.name}`);
        } else {
          this.drawerNextButton.hidden = true;
          this.drawerNextLabel.textContent = '';
          this.drawerNextButton.removeAttribute('aria-label');
        }
      }
    }

    setCharacterExpanded(characterId) {
      for (const trigger of this.characterTriggers) {
        const character = trigger.closest('[data-c26-character]');
        const isActive = Boolean(characterId) && character?.dataset.characterId === characterId;
        trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      }
    }

    onDrawerPrev() {
      if (!this.activeStoryId) return;
      const activeIndex = this.characterOrder.findIndex((entry) => entry.id === this.activeStoryId);
      const total = this.characterOrder.length;
      const prevEntry = activeIndex >= 0 && total > 1
        ? this.characterOrder[(activeIndex - 1 + total) % total]
        : null;
      if (!prevEntry) return;
      const character = this.characters.find((entry) => entry.dataset.characterId === prevEntry.id);
      const focusTarget = character?.querySelector('[data-c26-character-trigger]');
      this.openStoryDrawer(prevEntry.id, focusTarget, { fromFooterNav: true });
    }

    onDrawerNext() {
      if (!this.activeStoryId) return;
      const activeIndex = this.characterOrder.findIndex((entry) => entry.id === this.activeStoryId);
      const total = this.characterOrder.length;
      const nextEntry = activeIndex >= 0 && total > 1
        ? this.characterOrder[(activeIndex + 1) % total]
        : null;
      if (!nextEntry) return;
      const character = this.characters.find((entry) => entry.dataset.characterId === nextEntry.id);
      const focusTarget = character?.querySelector('[data-c26-character-trigger]');
      this.openStoryDrawer(nextEntry.id, focusTarget, { fromFooterNav: true });
    }

    async onQuickAddSubmit(event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches('[data-c26-quick-add]')) return;
      if (!this.drawer?.contains(form)) return;

      event.preventDefault();
      event.stopPropagation();

      const submitButton = form.querySelector('button[type="submit"]');
      const variantId = form.querySelector('input[name="id"]')?.value;
      if (!variantId) return;

      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;

      try {
        const cartAddUrl = window.Theme?.routes?.cart_add_url || '/cart/add.js';
        const cartUrl = `${window.Theme?.routes?.cart_url || '/cart'}.js`;
        const response = await fetch(cartAddUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
        });

        const payload = await response.json();
        if (!response.ok || payload.status) {
          throw new Error(payload.description || payload.message || 'Unable to add this product to cart.');
        }

        let cart = null;
        try {
          const cartResponse = await fetch(cartUrl, { headers: { Accept: 'application/json' } });
          if (cartResponse.ok) cart = await cartResponse.json();
        } catch {
          cart = null;
        }

        document.dispatchEvent(
          new CustomEvent('cart:update', {
            bubbles: true,
            detail: {
              resource: cart || payload,
              sourceId: this.sectionId,
              data: {
                source: 'christmas-2026-hero',
                variantId,
                itemCount: cart?.item_count || 1,
              },
            },
          })
        );

        if (submitButton instanceof HTMLButtonElement) {
          submitButton.dataset.added = 'true';
          window.setTimeout(() => {
            submitButton.removeAttribute('data-added');
          }, 900);
        }
      } catch (error) {
        console.error('Christmas hero quick add:', error);
      } finally {
        if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
      }
    }

    onThemeBlockSelect(event) {
      const character = event.target.closest?.('[data-c26-character]');
      if (!character || !this.root.contains(character) || this.motionQuery.matches) return;

      this.refresh();
      const characterCenter = character.offsetLeft + character.offsetWidth / 2;
      const targetTranslate = clamp(
        characterCenter - this.viewport.clientWidth / 2,
        0,
        this.maxTranslate
      );
      const progress = this.maxTranslate ? targetTranslate / this.maxTranslate : 0;

      if (this.useNativeHorizontalScroll) {
        this.viewport.scrollTo({ left: targetTranslate, behavior: 'smooth' });
        return;
      }

      window.scrollTo({
        top: this.sectionTop + progress * this.horizontalTravelDistance,
        behavior: 'smooth',
      });
    }

    destroy() {
      this.destroyed = true;
      cancelAnimationFrame(this.frame);
      cancelAnimationFrame(this.animationFrame);
      cancelAnimationFrame(this.resizeFrame);
      window.clearTimeout(this.resizeTimer);
      window.clearTimeout(this.drawerCloseTimer);
      this.unlockStoryScroll();
      this.restoreDrawerPlacement();
      this.disconnectIOSSwipeGate();
      window.removeEventListener('scroll', this.onScroll);
      this.viewport.removeEventListener('scroll', this.onNativeHorizontalScroll);
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('shopify:block:select', this.onThemeBlockSelect);
      this.motionQuery.removeEventListener('change', this.onMotionChange);
      this.characterTriggers.forEach((trigger) => {
        trigger.removeEventListener('click', this.onCharacterSelect);
      });
      this.drawerCloseButtons.forEach((button) => {
        button.removeEventListener('click', this.onDrawerClose);
      });
      this.drawerPrevButton?.removeEventListener('click', this.onDrawerPrev);
      this.drawerNextButton?.removeEventListener('click', this.onDrawerNext);
      this.drawer?.removeEventListener('submit', this.onQuickAddSubmit);
      this.iosSkipButton?.removeEventListener('click', this.onIOSSkip);
      this.debugElement?.remove();
      this.setCharacterExpanded(null);
      this.setScrollActiveCharacter(null);
      this.root.classList.remove(
        'is-enhanced',
        'is-reduced-motion',
        'has-progress',
        'is-left-copy-hidden',
        'is-left-copy-fading',
        'is-finale-visible'
      );
      this.applyPanoramaPosition(0);
      this.root.classList.remove('is-ios-swipe-mode', 'is-swipe-gate-active', 'is-swipe-complete');
    }
  }

  function mount(root) {
    if (!root || instances.has(root)) return;
    instances.set(root, new ChristmasHero(root));
  }

  function unmount(root) {
    const instance = instances.get(root);
    if (!instance) return;
    instance.destroy();
    instances.delete(root);
  }

  function boot(scope = document) {
    scope.querySelectorAll('[data-christmas-hero]').forEach(mount);
  }

  document.addEventListener('shopify:section:load', (event) => boot(event.target));
  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll('[data-christmas-hero]').forEach(unmount);
  });

  window[GLOBAL_KEY] = { boot, mount, unmount };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
  } else {
    boot();
  }
})();
