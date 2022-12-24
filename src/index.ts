import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Pathfinding, PathfindingHelper } from 'three-pathfinding';

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0);

// CAMERA
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 15;
camera.position.z = 20;
camera.position.x = -33;

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true

// ORBIT CAMERA CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.mouseButtons = {
	MIDDLE: THREE.MOUSE.ROTATE,
	RIGHT: THREE.MOUSE.PAN
}
orbitControls.enableDamping = true
orbitControls.enablePan = true
orbitControls.minDistance = 5
orbitControls.maxDistance = 60
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05 // prevent camera below ground
orbitControls.minPolarAngle = Math.PI / 4        // prevent top down view
orbitControls.update();

const dLight = new THREE.DirectionalLight('white', 0.6);
dLight.position.x = 20;
dLight.position.y = 30;
dLight.castShadow = true;
dLight.shadow.mapSize.width = 4096;
dLight.shadow.mapSize.height = 4096;
const d = 35;
dLight.shadow.camera.left = - d;
dLight.shadow.camera.right = d;
dLight.shadow.camera.top = d;
dLight.shadow.camera.bottom = - d;
scene.add(dLight);

const aLight = new THREE.AmbientLight('white', 0.4);
scene.add(aLight);

// ANIMATE
document.body.appendChild(renderer.domElement);

// RESIZE HANDLER
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

const agentHeight = 1.0;
const agentRadius = 0.25;
const agent = new THREE.Mesh(new THREE.CylinderGeometry(agentRadius, agentRadius, agentHeight), new THREE.MeshPhongMaterial({ color: 'green'}));
agent.position.y = agentHeight / 2;
const agentGroup = new THREE.Group();
agentGroup.add(agent);
agentGroup.position.z = 4;
agentGroup.position.x = 0;
agentGroup.position.y = 1;
scene.add(agentGroup);

const loader = new GLTFLoader();
loader.load('./glb/demo-level.glb', (gltf: GLTF) => {
    scene.add(gltf.scene);
});

const pathfinding = new Pathfinding();
const pathfindinghelper = new PathfindingHelper();
scene.add(pathfindinghelper);
const ZONE = 'level1';
const SPEED = 5;
let navmesh;
let groupID;
let navpath;
loader.load('./glb/demo-level-navmesh.glb', (gltf: GLTF) => {
    // scene.add(gltf.scene);
    gltf.scene.traverse((node) => {
        if (!navmesh && node.isObject3D && node.children && node.children.length > 0) {
            navmesh = node.children[0];
            pathfinding.setZoneData(ZONE, Pathfinding.createZone(navmesh.geometry));
            groupID = pathfinding.getGroup(ZONE, agentGroup.position);
        }
    });
});

// RAYCASTING
const raycaster = new THREE.Raycaster(); // create once
const clickMouse = new THREE.Vector2();  // create once
let target: THREE.Vector3 = null;

function intersect(pos: THREE.Vector2) {
    raycaster.setFromCamera(pos, camera);
    return raycaster.intersectObjects(scene.children);
}

window.addEventListener('click', event => {
    // THREE RAYCASTER
    clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
    const found = intersect(clickMouse);
    if (found.length > 0) {
        target = found[0].point;
        const agentpos = agentGroup.position;
        // console.log(`agentpos: ${JSON.stringify(agentpos)}`);
        // console.log(`target: ${JSON.stringify(target)}`);
        navpath = pathfinding.findPath(agentpos, target, ZONE, groupID);
        if (navpath) {
            // console.log(`navpath: ${JSON.stringify(navpath)}`);
            pathfindinghelper.reset();
            pathfindinghelper.setPlayerPosition(agentpos);
            pathfindinghelper.setTargetPosition(target);
            pathfindinghelper.setPath(navpath);
        }
    }
})

function moveTick ( delta: number ) {
    if ( !navpath || navpath.length <= 0 ) return

    let targetPosition = navpath[ 0 ];
    const velocity = targetPosition.clone().sub( agentGroup.position );

    if (velocity.lengthSq() > 0.05 * 0.05) {
        velocity.normalize();
        // Move player to target
        agentGroup.position.add( velocity.multiplyScalar( delta * SPEED ) );
    } else {
        // Remove node from the path we calculated
        navpath.shift();
    }
}

const clock = new THREE.Clock();
let gameLoop = () => {
    moveTick(clock.getDelta());
    orbitControls.update()
    renderer.render(scene, camera);
    setTimeout(gameLoop, 16);
};
gameLoop();