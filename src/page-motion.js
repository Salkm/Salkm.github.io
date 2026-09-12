export function createPageMotion({ reducedMotion = false } = {}) {
  const targets = document.querySelectorAll([
    '.services-title', '.services-intro', '.service-card', '.impact-head', '.skills-head', '.career-band .wrap',
    '.impact-grid > div', '.work-section .section-top', '.section-heading-row',
    '.project-filters', '.project', '.github-link', '.portrait-column', '.about-copy',
    '.expertise-block .section-top', '.stack-cloud', '.experience-intro',
    '.experience-item', '.credentials', '.contact-section .section-top',
    '#contact-heading', '.contact-bottom', '.contact-links', 'footer',
  ].join(','));
  const pending = new Map();
  const running = new Set();
  let paused = false;
  const reveal = (element, delay = 0) => {
    const animation = pending.get(element);
    if (!animation) return;
    pending.delete(element);
    observer.unobserve(element);
    element.dataset.revealed = 'true';
    if (reducedMotion || paused) {
      animation.finish();
      animation.cancel();
    }
    else {
      animation.effect.updateTiming({ delay });
      running.add(animation);
      animation.finished.then(() => {
        running.delete(animation);
        animation.cancel();
      });
      animation.play();
    }
  };
  const observer = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
      reveal(entry.target, index * 70);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  if (!reducedMotion) targets.forEach(element => {
    const animation = element.animate([
      { opacity: 0, transform: 'translateY(22px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 550, easing: 'cubic-bezier(.215,.61,.355,1)', fill: 'both' });
    animation.pause();
    pending.set(element, animation);
    observer.observe(element);
  });
  const onFocus = event => {
    for (const element of pending.keys()) {
      if (element.contains(event.target)) reveal(element);
    }
  };
  document.addEventListener('focusin', onFocus);
  const finishAll = () => {
    for (const element of pending.keys()) reveal(element);
    for (const animation of running) animation.finish();
  };
  return {
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      if (reducedMotion) finishAll();
    },
    setPaused(value) {
      paused = Boolean(value);
      if (paused) finishAll();
    },
    dispose() {
      paused = true;
      finishAll();
      observer.disconnect();
      document.removeEventListener('focusin', onFocus);
    },
  };
}
