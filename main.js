// Simple WebGL FPS using raw canvas 2D for minimalism
// Movement, mouse look (Pointer Lock), shooting, targets, scoring.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// HUD elements
const scoreEl = document.getElementById('score');

// Crosshair
const crosshair = document.createElement('div');
crosshair.id = 'crosshair';
document.body.appendChild(crosshair);

// Pointer Lock
canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    // locked
  }
});

// Input state
const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

let yaw = 0;     // horizontal angle
let pitch = 0;   // vertical angle
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const sensitivity = 0.0025;
  yaw += e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  const limit = Math.PI / 2 - 0.05;
  if (pitch > limit) pitch = limit;
  if (pitch < -limit) pitch = -limit;
});

// World
const world = {
  gravity: 20,
  floorY: 0,
  bounds: 60 // +/- bounds
};

// Player
const player = {
  x: 0, y: 1.7, z: 5,
  vx: 0, vy: 0, vz: 0,
  speed: 10,
  jumpPower: 8,
  onGround: true
};

// Projectiles
const bullets = [];
function shoot() {
  // Ray from camera forward
  const dir = forwardVector();
  bullets.push({
    x: player.x, y: player.y, z: player.z,
    vx: dir.x * 60, vy: dir.y * 60, vz: dir.z * 60,
    life: 1.2 // seconds
  });
}

// Targets
const targets = [];
function spawnTargets(n = 12) {
  targets.length = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.random;
    const dist = 12 + r() * 30;
    const ang = r() * Math.PI * 2;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const y = 1 + r() * 2;
    const size = 0.8 + r() * 0.6;
    targets.push({ x, y, z, size, alive: true });
  }
}
spawnTargets();

let score = 0;

// Mouse click -> shoot
window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && document.pointerLockElement === canvas) {
    shoot();
  }
});

// Simple 3D math helpers
function forwardVector() {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  return { x: cy * cp, y: sp, z: sy * cp };
}
function rightVector() {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  return { x: -sy, y: 0, z: cy };
}

// Movement update
function updatePlayer(dt) {
  const f = forwardVector();
  const r = rightVector();

  let moveX = 0, moveZ = 0;
  if (keys.has('w')) { moveX += f.x; moveZ += f.z; }
  if (keys.has('s')) { moveX -= f.x; moveZ -= f.z; }
  if (keys.has('a')) { moveX -= r.x; moveZ -= r.z; }
  if (keys.has('d')) { moveX += r.x; moveZ += r.z; }

  // normalize
  const len = Math.hypot(moveX, moveZ);
  if (len > 0) {
    moveX /= len; moveZ /= len;
    player.vx = moveX * player.speed;
    player.vz = moveZ * player.speed;
  } else {
    player.vx = 0; player.vz = 0;
  }

  // Jump
  if ((keys.has(' ') || keys.has('space')) && player.onGround) {
    player.vy = player.jumpPower;
    player.onGround = false;
  }

  // Gravity
  player.vy -= world.gravity * dt;

  // Apply
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.z += player.vz * dt;

  // Floor collision
  if (player.y < world.floorY + 1.7) {
    player.y = world.floorY + 1.7;
    player.vy = 0;
    player.onGround = true;
  }

  // Bounds
  player.x = Math.max(-world.bounds, Math.min(world.bounds, player.x));
  player.z = Math.max(-world.bounds, Math.min(world.bounds, player.z));
}

// Update bullets and collisions
function updateBullets(dt) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.life -= dt;
  }
  // Remove dead
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].life <= 0) bullets.splice(i, 1);
  }
  // Bullet-target hit test (sphere vs sphere)
  for (const t of targets) {
    if (!t.alive) continue;
    for (const b of bullets) {
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const dz = t.z - b.z;
      const d2 = dx*dx + dy*dy + dz*dz;
      const rad = t.size * 0.6;
      if (d2 < rad * rad) {
        t.alive = false;
        score += 10;
        scoreEl.textContent = `Score: ${score}`;
        break;
      }
    }
  }
}

// Minimal “3D” rendering via painter’s algorithm and perspective projection
function render() {
  ctx.fillStyle = '#202428';
  ctx.fillRect(0, 0, width, height);

  // Horizon and floor
  const horizon = height * 0.55;
  ctx.fillStyle = '#181a1f';
  ctx.fillRect(horizon, 0, width, height - horizon); // sky
  ctx.fillStyle = '#0f1013';
  ctx.fillRect(0, horizon, width, height - horizon); // ground

  // Convert world objects to view space relative to camera
  const cosY = Math.cos(-yaw), sinY = Math.sin(-yaw);
  const cosP = Math.cos(-pitch), sinP = Math.sin(-pitch);

  function toView(x, y, z) {
    // translate
    x -= player.x; y -= player.y; z -= player.z;
    // yaw
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    // pitch
    const y2 = y * cosP - z1 * sinP;
    const z2 = y * sinP + z1 * cosP;
    return { x: x1, y: y2, z: z2 };
  }

  // Draw targets
  const visibleTargets = targets
    .filter(t => t.alive)
    .map(t => {
      const v = toView(t.x, t.y, t.z);
      return { t, v };
    })
    .filter(o => o.v.z > 0.2) // in front of camera
    .sort((a, b) => b.v.z - a.v.z); // far to near

  const fov = Math.tan(Math.PI / 4); // 45deg
  function project(vx, vy, vz) {
    const px = (vx / (vz * fov)) * (height) + width / 2;
    const py = (-vy / (vz * fov)) * (height) + height / 2;
    return { x: px, y: py, z: vz };
  }

  for (const { t, v } of visibleTargets) {
    const p = project(v.x, v.y, v.z);
    const sizePx = (t.size / (v.z * fov)) * height;
    ctx.fillStyle = '#4fc3f7';
    ctx.strokeStyle = '#b3e5fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(p.x - sizePx / 2, p.y - sizePx / 2, sizePx, sizePx);
    ctx.fill();
    ctx.stroke();
  }

  // Draw bullets as small white dots
  for (const b of bullets) {
    const v = toView(b.x, b.y, b.z);
    if (v.z <= 0.2) continue;
    const p = project(v.x, v.y, v.z);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Win message
  if (targets.every(t => !t.alive)) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '24px system-ui';
    ctx.fillText('All targets cleared! Press R to restart.', width/2, height/2);
  }
}

// Restart
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    score = 0;
    scoreEl.textContent = `Score: ${score}`;
    bullets.length = 0;
    spawnTargets();
  }
});

// Main loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updatePlayer(dt);
  updateBullets(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
