/**
 * @class ModalDialog
 * Custom element for modal/lightbox dialogs. Supports popup delay, age verification,
 * Shopify design mode section select/deselect events, and video pause on close.
 */
if (!customElements.get('modal-dialog')) {
  class ModalDialog extends HTMLElement {
    constructor() {
      super();

      this.age_verification = this.classList.contains('age-verification-modal');
      this.dialogId = this.getAttribute('id');
      this.delay = parseInt(this.dataset.delay, 10) * 1000;
      this.popup = this.dataset.popup;
      this.section_id = this.dataset.sectionId;
      this.disabled = this.getAttribute('disabled') != null;
      this.button = this.querySelector('[id^="ModalClose-"]');

      if (this.button) {
        this.button.addEventListener('click', this.hide.bind(this));
      }

      if (!this.disabled) {
        this.addEventListener('keyup', (event) => {
          if (event.code.toUpperCase() === 'ESCAPE') {
            this.hide();
          }
        });
        this.addEventListener('click', (event) => {
          if (event.target.nodeName === 'MODAL-DIALOG') this.hide();
        });
      }

      if (this.delay && this.delay > 0) {
        if (!this._getCookie()) {
          setTimeout(() => {
            this.show();
            if (this.button) {
              this.button.addEventListener('click', this._setCookie.bind(this));
            }
          }, this.delay);
        }
      }

      if (this.age_verification) {
        if (!this._getCookie()) {
          this.show();
        }
        if (this.button) {
          this.button.addEventListener('click', this._setCookie.bind(this));
        }
      }

      if (Shopify.designMode) {
        this.moved = true;
        this.onSectionSelectBound = (event) => {
          if (event.detail.sectionId === this.section_id) this.show();
        };
        this.onSectionDeselectBound = (event) => {
          if (event.detail.sectionId === this.section_id) this.hide();
        };
        document.addEventListener('shopify:section:select', this.onSectionSelectBound);
        document.addEventListener('shopify:section:deselect', this.onSectionDeselectBound);
      }
    }

    disconnectedCallback() {
      if (this.onSectionSelectBound) {
        document.removeEventListener('shopify:section:select', this.onSectionSelectBound);
      }
      if (this.onSectionDeselectBound) {
        document.removeEventListener('shopify:section:deselect', this.onSectionDeselectBound);
      }
    }

    connectedCallback() {
      if (this.moved) return;
      this.moved = true;
      document.body.appendChild(this);
    }

    show(opener) {
      this.openedBy = opener;
      document.body.classList.add('overflow-hidden');
      this.setAttribute('open', '');

      setTimeout(() => {
        const dialog = this.querySelector('[role="dialog"]');
        if (dialog) dialog.focus();
      }, 100);
    }

    hide() {
      document.body.classList.remove('overflow-hidden');
      this.removeAttribute('open');

      this.querySelectorAll('.js-youtube').forEach((iframe) => {
        iframe.contentWindow.postMessage(
          '{"event":"command","func":"pauseVideo","args":""}',
          '*'
        );
      });
      this.querySelectorAll('.js-vimeo').forEach((iframe) => {
        iframe.contentWindow.postMessage('{"method":"pause"}', '*');
      });
      this.querySelectorAll('video').forEach((video) => video.pause());
    }

    _getCookie() {
      return window.localStorage.getItem(this.dialogId);
    }

    _setCookie() {
      window.localStorage.setItem(this.dialogId, JSON.stringify(new Date()));
    }
  }

  customElements.define('modal-dialog', ModalDialog);
}

if (!customElements.get('modal-opener')) {
  class ModalOpener extends HTMLElement {
    constructor() {
      super();

      const button = this.querySelector('button');
      if (!button) return;

      button.addEventListener('click', () => {
        const modal = document.querySelector(this.getAttribute('data-modal'));
        if (modal) modal.show(button);
      });
    }
  }

  customElements.define('modal-opener', ModalOpener);
}
