import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const socket = io();

// --- Game State ---
let selectedClass = null;
let serverId = "US-East";
const remotePlayers = {};
let isPlaying = false;

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky
scene.fog = new THREE.Fog(0x87ceeb, 0, 500);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 50, 20);
scene.add(dirLight);

// --- Build the Map ---
// Floor
const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x3d8c40 }); // Grass green
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Generate random blocky buildings
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const boxMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
for (let i = 0; i < 50; i++) {
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(
    (Math.random() - 0.5) * 150,
    2.5,
    (Math.random() - 0.5) * 150
  );
  box.scale.set(
    5 + Math.random() * 5,
    5 + Math.random() * 10,
    5 + Math.random() * 5
  );
  scene.add(box);
}

// --- Gun Classes & Models ---
const gunGroup = new THREE.Group();
camera.add(gunGroup);
scene.add(camera);

const classSpecs = {
  Assault: {
    color: 0x333333,
    scale: [0.2, 0.3, 1.2],
    offset: [0.4, -0.3, -0.6],
  },
  Sniper: {
    color: 0x115511,
    scale: [0.15, 0.2, 2.0],
    offset: [0.4, -0.3, -0.8],
  },
  Heavy: { color: 0x551111, scale: [0.4, 0.5, 1.0], offset: [0.5, -0.4, -0.5] },
  Scout: { color: 0x888822, scale: [0.1, 0.2, 0.5], offset: [0.3, -0.2, -0.4] },
  Shotgun: {
    color: 0x663300,
    scale: [0.3, 0.2, 0.8],
    offset: [0.4, -0.3, -0.5],
  },
};

function equipGun(className) {
  gunGroup.clear(); // Remove old gun
  const spec = classSpecs[className];
  const gunGeo = new THREE.BoxGeometry(1, 1, 1);
  const gunMat = new THREE.MeshLambertMaterial({ color: spec.color });
  const gunMesh = new THREE.Mesh(gunGeo, gunMat);

  gunMesh.scale.set(...spec.scale);
  gunMesh.position.set(...spec.offset);
  gunGroup.add(gunMesh);
}

// --- Multiplayer Logic ---
socket.on("currentPlayers", (players) => {
  Object.values(players).forEach((player) => {
    if (player.id !== socket.id) addRemotePlayer(player);
  });
});

socket.on("newPlayer", (player) => {
  addRemotePlayer(player);
});

socket.on("playerMoved", (player) => {
  if (remotePlayers[player.id]) {
    remotePlayers[player.id].position.set(player.x, player.y, player.z);
    remotePlayers[player.id].rotation.y = player.rotationY;
  }
});

socket.on("playerDisconnected", (id) => {
  if (remotePlayers[id]) {
    scene.remove(remotePlayers[id]);
    delete remotePlayers[id];
  }
});

function addRemotePlayer(player) {
  // Player body
  const pGeo = new THREE.BoxGeometry(1, 2, 1);
  const pMat = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // Enemy color
  const pMesh = new THREE.Mesh(pGeo, pMat);
  pMesh.position.set(player.x, player.y, player.z);

  // Remote Gun representation
  const spec = classSpecs[player.playerClass];
  const gunGeo = new THREE.BoxGeometry(1, 1, 1);
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const gunMesh = new THREE.Mesh(gunGeo, gunMat);
  gunMesh.scale.set(...spec.scale);
  gunMesh.position.set(0.5, 0, -0.5);
  pMesh.add(gunMesh);

  scene.add(pMesh);
  remotePlayers[player.id] = pMesh;
}

// --- UI Logic ---
const menu = document.getElementById("menu");
const playBtn = document.getElementById("playBtn");
const crosshair = document.getElementById("crosshair");
const classBtns = document.querySelectorAll(".class-btn");

classBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    classBtns.forEach((b) => b.classList.remove("selected"));
    e.target.classList.add("selected");
    selectedClass = e.target.getAttribute("data-class");
    playBtn.disabled = false;
  });
});

playBtn.addEventListener("click", () => {
  serverId = document.getElementById("serverSelect").value;
  menu.style.display = "none";
  crosshair.style.display = "block";
  controls.lock();

  equipGun(selectedClass);
  camera.position.set(0, 2, 0);

  socket.emit("joinServer", { server: serverId, class: selectedClass });
  isPlaying = true;
});

// --- Movement & Input Loop ---
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyW") moveState.forward = true;
  if (e.code === "KeyS") moveState.backward = true;
  if (e.code === "KeyA") moveState.left = true;
  if (e.code === "KeyD") moveState.right = true;
});
document.addEventListener("keyup", (e) => {
  if (e.code === "KeyW") moveState.forward = false;
  if (e.code === "KeyS") moveState.backward = false;
  if (e.code === "KeyA") moveState.left = false;
  if (e.code === "KeyD") moveState.right = false;
});

let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();

  if (controls.isLocked && isPlaying) {
    const delta = (time - prevTime) / 1000;

    // Basic physics/movement
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    const speed =
      selectedClass === "Scout"
        ? 60.0
        : selectedClass === "Heavy"
        ? 30.0
        : 45.0;

    if (moveState.forward || moveState.backward)
      velocity.z -= direction.z * speed * delta;
    if (moveState.left || moveState.right)
      velocity.x -= direction.x * speed * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // Simple floor boundary check
    if (camera.position.y < 2) {
      velocity.y = 0;
      camera.position.y = 2;
    }

    // Send position to server
    socket.emit("playerMovement", {
      x: camera.position.x,
      y: camera.position.y - 1, // send center of body, not camera height
      z: camera.position.z,
      rotationY: camera.rotation.y,
    });
  }

  prevTime = time;
  renderer.render(scene, camera);
}

animate();

// Resize handler
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
