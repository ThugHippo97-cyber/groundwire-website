import "./style.css";

// Page transitions
// Enter: body starts at opacity:0 via inline <head> style; JS reveals it after
// first paint. Skip on first-visit intro — the overlay is covering the body anyway
// and the laptop animation handles the reveal.
if (document.documentElement.classList.contains('laptop-pre-intro')) {
  document.body.style.opacity = '1';
  document.body.style.transform = 'none';
} else {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.style.opacity = '1';
      document.body.style.transform = 'translateY(0)';
    });
  });
}

// Exit: intercept internal nav clicks, fade out, then navigate.
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[href]");
  if (!link) return;
  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http") || link.target === "_blank") return;
  e.preventDefault();
  document.body.classList.add("page-transition-out");
  setTimeout(() => { window.location.href = href; }, 230);
});

// Mobile nav toggle
const navToggle = document.getElementById("nav-toggle");
const mobileNav = document.getElementById("mobile-nav");
const iconBurger = document.getElementById("icon-burger");
const iconClose = document.getElementById("icon-close");

navToggle?.addEventListener("click", () => {
  const isOpen = mobileNav.classList.contains("hidden") === false;
  mobileNav.classList.toggle("hidden");
  iconBurger.classList.toggle("hidden");
  iconClose.classList.toggle("hidden");
  navToggle.setAttribute("aria-expanded", String(!isOpen));
});

mobileNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileNav.classList.add("hidden");
    iconBurger.classList.remove("hidden");
    iconClose.classList.add("hidden");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

// Scroll-reveal animations
const revealEls = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
);

revealEls.forEach((el) => observer.observe(el));

// Footer year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// Generic carousel engine: rotates a set of absolutely-positioned panels
// in lockstep with a row of indicator dots. Used by the hero showcase and
// by each "Recent Projects" card.
function createCarousel({
  panels,
  dots,
  activeDotClasses,
  inactiveDotClasses,
  interval,
  onShow,
  prevButton,
  nextButton,
  pauseOnHoverEl,
}) {
  if (panels.length === 0) return;

  let index = panels.findIndex((panel) => panel.classList.contains("opacity-100"));
  if (index === -1) index = 0;
  let timer;

  function show(nextIndex) {
    index = nextIndex;
    panels.forEach((panel, i) => {
      panel.classList.toggle("opacity-100", i === index);
      panel.classList.toggle("opacity-0", i !== index);
    });
    dots.forEach((dot, i) => {
      const active = i === index;
      activeDotClasses.forEach((cls) => dot.classList.toggle(cls, active));
      inactiveDotClasses.forEach((cls) => dot.classList.toggle(cls, !active));
    });
    onShow?.(panels[index]);
  }

  function startRotation() {
    timer = window.setInterval(() => show((index + 1) % panels.length), interval);
  }

  function goTo(nextIndex) {
    window.clearInterval(timer);
    show(nextIndex);
    startRotation();
  }

  show(index);
  startRotation();

  dots.forEach((dot) => {
    dot.addEventListener("click", () => goTo(Number(dot.dataset.index)));
  });

  prevButton?.addEventListener("click", () => goTo((index - 1 + panels.length) % panels.length));
  nextButton?.addEventListener("click", () => goTo((index + 1) % panels.length));

  if (pauseOnHoverEl) {
    pauseOnHoverEl.addEventListener("mouseenter", () => window.clearInterval(timer));
    pauseOnHoverEl.addEventListener("mouseleave", () => startRotation());
  }
}

// Hero rotating site showcase
const heroScreen = document.getElementById("hero-screen");
const heroCaption = document.getElementById("hero-caption");

createCarousel({
  panels: heroScreen ? Array.from(heroScreen.querySelectorAll(".hero-panel")) : [],
  dots: Array.from(document.querySelectorAll(".hero-dot")),
  activeDotClasses: ["bg-primary", "w-6"],
  inactiveDotClasses: ["bg-white/20", "w-2"],
  interval: 3500,
  // Bound to the static outer showcase wrapper, not the carousel screen
  // itself — the screen div gets a fresh CSS matrix3d transform every
  // frame once the 3D laptop tilts, so its hit-region shifts continuously
  // and would otherwise fire spurious mouseenter/mouseleave, thrashing
  // the timer.
  pauseOnHoverEl: document.getElementById("hero-showcase"),
  onShow: (panel) => {
    if (heroCaption) heroCaption.textContent = `${panel.dataset.name} — ${panel.dataset.tag}`;
  },
});

// Hero laptop — tries the interactive 3D model first (Three.js + a real
// GLB + CSS3DRenderer for the screen carousel); falls back to the drawn
// SVG chassis (with its own simple CSS tilt) if WebGL or the model load
// fails for any reason.
const laptop3dStage = document.getElementById("laptop-3d-stage");
const laptopFallback = document.getElementById("laptop-fallback");
const laptopCanvas = document.getElementById("laptop-canvas");
const laptopCss3dRoot = document.getElementById("laptop-css3d-root");
const laptopLoading = document.getElementById("laptop-loading");

function enableFallbackLaptop() {
  laptop3dStage?.classList.add("hidden");
  laptopFallback?.classList.remove("hidden");

  const laptopStage = document.getElementById("laptop-stage");
  const laptopRig = document.getElementById("laptop-rig");
  if (!laptopStage || !laptopRig) return;

  laptopStage.addEventListener("mousemove", (event) => {
    const rect = laptopStage.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    laptopRig.style.setProperty("--laptop-rx", `${-py * 6}deg`);
    laptopRig.style.setProperty("--laptop-ry", `${px * 8}deg`);
  });

  laptopStage.addEventListener("mouseleave", () => {
    laptopRig.style.setProperty("--laptop-rx", "0deg");
    laptopRig.style.setProperty("--laptop-ry", "0deg");
  });
}

// Only run the Three.js / CSS3DRenderer laptop on large, mouse-driven screens.
// On touch devices the mouse-tilt has no payoff, the 628KB Three.js bundle is
// wasted bandwidth, and iOS Safari mis-projects the CSS3D screen overlay so the
// carousel floats out of the laptop screen. Those devices get the lightweight,
// pixel-reliable SVG fallback (percentage-positioned screen) instead.
// iOS/iPadOS Safari is the ONLY engine with the CSS3D mis-projection bug (the
// carousel floats out of the laptop screen), so gate on exactly that — nothing
// else. Media-query gates on width/pointer proved too brittle (Windows display
// scaling makes a normal laptop report <1024px CSS width; touchscreen laptops
// misreport pointer), wrongly dropping real desktops to the fallback. Everything
// non-iOS runs the 3D path; the WebGL try/catch below covers any rare failure.
// iPadOS 13+ masquerades as "Macintosh" but reports touch points (a real Mac
// reports 0), so the second test catches it.
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const prefer3DLaptop = !isIOS;

if (prefer3DLaptop && laptop3dStage && laptopCanvas && laptopCss3dRoot && heroScreen) {
  import("./laptop3d.js")
    .then(({ initLaptop3D, supportsWebGL }) => {
      if (!supportsWebGL()) throw new Error("WebGL unavailable");
      return initLaptop3D({
        stage: laptop3dStage,
        canvas: laptopCanvas,
        css3dRoot: laptopCss3dRoot,
        screenEl: heroScreen,
        loadingEl: laptopLoading,
      });
    })
    .catch((err) => {
      console.warn("3D hero laptop unavailable, using fallback:", err);
      enableFallbackLaptop();
    });
} else {
  enableFallbackLaptop();
}

// Active nav highlighting — the site is split across pages now, so the
// active link is whichever one points at the current page, not a scroll position.
const navLinks = document.querySelectorAll(".nav-link");
const currentPage = (window.location.pathname.split("/").pop() || "index").replace(/\.html$/, "");

navLinks.forEach((link) => {
  const linkPage = link.getAttribute("href").split("/").pop().replace(/\.html$/, "");
  link.classList.toggle("is-active", linkPage === currentPage);
});

// Quote form handler — POSTs to Google Apps Script; no-cors mode required
// because Apps Script issues a redirect that fetch can't follow cross-origin.
// The promise resolves for any completed network exchange, so we treat resolve
// as success and only show an error on actual network failure.
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyG4EXE-P82Hp8QO32PJrfR02C4P4QtQOkEebMYNi97zOqg04F4guhft4PLj_fAtNcG/exec';

// Plan pre-selection: services.html "Request This Plan" / "Get Started" links pass
// ?plan=<tier>. Validate against the known tiers (so an arbitrary URL value can't
// be injected into the page), then surface it to the visitor and fold it into the
// lead's source + description so the chosen plan reaches the spreadsheet.
const KNOWN_PLANS = ['Launch Package', 'Growth System', 'Operations Platform'];
const planParam = new URLSearchParams(window.location.search).get('plan');
const selectedPlan = KNOWN_PLANS.includes(planParam) ? planParam : null;

if (selectedPlan) {
  // Banner above whichever lead form is on this page (contact form OR questionnaire).
  const planForm = document.querySelector('form[action="#"], #questionnaire-form');
  if (planForm) {
    const notice = document.createElement('div');
    notice.className = 'sm:col-span-2 mb-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-heading';
    const strong = document.createElement('strong');
    strong.className = 'text-primary';
    strong.textContent = selectedPlan;
    notice.append('You’re requesting the ', strong, ' plan — add your details below and we’ll follow up with next steps.');
    planForm.prepend(notice);
  }
  // Carry the plan along if the visitor jumps from the contact form to the
  // questionnaire, so it's still captured there.
  document.querySelectorAll('a[href^="questionnaire.html"]').forEach((a) => {
    a.setAttribute('href', `questionnaire.html?plan=${encodeURIComponent(selectedPlan)}`);
  });
}

document.querySelectorAll('form[action="#"]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    // Strip .html so this works on Cloudflare's pretty URLs (/contact) too.
    const page = (window.location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
    const source = page === 'contact' ? 'Contact Page' : 'Home Page';

    const params = new URLSearchParams(new FormData(form));
    if (selectedPlan) {
      const desc = params.get('description') || '';
      params.set('description', `Requested plan: ${selectedPlan}` + (desc ? `\n\n${desc}` : ''));
    }
    params.append('source', selectedPlan ? `${source} (${selectedPlan})` : source);

    try {
      await fetch(SCRIPT_URL, { method: 'POST', body: params, mode: 'no-cors' });

      form.innerHTML = `
        <div class="sm:col-span-2 flex flex-col items-center gap-3 py-8 text-center">
          <svg class="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-lg font-semibold text-heading">You're all set!</p>
          <p class="text-sm text-muted max-w-xs">We received your request and will be in touch within 24 hours.</p>
          <a href="questionnaire.html${selectedPlan ? `?plan=${encodeURIComponent(selectedPlan)}` : ''}" class="mt-1 text-sm font-semibold text-primary hover:underline">Want to speed things up? Tell us more in our questionnaire &rarr;</a>
        </div>`;
    } catch {
      btn.disabled = false;
      btn.textContent = originalText;

      let errEl = form.querySelector('.form-error');
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.className = 'form-error sm:col-span-2 mt-1 text-sm text-red-600 text-center';
        form.appendChild(errEl);
      }
      errEl.textContent = 'Something went wrong — please email us directly at groundwireweb@gmail.com.';
    }
  });
});

// Questionnaire form — richer client-intake form. It posts to the same Apps
// Script endpoint, but bundles its extra answers into the `description` field so
// every answer lands in the lead email + sheet without changing the backend
// schema. It carries action="#questionnaire" so the generic handler above skips it.
const questionnaireForm = document.getElementById('questionnaire-form');
if (questionnaireForm) {
  questionnaireForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = questionnaireForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const fd = new FormData(questionnaireForm);
    // Fields prefixed q_ are questionnaire detail; compose them into one
    // readable block under "description" so nothing is lost server-side.
    const detailLabels = {
      q_phone: 'Phone',
      q_website: 'Current website',
      q_about: 'About the business / customers',
      q_goals: 'Primary goals',
      q_features: 'Pages / features needed',
      q_examples: 'Sites they like',
      q_branding: 'Existing logo / brand assets',
      q_budget: 'Budget range',
      q_timeline: 'Desired timeline',
      q_notes: 'Anything else',
    };
    const lines = [];
    for (const [key, label] of Object.entries(detailLabels)) {
      const values = fd.getAll(key).filter((v) => String(v).trim() !== '');
      if (values.length) lines.push(`${label}: ${values.join(', ')}`);
    }

    const params = new URLSearchParams();
    params.append('name', fd.get('name') || '');
    params.append('email', fd.get('email') || '');
    params.append('business_name', fd.get('business_name') || '');
    params.append('business_type', fd.get('business_type') || '');
    const descBody = lines.join('\n');
    if (selectedPlan) {
      params.append('description', `Requested plan: ${selectedPlan}` + (descBody ? `\n\n${descBody}` : ''));
    } else {
      params.append('description', descBody);
    }
    params.append('source', selectedPlan ? `Client Questionnaire (${selectedPlan})` : 'Client Questionnaire');

    try {
      await fetch(SCRIPT_URL, { method: 'POST', body: params, mode: 'no-cors' });

      questionnaireForm.innerHTML = `
        <div class="sm:col-span-2 flex flex-col items-center gap-3 py-8 text-center">
          <svg class="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-lg font-semibold text-heading">Thank you — we've got it!</p>
          <p class="text-sm text-muted max-w-md">Your questionnaire is in. We'll review your answers and reach out within 24 hours to set up your strategy call.</p>
        </div>`;
    } catch {
      btn.disabled = false;
      btn.textContent = originalText;

      let errEl = questionnaireForm.querySelector('.form-error');
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.className = 'form-error sm:col-span-2 mt-1 text-sm text-red-600 text-center';
        questionnaireForm.appendChild(errEl);
      }
      errEl.textContent = 'Something went wrong — please email us directly at groundwireweb@gmail.com.';
    }
  });
}

// Intro overlay — 24-hour gate checked in <head> via skip-intro class;
// this block plays the animation and writes the timestamp on first visit.
(function initIntro() {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;

  // If skip-intro was set by the gate script, overlay is already display:none — bail.
  if (document.documentElement.classList.contains('skip-intro')) return;

  // Write timestamp so this session's gate kicks in for subsequent page loads.
  try { localStorage.setItem('gw_intro_ts', String(Date.now())); } catch {}

  // Kick off the exit slide after content animations finish.
  const EXIT_DELAY = 2000; // ms — logo (0.85s) + tagline (1.25s) + scan (2.05s) + brief hold
  const EXIT_DURATION = 600;

  setTimeout(() => {
    overlay.classList.add('intro-exit');
    document.documentElement.classList.remove('laptop-pre-intro');

    // The overlay slides upward and reveals the hero (top of page) last —
    // roughly 450ms into the 550ms slide. Drive the clip-path wipe in JS
    // so we can (a) delay it to that moment and (b) append to laptop3d.js's
    // inline style.transition without clobbering the opacity fade it already
    // set on #hero-screen.
    const screen = document.getElementById('hero-screen');
    if (screen) {
      const SCREEN_DELAY = 430; // ms after overlay starts — hero area just visible
      screen.style.clipPath = 'inset(0 0 100% 0 round 4px)'; // hold value as inline
      setTimeout(() => {
        const base = screen.style.transition ? screen.style.transition + ', ' : '';
        screen.style.transition = base + 'clip-path 0.9s cubic-bezier(0.22, 1, 0.36, 1)';
        screen.getBoundingClientRect(); // force reflow before changing value
        screen.style.clipPath = 'inset(0 0 0% 0 round 4px)';
      }, SCREEN_DELAY);
    }

    overlay.addEventListener('animationend', (e) => {
      if (e.animationName === 'intro-slide-up') overlay.remove();
    }, { once: true });
  }, EXIT_DELAY);
})();

// Work page — reveal the demos held past the default 4-card grid.
const workShowMore = document.getElementById('work-show-more');
if (workShowMore) {
  workShowMore.addEventListener('click', () => {
    document.querySelectorAll('.work-extra').forEach((el) => el.classList.remove('hidden'));
    document.getElementById('work-show-more-wrap')?.remove();
  });
}
