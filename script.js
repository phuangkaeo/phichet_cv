(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* header takes over from the hero portrait */
  var bar = document.getElementById('bar');
  var portrait = document.getElementById('portrait');
  function onScroll(){
    var past = window.scrollY > 150;
    bar.classList.toggle('stuck', past);
    if(portrait) portrait.classList.toggle('fade', past);
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* figures */
  function runCount(el){
    if(el.dataset.done) return;
    el.dataset.done = '1';
    var target = parseFloat(el.dataset.count);
    var dec = parseInt(el.dataset.dec || '0', 10);
    var suffix = el.dataset.suffix || '';
    function fmt(n){
      if(dec > 0) return n.toFixed(dec);
      return n >= 1000 ? n.toLocaleString('fr-FR').replace(/ /g,' ') : String(n);
    }
    if(reduce){ el.textContent = fmt(target) + suffix; return; }
    var start = null, dur = 1000;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(dec > 0 ? target * eased : Math.round(target * eased)) + suffix;
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* bars grow to their value */
  function runBars(root){
    if(root.dataset.done) return;
    root.dataset.done = '1';
    root.querySelectorAll('.fill').forEach(function(bar, i){
      setTimeout(function(){ bar.style.width = bar.dataset.pct + '%'; }, reduce ? 0 : i * 90);
    });
    setTimeout(function(){ root.classList.add('drawn'); }, reduce ? 0 : 260);
  }

  /* pipeline lights up in order, because the order is the point */
  function runPipeline(root){
    if(root.dataset.done) return;
    root.dataset.done = '1';
    root.querySelectorAll('.stage').forEach(function(el, i){
      setTimeout(function(){ el.classList.add('on'); }, reduce ? 0 : i * 230);
    });
  }

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      var el = e.target;
      if(el.classList.contains('chartblock')) runBars(el);
      if(el.classList.contains('countup')) el.querySelectorAll('[data-count]').forEach(runCount);
      if(el.id === 'pipeline') runPipeline(el);
      io.unobserve(el);
    });
  }, {threshold:0.25, rootMargin:'0px 0px -40px 0px'});

  document.querySelectorAll('.chartblock, .countup, #pipeline')
    .forEach(function(el){ io.observe(el); });

  /* the hero plot: scattered readings settling onto a trend */
  var trendBox = document.getElementById('trend');

  function labels(){
    return document.documentElement.lang === 'en'
      ? ['raw data', 'indicator']
      : ['données brutes', 'indicateur'];
  }

  function buildTrend(settled){
    if(!trendBox) return null;
    var svg = trendBox.querySelector('svg');
    var NS = 'http://www.w3.org/2000/svg';
    var W = Math.max(320, trendBox.clientWidth || window.innerWidth);
    var H = Math.round(Math.min(300, Math.max(150, window.innerHeight * 0.26)));
    var n = W < 640 ? 34 : (W < 1100 ? 54 : 74);
    var pad = W < 640 ? 18 : 46;
    var top = 26, bottom = H - 30;

    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.textContent = '';

    // the trend: rising overall, but with real dips and recoveries on the way
    function fy(x){
      var t = (x - pad) / (W - pad * 2);
      var v = t * 0.55
            + Math.sin(t * 7.5 - 0.4) * 0.26
            + Math.sin(t * 3.0 + 0.8) * 0.10
            + t * 0.22;
      return bottom - v * (bottom - top);
    }
    var noise = [9,-12,5,-7,14,-4,-10,6,3,-14,10,-5,12,-8,4,-3,-13,8,6,-9,
                 11,-6,-4,13,-11,3,7,-8,5,10,-13,4,-5,12,-7,9,-3,6,-10,8,-6,11,
                 -2,7,-9,4,13,-5,-11,8];

    function add(tag, attrs, cls){
      var el = document.createElementNS(NS, tag);
      for(var k in attrs) el.setAttribute(k, attrs[k]);
      if(cls) el.setAttribute('class', cls);
      svg.appendChild(el);
      return el;
    }

    for(var g = 1; g <= 3; g++){
      var gy = top + (bottom - top) * (g / 4);
      add('line', {x1:0, y1:gy, x2:W, y2:gy}, 'grid');
    }
    add('line', {x1:0, y1:bottom, x2:W, y2:bottom}, 'base');

    // sample the curve, then join the samples with cubic beziers so the
    // line bends instead of turning corners
    var pts = [], segs = 34, step = (W - pad * 2) / segs;
    for(var k = 0; k <= segs; k++){
      var px = pad + k * step;
      pts.push([px, fy(px)]);
    }
    var line = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for(var k = 0; k < pts.length - 1; k++){
      var p0 = pts[k === 0 ? 0 : k - 1],
          p1 = pts[k],
          p2 = pts[k + 1],
          p3 = pts[k + 2 < pts.length ? k + 2 : pts.length - 1];
      // Catmull-Rom control points, converted to bezier
      var c1x = p1[0] + (p2[0] - p0[0]) / 6,
          c1y = p1[1] + (p2[1] - p0[1]) / 6,
          c2x = p2[0] - (p3[0] - p1[0]) / 6,
          c2y = p2[1] - (p3[1] - p1[1]) / 6;
      line += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1)
            + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1)
            + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    add('path', {d: line + ' L' + (W - pad) + ' ' + bottom + ' L' + pad + ' ' + bottom + ' Z'}, 'area');
    var path = add('path', {d: line}, 'line');
    var len = 0;
    try{ len = path.getTotalLength(); }catch(e){}
    path.style.setProperty('--len', (len || W * 1.4).toFixed(0));

    for(var i = 0; i < n; i++){
      var x = pad + (i / (n - 1)) * (W - pad * 2);
      var y = fy(x) + noise[i % noise.length] * (H / 150);
      var c = add('circle', {
        cx: x.toFixed(1),
        cy: Math.max(top - 10, Math.min(bottom - 2, y)).toFixed(1),
        r: W < 640 ? 2.4 : 3
      }, 'dot');
      c.style.setProperty('--from', (noise[(i * 7) % noise.length] * 3.2 - 12).toFixed(1) + 'px');
      c.style.transitionDelay = (i * 13) + 'ms';
    }

    // where the line ends is the point of the whole thing
    var ex = W - pad, ey = fy(ex);
    add('circle', {cx: ex.toFixed(1), cy: ey.toFixed(1), r: 4.5}, 'head');

    var txt = labels();
    var a = add('text', {x: pad, y: bottom + 20}, 'mark');
    a.textContent = txt[0];
    var b = add('text', {x: ex, y: ey - 14, 'text-anchor': 'end'}, 'mark');
    b.textContent = txt[1];

    if(settled) trendBox.classList.add('settled');
    return trendBox;
  }

  var rebuild;
  window.addEventListener('resize', function(){
    clearTimeout(rebuild);
    rebuild = setTimeout(function(){
      if(trendBox) buildTrend(trendBox.classList.contains('settled'));
    }, 220);
  });

  /* one opening sequence, then the page sits still */
  function intro(){
    buildTrend(false);
    var steps = [];
    var role = document.getElementById('role');
    var words = Array.prototype.slice.call(document.querySelectorAll('h1 .w'));
    var lead = document.getElementById('lead');
    var portrait2 = document.getElementById('portrait');
    var rows = Array.prototype.slice.call(document.querySelectorAll('.facts dl'));

    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ document.body.classList.add('ready'); });
    });

    if(reduce){
      if(role) role.classList.add('in');
      words.forEach(function(w){ w.classList.add('in'); });
      if(lead) lead.classList.add('in');
      if(portrait2) portrait2.classList.add('in');
      rows.forEach(function(r){ r.classList.add('in'); });
      if(trendBox) trendBox.classList.add('settled');
      return;
    }

    if(role) steps.push([role, 420]);
    words.forEach(function(w, i){ steps.push([w, 520 + i * 120]); });
    if(portrait2) steps.push([portrait2, 660]);
    if(lead) steps.push([lead, 940]);
    rows.forEach(function(r, i){ steps.push([r, 1150 + i * 90]); });

    steps.forEach(function(pair){
      setTimeout(function(){ pair[0].classList.add('in'); }, pair[1]);
    });
    if(trendBox) setTimeout(function(){ trendBox.classList.add('settled'); }, 1200);
  }

  /* smooth scrolling, if the library arrives */
  function smooth(){
    if(reduce || !window.Lenis) return;
    var lenis = new Lenis({
      duration: 1.15,
      easing: function(t){ return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    function raf(time){ lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach(function(a){
      a.addEventListener('click', function(e){
        var el = document.querySelector(a.getAttribute('href'));
        if(!el) return;
        e.preventDefault();
        lenis.scrollTo(el, {duration: 1.4});
      });
    });
  }
  if(document.readyState === 'complete') smooth();
  else window.addEventListener('load', smooth);

  /* language */
  var fr = document.getElementById('btn-fr'), en = document.getElementById('btn-en');
  function setLang(lang){
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-fr]').forEach(function(el){
      var v = el.getAttribute('data-' + lang);
      if(v !== null) el.innerHTML = v;
    });
    if(trendBox) buildTrend(trendBox.classList.contains('settled'));
    fr.setAttribute('aria-pressed', lang === 'fr');
    en.setAttribute('aria-pressed', lang === 'en');
    try{ localStorage.setItem('cv-lang', lang); }catch(e){}
  }
  fr.addEventListener('click', function(){ setLang('fr'); });
  en.addEventListener('click', function(){ setLang('en'); });
  try{
    if(localStorage.getItem('cv-lang') === 'en') setLang('en');
  }catch(e){}

  intro();
})();
