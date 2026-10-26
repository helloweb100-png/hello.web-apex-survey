/* ═══════════════════════════════════════════════════════════════
   APEX SURVEY · Marzam Surveying — app.js
   ───────────────────────────────────────────────────────────────
   Sin dependencias obligatorias. Lenis (CDN) es opcional: si no
   carga, la página usa el scroll nativo.

   ÍNDICE
   00 Configuración (¡EDITAR AQUÍ el WhatsApp!)
   01 Utilidades · 02 Motor de scroll (rAF) · 03 Loader
   04 Navegación / menú / puntos / progreso · 05 HUD y cursor
   06 Hero: nube de puntos WebGL + panel de medición
   07 Marquee y cinta métrica · 08 Manifiesto (palabra a palabra)
   09 Servicios (stack + diagnóstico + dial) · 10 Imagen expandible
   11 Explorador de equipos · 12 Comparador de calibración
   13 Proceso · 14 Bento · 15 Cifras + red de control
   16 Público (scroll horizontal) · 17 FAQ · 18 Formulario → WhatsApp
   19 Reveals, magnéticos, tilt · 20 Arranque
═══════════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    /* ═══ 00 · CONFIGURACIÓN ═══════════════════════════════════
       Cambia SOLO estos valores para personalizar el sitio.     */
    const CONFIG = {
        phone: '520000000000',          // WhatsApp con código de país, sin "+" ni espacios
        displayPhone: '+00 000 000 0000', // Cómo se muestra el número en la sección de contacto
        brand: 'Apex Survey'
    };

    /* ═══ 01 · UTILIDADES ═══════════════════════════════════ */
    const $  = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp  = (a, b, t) => a + (b - a) * t;
    const ease  = {
        out: t => 1 - Math.pow(1 - t, 3),
        io:  t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    };
    const html = document.documentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const absTop = el => el.getBoundingClientRect().top + window.scrollY;
    const pad = (n, l = 2) => String(Math.floor(n)).padStart(l, '0');
    const safe = (name, fn) => { try { return fn(); } catch (e) { console.warn('[apex] ' + name, e); } };
    const rand = seed => () => { // mulberry32: aleatorio determinista
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const dms = deg => {
        const d = Math.floor(deg), m = Math.floor((deg - d) * 60), s = Math.floor((((deg - d) * 60) - m) * 60);
        return pad(d, 3) + '°' + pad(m) + '′' + pad(s) + '″';
    };

    // Visibilidad de un elemento (para pausar animaciones fuera de pantalla)
    const watch = (el, cb, opts = { threshold: 0 }) => {
        if (!el) return;
        new IntersectionObserver(([e]) => cb(e.isIntersecting), opts).observe(el);
    };

    /* ═══ WhatsApp ═════════════════════════════════════════════ */
    const waURL = msg => `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(msg)}`;
    const applyWA = () => $$('[data-wa]').forEach(a => {
        a.href = waURL(a.dataset.wa);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
    });
    applyWA();
    const phoneEl = $('#ct-phone');
    if (phoneEl) phoneEl.textContent = CONFIG.displayPhone;
    const yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ═══ 02 · MOTOR DE SCROLL ═════════════════════════════════
       Un único bucle rAF; cada módulo registra su "updater".   */
    const S = { y: 0, vy: 0, vh: innerHeight, vw: innerWidth, docH: 0, t: 0, dt: 16, mx: 0, my: 0, cx: 0, cy: 0 };
    const updaters = [];
    const measurers = [];
    const onFrame = fn => updaters.push(fn);
    const onMeasure = fn => measurers.push(fn);

    let lenis = null;
    if (!reduce && window.Lenis) {
        safe('lenis', () => {
            lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true });
        });
    }

    let lastT = performance.now();
    const frame = now => {
        S.dt = Math.min(now - lastT, 64); lastT = now; S.t = now / 1000;
        if (lenis) lenis.raf(now);
        const y = window.scrollY;
        S.vy = y - S.y; S.y = y;
        for (let i = 0; i < updaters.length; i++) updaters[i](S);
        requestAnimationFrame(frame);
    };

    const measure = () => {
        S.vh = innerHeight; S.vw = innerWidth;
        html.style.setProperty('--vh', S.vh + 'px');
        measurers.forEach(fn => safe('measure', () => fn(S)));
        S.docH = document.documentElement.scrollHeight;
    };
    let mT;
    const queueMeasure = () => { clearTimeout(mT); mT = setTimeout(measure, 120); };
    addEventListener('resize', queueMeasure, { passive: true });
    addEventListener('orientationchange', queueMeasure);
    if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    // Scroll suave hacia anclas
    const goTo = (hash, instant) => {
        const target = hash === '#top' ? 0 : $(hash);
        if (target === null) return;
        const top = typeof target === 'number' ? 0 : absTop(target);
        const off = typeof target === 'number' ? 0 : -(S.vw < 1000 ? 56 : 40);
        if (lenis) lenis.scrollTo(top + off, { duration: instant ? 0 : 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
        else window.scrollTo({ top: top + off, behavior: instant || reduce ? 'auto' : 'smooth' });
    };
    document.addEventListener('click', e => {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const h = a.getAttribute('href');
        if (h === '#' || h.length < 2) return;
        if (!$(h) && h !== '#top') return;
        e.preventDefault();
        closeMenu();
        goTo(h);
    });

    /* ═══ 03 · LOADER ══════════════════════════════════════════ */
    const loader = $('#loader');
    let started = false;
    const startSite = () => {
        if (started) return; started = true;
        html.classList.add('is-ready');
        document.body.classList.remove('is-locked');
        if (lenis) lenis.start();
        cloud.start();
        setTimeout(showWA, 3200);
        // Tras la entrada, se quitan las transiciones del hero para que tilt/hover respondan al instante
        setTimeout(() => $$('[data-hero]').forEach(el => el.removeAttribute('data-hero')), 4600);
    };

    const initLoader = () => {
        if (!loader || !html.classList.contains('js')) { startSite(); return; }
        const num = $('#ld-num'), bar = $('#ld-bar'), msg = $('#ld-msg'), prog = $('.ld-prog'), coord = $('.ld-coord');
        const msgs = ['Inicializando sensor…', 'Calibrando eje horizontal…', 'Nivelando instrumento…', 'Capturando nube de puntos…', 'Equipo listo'];
        document.body.classList.add('is-locked');
        if (lenis) lenis.stop();

        const MIN = reduce ? 500 : 2600;
        const t0 = performance.now();
        let loaded = document.readyState === 'complete';
        addEventListener('load', () => { loaded = true; }, { once: true });
        let finished = false, lastMsg = -1;

        const finish = () => {
            if (finished) return; finished = true;
            num.textContent = '100'; msg.textContent = msgs[4];
            prog.style.strokeDashoffset = 0; bar.style.transform = 'scaleX(1)';
            if (reduce) { loader.classList.add('is-gone'); startSite(); return; }
            setTimeout(() => loader.classList.add('is-leaving'), 420);
            setTimeout(() => { loader.classList.add('is-open'); startSite(); }, 1380);
            setTimeout(() => loader.classList.add('is-gone'), 2500);
        };

        const tick = now => {
            if (finished) return;
            let p = clamp((now - t0) / MIN);
            if (!loaded) p = Math.min(p, .93);
            const e = p < 1 ? ease.out(p) * .6 + p * .4 : 1;
            num.textContent = Math.floor(e * 100);
            prog.style.strokeDashoffset = 100 - e * 100;
            bar.style.transform = `scaleX(${e})`;
            const mi = Math.min(3, Math.floor(e * 4));
            if (mi !== lastMsg) { lastMsg = mi; msg.textContent = msgs[mi]; }
            if (coord && Math.random() < .35) coord.textContent = `N ${(Math.random() * 99).toFixed(3).padStart(6, '0')} · E ${(Math.random() * 99).toFixed(3).padStart(6, '0')}`;
            if (p >= 1 && loaded) finish(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        setTimeout(finish, 9000); // seguro: nunca bloquear al usuario
    };

    /* ═══ 04 · NAVEGACIÓN ══════════════════════════════════════ */
    const nav = $('#nav'), burger = $('#burger'), menu = $('#menu');
    function openMenu() {
        menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
        burger.classList.add('is-open'); burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Cerrar menú');
        document.body.classList.add('is-locked'); if (lenis) lenis.stop();
        const main = $('#main'); if (main) main.inert = true;
        const first = $('.menu-link', menu); if (first) setTimeout(() => first.focus({ preventScroll: true }), 500);
    }
    function closeMenu() {
        if (!menu || !menu.classList.contains('is-open')) return;
        menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true');
        burger.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menú');
        document.body.classList.remove('is-locked'); if (lenis) lenis.start();
        const main = $('#main'); if (main) main.inert = false;
    }
    if (burger) burger.addEventListener('click', () => (menu.classList.contains('is-open') ? closeMenu() : openMenu()));
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    $$('.menu-cta').forEach(a => a.addEventListener('click', closeMenu));

    // Secciones activas + puntos laterales + progreso
    const DOTS = [['hero', 'Inicio'], ['manifiesto', 'Manifiesto'], ['servicios', 'Servicios'], ['taller', 'Del taller al campo'], ['equipos', 'Equipos'], ['calibracion', 'Calibración'], ['proceso', 'Proceso'], ['ventajas', 'La diferencia'], ['cifras', 'Cifras'], ['publico', 'Para quién'], ['faq', 'Preguntas'], ['contacto', 'Contacto']];
    const dotsEl = $('#dots');
    if (dotsEl) DOTS.forEach(([id, label]) => {
        const b = document.createElement('button');
        b.setAttribute('aria-label', 'Ir a ' + label); b.dataset.t = id;
        b.innerHTML = `<span>${label}</span>`;
        b.addEventListener('click', () => goTo('#' + id));
        dotsEl.appendChild(b);
    });
    const dotBtns = dotsEl ? $$('button', dotsEl) : [];
    const navLinks = $$('[data-nav]');
    const progressEl = $('#progress');
    const hud = $('#hud');
    let secs = [], activeId = '';
    onMeasure(() => {
        secs = $$('main > section[id], footer[id]').map(el => ({ id: el.id, top: absTop(el), bottom: absTop(el) + el.offsetHeight }));
    });
    onFrame(s => {
        nav.classList.toggle('is-scrolled', s.y > 24);
        if (progressEl) progressEl.style.setProperty('--sp', (s.y / Math.max(1, s.docH - s.vh)).toFixed(4));
        const mid = s.y + s.vh * .45;
        let cur = '';
        for (const sec of secs) if (sec.top <= mid) cur = sec.id;
        if (cur !== activeId) {
            activeId = cur;
            navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + cur));
            dotBtns.forEach(b => b.classList.toggle('is-active', b.dataset.t === cur));
            const dark = cur === 'cifras' || cur === 'footer';
            if (hud) { hud.classList.toggle('is-dark', dark); hud.classList.toggle('is-hidden', cur === 'footer'); }
            if (dotsEl) dotsEl.classList.toggle('is-dark', dark);
        }
    });

    /* ═══ 05 · HUD Y CURSOR ════════════════════════════════════ */
    const retic = $('#reticle');
    const hx = $('#hud-x'), hy = $('#hud-y'), hz = $('#hud-z');
    if (finePointer) {
        addEventListener('pointermove', e => {
            S.mx = e.clientX; S.my = e.clientY;
            if (retic) {
                retic.classList.add('is-on');
                retic.classList.toggle('is-hover', !!e.target.closest('a, button, [role="slider"], .pill, input, textarea, label, .cmp'));
            }
        }, { passive: true });
        document.documentElement.addEventListener('mouseleave', () => retic && retic.classList.remove('is-on'));
        onFrame(s => {
            s.cx = lerp(s.cx, s.mx, .22); s.cy = lerp(s.cy, s.my, .22);
            if (retic) retic.style.transform = `translate3d(${s.cx}px, ${s.cy}px, 0)`;
            if (hx && (s.t * 10 | 0) % 2 === 0) {
                hx.textContent = (s.mx / s.vw * 1000).toFixed(3).padStart(7, '0');
                hy.textContent = (s.my / s.vh * 1000).toFixed(3).padStart(7, '0');
                hz.textContent = (s.y * .1).toFixed(1).padStart(6, '0');
            }
        });
    }

    /* ═══ 06 · HERO · NUBE DE PUNTOS WEBGL ═════════════════════
       Escena procedural estilo LiDAR: terreno, vía, edificios y
       árboles muestreados como un escáner láser (anillos). Un haz
       giratorio y pulsos de radio "escanean" la nube sin parar.   */
    const cloud = (() => {
        const canvas = $('#cloud');
        const api = { start() {} };
        if (!canvas) return api;
        const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
        if (!gl) { canvas.style.display = 'none'; return api; }

        const VS = `
        precision highp float;
        attribute vec3 aPos; attribute vec2 aMeta;
        uniform mat4 uVP; uniform vec2 uOff;
        uniform float uTime, uPR, uSize, uDist, uReveal, uSweep, uPulse;
        varying vec4 vCol;
        vec3 ramp(float h){
            vec3 lo = vec3(0.40, 0.44, 0.52), mid = vec3(0.075, 0.612, 0.392), hi = vec3(0.965, 0.686, 0.231);
            return mix(mix(lo, mid, smoothstep(0.0, 0.30, h)), hi, smoothstep(0.62, 1.0, h));
        }
        void main(){
            float cls = aMeta.x, rnd = aMeta.y;
            vec3 p = aPos;
            float d = length(p.xz);
            float da = mod(atan(p.z, p.x) - uSweep + 3.14159265, 6.2831853) - 3.14159265;
            float beam = da <= 0.0 ? exp(da * 5.5) : 0.0;
            beam *= smoothstep(7.0, 16.0, d) * (1.0 - smoothstep(56.0, 72.0, d));
            float q1 = (d - uPulse) * 0.34;
            float q2 = (d - mod(uPulse + 46.0, 92.0)) * 0.34;
            float r1 = exp(-q1 * q1);
            float r2 = exp(-q2 * q2);
            float ring = max(r1, r2 * 0.75) * smoothstep(5.0, 14.0, d) * (1.0 - smoothstep(58.0, 80.0, d));
            p.y += ring * 0.9 + beam * 0.3;
            vec4 clip = uVP * vec4(p, 1.0);
            clip.xy += uOff * clip.w;
            gl_Position = clip;

            float h = clamp(aPos.y / 17.0, 0.0, 1.0);
            vec3 col;
            if (cls < 0.5) col = ramp(h);
            else if (cls < 1.5) col = mix(vec3(0.12, 0.13, 0.16), vec3(0.38, 0.39, 0.42), clamp(aPos.y / 14.0, 0.0, 1.0));
            else if (cls < 2.5) col = mix(vec3(0.04, 0.42, 0.26), vec3(0.30, 0.72, 0.42), rnd);
            else if (cls < 3.5) col = vec3(0.30, 0.32, 0.37);
            else if (cls < 4.5) col = vec3(0.96, 0.69, 0.23);
            else if (cls < 5.5) col = vec3(0.835, 0.0, 0.03);
            else col = vec3(0.18, 0.18, 0.2);
            col = mix(col, vec3(0.835, 0.0, 0.03), clamp(beam * 0.92, 0.0, 1.0));
            col = mix(col, vec3(0.835, 0.0, 0.03), ring * 0.55);

            float rev = 1.0 - smoothstep(uReveal - 8.0, uReveal, d);
            float edge = 1.0 - smoothstep(50.0, 72.0, d);
            float tw = 0.9 + 0.1 * sin(uTime * 2.2 + rnd * 40.0);
            float a = (0.58 + 0.4 * edge) * rev * tw;
            a = clamp(a + (beam * 0.4 + ring * 0.18) * rev, 0.0, 1.0);
            vCol = vec4(col, a);

            float size = uSize * (0.62 + rnd * 0.72) * (uDist / clip.w);
            size *= 1.0 + beam * 0.9 + ring * 0.7;
            if (cls > 4.5 && cls < 5.5) size = 6.5 * (uDist / clip.w) * (1.0 + 0.2 * sin(uTime * 4.0));
            gl_PointSize = clamp(size * uPR, 1.0, 24.0 * uPR);
        }`;
        const FS = `
        precision mediump float;
        varying vec4 vCol;
        void main(){
            vec2 c = gl_PointCoord - 0.5;
            float r = dot(c, c);
            if (r > 0.25) discard;
            float a = vCol.a * (1.0 - smoothstep(0.12, 0.25, r));
            gl_FragColor = vec4(vCol.rgb * a, a);
        }`;

        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
        let prog;
        try {
            prog = gl.createProgram();
            gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        } catch (err) { console.warn('[apex] webgl', err); canvas.style.display = 'none'; return api; }
        gl.useProgram(prog);

        /* — Escena procedural — */
        const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
        const noise = (x, y) => {
            const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
        };
        const fbm = (x, y) => { let a = .5, f = 1, s = 0; for (let i = 0; i < 4; i++) { s += a * noise(x * f, y * f); f *= 2; a *= .5; } return s; };
        const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
        const roadZ = x => Math.sin(x * .07 + .6) * 9 + 7;
        const roadMask = (x, z) => 1 - sstep(2.6, 4.6, Math.abs(z - roadZ(x)));
        const groundH = (x, z) => {
            const d = Math.hypot(x, z);
            const hills = (fbm(x * .042 + 10, z * .042 + 4) - .36) * 24;
            const flat = sstep(58, 28, d);
            let h = lerp(hills + 1.5, .35 + noise(x * .25, z * .25) * .12, flat);
            return lerp(h, .25, roadMask(x, z) * (1 - sstep(60, 70, Math.abs(x))));
        };

        const isMobile = innerWidth < 800;
        const N_GROUND = isMobile ? 17000 : 46000;
        const R = 68;
        const data = [];
        const push = (x, y, z, cls, r) => data.push(x, y, z, cls, r);
        const rnd = rand(20260);

        // Suelo: anillos concéntricos (patrón característico de un escáner terrestre)
        {
            const K = isMobile ? 70 : 110, rings = [];
            let wsum = 0;
            for (let k = 0; k < K; k++) { const u = (k + .5) / K, r = 2.4 * Math.pow(R / 2.4, u); rings.push(r); wsum += Math.pow(r, .8); }
            rings.forEach(r => {
                const n = Math.round(N_GROUND * Math.pow(r, .8) / wsum);
                for (let i = 0; i < n; i++) {
                    const a = rnd() * Math.PI * 2, rr = r + (rnd() - .5) * .35;
                    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
                    push(x, groundH(x, z) + (rnd() - .5) * .08, z, roadMask(x, z) > .55 ? 3 : 0, rnd());
                }
            });
        }
        // Edificios: caras muestreadas con "ventanas"
        {
            const count = isMobile ? 8 : 11;
            for (let b = 0; b < count; b++) {
                const ang = (b / count) * Math.PI * 2 + rnd() * .5;
                const dist = 15 + rnd() * 19;
                const cx = Math.cos(ang) * dist, cz = Math.sin(ang) * dist;
                if (roadMask(cx, cz) > .3) continue;
                const w = 6 + rnd() * 9, dpt = 5 + rnd() * 7, h = 4 + rnd() * 11, ry = rnd() * Math.PI;
                const base = groundH(cx, cz);
                const cs = Math.cos(ry), sn = Math.sin(ry);
                const place = (lx, ly, lz, cls, r) => push(cx + lx * cs - lz * sn, base + ly, cz + lx * sn + lz * cs, cls, r);
                const dens = 2.5;
                const faces = [
                    { n: Math.round(w * h * dens), f: (u, v) => [(u - .5) * w, v * h, dpt / 2], win: [Math.floor(w / 2.2), Math.floor(h / 2.6)] },
                    { n: Math.round(w * h * dens), f: (u, v) => [(u - .5) * w, v * h, -dpt / 2], win: [Math.floor(w / 2.2), Math.floor(h / 2.6)] },
                    { n: Math.round(dpt * h * dens), f: (u, v) => [w / 2, v * h, (u - .5) * dpt], win: [Math.floor(dpt / 2.2), Math.floor(h / 2.6)] },
                    { n: Math.round(dpt * h * dens), f: (u, v) => [-w / 2, v * h, (u - .5) * dpt], win: [Math.floor(dpt / 2.2), Math.floor(h / 2.6)] },
                    { n: Math.round(w * dpt * dens), f: (u, v) => [(u - .5) * w, h, (v - .5) * dpt], win: null }
                ];
                faces.forEach(face => {
                    for (let i = 0; i < face.n; i++) {
                        const u = rnd(), v = rnd(), [lx, ly, lz] = face.f(u, v);
                        let cls = 1;
                        if (face.win && face.win[0] > 0 && v > .12 && v < .94) {
                            const fu = (u * face.win[0]) % 1, fv = (v * face.win[1]) % 1;
                            if (fu > .22 && fu < .78 && fv > .25 && fv < .72) cls = 4;
                        }
                        place(lx, ly, lz, cls, rnd());
                    }
                });
            }
        }
        // Árboles
        {
            const trees = isMobile ? 46 : 78;
            for (let t = 0; t < trees; t++) {
                const a = rnd() * Math.PI * 2, d = 22 + Math.pow(rnd(), .8) * 42;
                const x = Math.cos(a) * d, z = Math.sin(a) * d;
                if (roadMask(x, z) > .15) continue;
                const g = groundH(x, z), th = 1.6 + rnd() * 2.4, cr = 1.5 + rnd() * 1.8;
                for (let i = 0; i < 8; i++) push(x + (rnd() - .5) * .15, g + (i / 8) * th, z + (rnd() - .5) * .15, 2, rnd());
                const pts = isMobile ? 60 : 105;
                for (let i = 0; i < pts; i++) {
                    let dx, dy, dz; do { dx = rnd() * 2 - 1; dy = rnd() * 2 - 1; dz = rnd() * 2 - 1; } while (dx * dx + dy * dy + dz * dz > 1);
                    push(x + dx * cr, g + th + cr * 1.15 + dy * cr * 1.25, z + dz * cr, 2, rnd());
                }
            }
        }
        // Escáner (trípode + marcador rojo)
        for (let l = 0; l < 3; l++) {
            const a = l * Math.PI * 2 / 3;
            for (let i = 0; i < 16; i++) { const f = i / 15; push(Math.cos(a) * (1 - f) * 1.1, 1.8 * f + .2, Math.sin(a) * (1 - f) * 1.1, 6, rnd()); }
        }
        for (let i = 0; i < 12; i++) push(0, 1.9 + i * .06, 0, 5, rnd());
        for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; push(Math.cos(a) * 1.5, .3, Math.sin(a) * 1.5, 5, rnd()); }

        const arr = new Float32Array(data);
        const COUNT = arr.length / 5;
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, 'aPos'), aMeta = gl.getAttribLocation(prog, 'aMeta');
        gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0);
        gl.enableVertexAttribArray(aMeta); gl.vertexAttribPointer(aMeta, 2, gl.FLOAT, false, 20, 12);
        const U = {}; ['uVP', 'uOff', 'uTime', 'uPR', 'uSize', 'uDist', 'uReveal', 'uSweep', 'uPulse'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
        gl.clearColor(0, 0, 0, 0);

        /* — Matrices — */
        const persp = (fovy, asp, n, f) => { const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; };
        const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const lookAt = (e, c, up) => {
            const z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross(up, z)), y = cross(z, x);
            return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
        };
        const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };

        /* — Estado — */
        let w = 0, h = 0, pr = 1, running = false, visible = true, t0 = 0, began = false;
        let pitch = .5, yaw = 0, mxs = 0, mys = 0, hp = 0, reveal = reduce ? 90 : 0, hpS = 0;
        const hero = $('#hero'), heroCopy = $('.hero-copy');
        const ro = { pts: $('#ro-pts'), hz: $('#ro-hz'), v: $('#ro-v'), sd: $('#ro-sd'), dz: $('#ro-dz'), path: $('#ro-path') };
        let heroH = 800, roT = 0;

        const resize = () => {
            const r = canvas.getBoundingClientRect();
            pr = Math.min(devicePixelRatio || 1, isMobile ? 1.75 : 2);
            w = Math.max(2, Math.round(r.width * pr)); h = Math.max(2, Math.round(r.height * pr));
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            gl.viewport(0, 0, w, h);
            heroH = hero ? hero.offsetHeight : 800;
        };
        onMeasure(resize);
        addEventListener('pointermove', e => { mxs = (e.clientX / innerWidth - .5) * 2; mys = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
        watch(hero, v => { visible = v; });

        const draw = (s) => {
            const time = s.t - t0;
            if (!reduce) {
                const rv = began ? ease.out(clamp(time / 4.6)) : 0;
                reveal = rv * 92;
            }
            hpS = lerp(hpS, clamp(s.y / (heroH * .9)), .1);
            const asp = w / h, portrait = asp < 1;
            const fov = (portrait ? 54 : 36) * Math.PI / 180;
            const dist = (portrait ? 132 : 116) + hpS * 30;
            const pit = lerp(portrait ? .52 : .56, 1.05, ease.io(hpS)) - mys * .05;
            const yw = (reduce ? .6 : time * .05 + .4) + mxs * .22;
            const ctr = [0, 3, 0];
            const eye = [ctr[0] + dist * Math.cos(pit) * Math.sin(yw), ctr[1] + dist * Math.sin(pit), ctr[2] + dist * Math.cos(pit) * Math.cos(yw)];
            const vp = mul(persp(fov, asp, 1, 400), lookAt(eye, ctr, [0, 1, 0]));
            const sweep = reduce ? 1.2 : time * .85;
            const pulse = reduce ? 30 : (time * 13) % 92;
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniformMatrix4fv(U.uVP, false, vp);
            const stacked = s.vw < 1100;
            gl.uniform2f(U.uOff, stacked ? 0 : .36, stacked ? -.02 : -.04);
            gl.uniform1f(U.uTime, time); gl.uniform1f(U.uPR, pr);
            gl.uniform1f(U.uSize, portrait ? 2.1 : 2.15); gl.uniform1f(U.uDist, dist);
            gl.uniform1f(U.uReveal, reveal); gl.uniform1f(U.uSweep, sweep); gl.uniform1f(U.uPulse, pulse);
            gl.drawArrays(gl.POINTS, 0, COUNT);

            // Panel de medición (se actualiza ~10 veces por segundo)
            if (ro.hz && s.t - roT > .1) {
                roT = s.t;
                const a = ((sweep % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                ro.hz.textContent = dms(a * 180 / Math.PI);
                ro.v.textContent = dms(90 + Math.sin(time * .7) * 3.4 + Math.sin(time * 2.3) * .2);
                ro.sd.textContent = (24 + Math.sin(time * .5) * 16 + Math.sin(time * 3.1) * .04).toFixed(3).padStart(6, '0') + ' m';
                const dz = Math.sin(time * 1.1) * .018;
                ro.dz.textContent = (dz >= 0 ? '+' : '−') + Math.abs(dz).toFixed(3) + ' m';
                ro.pts.textContent = Math.floor(COUNT * clamp(reveal / 80)).toLocaleString('es-MX') + ' pts';
                let d = '';
                for (let i = 0; i <= 24; i++) d += (i ? 'L' : 'M') + (i * 10) + ' ' + (20 + Math.sin(i * .62 + time * 3.2) * 9 + Math.sin(i * 1.7 - time * 2) * 4).toFixed(1);
                ro.path.setAttribute('d', d);
            }
        };

        onFrame(s => {
            if (!running || !visible || !w) return;
            safe('cloud', () => draw(s));
            // Parallax del bloque de texto
            if (heroCopy && s.y < heroH) {
                heroCopy.style.transform = `translate3d(0, ${(s.y * -.1).toFixed(1)}px, 0)`;
                heroCopy.style.opacity = (1 - clamp(s.y / (heroH * .75))).toFixed(3);
            }
        });

        api.start = () => {
            began = true; running = true; t0 = S.t; resize();
            if (reduce) draw(S);
        };
        // Primer fotograma antes de que termine el loader (nube vacía y lista)
        running = true; t0 = S.t; setTimeout(() => { resize(); }, 0);
        return api;
    })();

    /* ═══ 06b · PALABRA ROTATIVA DEL TITULAR ═══════════════════ */
    safe('rot', () => {
        const words = $$('.rot-w');
        if (words.length < 2 || reduce) return;
        let i = 0;
        setInterval(() => {
            if (!started) return;
            const cur = words[i]; i = (i + 1) % words.length; const nx = words[i];
            cur.classList.remove('is-on'); cur.classList.add('is-out');
            nx.classList.remove('is-out'); nx.classList.add('is-on');
            setTimeout(() => cur.classList.remove('is-out'), 900);
        }, 2800);
    });

    /* ═══ 07 · MARQUEE + CINTA MÉTRICA ═════════════════════════ */
    safe('marquee', () => {
        const track = $('#marquee');
        if (!track) return;
        Array.from(track.children).forEach(n => track.appendChild(n.cloneNode(true)));
        let x = 0, half = 1;
        onMeasure(() => { half = track.scrollWidth / 2; });
        onFrame(s => {
            x -= (reduce ? 0 : .8 * s.dt / 16.7) + s.vy * .5;
            if (x <= -half) x += half; if (x > 0) x -= half;
            track.style.transform = `translate3d(${x}px,0,0)`;
        });
    });
    safe('tape', () => {
        const tape = $('#tape');
        if (!tape) return;
        let out = '';
        for (let i = 0; i < 30; i++) out += `<span>${pad(i % 10, 2)}.00</span>`;
        tape.innerHTML = out;
        onFrame(s => { if (s.y > s.vh * 1.4) return; tape.style.transform = `translate3d(${-((s.y * .7 + s.t * 14) % 1000)}px,0,0)`; });
    });

    /* ═══ 08 · MANIFIESTO ══════════════════════════════════════ */
    const splitWords = (root, cls) => {
        let idx = 0;
        const walk = node => {
            Array.from(node.childNodes).forEach(n => {
                if (n.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach(p => {
                        if (!p) return;
                        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
                        if (cls === 'sw') {
                            const o = document.createElement('span'); o.className = 'sw';
                            const i = document.createElement('span'); i.textContent = p; i.style.setProperty('--i', idx++);
                            o.appendChild(i); frag.appendChild(o);
                        } else {
                            const o = document.createElement('span'); o.className = 'w'; o.textContent = p; idx++; frag.appendChild(o);
                        }
                    });
                    n.replaceWith(frag);
                } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
            });
        };
        walk(root);
        return idx;
    };
    safe('manifesto', () => {
        const el = $('#mf-text');
        if (!el) return;
        splitWords(el, 'w');
        const words = $$('.w', el);
        const n = words.length;
        let top = 0, hgt = 1;
        const last = new Array(n).fill(-1);
        onMeasure(s => { top = absTop(el); hgt = el.offsetHeight; });
        onFrame(s => {
            const p = clamp((s.y + s.vh * .86 - top) / (hgt + s.vh * .34));
            if (p <= 0 && last[0] === 0) return;
            const f = p * (n + 7);
            for (let i = 0; i < n; i++) {
                const v = Math.round(clamp(f - i) * 50) / 50;
                if (v !== last[i]) { last[i] = v; words[i].style.opacity = (.13 + .87 * v).toFixed(2); }
            }
        });
        if (reduce) words.forEach(w => (w.style.opacity = 1));
    });

    /* ═══ 09 · SERVICIOS ═══════════════════════════════════════ */
    safe('services', () => {
        const cards = $$('[data-svc]');
        const mqStack = matchMedia('(min-width: 1000px) and (min-height: 700px)');
        onFrame(s => {
            const on = mqStack.matches && !reduce;
            cards.forEach((card, i) => {
                const next = cards[i + 1];
                if (!on || !next) { if (card.style.transform) { card.style.transform = ''; card.style.filter = ''; } return; }
                const r = card.getBoundingClientRect(), nr = next.getBoundingClientRect();
                const p = clamp((r.top + r.height - nr.top) / (r.height - 10));
                const eased = ease.out(p);
                card.style.transform = `scale(${(1 - .055 * eased).toFixed(4)})`;
                card.style.filter = eased > .01 ? `brightness(${(1 - .05 * eased).toFixed(3)})` : '';
            });
        });

        // Parallax de las fotos
        const imgs = $$('[data-parallax-img]');
        onFrame(s => imgs.forEach(img => {
            const r = img.parentElement.getBoundingClientRect();
            if (r.bottom < -100 || r.top > s.vh + 100) return;
            const p = ((r.top + r.height / 2) - s.vh / 2) / (s.vh / 2 + r.height / 2);
            img.style.transform = `translate3d(0, ${(-p * r.height * .07).toFixed(1)}px, 0)`;
        }));
        $$('[data-parallax]').forEach(el => {
            const sp = parseFloat(el.dataset.parallax) || 0;
            onFrame(s => { const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > s.vh + 200) return; el.style.transform = `translate3d(0, ${(((r.top + r.height / 2) - s.vh / 2) * sp).toFixed(1)}px, 0)`; });
        });

        // Panel de diagnóstico en bucle
        const dPanel = $('.diag-panel');
        if (dPanel) {
            const items = $$('.diag-list li', dPanel), fill = $('#diag-fill'), pct = $('#diag-pct');
            let vis = false, p = 0;
            watch(dPanel.closest('.svc'), v => { vis = v; });
            onFrame(s => {
                if (!vis) return;
                p += s.dt / (reduce ? 1 : 6400); if (p > 1.22) p = 0;
                const q = clamp(p);
                fill.style.width = (q * 100).toFixed(1) + '%';
                pct.textContent = Math.round(q * 100) + '%';
                items.forEach((li, i) => {
                    li.classList.toggle('is-done', q >= (i + 1) / 4 - .001);
                    li.classList.toggle('is-on', q < (i + 1) / 4 - .001 && q >= i / 4);
                });
            });
        }

        // Dial de calibración
        const ticks = $('.d-ticks');
        if (ticks) {
            let g = '';
            for (let i = 0; i < 72; i++) {
                const a = i / 72 * Math.PI * 2, major = i % 6 === 0, r1 = 140, r2 = major ? 126 : 132;
                g += `<line class="${major ? 'mj' : ''}" x1="${(160 + Math.cos(a) * r1).toFixed(2)}" y1="${(160 + Math.sin(a) * r1).toFixed(2)}" x2="${(160 + Math.cos(a) * r2).toFixed(2)}" y2="${(160 + Math.sin(a) * r2).toFixed(2)}"/>`;
            }
            ticks.innerHTML = g;
            const val = $('#dial-val'), msg = $('#dial-msg');
            const steps = [['+4.2″', 'Verificando…'], ['+2.1″', 'Ajustando…'], ['+0.8″', 'Ajustando…'], ['+0.0″', 'Dentro de tolerancia']];
            let i = 0;
            watch(ticks.closest('.svc'), v => { if (v && !ticks._t) ticks._t = setInterval(() => { i = (i + 1) % steps.length; val.textContent = steps[i][0]; msg.textContent = steps[i][1]; }, 1900); else if (!v && ticks._t) { clearInterval(ticks._t); ticks._t = null; } });
        }
    });

    /* ═══ 10 · IMAGEN QUE SE EXPANDE ═══════════════════════════ */
    safe('expand', () => {
        const sec = $('#taller'), media = $('#xp-media'), over = $('#xp-over'), l = $('.xp-l'), r = $('.xp-r');
        if (!sec) return;
        let top = 0, range = 1, last = -1;
        onMeasure(s => { top = absTop(sec); range = Math.max(1, sec.offsetHeight - s.vh); });
        onFrame(s => {
            if (reduce) return;
            const p = clamp((s.y - top) / range);
            if (p === last) return; last = p;
            const e = ease.io(clamp(p / .62));
            const wide = s.vw >= 768;
            media.style.setProperty('--ix', lerp(wide ? 30 : 14, 0, e).toFixed(2) + '%');
            media.style.setProperty('--iy', lerp(wide ? 24 : 26, 0, e).toFixed(2) + '%');
            media.style.setProperty('--ir', lerp(28, 0, e).toFixed(1) + 'px');
            media.style.setProperty('--is', lerp(1.32, 1, e).toFixed(3));
            media.style.setProperty('--sh', clamp((p - .38) / .4).toFixed(3));
            const o = clamp((p - .6) / .28);
            over.style.opacity = o.toFixed(3);
            over.style.transform = `translate3d(0, ${((1 - o) * 46).toFixed(1)}px, 0)`;
            over.classList.toggle('is-live', o > .7);
            const fade = clamp(1 - e * 1.6);
            l.style.opacity = r.style.opacity = fade.toFixed(3);
            l.style.transform = `translate3d(${(-e * s.vw * .55).toFixed(1)}px, 0, 0)`;
            r.style.transform = `translate3d(${(e * s.vw * .55).toFixed(1)}px, 0, 0)`;
        });
        if (reduce) { over.style.opacity = 1; media.style.setProperty('--ix', '0%'); media.style.setProperty('--iy', '0%'); media.style.setProperty('--sh', '1'); }
    });

    /* ═══ 11 · EXPLORADOR DE EQUIPOS ═══════════════════════════ */
    safe('equip', () => {
        const tabs = $$('.eq-item'), panes = $$('.eq-pane'), cta = $('#eq-cta'), ctaT = $('#eq-cta-t'), prog = $('#eq-prog');
        if (!tabs.length) return;
        let cur = 0, auto = !reduce, hover = false, vis = false, t = 0;
        const DUR = 5200;
        const set = (i, user) => {
            if (user) auto = false;
            cur = i; t = 0;
            tabs.forEach((b, k) => { const on = k === i; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
            panes.forEach((p, k) => { p.hidden = k !== i; p.classList.toggle('is-active', k === i); });
            const name = panes[i].dataset.name;
            ctaT.textContent = 'Pedir precio de ' + name;
            cta.dataset.wa = `Hola Apex Survey, quiero información y precio de ${name}.`;
            applyWA();
            if (user) prog.style.transform = 'scaleX(0)';
        };
        tabs.forEach((b, i) => {
            b.addEventListener('click', () => set(i, true));
            b.addEventListener('mouseenter', () => { if (finePointer) set(i, true); });
            b.addEventListener('keydown', e => {
                if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
                e.preventDefault();
                const n = (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
                set(n, true); tabs[n].focus();
            });
        });
        const stage = $('#eq-stage');
        stage.addEventListener('pointerenter', () => { hover = true; }); stage.addEventListener('pointerleave', () => { hover = false; });
        watch($('#equipos'), v => { vis = v; });
        onFrame(s => {
            if (!auto || !vis || hover) return;
            t += s.dt;
            prog.style.transform = `scaleX(${clamp(t / DUR).toFixed(3)})`;
            if (t >= DUR) set((cur + 1) % tabs.length, false);
        });
        if (!auto) prog.parentElement.style.display = 'none';
    });

    /* ═══ 12 · COMPARADOR DE CALIBRACIÓN ═══════════════════════ */
    safe('compare', () => {
        const root = $('#cmp'), handle = $('#cmp-handle');
        if (!root) return;
        const svgs = $$('.cmp-svg', root);
        const rd = rand(77);
        const gauss = () => Math.sqrt(-2 * Math.log(rd() + 1e-9)) * Math.cos(2 * Math.PI * rd());
        const base = Array.from({ length: 34 }, () => [gauss(), gauss()]);
        const build = (svg, spread, bias, rpt) => {
            let g = '';
            for (let i = 40; i < 400; i += 40) g += `<line class="g" x1="${i}" y1="0" x2="${i}" y2="400"/><line class="g" x1="0" y1="${i}" x2="400" y2="${i}"/>`;
            [38, 82, 126, 170].forEach(r => g += `<circle class="r" cx="200" cy="200" r="${r}"/>`);
            g += `<line class="x" x1="200" y1="20" x2="200" y2="380"/><line class="x" x1="20" y1="200" x2="380" y2="200"/>`;
            base.forEach(([a, b], i) => {
                const x = 200 + bias[0] + a * spread, y = 200 + bias[1] + b * spread;
                g += `<circle class="p" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rpt}" style="--jx:${((rd() - .5) * 6).toFixed(1)}px;--jy:${((rd() - .5) * 6).toFixed(1)}px;--jd:${(2 + rd() * 2.5).toFixed(2)}s;--jl:${(-rd() * 3).toFixed(2)}s"/>`;
            });
            svg.innerHTML = g;
        };
        build(svgs[0], 58, [24, -18], 5.5);
        build(svgs[1], 9, [0, 0], 4.5);

        let pos = 50, user = false, drag = false, vis = false;
        const set = v => {
            pos = clamp(v, 4, 96);
            root.style.setProperty('--pos', pos.toFixed(2) + '%');
            handle.setAttribute('aria-valuenow', Math.round(pos));
        };
        const fromEvent = e => { const r = root.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
        root.addEventListener('pointerdown', e => { user = true; drag = true; root.classList.add('is-drag'); root.setPointerCapture(e.pointerId); fromEvent(e); });
        root.addEventListener('pointermove', e => { if (drag) fromEvent(e); });
        const end = () => { drag = false; root.classList.remove('is-drag'); };
        root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
        handle.addEventListener('keydown', e => {
            const step = e.shiftKey ? 15 : 5;
            if (e.key === 'ArrowLeft') { user = true; set(pos - step); e.preventDefault(); }
            else if (e.key === 'ArrowRight') { user = true; set(pos + step); e.preventDefault(); }
            else if (e.key === 'Home') { user = true; set(4); } else if (e.key === 'End') { user = true; set(96); }
        });
        watch(root, v => { vis = v; });
        onFrame(s => { if (!user && vis && !reduce) set(50 + Math.sin(s.t * .8) * 36); });
        set(50);
    });

    /* ═══ 13 · PROCESO ═════════════════════════════════════════ */
    safe('process', () => {
        const tl = $('#tl'), steps = $$('[data-step]');
        if (!tl) return;
        let top = 0, hgt = 1, tops = [];
        onMeasure(() => { top = absTop(tl); hgt = tl.offsetHeight; tops = steps.map(absTop); });
        onFrame(s => {
            const line = s.y + s.vh * .62;
            tl.style.setProperty('--tp', clamp((line - top - 30) / (hgt - 30)).toFixed(4));
            steps.forEach((st, i) => st.classList.toggle('is-on', line > tops[i] + 24));
        });
    });

    /* ═══ 14 · BENTO ═══════════════════════════════════════════ */
    safe('bento', () => {
        $$('.spot').forEach(el => el.addEventListener('pointermove', e => {
            const r = el.getBoundingClientRect();
            el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }));
        const words = $$('.bt-words b');
        if (words.length) { let i = 0; setInterval(() => { words[i].classList.remove('on'); i = (i + 1) % words.length; words[i].classList.add('on'); }, 1900); }
        const g = $('#gauge-n');
        if (g) setInterval(() => { g.textContent = '±' + (.8 + Math.random() * .5).toFixed(1); }, 900);
    });

    /* ═══ 15 · CIFRAS + RED DE CONTROL ═════════════════════════ */
    safe('counters', () => {
        const io = new IntersectionObserver(es => es.forEach(e => {
            if (!e.isIntersecting) return;
            io.unobserve(e.target);
            const el = e.target, to = +el.dataset.to, t0 = performance.now(), D = 1700;
            const step = n => { const p = clamp((n - t0) / D); el.textContent = Math.round(ease.out(p) * to); if (p < 1) requestAnimationFrame(step); };
            requestAnimationFrame(step);
        }), { threshold: .6 });
        $$('.count').forEach(c => io.observe(c));
    });
    safe('network', () => {
        const cv = $('#net');
        if (!cv) return;
        const ctx = cv.getContext('2d');
        let w = 0, h = 0, dpr = 1, nodes = [], vis = false, mx = -999, my = -999;
        const sec = cv.parentElement, rd = rand(31);
        const build = () => {
            dpr = Math.min(devicePixelRatio || 1, 2);
            w = sec.clientWidth; h = sec.clientHeight;
            cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = clamp(Math.round(w * h / 15000), 26, 80);
            nodes = Array.from({ length: n }, (_, i) => ({ x: rd() * w, y: rd() * h, vx: (rd() - .5) * .22, vy: (rd() - .5) * .22, tri: i % 7 === 0, i }));
        };
        onMeasure(build);
        watch(sec, v => { vis = v; });
        sec.addEventListener('pointermove', e => { const r = sec.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
        sec.addEventListener('pointerleave', () => { mx = my = -999; });
        const LINK = 150;
        onFrame(s => {
            if (!vis || !w) return;
            ctx.clearRect(0, 0, w, h);
            for (const n of nodes) {
                if (!reduce) { n.x += n.vx; n.y += n.vy; }
                if (n.x < 0 || n.x > w) n.vx *= -1; if (n.y < 0 || n.y > h) n.vy *= -1;
                const dx = mx - n.x, dy = my - n.y, dd = Math.hypot(dx, dy);
                if (dd < 170) { n.x += dx * .006; n.y += dy * .006; }
            }
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < LINK) {
                        const al = (1 - d / LINK) * .34;
                        ctx.strokeStyle = (i + j) % 11 === 0 ? `rgba(246,175,59,${al * 1.6})` : `rgba(255,255,255,${al})`;
                        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
                const dm = Math.hypot(a.x - mx, a.y - my);
                if (dm < 190) { ctx.strokeStyle = `rgba(213,0,7,${(1 - dm / 190) * .75})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke(); }
            }
            for (const n of nodes) {
                if (n.tri) {
                    ctx.strokeStyle = 'rgba(246,175,59,.9)'; ctx.lineWidth = 1.4; ctx.beginPath();
                    ctx.moveTo(n.x, n.y - 5); ctx.lineTo(n.x + 4.6, n.y + 3.4); ctx.lineTo(n.x - 4.6, n.y + 3.4); ctx.closePath(); ctx.stroke();
                    if (n.i % 14 === 0) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '10px JetBrains Mono, monospace'; ctx.fillText('P' + pad(n.i, 2), n.x + 9, n.y + 3); }
                } else { ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.beginPath(); ctx.arc(n.x, n.y, 1.8, 0, 6.283); ctx.fill(); }
            }
        });
    });

    /* ═══ 16 · PÚBLICO · SCROLL HORIZONTAL ═════════════════════ */
    safe('audience', () => {
        const sec = $('#publico'), track = $('#aud-track'), bar = $('#aud-prog');
        if (!sec || !track) return;
        const mq = matchMedia('(min-width: 1000px) and (min-height: 640px) and (hover: hover) and (pointer: fine)');
        let on = false, dist = 0, top = 0;
        onMeasure(s => {
            const should = mq.matches && !reduce;
            if (should !== on) { on = should; sec.classList.toggle('is-hscroll', on); if (!on) { sec.style.height = ''; track.style.transform = ''; } }
            if (!on) return;
            track.style.transform = 'none';
            const left = track.getBoundingClientRect().left;
            dist = Math.max(0, left + track.scrollWidth - s.vw + 64);
            sec.style.height = (s.vh + dist) + 'px';
            top = absTop(sec);
        });
        onFrame(s => {
            if (!on) return;
            const p = clamp((s.y - top) / Math.max(1, dist));
            track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
            bar.style.transform = `scaleX(${p.toFixed(4)})`;
        });
    });

    /* ═══ 17 · FAQ ═════════════════════════════════════════════ */
    safe('faq', () => {
        const items = $$('.acc-item');
        items.forEach(it => {
            const q = $('.acc-q', it);
            q.addEventListener('click', () => {
                const open = !it.classList.contains('is-open');
                items.forEach(o => { o.classList.remove('is-open'); $('.acc-q', o).setAttribute('aria-expanded', 'false'); });
                if (open) { it.classList.add('is-open'); q.setAttribute('aria-expanded', 'true'); }
            });
        });
    });

    /* ═══ 18 · FORMULARIO → WHATSAPP ═══════════════════════════ */
    safe('form', () => {
        const form = $('#wa-form');
        if (!form) return;
        const name = $('#f-name'), err = $('#e-name'), btn = $('#f-submit'), btnT = $('#f-submit-t');
        const defaultText = btnT.textContent;
        name.addEventListener('input', () => { name.parentElement.classList.remove('is-error'); err.textContent = ''; });
        form.addEventListener('submit', e => {
            e.preventDefault();
            const n = name.value.trim();
            if (n.length < 2) {
                name.parentElement.classList.add('is-error');
                err.textContent = 'Cuéntanos tu nombre para poder atenderte mejor.';
                name.focus();
                return;
            }
            const servicio = (form.querySelector('input[name="servicio"]:checked') || {}).value || 'Información general';
            const equipo = $('#f-equip').value.trim(), msg = $('#f-msg').value.trim();
            let text = `Hola ${CONFIG.brand}, soy ${n}.\nNecesito: ${servicio}.`;
            if (equipo) text += `\nMi equipo: ${equipo}.`;
            if (msg) text += `\n\n${msg}`;
            text += '\n\nQuedo atento/a a su respuesta. ¡Gracias!';
            btn.classList.add('is-sending'); btnT.textContent = 'Abriendo WhatsApp…';
            const url = waURL(text);
            const win = window.open(url, '_blank');
            if (win) win.opener = null; else location.href = url;
            setTimeout(() => { btn.classList.remove('is-sending'); btn.classList.add('is-done'); btnT.textContent = '¡Listo! Te esperamos en WhatsApp'; }, 500);
            setTimeout(() => { btn.classList.remove('is-done'); btnT.textContent = defaultText; form.reset(); }, 4800);
        });
    });

    /* ═══ 19 · REVEALS · MAGNÉTICOS · TILT ═════════════════════ */
    safe('reveals', () => {
        $$('[data-split]').forEach(h => splitWords(h, 'sw'));
        const io = new IntersectionObserver(es => es.forEach(e => {
            if (!e.isIntersecting) return;
            const el = e.target; io.unobserve(el);
            el.classList.add('in');
            if (el.hasAttribute('data-r')) setTimeout(() => { el.removeAttribute('data-r'); el.classList.remove('in'); el.style.removeProperty('--d'); }, 1900);
        }), { rootMargin: '0px 0px -9% 0px', threshold: .1 });
        $$('[data-r], [data-split]').forEach(el => io.observe(el));
    });
    if (finePointer && !reduce) {
        safe('magnetic', () => $$('[data-magnetic]').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                el.style.transform = `translate3d(${((e.clientX - r.left - r.width / 2) * .22).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * .32).toFixed(1)}px, 0)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        }));
        safe('tilt', () => $$('[data-tilt]').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
                el.style.transform = `perspective(700px) rotateY(${(x * 9).toFixed(2)}deg) rotateX(${(-y * 9).toFixed(2)}deg)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        }));
    }

    /* ═══ WhatsApp flotante ════════════════════════════════════ */
    const waFloat = $('.wa-float');
    function showWA() {
        if (!waFloat || waFloat.classList.contains('is-in')) return;
        waFloat.classList.add('is-in');
        setTimeout(() => waFloat.classList.add('show-tip'), 1200);
        setTimeout(() => waFloat.classList.remove('show-tip'), 7500);
    }

    /* ═══ 20 · ARRANQUE ════════════════════════════════════════ */
    measure();
    requestAnimationFrame(frame);
    addEventListener('load', measure);
    initLoader();
})();
