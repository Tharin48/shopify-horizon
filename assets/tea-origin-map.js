(function () {
  'use strict';

  var SEL = {
    section: '.tea-origin-map',
    wrap: '[data-tea-origin-read-more]',
    button: '.tea-origin-map__read-more',
  };

  var MQ_STACK = '(max-width: 989px)';

  /** @type {WeakSet<HTMLElement>} */
  var bound = new WeakSet();

  /**
   * @param {HTMLElement} wrap
   */
  function bindWrap(wrap) {
    if (bound.has(wrap)) return;
    bound.add(wrap);

    var btn = wrap.querySelector(SEL.button);
    if (!(btn instanceof HTMLButtonElement)) return;

    function setExpanded(expanded) {
      wrap.classList.toggle('is-expanded', expanded);
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      var less = btn.getAttribute('data-label-less');
      var more = btn.getAttribute('data-label-more');
      if (less && more) {
        btn.textContent = expanded ? less : more;
      }
    }

    function applyMq() {
      if (window.matchMedia(MQ_STACK).matches) {
        setExpanded(false);
      } else {
        setExpanded(true);
      }
    }

    btn.addEventListener('click', function () {
      setExpanded(!wrap.classList.contains('is-expanded'));
    });

    applyMq();
    window.matchMedia(MQ_STACK).addEventListener('change', applyMq);
  }

  /**
   * @param {ParentNode} root
   */
  function init(root) {
    var scope = root instanceof Element ? root : document.body;
    /** @type {Element[]} */
    var sections = [];

    if (scope instanceof Element && scope.matches(SEL.section)) {
      sections.push(scope);
    } else {
      sections = Array.prototype.slice.call(scope.querySelectorAll(SEL.section));
    }

    for (var s = 0; s < sections.length; s++) {
      var sec = sections[s];
      var wraps = sec.querySelectorAll(SEL.wrap);
      for (var i = 0; i < wraps.length; i++) {
        var w = wraps[i];
        if (w instanceof HTMLElement) {
          bindWrap(w);
        }
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    init(document);
  });

  document.addEventListener('shopify:section:load', function (event) {
    var t = event.target;
    if (t instanceof Element) {
      init(t);
    }
  });
})();
