/**
 * @class BackgroundVideo
 * Custom element that manages autoplay background video with optional play/pause controls.
 * Supports YouTube, Vimeo (via iframe postMessage), and Shopify-hosted video.
 */
if (!customElements.get('background-video')) {
  class BackgroundVideo extends HTMLElement {
    constructor() {
      super();

      this.paused = false;
      this.toggle = this.querySelector('.background-video__controls button');
    }

    connectedCallback() {
      this.video_container = this.querySelector('.background-video__iframe');

      if (this.video_container && this.video_container.querySelector('iframe')) {
        this.video_container.querySelector('iframe').addEventListener('load', () => {
          this._playVideo();
        });
      }

      if (this.toggle) {
        this.toggle.addEventListener('click', this._onToggleClick.bind(this));
      }
    }

    _onToggleClick() {
      if (this.paused) {
        this._playVideo();
        this.toggle.classList.remove('paused');
      } else {
        this._pauseVideo();
        this.toggle.classList.add('paused');
      }
    }

    _playVideo() {
      setTimeout(() => {
        const provider = this.video_container && this.video_container.dataset.provider;
        if (provider === 'youtube') {
          this.video_container.querySelector('iframe').contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
            '*'
          );
        } else if (provider === 'vimeo') {
          this.video_container.querySelector('iframe').contentWindow.postMessage(
            JSON.stringify({ method: 'play' }),
            '*'
          );
        } else if (provider === 'hosted') {
          const vid = this.video_container.querySelector('video');
          if (vid) vid.play();
        }
        this.paused = false;
      }, 10);
    }

    _pauseVideo() {
      setTimeout(() => {
        const provider = this.video_container && this.video_container.dataset.provider;
        if (provider === 'youtube') {
          this.video_container.querySelector('iframe').contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
            '*'
          );
        } else if (provider === 'vimeo') {
          this.video_container.querySelector('iframe').contentWindow.postMessage(
            JSON.stringify({ method: 'pause' }),
            '*'
          );
        } else if (provider === 'hosted') {
          const vid = this.video_container.querySelector('video');
          if (vid) vid.pause();
        }
        this.paused = true;
      }, 10);
    }
  }

  customElements.define('background-video', BackgroundVideo);
}
