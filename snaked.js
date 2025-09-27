// Snaked - Slither.io style with smooth boost orb trail and slowed, decelerating length loss

const ARENA_RADIUS = 3000;
const SNAKE_INIT_LEN = 8;
const SNAKE_INIT_SPEED = 2.2;
const SNAKE_BOOST_SPEED = 4.3;
const SNAKE_BOOST_LOSS_BASE = 0.008;
const SNAKE_BOOST_LOSS_MIN = 0.002;
const SNAKE_BOOST_LOSS_FACTOR = 0.33;
const SNAKE_MIN_LEN = 6;
const ORB_MINI_SIZE = 4;
const ORB_FREQ = 700;
const ORB_LARGE_SIZE = 20;
const FLAME_RING_WIDTH = 40;
const TURN_SPEED = 0.13;
const SEGMENT_SPACING = 14;
const SEGMENT_SIZE = 16;
const BOOST_ORB_TRAIL_SIZE = 2.5;
const BOOST_ORB_TRAIL_COLOR = "#43e370";
const BOOST_ORB_TRAIL_DIST = 12; // Drop an orb every N pixels moved while boosting

let canvas, ctx, minimap, mctx;
let gameActive = false, gameOver = false;
let snake, orbs = [], largeOrbs = [];
let score = 0, highscore = 0;
let boost = false, mouseBoost = false;
let skin = {color: "#43e370", pattern: "solid"};
let mouseTargetAngle = null;
let boostTrailDistance = 0;
let boostTrailLast = null;

let pendingGrowth = 0;

function $(id) { return document.getElementById(id); }

function showScreen(name) {
  for (const scr of document.querySelectorAll('.screen'))
    scr.style.display = 'none';
  $(name).style.display = 'flex';
}

function saveHighscore(s) {
  highscore = Math.max(highscore, s);
  localStorage.setItem("snaked_highscore", highscore);
  $("highscore").textContent = highscore;
}

function loadHighscore() {
  highscore = parseInt(localStorage.getItem("snaked_highscore")||"0");
  $("highscore").textContent = highscore;
}

function setSkin() {
  skin.color = $("snakeColor").value;
  skin.pattern = $("snakePattern").value;
}

$("snakeColor").addEventListener("input", setSkin);
$("snakePattern").addEventListener("change", setSkin);

$("playBtn").onclick = () => {
  setSkin();
  showScreen("game");
  startGame();
};

$("homeBtn").onclick = () => {
  showScreen("home");
  loadHighscore();
};

$("restartBtn").onclick = () => {
  startGame();
};

function startGame() {
  gameActive = true; gameOver = false;
  $("gameover").style.display = "none";
  score = 0;
  orbs = []; largeOrbs = [];
  pendingGrowth = 0;
  boostTrailDistance = 0;
  boostTrailLast = null;
  snake = makeSnake();
  placeOrbs();
  resizeCanvas();
  $("score").textContent = score;
  mouseTargetAngle = null;
  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameActive = false; gameOver = true;
  $("gameover").style.display = "block";
  $("finalScore").textContent = score;
  saveHighscore(score);
  leaveLargeOrb(snake.head.x, snake.head.y);
}

function makeSnake() {
  const segs = [];
  for (let i=0; i<SNAKE_INIT_LEN; ++i)
    segs.push({x: 0, y: 0});
  return {
    head: {x: 0, y: 0, dir: 0},
    segments: segs,
    len: SNAKE_INIT_LEN,
    color: skin.color,
    pattern: skin.pattern,
    speed: SNAKE_INIT_SPEED,
    boosting: false
  };
}

function placeOrbs() {
  orbs = [];
  for (let i=0; i<ORB_FREQ; ++i) {
    orbs.push({
      x: randInCircle(ARENA_RADIUS-80).x,
      y: randInCircle(ARENA_RADIUS-80).y,
      size: ORB_MINI_SIZE,
      glow: Math.random()*0.8+0.5,
      isBoostTrail: false
    });
  }
}

function leaveLargeOrb(x, y) {
  largeOrbs.push({
    x: x,
    y: y,
    size: ORB_LARGE_SIZE,
    glow: 1.2
  });
}

function randInCircle(radius) {
  let t = 2 * Math.PI * Math.random();
  let r = radius * Math.sqrt(Math.random());
  return {x: Math.cos(t)*r, y: Math.sin(t)*r};
}

// Handle input
document.addEventListener("keydown", e => {
  if (!gameActive) return;
  if (e.key === "ArrowUp") boost = true;
});
document.addEventListener("keyup", e => {
  if (!gameActive) return;
  if (e.key === "ArrowUp") boost = false;
});
$("arena").addEventListener("mousedown", e => {
  if (e.button === 0) mouseBoost = true;
});
$("arena").addEventListener("mouseup", e => {
  if (e.button === 0) mouseBoost = false;
});
$("arena").addEventListener("mousemove", e => {
  if (!gameActive) return;
  const rect = canvas.getBoundingClientRect();
  let mx = e.clientX - rect.left - rect.width/2;
  let my = e.clientY - rect.top - rect.height/2;
  mouseTargetAngle = Math.atan2(my, mx);
});
$("arena").addEventListener("dblclick", e => {
  mouseBoost = true;
  setTimeout(()=>{ mouseBoost = false; }, 300);
});

function resizeCanvas() {
  canvas = $("arena");
  minimap = $("minimap");
  let w = Math.min(window.innerWidth-30, 900);
  let h = Math.min(window.innerHeight-90, 700);
  canvas.width = w; canvas.height = h;
  minimap.width = 120; minimap.height = 120;
  ctx = canvas.getContext("2d");
  mctx = minimap.getContext("2d");
}
window.onresize = resizeCanvas;

// === Main Game Loop ===
function gameLoop() {
  if (!gameActive) return;
  snake.speed = SNAKE_INIT_SPEED;
  updateSnake();
  updateOrbs();
  render();
  requestAnimationFrame(gameLoop);
}

// === Update Logic ===
function updateSnake() {
  let s = snake;
  if (mouseTargetAngle !== null) {
    let angleDiff = ((mouseTargetAngle - s.head.dir + Math.PI*3) % (Math.PI*2)) - Math.PI;
    if (Math.abs(angleDiff) > TURN_SPEED) {
      s.head.dir += TURN_SPEED * Math.sign(angleDiff);
    } else {
      s.head.dir = mouseTargetAngle;
    }
  }

  let moveSpeed = (s.boosting || mouseBoost || boost) ? SNAKE_BOOST_SPEED : SNAKE_INIT_SPEED;
  let prevHead = {x: s.head.x, y: s.head.y};
  s.head.x += Math.cos(s.head.dir) * moveSpeed;
  s.head.y += Math.sin(s.head.dir) * moveSpeed;

  // Gradual boost orb trail: drop orbs as you move while boosting
  if (s.boosting || mouseBoost || boost) {
    if (boostTrailLast == null) boostTrailLast = {x: s.head.x, y: s.head.y};
    boostTrailDistance += Math.hypot(s.head.x - boostTrailLast.x, s.head.y - boostTrailLast.y);
    while (boostTrailDistance > BOOST_ORB_TRAIL_DIST) {
      boostTrailDistance -= BOOST_ORB_TRAIL_DIST;
      const tail = s.segments[s.segments.length - 1];
      orbs.push({
        x: tail.x,
        y: tail.y,
        size: BOOST_ORB_TRAIL_SIZE,
        glow: 1.2,
        isBoostTrail: true
      });
      boostTrailLast = {x: s.head.x, y: s.head.y};
    }
  } else {
    boostTrailDistance = 0;
    boostTrailLast = null;
  }

  // Body follows, segments maintain fixed distance
  s.segments[0].x = s.head.x; s.segments[0].y = s.head.y;
  for (let i=1; i<s.segments.length; ++i) {
    let prev = s.segments[i-1], curr = s.segments[i];
    let dx = prev.x - curr.x, dy = prev.y - curr.y;
    let dist = Math.hypot(dx, dy);
    if (dist !== SEGMENT_SPACING) {
      let angle = Math.atan2(dy, dx);
      curr.x = prev.x - Math.cos(angle)*SEGMENT_SPACING;
      curr.y = prev.y - Math.sin(angle)*SEGMENT_SPACING;
    }
  }

  s.boosting = (boost || mouseBoost) && s.segments.length > SNAKE_MIN_LEN;
  let lenFactor = Math.max(1, s.segments.length);
  let boostLoss = SNAKE_BOOST_LOSS_BASE * (1 - SNAKE_BOOST_LOSS_FACTOR * Math.log10(lenFactor) / 2);
  boostLoss = Math.max(boostLoss, SNAKE_BOOST_LOSS_MIN);

  if (s.boosting) {
    if (s.segments.length > SNAKE_MIN_LEN) {
      s.len -= boostLoss;
      let newLen = Math.floor(s.len);
      while (s.segments.length > newLen) s.segments.pop();
    }
    if (s.segments.length < SNAKE_MIN_LEN) s.len = SNAKE_MIN_LEN;
  }

  if (Math.hypot(s.head.x, s.head.y) > ARENA_RADIUS-FLAME_RING_WIDTH/2) {
    endGame();
  }
}

function updateOrbs() {
  const absorbRadius = (5/3) * SEGMENT_SIZE;
  for (let i=orbs.length-1; i>=0; --i) {
    let orb = orbs[i];
    if (dist(snake.head, orb) < absorbRadius) {
      pendingGrowth += 1/3;
      score += 1;
      $("score").textContent = score;
      orbs.splice(i,1);
      if (pendingGrowth >= 1) {
        pendingGrowth -= 1;
        snake.len += 1;
        const last = snake.segments[snake.segments.length - 1];
        snake.segments.push({ x: last.x, y: last.y });
      }
      continue;
    }
  }
  for (let i=largeOrbs.length-1; i>=0; --i) {
    let orb = largeOrbs[i];
    if (dist(snake.head, orb) < orb.size+SEGMENT_SIZE*0.7) {
      snake.len += 1;
      score += 10;
      $("score").textContent = score;
      largeOrbs.splice(i,1);
      const last = snake.segments[snake.segments.length - 1];
      snake.segments.push({ x: last.x, y: last.y });
      continue;
    }
  }
  while (orbs.length < ORB_FREQ) {
    orbs.push({
      ...randInCircle(ARENA_RADIUS-80),
      size: ORB_MINI_SIZE,
      glow: Math.random()*0.8+0.5,
      isBoostTrail: false
    });
  }
}

function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.globalAlpha = 0.5;
  drawFullGrid();
  ctx.globalAlpha = 1.0;
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  drawFlameRing();
  ctx.restore();
  for (let orb of orbs)
    drawOrb(
      orb, 
      orb.isBoostTrail ? BOOST_ORB_TRAIL_COLOR : "#43e370", 
      orb.size, 
      orb.glow
    );
  for (let orb of largeOrbs)
    drawOrb(orb, "#20ff85", orb.size, orb.glow);
  drawSnake(snake);
  ctx.restore();
  drawMinimap();
}

function drawFullGrid() {
  let w = canvas.width, h = canvas.height;
  let gridSize = 36;
  let startX = -(w % gridSize) / 2;
  let startY = -(h % gridSize) / 2;
  ctx.fillStyle = "#23262a";
  ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  for(let x=startX; x<w; x+=gridSize){
    ctx.beginPath();
    ctx.moveTo(x,0);
    ctx.lineTo(x,h);
    ctx.stroke();
  }
  for(let y=startY; y<h; y+=gridSize){
    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(w,y);
    ctx.stroke();
  }
}

function drawFlameRing() {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0,0,ARENA_RADIUS,0,2*Math.PI);
  ctx.lineWidth = FLAME_RING_WIDTH;
  ctx.strokeStyle = "#FFA500";
  ctx.shadowColor = "#FFA500";
  ctx.shadowBlur = 25;
  ctx.globalAlpha = 1.0;
  ctx.stroke();
  ctx.restore();
}

function drawOrb(orb, color, size, glow) {
  const sx = canvas.width/2 + (orb.x - snake.head.x);
  const sy = canvas.height/2 + (orb.y - snake.head.y);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.shadowColor = color;
  ctx.shadowBlur = 14*glow;
  ctx.beginPath();
  ctx.arc(0,0,size,0,2*Math.PI);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.88;
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawSnake(snake) {
  let segs = snake.segments;
  for (let i=segs.length-1; i>=0; --i) {
    const sx = canvas.width/2 + (segs[i].x - snake.head.x);
    const sy = canvas.height/2 + (segs[i].y - snake.head.y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.beginPath();
    ctx.arc(0,0,SEGMENT_SIZE,0,2*Math.PI);
    ctx.fillStyle = snake.color;
    ctx.globalAlpha = 1.0;
    if (snake.pattern==="striped" && i%8<4)
      ctx.fillStyle = "#fff";
    if (snake.pattern==="dotted" && i%13<2)
      ctx.fillStyle = "#b4ffde";
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.rotate(snake.head.dir);
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(SEGMENT_SIZE/2, -SEGMENT_SIZE/3, 3, 0, 2 * Math.PI);
  ctx.arc(SEGMENT_SIZE/2, SEGMENT_SIZE/3, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

function drawMinimap() {
  mctx.clearRect(0,0,minimap.width,minimap.height);
  mctx.save();
  mctx.translate(60,60);
  mctx.globalAlpha = 0.52;
  mctx.beginPath();
  mctx.arc(0,0,55,0,2*Math.PI);
  mctx.fillStyle = "#23262a";
  mctx.fill();
  mctx.globalAlpha = 1.0;
  mctx.lineWidth = 2;
  mctx.strokeStyle = "#aeffcd";
  mctx.stroke();
  let px = snake.head.x / ARENA_RADIUS * 55;
  let py = snake.head.y / ARENA_RADIUS * 55;
  mctx.beginPath();
  mctx.arc(px, py, 7, 0, 2*Math.PI);
  mctx.fillStyle = snake.color;
  mctx.shadowColor = "#fff";
  mctx.shadowBlur = 10;
  mctx.fill();
  mctx.shadowBlur = 0;
  mctx.restore();
}

function dist(a,b) {
  return Math.hypot(a.x-b.x, a.y-b.y);
}

window.onload = () => {
  showScreen("home");
  loadHighscore();
  resizeCanvas();
};