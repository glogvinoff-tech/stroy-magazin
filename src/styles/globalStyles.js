export const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  color-scheme: dark;
  --bg:#0d0f0e; --surface:#141716; --surface2:#1c1f1e; --surface3:#242827;
  --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.14);
  --text:#edf0ec; --muted:rgba(237,240,236,0.62); --muted2:rgba(237,240,236,0.38);
  --accent:#f97316; --accent2:#fb923c; --accent-glow:rgba(249,115,22,0.16);
  --yellow:#facc15; --green:#22c55e; --red:#ef4444;
  --ring:rgba(249,115,22,0.25);
  --overlay:rgba(0,0,0,0.76); --overlay2:rgba(0,0,0,0.58);
  --glass:rgba(0,0,0,0.22); --glass2:rgba(0,0,0,0.28); --glass-border:rgba(255,255,255,0.10);
  --fi-bg:rgba(0,0,0,0.42); --fi-bg-focus:rgba(0,0,0,0.62);
  --pop-bg:rgba(20,23,22,0.94); --pop-shadow:0 24px 60px rgba(0,0,0,0.80);
  --muted-strong:rgba(237,240,236,0.82);
  --gold:#f97316; --gold2:#fb923c; --gold-glow:rgba(249,115,22,0.16);
  --ff-d:'Bebas Neue',sans-serif;
  --ff-b:'Barlow',system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
  --ease:cubic-bezier(0.22,1,0.36,1); --ease2:cubic-bezier(0.16,1,0.3,1);
  --r-sm:6px; --r-md:12px; --r-lg:18px; --r-xl:50px;
  --shadow:0 24px 60px rgba(0,0,0,0.7); --hdr-h:66px;
  --fs-xs:12px; --fs-sm:13px; --fs-base:15px; --fs-md:16px; --fs-lg:18px;
}
:root[data-theme="light"]{
  color-scheme: light;
  --bg:#f4f4f2; --surface:#ffffff; --surface2:#ebebea; --surface3:#e0e0de;
  --border:rgba(0,0,0,0.09); --border2:rgba(0,0,0,0.18);
  --text:#111210; --muted:rgba(17,18,16,0.72); --muted2:rgba(17,18,16,0.48);
  --accent:#ea6c0a; --accent2:#f97316; --accent-glow:rgba(234,108,10,0.12);
  --ring:rgba(234,108,10,0.22);
  --overlay:rgba(0,0,0,0.34); --overlay2:rgba(0,0,0,0.22);
  --glass:rgba(255,255,255,0.74); --glass2:rgba(255,255,255,0.88); --glass-border:rgba(0,0,0,0.10);
  --fi-bg:rgba(255,255,255,0.90); --fi-bg-focus:#fff;
  --pop-bg:rgba(255,255,255,0.94); --pop-shadow:0 24px 60px rgba(0,0,0,0.18);
  --muted-strong:rgba(17,18,16,0.86);
  --gold:#ea6c0a; --gold2:#f97316; --gold-glow:rgba(234,108,10,0.12);
  --shadow:0 24px 60px rgba(0,0,0,0.16);
}
:root[data-theme="light"] body::after{opacity:.14;}
:root[data-theme="light"] .hdr{background:rgba(244,244,242,0.88);border-bottom:1px solid var(--border);}
:root[data-theme="light"] .hdr.compact{background:rgba(244,244,242,0.97);}
:root[data-theme="light"] .slide-fog-dark{opacity:0;}
:root[data-theme="light"] .slide-fog-light{opacity:1;}
:root[data-theme="light"] .slide img{filter:brightness(.75) saturate(.9);}
:root[data-theme="light"] .slide.cur img{filter:brightness(.82) saturate(1);}
:root[data-theme="light"] .price-card{background:rgba(255,255,255,0.82);box-shadow:0 24px 60px rgba(0,0,0,0.14);}
:root[data-theme="light"] .dot-el{background:rgba(17,18,16,0.20);}
:root[data-theme="light"] .dot-el:hover:not(.on){background:rgba(17,18,16,0.44);}
:root[data-theme="light"] .arr-btn{border:1px solid rgba(17,18,16,0.18);background:rgba(255,255,255,0.45);color:var(--text);}
:root[data-theme="light"] .arr-btn:hover{border-color:var(--accent);color:var(--accent);}
:root[data-theme="light"] .btn-hero-ghost{border-color:rgba(17,18,16,0.20);background:rgba(255,255,255,0.30);color:var(--text);}
:root[data-theme="light"] .slide-counter{color:rgba(17,18,16,0.60);}
:root[data-theme="light"] .btm{background:rgba(244,244,242,0.97);border-top:1px solid var(--border);}
:root[data-theme="light"] .mc-badge{background:rgba(255,255,255,0.80);border-color:rgba(17,18,16,0.14);}
:root[data-theme="light"] .dish-close{background:rgba(255,255,255,0.80);}
:root[data-theme="light"] .social-btn{background:rgba(255,255,255,0.55);box-shadow:0 10px 22px rgba(0,0,0,0.12);color:var(--text);}
:root[data-theme="light"] .social-btn:hover{background:rgba(255,255,255,0.75);}
:root.theme-anim body{transition:background-color .42s var(--ease),color .42s var(--ease);}

/* Reset */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;font-size:16px;}
body{font-family:var(--ff-b);background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;font-size:15px;line-height:1.65;}
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:9998;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.04'/%3E%3C/svg%3E");opacity:.4;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:var(--bg);}::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:2px;}
a{color:inherit;}
button{-webkit-tap-highlight-color:transparent;}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}

/* Focus */
.btn:focus-visible,.ico-btn:focus-visible,.nav-btn:focus-visible,.brand:focus-visible,.m-x:focus-visible,.pc-btn:focus-visible,.arr-btn:focus-visible,.submit:focus-visible,.social-btn:focus-visible,.sw-send:focus-visible,.admin-send:focus-visible{outline:none;box-shadow:0 0 0 3px var(--ring);}

/* HEADER */
.hdr{position:sticky;top:0;z-index:300;height:var(--hdr-h);padding:0 48px;display:flex;align-items:center;justify-content:space-between;background:rgba(13,15,14,0.88);backdrop-filter:blur(24px) saturate(160%);border-bottom:1px solid var(--border);transition:height .4s var(--ease),background .4s;}
.hdr.compact{height:56px;background:rgba(13,15,14,0.97);}
.brand{display:flex;flex-direction:column;gap:1px;user-select:none;background:none;border:none;padding:0;text-align:left;color:inherit;cursor:pointer;}
.brand-name{font-family:var(--ff-d);font-size:28px;letter-spacing:3px;text-transform:uppercase;line-height:1;color:var(--text);}
.brand-sub{font-size:8px;letter-spacing:5px;text-transform:uppercase;color:var(--accent);font-weight:500;}
.nav{display:flex;align-items:center;gap:4px;}
.nav-btn{position:relative;padding:8px 14px;font-family:var(--ff-b);font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:500;background:none;border:none;cursor:pointer;transition:color .3s;}
.nav-btn::after{content:'';position:absolute;bottom:4px;left:16px;right:16px;height:2px;background:var(--accent);transform:scaleX(0);transform-origin:center;transition:transform .35s var(--ease);}
.nav-btn:hover{color:var(--text);}.nav-btn:hover::after,.nav-btn.on::after{transform:scaleX(1);}.nav-btn.on{color:var(--accent);}
.hdr-right{display:flex;align-items:center;gap:8px;}
.ico-btn{width:40px;height:40px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;position:relative;transition:all .3s var(--ease);}
.ico-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-glow);transform:scale(1.05);}
.ico-btn .bdg{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:3px;background:var(--accent);color:#fff;font-size:9px;font-weight:700;border:2px solid var(--bg);display:flex;align-items:center;justify-content:center;}
.mobile-only{display:none;}
.hdr-pop{position:relative;}
.hdr-menu{position:absolute;right:0;top:calc(100% + 10px);min-width:220px;padding:8px;border-radius:var(--r-md);border:1px solid var(--border2);background:var(--pop-bg);backdrop-filter:blur(18px) saturate(150%);box-shadow:var(--pop-shadow);z-index:350;animation:modalIn .35s var(--ease);}
.hdr-menu-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--text);font-size:13px;cursor:pointer;transition:all .22s var(--ease);text-align:left;font-family:var(--ff-b);}
.hdr-menu-btn span{display:inline-flex;align-items:center;gap:10px;min-width:0;}
.hdr-menu-btn svg{color:var(--accent);opacity:.92;}
.hdr-menu-btn:hover{border-color:rgba(249,115,22,0.40);background:rgba(249,115,22,0.08);transform:translateY(-1px);}
.hdr-menu-btn.on{border-color:rgba(249,115,22,0.55);background:rgba(249,115,22,0.10);}
.hdr-menu-btn.danger:hover{border-color:rgba(239,68,68,0.55);background:rgba(239,68,68,0.08);}
.user-menu{position:relative;}
.user-pop{position:absolute;right:0;top:calc(100% + 10px);min-width:240px;padding:12px;border-radius:var(--r-md);border:1px solid var(--border2);background:var(--pop-bg);backdrop-filter:blur(18px) saturate(150%);box-shadow:var(--pop-shadow);z-index:350;animation:modalIn .35s var(--ease);}
.user-pop-head{color:var(--muted);font-size:11px;letter-spacing:1.2px;}
.user-pop-name{color:var(--text);font-family:var(--ff-d);font-size:26px;margin-top:2px;margin-bottom:12px;line-height:1.2;}
.user-pop-actions{display:flex;flex-direction:column;gap:8px;}
.user-pop-btn{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--glass-border);background:var(--glass);color:var(--text);cursor:pointer;transition:all .22s var(--ease);text-align:center;font-size:13px;font-family:var(--ff-b);}
.user-pop-btn:hover{border-color:rgba(249,115,22,0.40);background:rgba(249,115,22,0.08);transform:translateY(-1px);}
.user-pop-btn.danger{border-color:rgba(239,68,68,0.22);}
.user-pop-btn.danger:hover{border-color:rgba(239,68,68,0.55);background:rgba(239,68,68,0.10);color:#fff;}

/* HERO */
.hero{position:relative;height:calc(100vh - var(--hdr-h));min-height:520px;overflow:hidden;touch-action:pan-y;}
.slides-wrap{display:flex;height:100%;transition:transform .95s var(--ease2);}
.slide{min-width:100%;height:100%;position:relative;flex-shrink:0;overflow:hidden;}
.slide-img{position:absolute;inset:0;pointer-events:none;}
.slide-img img{position:absolute;inset:0;}
.slide-img-base{opacity:1;}
.slide-img-next{opacity:0;}
.slide-img.fading .slide-img-base{opacity:0;}
.slide-img.fading .slide-img-next{opacity:1;}
.slide-img-placeholder{background:radial-gradient(900px 220px at 10% 0%, rgba(249,115,22,0.08), transparent 60%),rgba(0,0,0,0.22);}
.slide img{width:100%;height:100%;object-fit:cover;filter:brightness(.48) saturate(.7);transition:opacity .42s var(--ease),filter .6s,transform 8s linear;}
.slide.cur img{filter:brightness(.55) saturate(.85);transform:scale(1.04);}
.slide-fog{position:absolute;inset:0;transition:opacity .42s var(--ease);}
.slide-fog-dark{background:linear-gradient(160deg,rgba(13,15,14,.05) 15%,rgba(13,15,14,.35) 55%,rgba(13,15,14,.96) 100%);opacity:1;}
.slide-fog-light{background:linear-gradient(160deg,rgba(244,244,242,.05) 15%,rgba(244,244,242,.62) 55%,rgba(244,244,242,.98) 100%);opacity:0;}
.slide-body{position:absolute;left:64px;bottom:80px;z-index:5;padding:24px 28px;border-radius:14px;background:rgba(13,15,14,0.52);backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(255,255,255,0.10);box-shadow:0 8px 40px rgba(0,0,0,0.28);max-width:500px;width:max-content;}
:root[data-theme="light"] .slide-body{background:rgba(244,244,242,0.70);border:1px solid rgba(0,0,0,0.09);}
.slide-tag{font-size:9px;letter-spacing:3.5px;text-transform:uppercase;color:var(--accent);font-weight:600;margin-bottom:14px;opacity:0;transform:translateY(12px);transition:all .6s var(--ease) .1s;}
.slide-h{font-family:var(--ff-d);font-size:clamp(52px,7vw,96px);font-weight:400;line-height:.95;color:#edf0ec;margin-bottom:16px;opacity:0;transform:translateY(22px);transition:all .7s var(--ease) .28s;letter-spacing:1px;}
:root[data-theme="light"] .slide-h{color:#111210;}
.slide-h em{font-style:normal;color:var(--accent2);}
.slide-p{font-size:16px;color:rgba(237,240,236,0.84);line-height:1.6;max-width:420px;opacity:0;transform:translateY(14px);transition:all .65s var(--ease) .44s;font-weight:300;}
:root[data-theme="light"] .slide-p{color:rgba(17,18,16,0.80);}
.slide-cta{margin-top:24px;opacity:0;transform:translateY(14px);transition:all .6s var(--ease) .58s;display:flex;gap:12px;flex-wrap:wrap;}
.slide.cur .slide-tag,.slide.cur .slide-h,.slide.cur .slide-p,.slide.cur .slide-cta{opacity:1;transform:none;}

/* Price card */
.price-card{position:absolute;right:64px;bottom:80px;z-index:10;background:rgba(20,23,22,0.88);backdrop-filter:blur(20px);border:1px solid var(--border2);border-radius:var(--r-md);padding:24px 28px;min-width:210px;opacity:0;transform:translateX(20px) translateY(10px);transition:all .8s var(--ease) .55s;box-shadow:var(--shadow);}
.slide.cur .price-card{opacity:1;transform:none;}
.pc-label{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);font-family:var(--ff-b);}
.pc-name{font-family:var(--ff-d);font-size:24px;color:var(--text);margin:8px 0 4px;letter-spacing:1px;}
.pc-price{font-family:var(--ff-d);font-size:44px;font-weight:400;color:var(--accent);line-height:1;letter-spacing:1px;}
.pc-price sup{font-size:18px;vertical-align:super;}
.pc-desc{font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5;}
.pc-btn{margin-top:16px;width:100%;padding:13px;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:var(--r-sm);color:#fff;font-family:var(--ff-b);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;cursor:pointer;transition:all .35s var(--ease);box-shadow:0 8px 24px rgba(249,115,22,.25);}
.pc-btn:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(249,115,22,.40);}

/* Slider controls */
.slider-ctrl{position:absolute;bottom:32px;left:80px;z-index:20;display:flex;align-items:center;gap:20px;}
.dots-row{display:flex;gap:8px;align-items:center;}
.dot-el{height:3px;background:rgba(255,255,255,.22);border:none;cursor:pointer;transition:all .45s var(--ease);padding:0;width:20px;border-radius:2px;}
.dot-el:hover:not(.on){background:rgba(255,255,255,.5);}.dot-el.on{width:44px;background:var(--accent);}
.arr-row{display:flex;gap:8px;}
.arr-btn{width:44px;height:44px;border-radius:var(--r-sm);border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);backdrop-filter:blur(8px);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s var(--ease);}
.arr-btn:hover{border-color:var(--accent);color:var(--accent);background:rgba(249,115,22,.1);transform:scale(1.08);}
.hero-timer{position:absolute;top:18px;left:48px;z-index:20;width:44px;height:44px;border-radius:var(--r-sm);background:var(--glass2);border:1px solid var(--glass-border);backdrop-filter:blur(14px) saturate(140%);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 22px rgba(0,0,0,0.25);transition:background-color .3s,border-color .3s;cursor:pointer;padding:0;}
.hero-timer:hover{border-color:rgba(249,115,22,0.5);background:rgba(249,115,22,0.12);}
.hero-timer.paused{border-color:rgba(249,115,22,0.45);background:rgba(249,115,22,0.1);}
.hero-timer svg{width:26px;height:26px;transform:rotate(-90deg);}
.hero-timer-track{stroke:var(--border2);stroke-width:3;fill:none;opacity:.9;}
.hero-timer-prog{stroke:var(--accent);stroke-width:3;fill:none;stroke-linecap:round;animation:heroTimer var(--hero-int, 6500ms) linear forwards;will-change:stroke-dashoffset;}
@keyframes heroTimer{to{stroke-dashoffset:0;}}
.slide-counter{position:absolute;top:28px;right:64px;z-index:20;font-family:var(--ff-d);font-size:13px;color:var(--muted);display:flex;align-items:center;gap:6px;transition:color .42s var(--ease);}
.slide-counter strong{color:var(--accent);font-size:26px;font-weight:400;}

/* Home reveal */
.reveal{opacity:0;transform:translateY(16px);filter:blur(6px);transition:opacity .9s var(--ease2),transform .9s var(--ease2),filter .9s var(--ease2);transition-delay:var(--d,0ms);will-change:transform,opacity,filter;}
.home-reveal.on .reveal{opacity:1;transform:none;filter:none;}
.home-band{padding:96px 64px 72px;max-width:1400px;margin:0 auto;content-visibility:auto;contain-intrinsic-size:720px;}
.home-band-inner{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;flex-wrap:wrap;}
.home-head{max-width:760px;}
.home-kicker{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--accent);margin-bottom:10px;font-weight:600;}
.home-title{font-family:var(--ff-d);font-size:clamp(44px,4.5vw,72px);font-weight:400;line-height:1;color:var(--text);letter-spacing:2px;}
.home-title em{font-style:normal;color:var(--accent2);}
.home-lead{margin-top:14px;color:var(--muted-strong);font-size:15px;line-height:1.8;max-width:560px;}
.home-actions{display:flex;gap:12px;flex-wrap:wrap;}
.home-cards{padding:0 64px 96px;max-width:1400px;margin:0 auto;content-visibility:auto;contain-intrinsic-size:520px;}
.home-cards-inner{border:1px solid var(--glass-border);border-radius:var(--r-md);background:radial-gradient(900px 220px at 10% 0%, rgba(249,115,22,0.12), transparent 60%),var(--glass);padding:26px;}
.home-cards-title{font-family:var(--ff-d);font-size:32px;color:var(--text);margin-bottom:18px;line-height:1;letter-spacing:1px;}
.home-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
.home-card{padding:18px;border-radius:var(--r-md);border:1px solid var(--glass-border);background:var(--glass);transition:transform .35s var(--ease),border-color .35s var(--ease),background .35s var(--ease);min-height:140px;position:relative;overflow:hidden;}
.home-card::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(500px 120px at 0% 0%, rgba(249,115,22,0.10), transparent 55%);}
.home-card:hover{border-color:rgba(249,115,22,0.38);background:rgba(249,115,22,0.06);transform:translateY(-2px);}
.home-card-ico{color:var(--accent);margin-bottom:12px;}
.home-card-h{font-size:11px;letter-spacing:2.8px;text-transform:uppercase;color:var(--text);margin-bottom:8px;font-weight:600;}
.home-card-p{color:var(--muted-strong);font-size:14px;line-height:1.7;max-width:260px;}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:10px;font-family:var(--ff-b);font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;cursor:pointer;border:none;transition:all .35s var(--ease);white-space:nowrap;}
.link-like{background:none;border:none;color:var(--accent);text-decoration:underline;cursor:pointer;padding:0;font-size:inherit}
.link-like:hover{color:var(--accent2);}
.btn-row{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;}
.btn-ghost{padding:11px 22px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--muted);}
.btn-ghost:hover{border-color:var(--accent);color:var(--text);background:var(--accent-glow);transform:translateY(-1px);}
.btn-gold{padding:12px 26px;border-radius:var(--r-sm);background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-weight:700;box-shadow:0 8px 24px rgba(249,115,22,.25);}
.btn-gold:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(249,115,22,.40);}
.btn-outline-gold{padding:11px 22px;border-radius:var(--r-sm);border:1px solid var(--accent);background:transparent;color:var(--accent);}
.btn-outline-gold:hover{background:var(--accent);color:#fff;}
.btn-hero{padding:14px 30px;border-radius:var(--r-sm);font-size:11px;letter-spacing:2.5px;}
.btn-hero-ghost{padding:13px 28px;border-radius:var(--r-sm);border:1px solid rgba(255,255,255,.22);background:transparent;color:var(--text);font-size:11px;letter-spacing:2px;}
.btn-hero-ghost:hover{border-color:var(--accent);color:var(--accent);}

/* Social auth */
.social-row{position:relative;display:flex;align-items:center;justify-content:center;gap:12px;padding:6px 0;}
.social-btn{width:52px;height:52px;border-radius:var(--r-sm);border:1px solid var(--border2);background:rgba(0,0,0,.35);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .3s var(--ease);box-shadow:0 10px 22px rgba(0,0,0,.25);}
.social-btn svg{display:block;}
.social-btn:hover:not(:disabled){border-color:var(--accent);background:var(--accent-glow);transform:translateY(-1px) scale(1.04);color:var(--accent2);}
.social-btn:disabled{opacity:.45;cursor:not-allowed;}
.social-popover{position:absolute;top:calc(100% + 10px);left:50%;transform:translateX(-50%);width:min(340px,92vw);background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-md);padding:12px;box-shadow:var(--pop-shadow);z-index:20;animation:modalIn .35s var(--ease);}
.social-popover-title{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;text-align:center;}
.social-popover-body{display:flex;justify-content:center;min-height:44px;}

/* BOTTOM BAR */
.btm{background:rgba(13,15,14,.97);backdrop-filter:blur(20px);border-top:1px solid var(--border);padding:14px 48px;display:flex;align-items:center;justify-content:space-between;gap:16px;}
.btm-left{display:flex;align-items:center;gap:12px;}
.v-div{width:1px;height:28px;background:var(--border2);}
.btn-cart{padding:12px 24px;font-size:10px;letter-spacing:2px;}
.btn-count{margin-left:6px;min-width:22px;height:20px;padding:0 8px;border-radius:4px;background:var(--glass);border:1px solid var(--glass-border);font-size:10px;display:inline-flex;align-items:center;justify-content:center;}

/* MENU PAGE (Каталог) */
.page{padding:80px 64px;max-width:1400px;margin:0 auto;}
.page-title{font-family:var(--ff-d);font-size:clamp(48px,6vw,80px);font-weight:400;color:var(--text);margin-bottom:8px;letter-spacing:2px;}
.page-title em{font-style:normal;color:var(--accent);}
.page-sub{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:48px;font-weight:500;}
.cat-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:48px;}
.cat-tab{padding:10px 20px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--muted);font-family:var(--ff-b);font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .3s var(--ease);font-weight:600;}
.cat-tab:hover{color:var(--text);background:rgba(255,255,255,.04);}.cat-tab.on{border-color:var(--accent);color:var(--accent);background:var(--accent-glow);}
.menu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;}
.menu-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;transition:all .4s var(--ease);}
.menu-card:hover{border-color:var(--border2);transform:translateY(-4px);box-shadow:0 24px 48px rgba(0,0,0,.5);}
.mc-img{position:relative;height:200px;overflow:hidden;cursor:pointer;}
.mc-img img{width:100%;height:100%;object-fit:cover;transition:transform .7s var(--ease),filter .5s;filter:brightness(.9) saturate(.85);}
.menu-card:hover .mc-img img{transform:scale(1.06);filter:brightness(1) saturate(1);}
.mc-badge{position:absolute;top:12px;left:12px;padding:4px 10px;border-radius:4px;background:rgba(13,15,14,.80);backdrop-filter:blur(8px);border:1px solid var(--border2);font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--accent);font-weight:700;}
.mc-body{padding:18px;}
.mc-name{font-family:var(--ff-d);font-size:22px;color:var(--text);margin-bottom:6px;letter-spacing:.5px;}
.mc-desc{font-size:13px;color:var(--muted-strong);line-height:1.6;margin-bottom:14px;}
.mc-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}
.tag-chip{padding:3px 10px;border-radius:4px;background:var(--surface3);color:var(--muted);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:500;}
.tag-chip.spicy{color:#f97316;}.tag-chip.veg{color:#22c55e;}.tag-chip.new{color:var(--accent);}
.mc-footer{display:flex;align-items:center;justify-content:space-between;}
.mc-price{font-family:var(--ff-d);font-size:28px;color:var(--accent);font-weight:400;}
.mc-price span{font-size:14px;}
.add-btn{display:flex;align-items:center;gap:7px;padding:10px 18px;border-radius:var(--r-sm);border:1px solid var(--accent);background:transparent;color:var(--accent);font-family:var(--ff-b);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;cursor:pointer;transition:all .3s var(--ease);}
.add-btn:hover,.add-btn.added{background:var(--accent);color:#fff;}

/* CART DRAWER */
.drawer-ov{position:fixed;inset:0;z-index:400;background:var(--overlay2);backdrop-filter:blur(8px);animation:fadeIn .3s ease;}
.drawer{position:fixed;right:0;top:0;bottom:0;z-index:401;width:min(560px,100vw);max-width:100vw;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;animation:slideInR .45s var(--ease);box-shadow:-24px 0 60px rgba(0,0,0,.5);overflow-x:hidden;}
@keyframes slideInR{from{transform:translateX(100%)}to{transform:translateX(0)}}
.d-hdr{padding:28px 28px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.d-title{font-family:var(--ff-d);font-size:32px;color:var(--text);letter-spacing:1px;}
.d-close{width:34px;height:34px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--muted);cursor:pointer;font-size:17px;display:flex;align-items:center;justify-content:center;transition:all .3s;}
.d-close:hover{border-color:var(--red);color:var(--red);transform:rotate(90deg);}
.d-items{flex:1;overflow-y:auto;overflow-x:hidden;padding:20px 28px;display:flex;flex-direction:column;gap:16px;min-width:0;}
.d-reservation{padding:12px;margin-bottom:12px;background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--r-sm);}
.d-reservation-title{font-size:14px;font-weight:700;color:var(--accent2);}
.d-reservation-line{margin-top:6px;color:var(--text);font-size:13px;}
.d-reservation-meta{margin-top:4px;color:var(--muted);font-size:13px;}
.cart-item{display:flex;gap:14px;padding:16px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);transition:border-color .3s;min-width:0;align-items:flex-start;}
.cart-item:hover{border-color:var(--border2);}
.ci-img{width:72px;height:72px;border-radius:var(--r-sm);overflow:hidden;flex-shrink:0;}
.ci-img img{width:100%;height:100%;object-fit:cover;}
.ci-info{flex:1;min-width:0;}
.ci-name{font-family:var(--ff-d);font-size:19px;color:var(--text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.5px;}
.ci-price{font-size:14px;color:var(--accent);margin-bottom:10px;}
.ci-qty{display:flex;align-items:center;gap:10px;}
.qty-btn{width:28px;height:28px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;transition:all .25s;}
.qty-btn:hover{border-color:var(--accent);color:var(--accent);}
.qty-v{font-size:14px;font-weight:600;min-width:20px;text-align:center;}
.ci-del{align-self:flex-start;background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;transition:color .2s;padding:4px;}
.ci-del:hover{color:var(--red);}
.d-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--muted);}
.d-empty-icon{font-size:52px;opacity:.25;}
.d-empty-txt{font-family:var(--ff-d);font-size:28px;letter-spacing:1px;}
.d-empty-sub{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;}
.d-foot{padding:24px 28px;border-top:1px solid var(--border);overflow-x:hidden;}
.d-total{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px;}
.d-total-label{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);font-weight:600;}
.d-total-price{font-family:var(--ff-d);font-size:42px;color:var(--accent);font-weight:400;}

/* MODALS */
.modal-ov{position:fixed;inset:0;z-index:500;background:var(--overlay);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .3s ease;}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal{background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);width:100%;max-width:460px;box-shadow:var(--shadow);animation:modalIn .48s var(--ease);overflow:hidden;max-height:90vh;overflow-y:auto;}
.modal.modal-sm{max-width:400px;}
.modal.modal-md{max-width:520px;}
.modal.modal-lg{max-width:760px;}
.modal.modal-xl{max-width:980px;}
.modal.reserve-modal{max-width:min(1180px,calc(100vw - 32px));}
@keyframes modalIn{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:none}}
.m-hdr{padding:28px 28px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--surface);z-index:2;}
.m-ttl{font-family:var(--ff-d);font-size:30px;color:var(--text);display:flex;align-items:center;gap:12px;letter-spacing:1px;}
.m-ttl .ico{color:var(--accent);}
.m-x{width:34px;height:34px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--muted);cursor:pointer;font-size:17px;display:flex;align-items:center;justify-content:center;transition:all .3s;}
.m-x:hover{border-color:var(--red);color:var(--red);transform:rotate(90deg);}
.m-body{padding:28px;}
.m-ftr{padding:18px 28px 26px;border-top:1px solid var(--border);text-align:center;}
.m-ftr p{font-size:12px;color:var(--muted);margin:6px 0;}
.m-ftr a{color:var(--accent);cursor:pointer;transition:color .2s;text-decoration:none;}
.m-ftr a:hover{color:var(--accent2);}
.fg{margin-bottom:20px;}
.fl{display:flex;align-items:center;gap:7px;margin-bottom:9px;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);font-weight:600;}
.fl svg{color:var(--accent);}
.fi{width:100%;padding:13px 16px;background:var(--fi-bg);border:1px solid var(--border2);border-radius:var(--r-sm);color:var(--text);font-family:var(--ff-b);font-size:14px;outline:none;transition:all .3s;appearance:none;}
.fi:focus{border-color:var(--accent);background:var(--fi-bg-focus);box-shadow:0 0 0 3px var(--ring);}
.fi::placeholder{color:var(--muted2);}
.fi-row{display:flex;gap:14px;}
.fi-row .fg{flex:1;}
.f-check{display:flex;align-items:flex-start;gap:10px;margin:14px 0;}
.f-check input{margin-top:3px;accent-color:var(--accent);cursor:pointer;}
.f-check label{font-size:11px;color:var(--muted);line-height:1.55;cursor:pointer;}
.f-check a{color:var(--accent);text-decoration:none;}
.submit{width:100%;padding:15px;margin-top:6px;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:var(--r-sm);color:#fff;font-family:var(--ff-b);font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;transition:all .35s var(--ease);box-shadow:0 8px 24px rgba(249,115,22,.25);}
.submit:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 40px rgba(249,115,22,.38);}
.submit:disabled{opacity:.45;cursor:not-allowed;}
.submit.no-mt{margin-top:0;}

/* Reservation */
.reserve-need-auth{text-align:center;}
.reserve-need-auth-body{padding:40px 20px;}
.reserve-need-auth-ico{display:flex;justify-content:center;margin-bottom:16px;}
.reserve-need-auth-ico svg{width:48px;height:48px;color:var(--accent);}
.reserve-need-auth-text{font-size:16px;margin-bottom:20px;line-height:1.6;color:var(--muted-strong);}
.date-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;}
.gs-wrap{display:flex;align-items:center;gap:12px;margin-top:6px;}
.gs-btn{width:36px;height:36px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;transition:all .25s;}
.gs-btn:hover{border-color:var(--accent);color:var(--accent);}
.gs-val{font-family:var(--ff-d);font-size:28px;color:var(--accent);min-width:32px;text-align:center;}
.gs-label{font-size:11px;color:var(--muted);}
.reserve-layout{display:grid;grid-template-columns:minmax(320px,0.95fr) minmax(420px,1.25fr);gap:20px;align-items:start;}
.reserve-side,.reserve-plan{min-width:0;}
.reserve-plan-canvas{width:100%;max-width:none;}

/* Footer credit */
.site-credit{padding:18px 24px 10px;text-align:center;color:var(--muted);font-size:11px;letter-spacing:1.2px;}
.site-credit strong{color:var(--accent2);font-weight:600;}
.site-credit a{color:var(--accent);text-decoration:none;}
.site-credit a:hover{color:var(--accent2);}

/* Dish detail modal */
.dish-hero{position:relative;}
.dish-close{position:absolute;top:16px;right:16px;background:rgba(13,15,14,.75);backdrop-filter:blur(8px);}
.dish-badge{top:16px;left:16px;}
.dish-tags{margin-bottom:12px;}
.dish-img{width:100%;height:260px;object-fit:cover;}
.dish-body{padding:28px;}
.dish-name{font-family:var(--ff-d);font-size:36px;color:var(--text);margin-bottom:10px;letter-spacing:1px;}
.dish-meta{display:flex;gap:16px;margin-bottom:16px;}
.dm-item{display:flex;flex-direction:column;gap:3px;}
.dm-label{display:flex;align-items:center;gap:8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);font-weight:600;}
.dm-label svg{width:12px;height:12px;color:var(--accent);}
.dm-val{font-family:var(--ff-d);font-size:20px;color:var(--accent);}
.dish-desc{font-size:14px;color:var(--muted-strong);line-height:1.75;margin-bottom:18px;}
.dish-ingr{font-size:12px;color:var(--muted);margin-bottom:24px;}
.dish-ingr strong{color:var(--text);letter-spacing:.5px;}
.dish-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.dish-price{font-family:var(--ff-d);font-size:48px;font-weight:400;color:var(--accent);}
.dish-price sup{font-size:22px;vertical-align:super;}

/* TOAST */
.toast-wrap{position:fixed;bottom:28px;right:28px;z-index:9000;display:flex;flex-direction:column;gap:10px;pointer-events:none;}
.toast{padding:14px 20px;border-radius:var(--r-sm);background:var(--surface2);border:1px solid var(--border2);color:var(--text);font-size:12px;box-shadow:0 16px 40px rgba(0,0,0,.6);display:flex;align-items:center;gap:10px;animation:toastIn .4s var(--ease);max-width:300px;font-family:var(--ff-b);}
.toast.ok{border-color:rgba(249,115,22,.35);}.toast.err{border-color:rgba(239,68,68,.35);}
@keyframes toastIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}

/* Admin */
.pc-admin-edit{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:var(--r-sm);border:1px solid rgba(249,115,22,0.45);background:rgba(249,115,22,0.12);color:var(--accent2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s var(--ease);z-index:10;}
.pc-admin-edit:hover{background:rgba(249,115,22,0.25);border-color:var(--accent);transform:scale(1.08);}

/* RESPONSIVE */
@media(max-width:1280px){
  .hdr{padding:0 32px;}
  .btm{padding:14px 32px;}
  .home-band{padding:80px 40px 60px;}
  .home-cards{padding:0 40px 80px;}
  .page{padding:72px 40px;}
}
@media(max-width:900px){
  .hdr{padding:0 20px;}.nav{display:none;}.mobile-only{display:flex;}
  .hdr-menu,.user-pop{min-width:min(320px, calc(100vw - 40px));}
  .slide-body{left:20px;right:20px;bottom:100px;width:auto;max-width:calc(100vw - 40px);}.price-card{display:none;}
  .btm{padding:12px 18px;gap:10px;}.page{padding:48px 24px;}
  .home-band{padding:64px 20px 52px;}.home-cards{padding:0 20px 64px;}
  .home-grid{grid-template-columns:1fr 1fr;}.home-cards-inner{padding:18px;}
  .menu-grid{grid-template-columns:1fr 1fr;}.slider-ctrl{left:20px;bottom:24px;}
  .hero-timer{left:20px;}
  .slide-counter{right:20px;}
  .slide-cta{gap:8px;}
}
@media(max-width:640px){
  .hdr{padding:0 14px;}
  .hdr-right{gap:6px;}
  .ico-btn{width:36px;height:36px;font-size:13px;}
  .brand-name{font-size:24px;letter-spacing:2px;}
  .hero{height:clamp(460px,72svh,680px);min-height:0;}
  .slide-body{left:16px;right:16px;bottom:80px;padding:16px 18px;}
  .slide-h{font-size:clamp(38px,10vw,60px);}
  .slide-p{font-size:15px;max-width:100%;}
  .slider-ctrl{left:16px;bottom:14px;}
  .hero-timer{left:16px;top:14px;}
  .slide-counter{right:16px;top:22px;}
  .arr-row{display:none;}
  .hdr-pop,.user-menu{position:static;}
  .hdr-menu{position:absolute;top:calc(100% + 6px);left:10px;right:10px;min-width:0;max-width:none;}
  .user-pop{position:absolute;top:calc(100% + 6px);right:10px;left:auto;min-width:min(240px,calc(100vw - 20px));}
}
@media(max-width:540px){
  .menu-grid{grid-template-columns:1fr;}.fi-row{flex-direction:column;gap:0;}
  .btm{flex-direction:column;align-items:stretch;gap:8px;padding:12px 16px;}
  .btm-left{justify-content:center;}
  .btn-cart{justify-content:center;}
  .v-div{display:none;}
  .social-btn{width:56px;height:56px;}
  .home-grid{grid-template-columns:1fr;}.home-actions{width:100%;}
  .home-actions .btn{flex:1;justify-content:center;}
  .slide-cta{flex-direction:column;align-items:flex-start;gap:8px;}
  .btn-hero,.btn-hero-ghost{width:100%;justify-content:center;}
  .toast-wrap{bottom:130px;right:14px;left:14px;}
  .toast{max-width:none;}
  .d-hdr{padding:16px 16px 12px;}
  .d-title{font-size:26px;}
  .d-items{padding:12px 16px;gap:12px;}
  .d-foot{padding:12px 16px;}
  .cart-item{padding:12px;gap:10px;}
  .ci-img{width:60px;height:60px;}
  .ci-name{font-size:16px;}
  .d-total{margin-bottom:12px;}
  .d-total-price{font-size:32px;}
  .m-ttl{font-size:24px;}
  .date-row{grid-template-columns:1fr;}
  .reserve-layout{grid-template-columns:1fr;gap:14px;}
  .modal.reserve-modal{max-width:calc(100vw - 12px);}
  .site-credit{padding:14px 18px 6px;font-size:10px;}
  .modal-ov{padding:10px;}
  .modal{border-radius:var(--r-sm);}
  .m-hdr{padding:20px 20px 16px;}
  .m-body{padding:20px;}
  .m-ftr{padding:14px 20px 20px;}
}
@media(max-width:400px){
  .hdr{padding:0 10px;}
  .hdr-right{gap:4px;}
  .ico-btn{width:32px;height:32px;font-size:12px;}
  .brand-name{font-size:20px;letter-spacing:1px;}
  .brand-sub{letter-spacing:3px;}
}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto;}
  *,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important;}
  .slides-wrap{transition:none!important;}
  .slide img{transition:none!important;transform:none!important;}
}

/* Readability */
.user-pop-head{font-size:13px;}
.user-pop-btn{font-size:14px;}
.slide-tag{font-size:11px;}
.home-kicker{font-size:12px;}
.home-card-h{font-size:12px;}
.mc-desc{font-size:14px;color:var(--muted-strong);}
.mc-name{font-size:19px;color:var(--text);}
.mc-price{font-size:22px;color:var(--accent);}
.mc-price span{font-size:13px;}
.mc-price-now{font-size:22px;}
.mc-price-was{font-size:13px;}
.mc-price-disc{font-size:12px;}
.add-btn{font-size:12px;}
.d-title{font-size:24px;}
.ci-name{font-size:16px;color:var(--text);}
.ci-price{font-size:17px;color:var(--accent);}
.fl{font-size:14px;color:var(--muted-strong);}
.fi{font-size:15px;color:var(--text);}
.d-total-label{font-size:15px;color:var(--muted-strong);}
.d-total-price{font-size:26px;color:var(--text);}
.page-sub{font-size:16px;color:var(--muted-strong);}
.cat-tab{font-size:13px;}
.f-lbl{font-size:13px;}
.f-count{font-size:12px;}
.sw-bubble{font-size:15px;}
.sw-title{font-size:16px;}
.sw-sub{font-size:13px;color:var(--muted-strong);}
.tag-chip{font-size:12px;}
.m-ttl{font-size:22px;color:var(--text);}
`;
