/* ============================================
   PORTFOLIO — INTERACTIVE SCRIPTS v2.0
   3D Globe · Stacking Panels · Scroll Snap
   ============================================ */

(function () {
  'use strict';

  /* =============================================
     1. 3D WIREFRAME GLOBE
     ============================================= */
  class WireframeGlobe {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      // Rotation state
      this.baseRotY = 0;
      this.mouseX = 0;
      this.mouseY = 0;
      this.rotY = 0;
      this.rotX = 0.45;
      this.targetRotY = 0;
      this.targetRotX = 0.45;
      this.autoSpeed = 0.004;
      this.hovering = false;
      this.time = 0;

      // Grid density
      this.meridians = 14;
      this.parallels = 9;
      this.res = 80;

      // Dot markers on surface
      this.markers = [];
      for (let i = 0; i < 30; i++) {
        this.markers.push({
          lat: (Math.random() - 0.5) * Math.PI * 0.92,
          lon: Math.random() * Math.PI * 2,
          r: 1.5 + Math.random() * 2.5,
          phase: Math.random() * Math.PI * 2,
        });
      }

      // Build connections between nearby markers
      this.connections = [];
      for (let i = 0; i < this.markers.length; i++) {
        for (let j = i + 1; j < this.markers.length; j++) {
          const dLat = Math.abs(this.markers[i].lat - this.markers[j].lat);
          const dLon = Math.abs(this.markers[i].lon - this.markers[j].lon);
          const d = Math.sqrt(dLat * dLat + dLon * dLon);
          if (d < 1.2 && this.connections.length < 18) {
            this.connections.push([i, j]);
          }
        }
      }

      this.resize();
      this.setupEvents();
      this.animate();
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const parent = this.canvas.parentElement;
      this.w = parent.offsetWidth;
      this.h = parent.offsetHeight;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.R = Math.min(this.w, this.h) * 0.50;
      // Position globe in the center for all breakpoints
      this.cx = this.w * 0.50;
      this.cy = this.h * 0.50;
    }

    rot3d(x, y, z) {
      const cx = Math.cos(this.rotX), sx = Math.sin(this.rotX);
      const y1 = y * cx - z * sx;
      const z1 = y * sx + z * cx;
      const cy = Math.cos(this.rotY), sy = Math.sin(this.rotY);
      const x1 = x * cy + z1 * sy;
      const z2 = -x * sy + z1 * cy;
      return [x1, y1, z2];
    }

    spherePoint(lat, lon) {
      const x = this.R * Math.cos(lat) * Math.sin(lon);
      const y = this.R * Math.sin(lat);
      const z = this.R * Math.cos(lat) * Math.cos(lon);
      return this.rot3d(x, y, z);
    }

    draw() {
      const { ctx, w, h, R, cx, cy, meridians, parallels, res } = this;
      ctx.clearRect(0, 0, w, h);

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const inkColor = isDark ? '#FFFFFF' : '#111111';

      // --- Draw back-facing lines (dashed, faint) ---
      this.drawGrid(0.10, true, inkColor);

      // --- Draw front-facing lines (solid) ---
      this.drawGrid(0.45, false, inkColor);

      // --- Connections between markers ---
      ctx.lineWidth = 1;
      this.connections.forEach(([a, b]) => {
        const mA = this.markers[a];
        const mB = this.markers[b];
        const [ax, ay, az] = this.spherePoint(mA.lat, mA.lon);
        const [bx, by, bz] = this.spherePoint(mB.lat, mB.lon);
        if (az > -R * 0.15 && bz > -R * 0.15) {
          ctx.beginPath();
          ctx.moveTo(ax + cx, ay + cy);
          ctx.lineTo(bx + cx, by + cy);
          ctx.strokeStyle = inkColor;
          ctx.globalAlpha = Math.min((az + R) / (2 * R), (bz + R) / (2 * R)) * 0.2;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
        }
      });
      ctx.setLineDash([]);

      // --- Dot markers ---
      this.markers.forEach((m) => {
        const [rx, ry, rz] = this.spherePoint(m.lat, m.lon);
        if (rz > -R * 0.1) {
          const alpha = Math.max(0, (rz + R * 0.1) / (R * 1.1));
          const pulse = 0.7 + 0.3 * Math.sin(this.time * 2.5 + m.phase);
          ctx.beginPath();
          ctx.arc(rx + cx, ry + cy, m.r * pulse, 0, Math.PI * 2);
          ctx.fillStyle = inkColor;
          ctx.globalAlpha = alpha * 0.65;
          ctx.fill();

          // Glow ring on some markers
          if (m.r > 3) {
            ctx.beginPath();
            ctx.arc(rx + cx, ry + cy, m.r * pulse * 2.2, 0, Math.PI * 2);
            ctx.strokeStyle = inkColor;
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = alpha * 0.12;
            ctx.stroke();
          }
        }
      });

      // --- Outer ring (equator highlight) ---
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([]);
      ctx.stroke();

      // --- Orbit ring (tilted ellipse) ---
      ctx.beginPath();
      const orbitR = R * 1.25;
      const orbitTilt = 0.3;
      for (let i = 0; i <= 100; i++) {
        const angle = (i / 100) * Math.PI * 2;
        const ox = orbitR * Math.cos(angle);
        const oy = orbitR * Math.sin(angle) * Math.sin(orbitTilt);
        const oz = orbitR * Math.sin(angle) * Math.cos(orbitTilt);
        const [rx, ry] = this.rot3d(ox, oy, oz);
        if (i === 0) ctx.moveTo(rx + cx, ry + cy);
        else ctx.lineTo(rx + cx, ry + cy);
      }
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.12;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // --- Small orbiting dot ---
      const dotAngle = this.time * 0.6;
      const dotX = orbitR * Math.cos(dotAngle);
      const dotY = orbitR * Math.sin(dotAngle) * Math.sin(orbitTilt);
      const dotZ = orbitR * Math.sin(dotAngle) * Math.cos(orbitTilt);
      const [drx, dry, drz] = this.rot3d(dotX, dotY, dotZ);
      ctx.beginPath();
      ctx.arc(drx + cx, dry + cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = inkColor;
      ctx.globalAlpha = drz > 0 ? 0.7 : 0.15;
      ctx.fill();

      ctx.globalAlpha = 1;
    }

    drawGrid(alpha, back, inkColor) {
      const { ctx, R, cx, cy, meridians, parallels, res } = this;

      // Meridians (longitude lines)
      for (let i = 0; i < meridians; i++) {
        const lon = (i / meridians) * Math.PI * 2;
        ctx.beginPath();
        let moved = false;
        for (let j = 0; j <= res; j++) {
          const lat = (j / res) * Math.PI - Math.PI / 2;
          const [rx, ry, rz] = this.spherePoint(lat, lon);
          const isFront = rz >= 0;

          if (back ? !isFront : isFront) {
            if (!moved) { ctx.moveTo(rx + cx, ry + cy); moved = true; }
            else ctx.lineTo(rx + cx, ry + cy);
          } else {
            moved = false;
          }
        }
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = back ? 0.8 : 1.3;
        ctx.globalAlpha = alpha;
        if (back) ctx.setLineDash([3, 4]);
        else ctx.setLineDash([]);
        ctx.stroke();
      }

      // Parallels (latitude lines)
      for (let i = 1; i < parallels; i++) {
        const lat = (i / parallels) * Math.PI - Math.PI / 2;
        const r = R * Math.cos(lat);
        const yBase = R * Math.sin(lat);
        ctx.beginPath();
        let moved = false;
        for (let j = 0; j <= res; j++) {
          const lon = (j / res) * Math.PI * 2;
          const x = r * Math.sin(lon);
          const z = r * Math.cos(lon);
          const [rx, ry, rz] = this.rot3d(x, yBase, z);
          const isFront = rz >= 0;

          if (back ? !isFront : isFront) {
            if (!moved) { ctx.moveTo(rx + cx, ry + cy); moved = true; }
            else ctx.lineTo(rx + cx, ry + cy);
          } else {
            moved = false;
          }
        }
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = back ? 0.8 : 1.3;
        ctx.globalAlpha = alpha;
        if (back) ctx.setLineDash([3, 4]);
        else ctx.setLineDash([]);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    setupEvents() {
      // Mouse interaction
      window.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const dx = mx - this.cx;
        const dy = my - this.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.R * 1.5) {
          const nx = dx / (this.R * 1.5);
          const ny = dy / (this.R * 1.5);
          this.mouseX = nx * Math.PI * 0.7;
          this.mouseY = ny * Math.PI * 0.35;
          this.hovering = true;
          this.canvas.style.cursor = 'grab';
        } else {
          this.hovering = false;
          this.canvas.style.cursor = '';
        }
      });

      window.addEventListener('mouseleave', () => {
        this.hovering = false;
        this.canvas.style.cursor = '';
      });

      // Touch interaction
      window.addEventListener('touchmove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const mx = touch.clientX - rect.left;
        const my = touch.clientY - rect.top;
        const dx = mx - this.cx;
        const dy = my - this.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.R * 1.5) {
          const nx = dx / (this.R * 1.5);
          const ny = dy / (this.R * 1.5);
          this.mouseX = nx * Math.PI * 0.5;
          this.mouseY = ny * Math.PI * 0.25;
          this.hovering = true;
        } else {
          this.hovering = false;
        }
      }, { passive: true });

      window.addEventListener('touchend', () => {
        this.hovering = false;
      });

      // Resize
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => this.resize(), 150);
      });
    }

    animate() {
      this.time += 0.016;

      if (!this.hovering) {
        this.baseRotY += this.autoSpeed;
        // Smoothly decay mouse offsets
        this.mouseX += (0 - this.mouseX) * 0.05;
        this.mouseY += (0 - this.mouseY) * 0.05;
      }

      this.targetRotY = this.baseRotY + this.mouseX;
      this.targetRotX = 0.45 + this.mouseY;

      // Smooth lerp
      this.rotY += (this.targetRotY - this.rotY) * 0.06;
      this.rotX += (this.targetRotX - this.rotX) * 0.06;

      this.draw();
      requestAnimationFrame(() => this.animate());
    }
  }

  // Initialize globe
  const globeCanvas = document.getElementById('globeCanvas');
  if (globeCanvas) {
    new WireframeGlobe(globeCanvas);
  }


  /* =============================================
     2. INTERACTIVE DOTS CURSOR EFFECT
     ============================================= */
  class InteractiveDots {
    constructor() {
      this.container = document.createElement('div');
      this.container.style.position = 'absolute';
      this.container.style.top = '0';
      this.container.style.left = '0';
      this.container.style.width = '100%';
      this.container.style.height = '100vh';
      this.container.style.overflow = 'hidden';
      this.container.style.zIndex = '0'; // Behind panel content, above panel background
      this.container.style.pointerEvents = 'none'; // Allow clicking through

      this.canvas = document.createElement('canvas');
      this.canvas.style.display = 'block';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.container.appendChild(this.canvas);

      this.ctx = this.canvas.getContext('2d');

      // Theme colors
      this.backgroundColor = 'transparent'; // We will clearRect so it acts as an overlay
      this.dotColor = '#666666';
      
      this.gridSpacing = 30;
      this.animationSpeed = 0.005;
      this.removeWaveLine = true;

      this.time = 0;
      this.mouse = { x: -1000, y: -1000, isDown: false };
      this.ripples = [];
      this.dots = [];
      this.dpr = window.devicePixelRatio || 1;

      this.resizeCanvas = this.resizeCanvas.bind(this);
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleMouseDown = this.handleMouseDown.bind(this);
      this.handleMouseUp = this.handleMouseUp.bind(this);
      this.animate = this.animate.bind(this);
      this.updatePanelLocation = this.updatePanelLocation.bind(this);

      window.addEventListener('resize', this.resizeCanvas);
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('mousedown', this.handleMouseDown);
      window.addEventListener('mouseup', this.handleMouseUp);
      window.addEventListener('panelChanged', (e) => this.updatePanelLocation(e.detail));

      this.updatePanelLocation();
      this.resizeCanvas();
      this.animate();
    }

    updatePanelLocation(idx = 0) {
      const panels = document.querySelectorAll('.panel');
      const targetPanel = panels[idx];
      if (targetPanel && targetPanel !== this.container.parentElement) {
        targetPanel.insertBefore(this.container, targetPanel.firstChild);
        this.resizeCanvas();
      }
    }

    getMouseInfluence(x, y) {
      const dx = x - this.mouse.x;
      const dy = y - this.mouse.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 150;
      return Math.max(0, 1 - distance / maxDistance);
    }

    getRippleInfluence(x, y, currentTime) {
      let totalInfluence = 0;
      this.ripples.forEach((ripple) => {
        const age = currentTime - ripple.time;
        const maxAge = 3000;
        if (age < maxAge) {
          const dx = x - ripple.x;
          const dy = y - ripple.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const rippleRadius = (age / maxAge) * 300;
          const rippleWidth = 60;
          if (Math.abs(distance - rippleRadius) < rippleWidth) {
            const rippleStrength = (1 - age / maxAge) * ripple.intensity;
            const proximityToRipple = 1 - Math.abs(distance - rippleRadius) / rippleWidth;
            totalInfluence += rippleStrength * proximityToRipple;
          }
        }
      });
      return Math.min(totalInfluence, 2);
    }

    initializeDots() {
      const canvasWidth = this.canvas.clientWidth;
      const canvasHeight = this.canvas.clientHeight;
      this.dots = [];
      for (let x = this.gridSpacing / 2; x < canvasWidth; x += this.gridSpacing) {
        for (let y = this.gridSpacing / 2; y < canvasHeight; y += this.gridSpacing) {
          this.dots.push({
            x,
            y,
            originalX: x,
            originalY: y,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    resizeCanvas() {
      this.dpr = window.devicePixelRatio || 1;
      const displayWidth = this.container.clientWidth || window.innerWidth;
      const displayHeight = this.container.clientHeight || window.innerHeight;
      this.canvas.width = displayWidth * this.dpr;
      this.canvas.height = displayHeight * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.initializeDots();
    }

    handleMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    }

    handleMouseDown(e) {
      this.mouse.isDown = true;
      const rect = this.canvas.getBoundingClientRect();
      this.ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        time: Date.now(),
        intensity: 2,
      });
      const now = Date.now();
      this.ripples = this.ripples.filter((r) => now - r.time < 3000);
    }

    handleMouseUp() {
      this.mouse.isDown = false;
    }

    animate() {
      this.time += this.animationSpeed;
      const currentTime = Date.now();
      const canvasWidth = this.canvas.clientWidth;
      const canvasHeight = this.canvas.clientHeight;

      // Clear background instead of filling it to act as an overlay
      this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      this.dots.forEach((dot) => {
        const mouseInfluence = this.getMouseInfluence(dot.originalX, dot.originalY);
        const rippleInfluence = this.getRippleInfluence(dot.originalX, dot.originalY, currentTime);
        const totalInfluence = mouseInfluence + rippleInfluence;
        
        // Hide dots that are not hovered or rippled
        if (totalInfluence <= 0.01) return;
        
        dot.x = dot.originalX;
        dot.y = dot.originalY;
        
        const baseDotSize = 0;
        const dotSize = Math.max(0, baseDotSize + totalInfluence * 4 + Math.sin(this.time + dot.phase) * 0.5);
        // Fade in based on influence
        const opacity = Math.min(1, totalInfluence * 1.5);
        
        this.ctx.beginPath();
        this.ctx.arc(dot.x, dot.y, dotSize, 0, Math.PI * 2);
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const colorHex = isDark ? '#999999' : '#666666';
        const red = parseInt(colorHex.slice(1, 3), 16);
        const green = parseInt(colorHex.slice(3, 5), 16);
        const blue = parseInt(colorHex.slice(5, 7), 16);
        
        this.ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${opacity})`;
        this.ctx.fill();
      });

      if (!this.removeWaveLine) {
        this.ripples.forEach((ripple) => {
          const age = currentTime - ripple.time;
          const maxAge = 3000;
          if (age < maxAge) {
            const progress = age / maxAge;
            const radius = progress * 300;
            const alpha = (1 - progress) * 0.3 * ripple.intensity;
            this.ctx.beginPath();
            this.ctx.strokeStyle = `rgba(100, 100, 100, ${alpha})`;
            this.ctx.lineWidth = 2;
            this.ctx.arc(ripple.x, ripple.y, radius, 0, 2 * Math.PI);
            this.ctx.stroke();
            
            const innerRadius = progress * 150;
            const innerAlpha = (1 - progress) * 0.2 * ripple.intensity;
            this.ctx.beginPath();
            this.ctx.strokeStyle = `rgba(120, 120, 120, ${innerAlpha})`;
            this.ctx.lineWidth = 1;
            this.ctx.arc(ripple.x, ripple.y, innerRadius, 0, 2 * Math.PI);
            this.ctx.stroke();
          }
        });
      }

      requestAnimationFrame(this.animate);
    }
  }

  new InteractiveDots();


  /* =============================================
     3. ONE-SCROLL PANEL TRANSITIONS (FULL PAGE SLIDER)
     ============================================= */
  const navbar = document.getElementById('navbar');
  const panels = document.querySelectorAll('.panel');
  const panelIds = ['home', 'about', 'experience', 'qa', 'contact'];
  const navLinks = document.querySelectorAll('.nav-link[data-section]');
  const dots = document.querySelectorAll('.section-dots .dot');
  const sectionDots = document.getElementById('sectionDots');



  let currentPanelIndex = 0;
  let isAnimating = false;

  // Ensure body can't scroll natively
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  function scrambleTextNodes(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const textNodes = [];
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim().length > 0) {
        textNodes.push({
          node: node,
          original: node.nodeValue
        });
      }
    }

    if (textNodes.length === 0) return;

    let iterations = 0;
    const maxIterations = 25; // 1 second total (25 * 40ms)
    const interval = setInterval(() => {
      let allDone = true;
      textNodes.forEach((item) => {
        const textLen = item.original.length;
        const charsToReveal = Math.floor((iterations / maxIterations) * textLen);
        
        let newText = '';
        for (let i = 0; i < textLen; i++) {
          const char = item.original[i];
          if (i < charsToReveal || char.trim() === '') {
            newText += char;
          } else {
            newText += Math.floor(Math.random() * 10).toString();
          }
        }
        item.node.nodeValue = newText;
        if (charsToReveal < textLen) {
          allDone = false;
        }
      });
      
      iterations++;
      if (iterations > maxIterations || allDone) {
        clearInterval(interval);
        textNodes.forEach(item => { item.node.nodeValue = item.original; });
      }
    }, 40);
  }

  function setPanelActive(section, active) {
    if (active) {
      if (!section.classList.contains('is-1')) {
        section.classList.add('is-1');
        section.querySelectorAll('.reveal-up').forEach((el) => {
          const delay = parseInt(el.dataset.delay) || 0;
          setTimeout(() => {
            if (section.classList.contains('is-1')) {
              el.classList.add('revealed');
              if (typeof isPageLoaded !== 'undefined' && isPageLoaded) {
                scrambleTextNodes(el);
              }
            }
          }, delay + 400);
        });
      }
    } else {
      if (section.classList.contains('is-1')) {
        section.classList.remove('is-1');
        section.querySelectorAll('.reveal-up').forEach((el) => {
          el.classList.remove('revealed');
        });
      }
    }
  }

  function updateNavbarTheme() {
    const isGlobalDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const activePanel = panels[currentPanelIndex];
    if (!activePanel) return;
    const isPanelDark = activePanel.classList.contains('panel-dark');
    const showDarkNav = isPanelDark || isGlobalDark;

    navbar.classList.toggle('dark-mode', showDarkNav);
    document.body.classList.toggle('cursor-on-dark', showDarkNav);
    if (sectionDots) sectionDots.classList.toggle('on-dark', showDarkNav);
    navbar.classList.toggle('scrolled', currentPanelIndex > 0);
  }

  function updateActivePanel(newIndex) {
    if (newIndex < 0 || newIndex >= panels.length) return;
    if (newIndex === currentPanelIndex && panels[currentPanelIndex].classList.contains('is-1')) return;

    if (isAnimating) return;
    isAnimating = true;

    const oldPanel = panels[currentPanelIndex];
    const newPanel = panels[newIndex];

    // Slide direction based on scroll direction
    const isScrollingDown = newIndex > currentPanelIndex;
    const startY = isScrollingDown ? '100%' : '-100%';
    const leaveY = isScrollingDown ? '-100%' : '100%';
    
    // Reset scroll position of the panel depending on transition direction
    if (isScrollingDown) {
      newPanel.scrollTop = 0;
    } else {
      newPanel.scrollTop = newPanel.scrollHeight - newPanel.clientHeight;
    }

    newPanel.style.setProperty('--translate-x', '0');
    newPanel.style.setProperty('--translate-y', startY);
    void newPanel.offsetWidth; // Force reflow

    // Prepare old panel to slide out
    if (currentPanelIndex !== newIndex) {
      oldPanel.classList.remove('is-1');
      oldPanel.classList.add('is-leaving');
      oldPanel.style.setProperty('--leave-y', leaveY);
    }

    currentPanelIndex = newIndex;
    setPanelActive(newPanel, true);

    const currentId = panelIds[currentPanelIndex];
    navLinks.forEach((link) => link.classList.toggle('active', link.dataset.section === currentId));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentPanelIndex));

    updateNavbarTheme();

    window.dispatchEvent(new CustomEvent('panelChanged', { detail: currentPanelIndex }));

    // Cleanup after mask transition finishes
    setTimeout(() => {
      if (oldPanel !== newPanel) {
        setPanelActive(oldPanel, false);
        oldPanel.classList.remove('is-leaving');
      }
      isAnimating = false;
    }, 1200);
  }

  updateActivePanel(0);

  window.addEventListener('wheel', (e) => {
    if (isAnimating) return;
    const activePanel = panels[currentPanelIndex];
    if (activePanel) {
      const isScrollable = activePanel.scrollHeight > activePanel.clientHeight;
      if (isScrollable) {
        if (e.deltaY > 0) {
          const isAtBottom = activePanel.scrollTop + activePanel.clientHeight >= activePanel.scrollHeight - 15;
          if (!isAtBottom) return; // Let panel scroll natively
        } else if (e.deltaY < 0) {
          const isAtTop = activePanel.scrollTop <= 15;
          if (!isAtTop) return; // Let panel scroll natively
        }
      }
    }
    if (e.deltaY > 0) updateActivePanel(currentPanelIndex + 1);
    else if (e.deltaY < 0) updateActivePanel(currentPanelIndex - 1);
  }, { passive: false });

  let touchStartY = 0;
  let wasAtBottomOnTouchStart = false;
  let wasAtTopOnTouchStart = false;

  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    const activePanel = panels[currentPanelIndex];
    if (activePanel) {
      wasAtBottomOnTouchStart = activePanel.scrollTop + activePanel.clientHeight >= activePanel.scrollHeight - 15;
      wasAtTopOnTouchStart = activePanel.scrollTop <= 15;
    } else {
      wasAtBottomOnTouchStart = false;
      wasAtTopOnTouchStart = false;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isAnimating) {
      e.preventDefault();
      return;
    }
    const activePanel = panels[currentPanelIndex];
    if (activePanel) {
      const isScrollable = activePanel.scrollHeight > activePanel.clientHeight;
      if (isScrollable) {
        // Do not prevent default so native scrolling inside the panel works
        return;
      }
    }
    // Prevent default body scrolling/bounce effects when not scrolling panel content
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (isAnimating) return;
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) {
      const activePanel = panels[currentPanelIndex];
      if (activePanel) {
        const isScrollable = activePanel.scrollHeight > activePanel.clientHeight;
        if (isScrollable) {
          if (diff > 0) { // Swiping up -> scrolling down
            // Switch panel ONLY if we were ALREADY at the bottom when touch started
            if (!wasAtBottomOnTouchStart) return;
          } else { // Swiping down -> scrolling up
            // Switch panel ONLY if we were ALREADY at the top when touch started
            if (!wasAtTopOnTouchStart) return;
          }
        }
      }
      if (diff > 0) updateActivePanel(currentPanelIndex + 1);
      else updateActivePanel(currentPanelIndex - 1);
    }
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (isAnimating) return;
    const activePanel = panels[currentPanelIndex];
    if (activePanel) {
      const isScrollable = activePanel.scrollHeight > activePanel.clientHeight;
      if (isScrollable) {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          const isAtBottom = activePanel.scrollTop + activePanel.clientHeight >= activePanel.scrollHeight - 15;
          if (!isAtBottom) return; // Let default browser action scroll down
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          const isAtTop = activePanel.scrollTop <= 15;
          if (!isAtTop) return; // Let default browser action scroll up
        }
      }
    }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') updateActivePanel(currentPanelIndex + 1);
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') updateActivePanel(currentPanelIndex - 1);
    else if (e.key === 'Home') updateActivePanel(0);
    else if (e.key === 'End') updateActivePanel(panels.length - 1);
  });

  /* =============================================
     4. DOT NAVIGATION CLICK
     ============================================= */
  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      updateActivePanel(parseInt(dot.dataset.index, 10));
    });
  });

  /* =============================================
     5. SMOOTH SCROLL FOR ANCHOR LINKS
     ============================================= */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = anchor.getAttribute('href').substring(1);
      const idx = panelIds.indexOf(targetId);
      if (idx !== -1) updateActivePanel(idx);
      
      const navBurger = document.getElementById('navBurger');
      const mobileMenu = document.getElementById('mobileMenu');
      if (navBurger && mobileMenu) {
        navBurger.classList.remove('active');
        mobileMenu.classList.remove('active');
      }
    });
  });


  /* =============================================
     6. 3D TILT EFFECT
     ============================================= */
  const TILT_MAX = 8;
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotX = ((y - rect.height / 2) / (rect.height / 2)) * -TILT_MAX;
      const rotY = ((x - rect.width / 2) / (rect.width / 2)) * TILT_MAX;
      el.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02,1.02,1.02)`;
      el.style.transition = 'none';
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)';
      el.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)';
    });
  });


  /* =============================================
     7. SCROLL REVEAL (Disabled Intersection Observer in favor of unified transitions)
     ============================================= */


  /* =============================================
     8. QA ACCORDION
     ============================================= */
  const qaItems = document.querySelectorAll('.qa-item');
  qaItems.forEach((item) => {
    item.querySelector('.qa-question').addEventListener('click', () => {
      const wasActive = item.classList.contains('active');
      qaItems.forEach((qi) => {
        qi.classList.remove('active');
        qi.querySelector('.qa-question').setAttribute('aria-expanded', 'false');
      });
      if (!wasActive) {
        item.classList.add('active');
        item.querySelector('.qa-question').setAttribute('aria-expanded', 'true');
      }
    });
  });


  /* =============================================
     9. MOBILE MENU
     ============================================= */
  const navBurger = document.getElementById('navBurger');
  const mobileMenu = document.getElementById('mobileMenu');

  if (navBurger && mobileMenu) {
    navBurger.addEventListener('click', () => {
      navBurger.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    document.querySelectorAll('.mobile-link').forEach((link) => {
      link.addEventListener('click', () => {
        navBurger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }


  /* =============================================
     10. DOODLE UNDERLINE DRAW ANIMATION
     ============================================= */
  document.querySelectorAll('.doodle-underline-sm path').forEach((path) => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
  });

  const doodleObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const path = entry.target.querySelector('path');
          if (path) {
            path.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)';
            path.style.strokeDashoffset = '0';
          }
          doodleObs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll('.doodle-underline-sm').forEach((svg) => doodleObs.observe(svg));


  /* =============================================
     11. CONTACT FORM
     ============================================= */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('.btn');
      const orig = btn.innerHTML;

      const nameVal = document.getElementById('name').value;
      const emailVal = document.getElementById('email').value;
      const messageVal = document.getElementById('message').value;

      const subject = encodeURIComponent(`Portfolio Inquiry from ${nameVal}`);
      const body = encodeURIComponent(`Hi Azmi,\n\n${messageVal}\n\nBest regards,\n${nameVal}\n(${emailVal})`);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=azmisirojuddin3@gmail.com&su=${subject}&body=${body}`;

      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="animation:spin .7s linear infinite"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="40 20"/></svg> Opening Gmail...`;
      btn.disabled = true;

      // Open Gmail compose screen in a new tab
      window.open(gmailUrl, '_blank');

      setTimeout(() => {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Opened!`;
        btn.style.background = '#2D8B4E';
        btn.style.color = '#fff';

        setTimeout(() => {
          btn.innerHTML = orig;
          btn.disabled = false;
          btn.style.background = '';
          btn.style.color = '';
          contactForm.reset();
        }, 2500);
      }, 1000);
    });
  }


  /* =============================================
     12. HERO ANIMATIONS ON LOAD
     ============================================= */
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
  });


  /* =============================================
     13. SHAPE PARALLAX ON SCROLL
     ============================================= */
  function initShapeParallax() {
    const parallaxItems = document.querySelectorAll('[data-parallax-speed]');
    if (parallaxItems.length === 0) return;

    window.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx; 
      const dy = (e.clientY - cy) / cy; 

      parallaxItems.forEach((item) => {
        const speed = parseFloat(item.dataset.parallaxSpeed) || 0.1;
        const xOffset = dx * speed * 45;
        const yOffset = dy * speed * 45;
        
        // Update the CSS custom property on the element
        item.style.setProperty('--scroll-y', `${yOffset}px`);
        
        // If not using float animation, apply directly to transform
        if (!item.classList.contains('hd') && !item.classList.contains('section-doodle')) {
          item.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        }
      });
    }, { passive: true });
  }

  initShapeParallax();


  /* =============================================
     15. GLOBAL DARK MODE TOGGLE
     ============================================= */
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (currentTheme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
      // Re-trigger color adjustments
      updateNavbarTheme();
    });
  }


  /* =============================================
     16. INJECT KEYFRAMES
     ============================================= */
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`;
  document.head.appendChild(style);

  /* =============================================
     17. PAGE LOADER
     ============================================= */
  let isPageLoaded = false;
  window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    const percentEl = document.getElementById('loader-percent');
    const barEl = document.getElementById('loader-bar');
    if (loader && percentEl) {
      let progress = 0;
      const duration = 1200; 
      const startTime = performance.now();
      
      const animateLoader = (time) => {
        let elapsed = time - startTime;
        let t = Math.min(elapsed / duration, 1);
        
        let easeT = 1 - Math.pow(1 - t, 4);
        
        progress = Math.floor(easeT * 100);
        percentEl.textContent = progress + '%';
        if (barEl) barEl.style.width = progress + '%';
        
        if (t < 1) {
          requestAnimationFrame(animateLoader);
        } else {
          setTimeout(() => {
            loader.classList.add('hidden');
            isPageLoaded = true;
            // Start the first panel's scramble animation now
            if (panels && panels[currentPanelIndex]) {
              panels[currentPanelIndex].querySelectorAll('.reveal-up').forEach(el => {
                scrambleTextNodes(el);
              });
            }
          }, 200);
        }
      };
      
      requestAnimationFrame(animateLoader);
    }
  });

})();
