const HERO_VIDEO_SELECTOR = '[data-hero-background-video]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function scheduleAfterInitialRender(callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(callback, { timeout: 1200 });
        return;
      }

      setTimeout(callback, 250);
    });
  });
}

/**
 * @param {HTMLVideoElement} video
 */
function hydrateVideo(video) {
  if (video.dataset.heroVideoHydrated === 'true') return;

  video.dataset.heroVideoHydrated = 'true';

  for (const source of video.querySelectorAll('source[data-src]')) {
    source.src = source.dataset.src || '';
    source.removeAttribute('data-src');
  }

  video.preload = 'metadata';
  video.load();
}

/**
 * @param {HTMLVideoElement} video
 */
function revealVideo(video) {
  const wrapper = video.closest('.hero__media-wrapper');
  if (!wrapper) return;

  if (wrapper.dataset.heroVideoCovered === 'true') return;
  wrapper.setAttribute('data-hero-video-covered', 'true');
}

/**
 * @param {HTMLVideoElement} video
 * @returns {HTMLCanvasElement | null}
 */
function getCanvas(video) {
  const wrapper = video.closest('.hero__media-wrapper');
  if (!wrapper) return null;

  const canvas = wrapper.querySelector('[data-hero-background-canvas]');
  return canvas instanceof HTMLCanvasElement ? canvas : null;
}

/**
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement} canvas
 */
function syncCanvasSize(video, canvas) {
  const wrapper = video.closest('.hero__media-wrapper');
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.round(rect.width * pixelRatio);
  const nextHeight = Math.round(rect.height * pixelRatio);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
}

/**
 * Draw the hidden video into a visible canvas using object-fit: cover semantics.
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement} canvas
 */
function drawVideoFrame(video, canvas) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;

  syncCanvasSize(video, canvas);

  const context = canvas.getContext('2d');
  if (!context || !canvas.width || !canvas.height || !video.videoWidth || !video.videoHeight) {
    return false;
  }

  const canvasRatio = canvas.width / canvas.height;
  const videoRatio = video.videoWidth / video.videoHeight;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = video.videoWidth;
  let sourceHeight = video.videoHeight;

  if (videoRatio > canvasRatio) {
    sourceWidth = video.videoHeight * canvasRatio;
    sourceX = (video.videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = video.videoWidth / canvasRatio;
    sourceY = (video.videoHeight - sourceHeight) / 2;
  }

  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return true;
}

/**
 * Keep the poster visible until we have definitely painted a video frame.
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement} canvas
 */
function revealVideoWhenPainted(video, canvas) {
  if (video.dataset.heroVideoRevealed === 'true') return;

  const commitReveal = () => {
    if (video.dataset.heroVideoRevealed === 'true') return;

    if (!drawVideoFrame(video, canvas)) {
      return;
    }

    requestAnimationFrame(() => {
      video.dataset.heroVideoRevealed = 'true';
      revealVideo(video);
    });
  };

  if ('requestVideoFrameCallback' in video) {
    video.requestVideoFrameCallback(() => {
      commitReveal();
    });
    return;
  }

  requestAnimationFrame(() => {
    commitReveal();
  });
}

/**
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement} canvas
 */
function startCanvasPlayback(video, canvas) {
  if (video.dataset.heroCanvasPlaybackStarted === 'true') return;
  video.dataset.heroCanvasPlaybackStarted = 'true';

  const renderFrame = () => {
    if (!video.isConnected || !canvas.isConnected) return;

    drawVideoFrame(video, canvas);

    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(() => renderFrame());
      return;
    }

    requestAnimationFrame(renderFrame);
  };

  renderFrame();
}

/**
 * @param {HTMLVideoElement} video
 */
function prepareVideo(video) {
  if (video.dataset.heroVideoPrepared === 'true') return;

  video.dataset.heroVideoPrepared = 'true';

  const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);

  if (reduceMotion.matches) {
    return;
  }

  const canvas = getCanvas(video);
  if (!canvas) return;

  const handleReady = () => {
    drawVideoFrame(video, canvas);
    startCanvasPlayback(video, canvas);
    revealVideoWhenPainted(video, canvas);
  };

  video.addEventListener('loadeddata', handleReady, { once: true });
  video.addEventListener('canplay', handleReady, { once: true });
  window.addEventListener('resize', () => drawVideoFrame(video, canvas), { passive: true });

  scheduleAfterInitialRender(() => {
    hydrateVideo(video);

    if (video.dataset.heroVideoAutoplay === 'false') {
      return;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  });
}

function initHeroBackgroundVideos() {
  for (const video of document.querySelectorAll(HERO_VIDEO_SELECTOR)) {
    if (video instanceof HTMLVideoElement) {
      prepareVideo(video);
    }
  }
}

initHeroBackgroundVideos();

document.addEventListener('shopify:section:load', initHeroBackgroundVideos);
