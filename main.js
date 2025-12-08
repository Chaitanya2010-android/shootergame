// main.js - module
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/PointerLockControls.js';

const canvas = document.getElementById('c');
const healthEl = document.getElementById('healthVal');
const ammoEl = document.getElementById('ammoVal');
const startBtn = document.getElementById('startBtn');
const menu = document.getElementById('menu');

let scene, camera, renderer, controls;
let clock = new THREE.Clock();

const PLAYER = {
  height: 1.6,
  speed: 6,
  jumpSpeed: 6,
  velocity: new THREE.Vector3(),
  canJump: false,
  health: 100,
  ammo: 30
};

const bulletSpeed = 80;
const gravity = 30;

const objects = []; // collidable objects (walls)
const enemies = [];
const bullets = []; // player bullets
const enemyBullets = [];

init();
animate();

function init() {
  // Scene, camera, renderer
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x88c0ff);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, PLAYER.height, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  // Light
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemi.position.set(0, 200, 0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(-50, 100, -50);
  dir.castShadow = true;
  scene.add(dir);

  // Floor with grid / tiles via canvas texture
  const tileTex = makeGridTexture(1024, 1024, 8, '#6b6b6b', '#8c8c8c');
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(20, 20);
  const floorMat = new THREE.MeshStandardMaterial({ map: tileTex });
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Walls around the play area
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const wallThickness = 2;
  addWall(0, wallThickness/2, -100 - wallThickness/2, 200, wallThickness, wallMat); // back
  addWall(0, wallThickness/2, 100 + wallThickness/2, 200, wallThickness, wallMat); // front
  addWall(-100 - wallThickness/2, wallThickness/2, 0, wallThickness, 200, wallMat); // left
  addWall(100 + wallThickness/2, wallThickness/2, 0, wallThickness, 200, wallMat); // right

  // Some boxes for cover
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  addBox( -10, 1, -10, 8, 2, 8, boxMat);
  addBox( 12, 1, 6, 6, 2, 6, boxMat);
  addBox( -20, 1, 22, 10, 2, 6, boxMat);

  // Simple sky sphere
  const skyGeo = new THREE.SphereGeometry(300, 16, 8);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Controls (pointer lock)
  controls = new PointerLockControls(camera, document.body);
  controls.getObject().position.y = PLAYER.height;
  scene.add(controls.getObject());

  // Start button locks pointer
  startBtn.addEventListener('click', () => {
    controls.lock();
  });

  controls.addEventListener('lock', () => {
    menu.style.display = 'none';
  });
  controls.addEventListener('unlock', () => {
    menu.style.display = 'block';
  });

  // Input
  setupInput();

  // Spawn some enemies
  spawnEnemy(new THREE.Vector3( -30, 0, -30 ));
  spawnEnemy(new THREE.Vector3( 40, 0, -20 ));
  spawnEnemy(new THREE.Vector3( 20, 0, 40 ));

  // Crosshair
  makeCrosshair();

  window.addEventListener('resize', onWindowResize);
}

// Utility: grid texture
function makeGridTexture(w, h, tiles, color1, color2) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tw = w / tiles;
  const th = h / tiles;
  for (let x = 0; x < tiles; x++) {
    for (let y = 0; y < tiles; y++) {
      ctx.fillStyle = ( (x+y) % 2 === 0 ) ? color1 : color2;
      ctx.fillRect(x*tw, y*th, tw, th);
    }
  }
  // highlight grid lines
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let x=0;x<=tiles;x++){
    ctx.beginPath(); ctx.moveTo(x*tw,0); ctx.lineTo(x*tw,h); ctx.stroke();
  }
  for (let y=0;y<=tiles;y++){
    ctx.beginPath(); ctx.moveTo(0,y*th); ctx.lineTo(w,y*th); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function addWall(x,y,z,w,h,mat){
  // Overload: if w is thickness, h is length: handle both signatures
  let width = w, depth = h;
  if (w > 20) depth = 2;
  const geo = new THREE.BoxGeometry(w, h, 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x,y,z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  objects.push(mesh);
}
function addBox(x,y,z,w,h,d,mat){
  const geo = new THREE.BoxGeometry(w,h,d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x,y + h/2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  objects.push(mesh);
}

// Input handling
const keys = {};
function setupInput(){
  const onKeyDown = function ( event ) {
    keys[event.code] = true;
    if (event.code === 'Space' && PLAYER.canJump) {
      PLAYER.velocity.y = PLAYER.jumpSpeed;
      PLAYER.canJump = false;
    }
  };
  const onKeyUp = function ( event ) {
    keys[event.code] = false;
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  document.addEventListener('mousedown', (e) => {
    if (!controls.isLocked) return;
    if (e.button === 0) { // left click
      shoot();
    }
  });
}

// Shooting
function shoot() {
  if (PLAYER.ammo <= 0) return;
  PLAYER.ammo--;
  ammoEl.textContent = PLAYER.ammo;
  const origin = new THREE.Vector3();
  origin.copy(camera.getWorldPosition(new THREE.Vector3()));
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const bullet = {
    pos: origin.clone(),
    vel: dir.clone().multiplyScalar(bulletSpeed),
    life: 2.5,
    mesh: makeBulletMesh(0xffee88)
  };
  bullet.mesh.position.copy(bullet.pos);
  scene.add(bullet.mesh);
  bullets.push(bullet);
}

// Enemy class
class Enemy {
  constructor(pos) {
    this.health = 50;
    const geo = new THREE.BoxGeometry(1.2, 2, 1.2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaa3333 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.copy(pos).add(new THREE.Vector3(0,1,0));
    scene.add(this.mesh);
    this.reload = 0;
  }
  update(dt){
    // Move toward player (simple)
    const playerPos = controls.getObject().position.clone();
    const toPlayer = playerPos.clone().sub(this.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist > 2.5) {
      toPlayer.normalize();
      this.mesh.position.addScaledVector(toPlayer, dt * 2.0); // enemy speed
    }
    // Shooting
    this.reload -= dt;
    if (this.reload <= 0 && dist < 35) {
      this.reload = 1.35;
      this.shootAt(playerPos);
    }
    // Simple rotation to look at player
    this.mesh.lookAt(playerPos.setY(this.mesh.position.y));
  }
  shootAt(targetPos){
    const origin = this.mesh.position.clone().add(new THREE.Vector3(0,0.8,0));
    const dir = targetPos.clone().sub(origin).normalize();
    const b = {
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(40),
      life: 4,
      mesh: makeBulletMesh(0xff4444, 0.06)
    };
    b.mesh.position.copy(b.pos);
    scene.add(b.mesh);
    enemyBullets.push(b);
  }
  takeDamage(dmg){
    this.health -= dmg;
  }
  dispose(){
    scene.remove(this.mesh);
  }
}

function spawnEnemy(at) {
  const e = new Enemy(at);
  enemies.push(e);
}

// Bullet mesh
function makeBulletMesh(hex, size = 0.12) {
  const geo = new THREE.SphereGeometry(size, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: hex });
  const m = new THREE.Mesh(geo, mat);
  return m;
}

// Main loop
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
}

function update(dt) {
  // Movement
  if (controls.isLocked) {
    // Apply gravity
    PLAYER.velocity.y -= gravity * dt;
    let speed = PLAYER.speed;
    const forward = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), dir).normalize();

    const move = new THREE.Vector3();
    move.addScaledVector(dir, forward);
    move.addScaledVector(right, strafe);
    if (move.lengthSq() > 0) {
      move.normalize();
      PLAYER.velocity.x = move.x * speed;
      PLAYER.velocity.z = move.z * speed;
    } else {
      PLAYER.velocity.x = 0;
      PLAYER.velocity.z = 0;
    }

    // Integrate
    const oldPos = controls.getObject().position.clone();
    controls.getObject().position.addScaledVector(PLAYER.velocity, dt);

    // Simple floor collision
    if (controls.getObject().position.y < PLAYER.height) {
      PLAYER.velocity.y = 0;
      controls.getObject().position.y = PLAYER.height;
      PLAYER.canJump = true;
    }

    // Simple wall collision against objects[] bounding boxes
    for (let obj of objects) {
      const box = new THREE.Box3().setFromObject(obj);
      const pos = controls.getObject().position;
      if (box.containsPoint(new THREE.Vector3(pos.x, pos.y - PLAYER.height/2, pos.z))) {
        // push back to old pos
        controls.getObject().position.copy(oldPos);
        PLAYER.velocity.x = PLAYER.velocity.z = 0;
        break;
      }
    }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.pos.addScaledVector(b.vel, dt);
    b.mesh.position.copy(b.pos);
    b.life -= dt;
    // Check against enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const dist = e.mesh.position.distanceTo(b.pos);
      if (dist < 1.2) {
        // hit
        e.takeDamage(25);
        b.life = 0;
      }
    }
    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(i,1);
    }
  }

  // Enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.pos.addScaledVector(b.vel, dt);
    b.mesh.position.copy(b.pos);
    b.life -= dt;
    const playerPos = controls.getObject().position.clone();
    if (playerPos.distanceTo(b.pos) < 1.0) {
      // hit player
      PLAYER.health -= 8;
      healthEl.textContent = Math.max(0, Math.floor(PLAYER.health));
      b.life = 0;
      if (PLAYER.health <= 0) {
        // Game over - unlock pointer
        controls.unlock();
        alert('You died. Reload the page to try again.');
      }
    }
    if (b.life <= 0) {
      scene.remove(b.mesh);
      enemyBullets.splice(i,1);
    }
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.update(dt);
    if (e.health <= 0) {
      e.dispose();
      enemies.splice(i,1);
    }
  }

  // Simple respawn: if all enemies dead, spawn more after delay
  if (enemies.length === 0 && Math.random() < 0.007) {
    spawnEnemy(new THREE.Vector3( randomRange(-50,50), 0, randomRange(-50,50) ));
  }
}

function randomRange(a,b){ return a + Math.random()*(b-a); }

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Crosshair element
function makeCrosshair(){
  const div = document.createElement('div');
  div.id = 'crosshair';
  document.body.appendChild(div);
}

// Make bullet small sphere (reused if needed)
// already implemented above

// simple helper: refill ammo with R (for convenience)
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') {
    PLAYER.ammo = 30;
    ammoEl.textContent = PLAYER.ammo;
  }
});
