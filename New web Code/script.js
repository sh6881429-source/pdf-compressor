/* ═══════════════════ SCRIPT.JS ═══════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // ── Navbar scroll effect ──
  const navbar = document.getElementById('navbar');
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });

  // ── Mobile menu toggle ──
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    links.classList.toggle('open');
  });
  // Close menu on link click
  links.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      links.classList.remove('open');
    });
  });

  // ── Active nav link on scroll ──
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link[data-section]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[data-section="${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => observer.observe(s));

  // ── Scroll reveal ──
  document.querySelectorAll('.tool-card, .section-header, .about-content, .about-visual, .contact-form, .contact-info, .info-card, .feature')
    .forEach(el => el.classList.add('reveal'));
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ── Counter animation ──
  const counters = document.querySelectorAll('.stat-number[data-count]');
  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = +el.dataset.count;
      const duration = 1600;
      const start = performance.now();
      const animate = now => {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * ease);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterObserver.observe(c));

  // ── Contact form ──
  const form = document.getElementById('contact-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('contact-submit');
    const originalContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span>Sending...</span>';

    const payload = {
      name: document.getElementById('contact-name').value,
      email: document.getElementById('contact-email').value,
      message: document.getElementById('contact-message').value
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        btn.innerHTML = '<span>✓ Message Sent!</span>';
        btn.style.background = 'var(--emerald)';
        form.reset();
      } else {
        alert('Error: ' + data.message);
        btn.innerHTML = originalContent;
      }
    } catch (err) {
      console.error(err);
      alert('Problem sending message. Please try again.');
      btn.innerHTML = originalContent;
    } finally {
      btn.disabled = false;
      setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.style.background = '';
        if (window.lucide) lucide.createIcons();
      }, 3000);
    }
  });

  // ── Card tilt effect (desktop) ──
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.tool-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `translateY(-4px) perspective(800px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
        const glow = card.querySelector('.card-glow');
        if (glow) {
          glow.style.background = `radial-gradient(circle at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, rgba(99,102,241,.1) 0%, transparent 60%)`;
        }
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  // ── Scroll to top button ──
  const scrollBtn = document.getElementById('scroll-top');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});
