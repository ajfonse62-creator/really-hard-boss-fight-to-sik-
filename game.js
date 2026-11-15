// 1. Автозагрузка картинок + вырезка белого фона + обрезка пустых полей
function loadImg(el, name, fb, cleanBg = true) {
    const ex = ['.png', '.jpg', '.jpeg', '.webp', '.PNG', '.JPG'];
    let i = 0;
    function next() {
        if (i >= ex.length) {
            el.removeAttribute('src');
            if (fb) el.classList.add(fb);
            return;
        }
        const testImg = new Image();
        testImg.crossOrigin = "Anonymous";
        testImg.onload = () => {
            if (!cleanBg) {
                el.src = testImg.src;
                return;
            }
            const c = document.createElement('canvas');
            c.width = testImg.width;
            c.height = testImg.height;
            const cx = c.getContext('2d');
            cx.drawImage(testImg, 0, 0);
            try {
                const imgData = cx.getImageData(0, 0, c.width, c.height);
                const d = imgData.data;
                let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
                let hasPixels = false;

                for (let y = 0; y < c.height; y++) {
                    for (let x = 0; x < c.width; x++) {
                        const p = (y * c.width + x) * 4;
                        if (d[p] > 225 && d[p + 1] > 225 && d[p + 2] > 225) {
                            d[p + 3] = 0;
                        } else if (d[p + 3] > 10) {
                            hasPixels = true;
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }
                cx.putImageData(imgData, 0, 0);

                if (hasPixels && maxX >= minX && maxY >= minY) {
                    const cropW = maxX - minX + 1;
                    const cropH = maxY - minY + 1;
                    const out = document.createElement('canvas');
                    out.width = cropW;
                    out.height = cropH;
                    out.getContext('2d').drawImage(c, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
                    el.src = out.toDataURL();
                } else {
                    el.src = c.toDataURL();
                }
            } catch (e) {
                el.src = testImg.src;
            }
        };
        testImg.onerror = next;
        testImg.src = name + ex[i++];
    }
    next();
}

loadImg(document.getElementById('boss-img'), 'boss', null, true);
loadImg(document.getElementById('soul'), 'soul', null, true);

const boomPreload = document.createElement('img');
loadImg(boomPreload, 'boom', null, true);

const bulletPreload = document.createElement('img');
loadImg(bulletPreload, 'bullet', null, true);

const barPreload = document.createElement('img');
loadImg(barPreload, 'bar', null, false);

// 2. Музыка боя (music.mp3)
const bgm = new Audio('music.mp3');
bgm.loop = true;
bgm.volume = 0.6;

function startMusic() {
    if (bgm.paused && state !== 'win') {
        bgm.play().catch(() => {});
    }
}
window.addEventListener('pointerdown', startMusic, { once: true });
window.addEventListener('keydown', startMusic, { once: true });

// 3. Фон во весь экран
const bg = document.getElementById('shader-bg');
const ctx = bg.getContext('2d');
function resize() {
    bg.width = document.documentElement.clientWidth;
    bg.height = document.documentElement.clientHeight;
}
window.addEventListener('resize', resize);
resize();

let t = 0;
function drawBg() {
    t += 0.025;
    const cx = bg.width / 2, cy = bg.height / 2, maxR = Math.hypot(cx, cy);
    ctx.fillStyle = '#06010d';
    ctx.fillRect(0, 0, bg.width, bg.height);

    for (let r = 7; r > 0; r--) {
        let p = ((r + (t * 1.4) % 1) / 7);
        let rad = Math.pow(p, 1.5) * maxR * 1.2;
        let ang = t * (r % 2 ? 0.5 : -0.5);
        for (let s = 0; s < 10; s++) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, rad, (s / 10) * Math.PI * 2 + ang, ((s + 1) / 10) * Math.PI * 2 + ang);
            ctx.fillStyle = (s + r) % 2 ? `rgba(12,4,28,${0.6 * p})` : `rgba(60,18,120,${0.35 * p})`;
            ctx.fill();
        }
    }
    ctx.strokeStyle = 'rgba(190,140,255,0.18)';
    ctx.lineWidth = 2;
    for (let w = 0; w < 3; w++) {
        ctx.beginPath();
        for (let x = 0; x <= bg.width; x += 30) {
            let y = cy + Math.sin(x * 0.015 + t * 1.5 + w) * 75;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    requestAnimationFrame(drawBg);
}
drawBg();

// 4. Переменные и управление
const box = document.getElementById('battle-box');
const soul = document.getElementById('soul');
const diag = document.getElementById('dialogue-box');
const sub = document.getElementById('submenu');
const fg = document.getElementById('fight-minigame');
const cur = document.getElementById('cursor-bar');

let hp = 20, bHp = 120, sX = 128, sY = 85;
let state = 'menu', mult = 1, rage = 1, invuln = 0;
let keys = {}, bul = [], haz = [], curX = 0, fInt = null, turnIv = null;
let items = [{ n: "Кукуруза (+12 HP)", h: 12 }, { n: "Порох (+20 HP)", h: 20 }];

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyZ' || e.code === 'Enter') handleActionPress();
});
window.addEventListener('keyup', e => keys[e.code] = false);

function handleActionPress() {
    startMusic();
    if (state === 'aim') hitConfirm();
    else if (state === 'def') shoot();
}

// 5. Меню действий
function openMenu(type) {
    startMusic();
    if (state !== 'menu') return;
    sub.style.display = 'none';
    fg.style.display = 'none';

    if (type === 'fight') {
        state = 'aim';
        fg.style.display = 'flex';
        curX = 0;
        diag.textContent = "* Нажми ОГОНЬ (Z) в центре жёлтой зоны!";
        fInt = setInterval(() => {
            curX += 6;
            cur.style.left = curX + 'px';
            if (curX >= 274) hitConfirm();
        }, 16);
    } else if (type === 'act') {
        sub.style.display = 'flex';
        sub.innerHTML = `
            <button onclick="doAct('chk')">* Осмотреть</button>
            <button onclick="doAct('foc')">* Фокус (x1.5 урон)</button>
            <button onclick="doAct('tnt')">* Дразнить</button>
        `;
    } else if (type === 'item') {
        if (items.length === 0) { diag.textContent = "* Рюкзак пуст!"; return; }
        sub.style.display = 'flex';
        sub.innerHTML = items.map((it, i) => `<button onclick="useItem(${i})">* ${it.n}</button>`).join('');
    } else if (type === 'mercy') {
        diag.textContent = "* Цветок не принимает пощаду!";
        enemyTurn();
    }
}

function hitConfirm() {
    clearInterval(fInt);
    fg.style.display = 'none';
    let dist = Math.abs(137 - curX);
    let base = curX >= 274 ? 0 : (dist < 18 ? 35 : (dist < 50 ? 20 : 10));
    let dmg = Math.round(base * mult);
    mult = 1;

    if (dmg > 0) {
        bHp = Math.max(0, bHp - dmg);
        document.getElementById('boss-hp-fill').style.width = (bHp / 120 * 100) + '%';
        let bi = document.getElementById('boss-img');
        bi.classList.remove('shake');
        void bi.offsetWidth;
        bi.classList.add('shake');
        diag.textContent = `* Нанесено ${dmg} урона!`;
    } else {
        diag.textContent = "* ПРОМАХ!";
    }

    // ПОБЕДА: ВЗРЫВ И БЕСКОНЕЧНЫЙ ЧЁРНЫЙ ЭКРАН «ИГРА ОКОНЧЕНА»
    if (bHp <= 0) {
        state = 'win';
        clearInterval(turnIv);
        bgm.pause();
        diag.textContent = "* ПОБЕДА! Босс повержен!";

        const bi = document.getElementById('boss-img');
        document.getElementById('boss-hp-wrap').style.display = 'none';

        if (boomPreload.src) {
            bi.src = boomPreload.src;
        }
        bi.classList.remove('shake');
        bi.classList.add('boom-effect');

        setTimeout(() => {
            document.getElementById('end-screen').style.display = 'flex';
        }, 1100);
        return;
    }

    setTimeout(enemyTurn, 800);
}

function doAct(a) {
    sub.style.display = 'none';
    if (a === 'chk') diag.textContent = `* ЦВЕТОК - HP ${bHp}/120. Сбивай полосы выстрелами!`;
    if (a === 'foc') { mult = 1.5; diag.textContent = "* Прицел наведён! Урон следующей атаки x1.5."; }
    if (a === 'tnt') { rage = 1.35; diag.textContent = "* Босс в ярости! Скорость атак выросла."; }
    setTimeout(enemyTurn, 1000);
}

function useItem(i) {
    sub.style.display = 'none';
    let it = items.splice(i, 1)[0];
    hp = Math.min(20, hp + it.h);
    updHp();
    diag.textContent = `* Использовано: ${it.n}`;
    setTimeout(enemyTurn, 900);
}

// 6. Атаки босса (один в один как у вас) и стрельба души
function enemyTurn() {
    if (state === 'win') return;
    state = 'def';
    let step = 0;
    turnIv = setInterval(() => {
        if (state === 'win') { clearInterval(turnIv); return; }
        step++;
        if (step % 4 === 0) {
            let b = document.createElement('img');
            b.className = 'enemy-bar';
            if (barPreload.src) {
                b.src = barPreload.src;
            } else {
                b.classList.add('bar-fallback');
            }
            let sx = Math.random() > 0.5 ? 0 : 150;
            b.style.width = '130px'; b.style.left = sx + 'px'; b.style.top = '0px';
            box.appendChild(b);
            haz.push({ el: b, x: sx, y: 0, w: 130, h: 18, vy: 2.8 * rage, brk: true });
        } else {
            let p = document.createElement('div');
            p.className = 'enemy-proj';
            let sx = Math.random() * 265;
            p.style.left = sx + 'px'; p.style.top = '0px';
            box.appendChild(p);
            haz.push({ el: p, x: sx, y: 0, w: 12, h: 12, vy: 3.5 * rage, brk: false });
        }
        if (step >= 14) {
            clearInterval(turnIv);
            setTimeout(() => {
                if (state === 'win') return;
Используйте код с осторожностью.
state = 'menu';
diag.textContent = "* Ваш ход!";
haz.forEach(h => h.el.remove()); haz = [];
bul.forEach(b => b.el.remove()); bul = [];
}, 1400);
}
}, Math.round(550 / rage));
}
function shoot() {
if (state !== 'def' || bul.length > 3) return;
let b = document.createElement('img');
b.className = 'bullet';
if (bulletPreload.src) {
b.src = bulletPreload.src;
} else {
b.classList.add('bullet-fallback');
}
b.style.left = (sX + 6) + 'px'; b.style.top = (sY - 18) + 'px';
box.appendChild(b);
bul.push({ el: b, x: sX + 6, y: sY - 18 });
}
function updHp() {
document.getElementById('hp-fill').style.width = (hp / 20 * 100) + '%';
document.getElementById('hp-text').textContent = ${hp}/20;
if (hp <= 0) {
bgm.pause();
alert("GAME OVER!");
location.reload();
}
}
function bind(id, k) {
let b = document.getElementById(id);
if (!b) return;
b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; });
b.addEventListener('pointerup', e => { e.preventDefault(); keys[k] = false; });
b.addEventListener('pointerleave', () => keys[k] = false);
}
bind('btn-up', 'ArrowUp'); bind('btn-down', 'ArrowDown');
bind('btn-left', 'ArrowLeft'); bind('btn-right', 'ArrowRight');
function loop() {
if (invuln > 0) {
invuln--;
if (invuln === 0) soul.classList.remove('blink');
}
if (state === 'def') {
let sp = keys['ShiftLeft'] ? 2 : 3.5;
if (keys['ArrowLeft'] && sX > 0) sX -= sp;
if (keys['ArrowRight'] && sX < 248) sX += sp;
if (keys['ArrowUp'] && sY > 0) sY -= sp;
if (keys['ArrowDown'] && sY < 168) sY += sp;
soul.style.left = sX + 'px';
soul.style.top = sY + 'px';
for (let i = bul.length - 1; i >= 0; i--) {
bul[i].y -= 7;
bul[i].el.style.top = bul[i].y + 'px';
if (bul[i].y < -25) {
bul[i].el.remove();
bul.splice(i, 1);
continue;
}
for (let j = haz.length - 1; j >= 0; j--) {
let h = haz[j];
if (h.brk && bul[i].x < h.x + h.w && bul[i].x + 12 > h.x && bul[i].y < h.y + h.h && bul[i].y + 24 > h.y) {
h.el.remove(); haz.splice(j, 1);
bul[i].el.remove(); bul.splice(i, 1);
break;
}
}
}
for (let j = haz.length - 1; j >= 0; j--) {
let h = haz[j];
h.y += h.vy;
h.el.style.top = h.y + 'px';
if (h.y > 205) {
h.el.remove();
haz.splice(j, 1);
continue;
}
if (invuln === 0 && sX + 4 < h.x + h.w && sX + 20 > h.x && sY + 4 < h.y + h.h && sY + 20 > h.y) {
hp = Math.max(0, hp - 4);
invuln = 45;
soul.classList.add('blink');
updHp();
if (!h.brk) {
h.el.remove();
haz.splice(j, 1);
}
}
}
}
requestAnimationFrame(loop);
}
loop();
