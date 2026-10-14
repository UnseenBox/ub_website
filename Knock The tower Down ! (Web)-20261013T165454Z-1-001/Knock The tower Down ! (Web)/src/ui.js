// DOM UI: screens, HUD, level select, results, toasts, buttons.
import { LEVELS } from './levels.js';
import { isSoundOn, setSoundOn, sfx } from './audio.js';

export function createUI(game) {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), hudLevel: $('hud-level'), hudScore: $('hud-score'), shotRack: $('shot-rack'),
    hint: $('hint-bar'),
    title: $('screen-title'), levels: $('screen-levels'), pause: $('screen-pause'), result: $('screen-result'),
    grid: $('level-grid'), toast: $('toast'),
    resultTitle: $('result-title'), resultStars: $('result-stars'), resultScore: $('result-score'), resultDetail: $('result-detail'),
    btnNext: $('btn-next'),
    btnRetry: $('btn-retry'),
  };
  let toastTimer = 0;

  function toast(msg, ms = 1800) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
  }

  function show(name) {
    for (const s of [els.title, els.levels, els.pause, els.result]) s.classList.add('hidden');
    if (name === 'title') els.title.classList.remove('hidden');
    if (name === 'levels') { els.levels.classList.remove('hidden'); renderGrid(); }
    if (name === 'pause') els.pause.classList.remove('hidden');
    if (name === 'result') els.result.classList.remove('hidden');
    // HUD visible during play & pause
    const inGame = game.state.screen === 'play' || game.state.screen === 'paused';
    els.hud.classList.toggle('hidden', !inGame);
    if (name === 'pause') els.hud.classList.remove('hidden');
  }

  function renderGrid() {
    els.grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const locked = i + 1 > game.save.unlocked;
      const bonus = lv.tier === 'bonus';
      const b = document.createElement('button');
      b.className = 'lvl-btn' + (locked ? ' locked' : '') + (bonus ? ' bonus' : '');
      const st = game.save.stars[i] || 0;
      b.innerHTML =
        (bonus && !locked ? '<div class="tag">MONUMENT</div>' : '') +
        `<div class="n">${locked ? 'XXX' : bonus ? '▲' : i + 1}</div>` +
        `<div class="t">${lv.name}</div>` +
        `<div class="s">${locked ? '' : '*'.repeat(st) + '·'.repeat(3 - st)}</div>`;
      if (!locked) b.addEventListener('click', () => { sfx.unlock(); sfx.click(); game.startPlay(i); syncAll(); });
      els.grid.appendChild(b);
    });
  }

  function renderHUD() {
    const st = game.state;
    const endless = st.mode === 'endless' && st.run;
    if (endless) {
      const short = (st.run.current?.name || '').replace(/ #\d+$/, '');
      els.hudLevel.textContent = `MAP ${st.run.depth} — ${short}`;
      els.hudScore.textContent = `${st.run.banked + st.score}`;
    } else {
      els.hudLevel.textContent = `Level ${st.levelIndex + 1} — ${LEVELS[st.levelIndex].name}`;
      els.hudScore.textContent = `${st.score}`;
    }
    els.shotRack.innerHTML = '';
    st.shots.forEach((t, i) => {
      const d = document.createElement('div');
      d.className = 'shot-pip ' + t + (i < st.shotIndex ? ' spent' : i === st.shotIndex && st.loaded ? ' current' : i > st.shotIndex ? '' : '');
      d.textContent = game.PROJ_LABEL[t];
      d.title = t;
      els.shotRack.appendChild(d);
    });
    // hint bar: current projectile + objective
    if (st.screen === 'play' && !st.result) {
      const left = st.targetsTotal - st.targetsDown;
      const proj = st.loadedType ? `<b>${game.PROJ_LABEL[st.loadedType]}</b> ${st.loadedType}` : '…';
      els.hint.innerHTML = `${proj} &nbsp;•&nbsp; [@] ${left} core${left === 1 ? '' : 's'} online &nbsp;•&nbsp; ${endless ? st.run.current.hint : LEVELS[st.levelIndex].hint}`;
      els.hint.classList.remove('hidden');
    } else els.hint.classList.add('hidden');
  }

  function showResult() {
    const st = game.state;
    const win = st.result === 'win';
    const endless = st.mode === 'endless' && st.run;
    if (endless) return showEndlessResult(st, win);
    els.resultTitle.textContent = win ? 'TOWER TOPPLED' : 'OUT OF SHOTS';
    const stars = st.starsEarned || 0;
    els.resultStars.innerHTML = win
      ? [1, 2, 3].map(i => `<span class="${i <= stars ? '' : 'dim'}">${i <= stars ? '*' : '·'}</span>`).join('')
      : '<span class="dim">···</span>';
    els.resultScore.textContent = `Score ${st.score}`;
    const left = st.targetsTotal - st.targetsDown;
    const standing = st.totalMass ? Math.max(0, 100 - Math.round((st.massDown / st.totalMass) * 100)) : 100;
    const collapseLine = st.collapseFired ? '<br /><span class="big">STRUCTURAL COLLAPSE</span>' : '';
    els.resultDetail.innerHTML = win
      ? `Cores offline: <b>${st.targetsDown}/${st.targetsTotal}</b> &nbsp;•&nbsp; Shots used: <b>${st.shotsUsed}</b> (par ${LEVELS[st.levelIndex].par})<br />Blocks smashed: <b>${st.destroyedCount}</b> &nbsp;•&nbsp; Structure left standing: <b>${standing}%</b> &nbsp;•&nbsp; Shot bonus: <b>+${st.bonus || 0}</b>${collapseLine}<br />${st.starsEarned === 3 ? 'Rank S — flawless demolition.' : st.starsEarned === 2 ? 'Rank A — clean work. Fewer shots for S.' : 'Rank B — cleared. Retry for a better rank.'}`
      : `Cores still online: <b>${left}</b>. Read the pattern — sparse glyphs are glass, and glass carries almost nothing.<br />Blocks smashed: <b>${st.destroyedCount}</b> &nbsp;•&nbsp; Structure left standing: <b>${standing}%</b>${collapseLine}`;
    els.btnNext.style.display = win && st.levelIndex + 1 < LEVELS.length ? '' : 'none';
    els.btnNext.textContent = 'NEXT >';
    els.btnRetry.textContent = '[R] RETRY';
    show('result');
  }

  function showEndlessResult(st, win) {
    const run = st.run;
    if (win) {
      els.resultTitle.textContent = `MAP ${run.depth} CLEARED`;
      els.resultStars.innerHTML = [1, 2, 3].map(i => {
        const s = st.starsEarned || 0;
        return `<span class="${i <= s ? '' : 'dim'}">${i <= s ? '*' : '·'}</span>`;
      }).join('');
      els.resultScore.textContent = `Map ${st.score} • Run ${run.total}`;
      els.resultDetail.innerHTML =
        `Cores offline: <b>${st.targetsDown}/${st.targetsTotal}</b> &nbsp;•&nbsp; Shots used: <b>${st.shotsUsed}</b> (par ${run.current.par})<br />` +
        `Blocks smashed: <b>${st.destroyedCount}</b> &nbsp;•&nbsp; Maps cleared: <b>${run.maps}</b>` +
        (st.collapseFired ? ' &nbsp;•&nbsp; <span class="big">COLLAPSE</span>' : '') + '<br />' +
        `Best run: <b>${st.endlessBest?.score ?? 0}</b> pts / <b>${st.endlessBest?.maps ?? 0}</b> maps`;
      els.btnNext.style.display = '';
      els.btnNext.textContent = 'NEXT MAP >';
      els.btnRetry.textContent = '[R] REPLAY';
    } else {
      els.resultTitle.textContent = 'RUN OVER';
      els.resultStars.innerHTML = '<span class="dim">···</span>';
      els.resultScore.textContent = `Run ${run.total} • ${run.maps} map${run.maps === 1 ? '' : 's'}`;
      els.resultDetail.innerHTML =
        `The cores hold this sector. Final score: <b>${run.total}</b><br />` +
        `Maps cleared: <b>${run.maps}</b><br />` +
        `Best run: <b>${st.endlessBest?.score ?? 0}</b> pts / <b>${st.endlessBest?.maps ?? 0}</b> maps`;
      els.btnNext.style.display = 'none';
      els.btnRetry.textContent = '[R] NEW RUN';
    }
    show('result');
  }

  function syncAll() {
    const s = game.state.screen;
    if (s === 'title') show('title');
    else if (s === 'levels') show('levels');
    else if (s === 'paused') show('pause');
    else if (s === 'result') showResult();
    else { for (const x of [els.title, els.levels, els.pause, els.result]) x.classList.add('hidden'); els.hud.classList.remove('hidden'); }
    renderHUD();
    syncSoundBtns();
  }

  function syncSoundBtns() {
    const on = isSoundOn();
    $('btn-sound').textContent = on ? '[S]' : '[X]';
    $('btn-sound2').textContent = on ? 'SND: ON' : 'SND: OFF';
    const t = $('btn-sound-title'); if (t) t.textContent = on ? 'SND: ON' : 'SND: OFF';
  }

  function wire(input) {
    $('btn-play').addEventListener('click', () => { sfx.unlock(); sfx.click(); game.state.screen = 'levels'; syncAll(); });
    $('btn-endless').addEventListener('click', () => { sfx.unlock(); sfx.click(); game.startEndless(); input.resetAim(); syncAll(); });
    $('btn-how').addEventListener('click', () => { sfx.click(); $('howto').classList.toggle('hidden'); });
    $('btn-back-title').addEventListener('click', () => { sfx.click(); game.state.screen = 'title'; syncAll(); });
    const toggleSound = () => { setSoundOn(!isSoundOn()); syncSoundBtns(); sfx.click(); };
    $('btn-sound').addEventListener('click', toggleSound);
    $('btn-sound2').addEventListener('click', toggleSound);
    $('btn-sound-title').addEventListener('click', toggleSound);
    $('btn-reset-save').addEventListener('click', () => {
      if (confirm('Reset all progress?')) {
        game.save.unlocked = 1; game.save.stars = []; game.save.best = [];
        // the endless best is separate state and was previously left behind,
        // so "reset all progress" did not actually reset all progress
        try {
          localStorage.removeItem('ktd_save_v1');
          localStorage.removeItem('ktd_save_v2');
          localStorage.removeItem('ktd_endless_best_v1');
        } catch {}
        game.state.endlessBest = { score: 0, maps: 0 };
        toast('Progress reset'); syncAll();
      }
    });
    $('btn-menu').addEventListener('click', () => { sfx.click(); game.state.screen = 'levels'; game.state.canAim = false; syncAll(); });
    const doRestart = () => { sfx.click(); game.retry(); input.resetAim(); syncAll(); };
    $('btn-restart').addEventListener('click', doRestart);
    $('btn-restart2').addEventListener('click', doRestart);
    $('btn-pause').addEventListener('click', () => {
      if (game.state.screen !== 'play') return;
      sfx.click(); game.state.screen = 'paused'; game.state.canAim = false; syncAll();
    });
    $('btn-resume').addEventListener('click', () => {
      sfx.click(); game.state.screen = 'play'; game.state.canAim = !!game.state.loaded && !game.state.flying; syncAll();
    });
    $('btn-quit').addEventListener('click', () => { sfx.click(); game.state.screen = 'levels'; syncAll(); });
    $('btn-retry').addEventListener('click', () => {
      sfx.click();
      // endless run-over restarts with a fresh run; otherwise replay current map
      if (game.state.mode === 'endless' && game.state.result === 'lose') game.startEndless();
      else game.retry();
      input.resetAim(); syncAll();
    });
    $('btn-levels2').addEventListener('click', () => { sfx.click(); game.state.screen = 'levels'; syncAll(); });
    els.btnNext.addEventListener('click', () => {
      sfx.click();
      if (game.state.mode === 'endless') game.startEndlessMap();
      else game.startPlay(Math.min(LEVELS.length - 1, game.state.levelIndex + 1));
      input.resetAim(); syncAll();
    });
  }

  return { show, renderHUD, showResult, syncAll, toast, wire, renderGrid };
}
