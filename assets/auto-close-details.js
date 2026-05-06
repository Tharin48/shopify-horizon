(function autoCloseDetails() {
  const openDetails = new Set();

  function syncOpenDetails(element) {
    if (!(element instanceof HTMLDetailsElement)) return;
    if (!element.hasAttribute('data-auto-close-details')) return;

    if (element.hasAttribute('open')) {
      openDetails.add(element);
    } else {
      openDetails.delete(element);
    }
  }

  document.querySelectorAll('details[data-auto-close-details][open]').forEach((element) => {
    syncOpenDetails(element);
  });

  document.addEventListener(
    'toggle',
    function (event) {
      syncOpenDetails(event.target);
    },
    true
  );

  document.addEventListener('click', function (event) {
    if (!openDetails.size) return;

    const closingOn = window.innerWidth < 750 ? 'mobile' : 'desktop';
    const eventTarget = event.target instanceof Node ? event.target : null;
    const detailsToClose = [];

    openDetails.forEach((element) => {
      if (!document.contains(element)) {
        openDetails.delete(element);
        return;
      }

      if (!element.getAttribute('data-auto-close-details')?.includes(closingOn)) {
        return;
      }

      if (eventTarget && element.contains(eventTarget)) {
        return;
      }

      detailsToClose.push(element);
    });

    for (const detailsElement of detailsToClose) {
      detailsElement.removeAttribute('open');
      openDetails.delete(detailsElement);
    }
  });
})();
