// 게임 루프 + 웨이브 관리 + 전투 판정 허브 (타격감 연출은 hitEnemy/hurtPlayer에 집중)
const Game = {
  state: 'start', // start | play | over
  player: null,
  enemies: [],
  arrows: [],
  pickups: [],
  markers: [],        // 스폰 예고 마커
  pendingSpawns: [],  // 웨이브 스폰 대기열
  wave: 0,
  kills: 0,
  time: 0,
  waveRest: 0,
  hitstop: 0,         // 히트스톱: 이 시간 동안 게임 정지 (타격감)
  banner: null,
  vignette: 0,
  blinkT: 0,

  restart() {
    this.player = createPlayer(Renderer.W / 2, Renderer.H / 2);
    this.enemies = [];
    this.arrows = [];
    this.pickups = [];
    this.markers = [];
    this.pendingSpawns = [];
    this.wave = 0;
    this.kills = 0;
    this.time = 0;
    this.waveRest = 1.2;
    this.hitstop = 0;
    this.banner = null;
    this.vignette = 0;
    Particles.clear();
    this.state = 'play';
  },

  // ── 웨이브 구성: 슬라임 기본 + 2웨이브부터 궁수 + 3웨이브부터 멧돼지 ──
  nextWave() {
    this.wave++;
    const comp = [];
    const slimes = Math.min(2 + this.wave, 9);
    const archers = Math.min(Math.max(0, this.wave - 1), 4);
    const boars = Math.min(Math.floor(this.wave / 3), 3);
    for (let i = 0; i < slimes; i++) comp.push('slime');
    for (let i = 0; i < archers; i++) comp.push('archer');
    for (let i = 0; i < boars; i++) comp.push('boar');

    // 시차를 두고 순차 스폰 (한꺼번에 쏟아지지 않게)
    comp.forEach((type, i) => {
      this.pendingSpawns.push({ delay: i * 0.35, type });
    });

    this.banner = { text: `WAVE ${this.wave}`, life: 1.6, maxLife: 1.6 };
    AudioSys.wave();
  },

  // ── 전투 판정 허브: 타격감 연출을 한 곳에서 처리 ──
  hitEnemy(e, dmg, dir, { crit = false, kb = 190 } = {}) {
    e.hp -= dmg;
    e.flash = 0.1;
    e.kbx += dir.x * kb;
    e.kby += dir.y * kb;

    // 히트스톱 + 셰이크 + 파티클 + 사운드 + 데미지 숫자
    this.hitstop = Math.max(this.hitstop, crit ? 0.09 : 0.04);
    Renderer.shake(crit ? 4 : 2, 0.12);
    Particles.burst(e.x, e.y, {
      count: crit ? 12 : 6,
      colors: ['#ffffff', '#f7b32b', '#ffd866'],
      speed: 160, life: 0.3, size: 3,
      dir: Math.atan2(dir.y, dir.x), spread: 1.6,
    });
    Particles.text(e.x, e.y - 22, String(dmg), {
      color: crit ? '#f7b32b' : '#ffffff',
      size: crit ? 22 : 15,
    });
    if (crit) AudioSys.crit(); else AudioSys.hit();

    if (e.hp <= 0) this.killEnemy(e, dir);
  },

  killEnemy(e, dir) {
    e.dead = true;
    this.kills++;
    this.hitstop = Math.max(this.hitstop, 0.08);
    Renderer.shake(3, 0.15);
    AudioSys.die();
    // 픽셀 파편으로 산산조각
    const palette = { slime: ['#38b764', '#a7f070', '#257179'], archer: ['#e8e0cf', '#a99e8c'], boar: ['#8d5a3b', '#5e3a26'] }[e.type];
    Particles.burst(e.x, e.y, {
      count: 18, colors: palette, speed: 190, life: 0.55, size: 4,
      gravity: 300, dir: Math.atan2(dir.y, dir.x), spread: 2.6,
    });
    // 12% 확률 하트 드랍 (긴 세션 유지용)
    if (Math.random() < 0.12) {
      this.pickups.push({ x: e.x, y: e.y, t: 0, r: 12 });
    }
  },

  hurtPlayer(dmg, dir, kb = 260) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'play') return;
    p.hp -= dmg;
    p.invuln = 0.9;
    p.kbx = dir.x * kb;
    p.kby = dir.y * kb;
    this.hitstop = Math.max(this.hitstop, 0.06);
    this.vignette = 0.6;
    Renderer.shake(6, 0.3);
    AudioSys.hurt();
    Particles.burst(p.x, p.y, {
      count: 10, colors: ['#e43b44', '#8a1c2c'], speed: 140, life: 0.4, size: 3,
    });

    if (p.hp <= 0) {
      p.hp = 0;
      this.state = 'over';
      AudioSys.gameover();
      Renderer.shake(8, 0.5);
      Particles.burst(p.x, p.y, {
        count: 30, colors: ['#3b5dc9', '#94a1b8', '#f0c297'], speed: 220, life: 0.8, size: 4, gravity: 250,
      });
    }
  },

  spawnArrow(x, y, dir) {
    this.arrows.push({ x, y, dir, speed: 310, r: 4, life: 3 });
  },

  tick(dt) {
    this.blinkT += dt;

    if (this.state === 'start') {
      if (Input.anyKeyPressed || Input.mouse.justDown) this.restart();
      return;
    }
    if (this.state === 'over') {
      Particles.update(dt);
      if (Input.pressed('KeyR') || Input.mouse.justDown) this.restart();
      return;
    }

    if (Input.pressed('KeyM')) AudioSys.toggleMute();

    // 히트스톱: 시간 자체를 멈춘다 (렌더링은 계속)
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    this.time += dt;
    if (this.vignette > 0) this.vignette -= dt * 1.5;
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    if (window.__demoBot) window.__demoBot(this, dt);

    this.player.update(dt, this);

    // ── 스폰 대기열 → 예고 마커 → 적 등장 ──
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const s = this.pendingSpawns[i];
      s.delay -= dt;
      if (s.delay <= 0) {
        const pos = World.randomSpawnPos(this.player);
        this.markers.push({ x: pos.x, y: pos.y, type: s.type, t: 0.7 });
        this.pendingSpawns.splice(i, 1);
      }
    }
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.t -= dt;
      if (m.t <= 0) {
        this.enemies.push(createEnemy(m.type, m.x, m.y));
        Particles.burst(m.x, m.y, { count: 8, colors: ['#5c1e5e', '#8a3a8c'], speed: 90, life: 0.35, size: 3 });
        this.markers.splice(i, 1);
      }
    }

    // ── 적 갱신 ──
    for (const e of this.enemies) if (!e.dead) e.update(dt, this);
    this.enemies = this.enemies.filter((e) => !e.dead);

    // ── 화살 ──
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.x += a.dir.x * a.speed * dt;
      a.y += a.dir.y * a.speed * dt;
      const p = this.player;
      if (p.invuln <= 0 && Math.hypot(p.x - a.x, p.y - a.y) < p.r + a.r) {
        this.hurtPlayer(1, a.dir);
        this.arrows.splice(i, 1);
        continue;
      }
      if (a.life <= 0 || World.isSolidAt(a.x, a.y)) {
        Particles.burst(a.x, a.y, { count: 4, colors: ['#a99e8c'], speed: 70, life: 0.25, size: 2 });
        this.arrows.splice(i, 1);
      }
    }

    // ── 하트 픽업 ──
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      const p = this.player;
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < p.r + pk.r) {
        if (p.hp < p.maxHp) p.hp++;
        AudioSys.pickup();
        Particles.burst(pk.x, pk.y, { count: 8, colors: ['#e43b44', '#f5817e'], speed: 100, life: 0.4, size: 3 });
        this.pickups.splice(i, 1);
      }
    }

    Particles.update(dt);

    // ── 웨이브 종료 판정 ──
    if (this.enemies.length === 0 && this.markers.length === 0 && this.pendingSpawns.length === 0) {
      this.waveRest -= dt;
      if (this.waveRest <= 0) {
        this.nextWave();
        this.waveRest = 3.0;
      }
    }
  },

  render() {
    const ctx = Renderer.ctx;
    Renderer.begin();
    World.draw(ctx);

    if (this.state === 'start') {
      HUD.drawStartScreen(ctx, this.blinkT);
      return;
    }

    // 스폰 예고 마커 (보라색 원 수축)
    for (const m of this.markers) {
      const r = 10 + m.t * 30;
      ctx.strokeStyle = `rgba(160,80,190,${0.9 - m.t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 하트 픽업 (둥실둥실)
    for (const pk of this.pickups) {
      const bob = Math.sin(pk.t * 5) * 3;
      ctx.drawImage(Sprites.heart, Math.round(pk.x - 12), Math.round(pk.y - 9 + bob), 24, 18);
    }

    // y좌표 정렬 렌더링 (아래에 있는 캐릭터가 앞에 그려짐)
    const drawables = [...this.enemies];
    if (this.state !== 'over') drawables.push(this.player);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw(ctx);

    // 화살
    for (const a of this.arrows) {
      Renderer.drawSprite(Sprites.arrow, a.x, a.y, { rot: Math.atan2(a.dir.y, a.dir.x) });
    }

    Particles.draw(ctx);
    HUD.draw(ctx, this);

    if (this.state === 'over') HUD.drawGameOver(ctx, this, this.blinkT);
  },
};

// ── 부트스트랩 ──
(function boot() {
  const canvas = document.getElementById('game');
  Renderer.init(canvas);
  Input.init(canvas);
  World.init();

  // 테스트 훅: ?autostart=1 → 시작 화면 건너뜀
  const qs = new URLSearchParams(location.search);
  if (qs.has('autostart') || qs.has('demo')) Game.restart();
  if (qs.has('demo')) installDemoBot();
  window.Game = Game; // 자동 테스트에서 상태 검증용

  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      Game.tick(STEP);
      Input.endFrame();
      acc -= STEP;
    }
    Renderer.update(dt);
    Game.render();
  }
  requestAnimationFrame(frame);
})();

// 데모 봇: 스크린샷 검증용 자동 플레이 (?demo=1)
function installDemoBot() {
  let t = 0;
  window.__demoBot = (game, dt) => {
    t += dt;
    const p = game.player;
    let target = null;
    let best = Infinity;
    for (const e of game.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) { best = d; target = e; }
    }
    Input.keys['KeyW'] = Input.keys['KeyA'] = Input.keys['KeyS'] = Input.keys['KeyD'] = false;
    if (target) {
      if (best > 55) {
        if (target.x < p.x - 8) Input.keys['KeyA'] = true;
        if (target.x > p.x + 8) Input.keys['KeyD'] = true;
        if (target.y < p.y - 8) Input.keys['KeyW'] = true;
        if (target.y > p.y + 8) Input.keys['KeyS'] = true;
      }
      if (best < 75 && p.attackCd <= 0) {
        p.facing = { x: (target.x - p.x) / best, y: (target.y - p.y) / best };
        Input.justPressed['KeyJ'] = true;
      }
      if (t > 2.5) { Input.justPressed['Space'] = true; t = 0; }
    }
  };
}
