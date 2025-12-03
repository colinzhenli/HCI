// 3D Scene Visualization for Dual Robotic Arm Setup
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Coordinate system: Z up, X back, Y front (right-hand)
// Scene uses: Y up internally, so we need to convert

export class RoboticScene3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        if (!this.container) {
            console.error(`Container with id "${containerId}" not found`);
            return;
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Dynamic arm components
        this.cameraArm = null;
        this.lightArm = null;
        this.cameraEndEffector = null;
        this.lightEndEffector = null;
        this.cameraArmLine = null;
        this.lightArmLine = null;

        // Base positions (in scene coordinates)
        this.cameraBasePos = new THREE.Vector3(0, 0, 0);
        this.lightBasePos = new THREE.Vector3(0, 0, 0);

        // Pose data
        this.poses = null;
        this.currentFrame = 0;

        this.init();
        this.createScene();
        this.animate();
    }

    init() {
        if (!this.container) {
            console.error('3D scene container not found!');
            return;
        }

        const width = this.container.clientWidth || 600;
        const height = this.container.clientHeight || 400;

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Create camera - positioned to see the workspace
        // Coordinate system: +Z up, +Y right, +X backward
        const aspect = width / height;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 10000);
        // Position camera to look at the scene from above and front (-X direction)
        this.camera.position.set(-800, 0, 800);
        this.camera.up.set(0, 0, 1);  // Z is up
        this.camera.lookAt(0, 0, 300);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Add orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, 300);
        this.controls.update();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    // Convert from world coordinates to scene coordinates (same coordinate system)
    worldToScene(x, y, z) {
        // Use the same coordinate system as world (base1 frame)
        return new THREE.Vector3(x, y, z);
    }

    createScene() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Add directional light (Z is up)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(-500, 500, 1000);  // Above and to the front
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Create ground plane (XY plane at Z=0)
        const gridHelper = new THREE.GridHelper(1000, 20, 0x4a5568, 0x2d3748);
        gridHelper.rotation.x = Math.PI / 2;  // Rotate to make it XY plane
        gridHelper.position.z = 0;
        this.scene.add(gridHelper);

        // Add coordinate axes at origin
        const axesHelper = new THREE.AxesHelper(200);
        axesHelper.position.set(0, 0, 5);
        this.scene.add(axesHelper);

        // Create table surface (represents the workspace)
        this.createTable();

        // Create dynamic arm structures
        this.createDynamicArms();

        // Add workspace indicator
        this.createWorkspace();

        // Add labels
        this.addSceneLabels();
    }

    createTable() {
        // Table on XY plane (Z up)
        const tableGeometry = new THREE.BoxGeometry(600, 600, 10);
        const tableMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            roughness: 0.7,
            metalness: 0.1
        });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(0, 0, -5);  // Slightly below Z=0 plane
        table.receiveShadow = true;
        this.scene.add(table);
    }

    createDynamicArms() {
        // Camera arm base position: Base1 at (0, -300, 0)
        this.cameraBasePos = this.worldToScene(0, -300, 0);
        
        // Light arm base position: Base2 at (0, 300, 0)
        this.lightBasePos = this.worldToScene(0, 300, 0);

        // Create camera arm group
        this.cameraArm = new THREE.Group();
        this.scene.add(this.cameraArm);

        // Create light arm group
        this.lightArm = new THREE.Group();
        this.scene.add(this.lightArm);

        // Create camera end effector
        this.cameraEndEffector = this.createCameraEffector();
        this.scene.add(this.cameraEndEffector);

        // Create light end effector
        this.lightEndEffector = this.createLightEffector();
        this.scene.add(this.lightEndEffector);

        // Create arm base cylinders
        this.createArmBase(this.cameraBasePos, 0x606060);
        this.createArmBase(this.lightBasePos, 0x606060);

        // Create line connections (will be updated dynamically)
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe8e8e8, linewidth: 3 });
        
        // Camera arm line
        const cameraLineGeom = new THREE.BufferGeometry();
        cameraLineGeom.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,0], 3));
        this.cameraArmLine = new THREE.Line(cameraLineGeom, lineMaterial);
        this.scene.add(this.cameraArmLine);

        // Light arm line
        const lightLineGeom = new THREE.BufferGeometry();
        lightLineGeom.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,0], 3));
        this.lightArmLine = new THREE.Line(lightLineGeom, lineMaterial.clone());
        this.lightArmLine.material.color.setHex(0xe8e8e8);
        this.scene.add(this.lightArmLine);

        // Set initial positions (Z is up)
        this.cameraEndEffector.position.copy(this.cameraBasePos);
        this.cameraEndEffector.position.z += 300;
        this.lightEndEffector.position.copy(this.lightBasePos);
        this.lightEndEffector.position.z += 300;

        this.updateArmLines();
    }

    createArmBase(position, color) {
        const baseGeometry = new THREE.CylinderGeometry(30, 40, 50, 16);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.4,
            metalness: 0.6
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.rotation.x = Math.PI / 2;  // Orient cylinder along Z axis
        base.position.copy(position);
        base.position.z += 25;  // Z is up
        base.castShadow = true;
        this.scene.add(base);
    }

    createCameraEffector() {
        const cameraGroup = new THREE.Group();

        // Camera body
        const bodyGeometry = new THREE.BoxGeometry(40, 30, 60);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.2,
            metalness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        cameraGroup.add(body);

        // Lens
        const lensGeometry = new THREE.CylinderGeometry(12, 12, 25, 16);
        const lensMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a,
            roughness: 0.1,
            metalness: 0.9
        });
        const lens = new THREE.Mesh(lensGeometry, lensMaterial);
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 30;
        lens.castShadow = true;
        cameraGroup.add(lens);

        // Lens glass (indicates direction)
        const glassGeometry = new THREE.CircleGeometry(10, 16);
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a90e2,
            roughness: 0.0,
            metalness: 1.0,
            emissive: 0x1a4d7a,
            emissiveIntensity: 0.5
        });
        const glass = new THREE.Mesh(glassGeometry, glassMaterial);
        glass.position.z = 43;
        cameraGroup.add(glass);

        return cameraGroup;
    }

    createLightEffector() {
        const lightGroup = new THREE.Group();

        // Light housing
        const housingGeometry = new THREE.CylinderGeometry(20, 25, 40, 16);
        const housingMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.3,
            metalness: 0.7
        });
        const housing = new THREE.Mesh(housingGeometry, housingMaterial);
        housing.rotation.x = Math.PI / 2;
        housing.castShadow = true;
        lightGroup.add(housing);

        // Light emitter (indicates direction)
        const emitterGeometry = new THREE.CircleGeometry(18, 16);
        const emitterMaterial = new THREE.MeshStandardMaterial({
            color: 0xffeb3b,
            emissive: 0xffeb3b,
            emissiveIntensity: 0.8,
            roughness: 0.1
        });
        const emitter = new THREE.Mesh(emitterGeometry, emitterMaterial);
        emitter.position.z = 21;
        lightGroup.add(emitter);

        // Add point light for glow effect
        const pointLight = new THREE.PointLight(0xffeb3b, 0.5, 300);
        pointLight.position.z = 25;
        lightGroup.add(pointLight);

        return lightGroup;
    }

    updateArmLines() {
        // Update camera arm line (Z is up)
        const cameraPositions = this.cameraArmLine.geometry.attributes.position.array;
        cameraPositions[0] = this.cameraBasePos.x;
        cameraPositions[1] = this.cameraBasePos.y;
        cameraPositions[2] = this.cameraBasePos.z + 50;  // Z offset for base height
        cameraPositions[3] = this.cameraEndEffector.position.x;
        cameraPositions[4] = this.cameraEndEffector.position.y;
        cameraPositions[5] = this.cameraEndEffector.position.z;
        this.cameraArmLine.geometry.attributes.position.needsUpdate = true;

        // Update light arm line (Z is up)
        const lightPositions = this.lightArmLine.geometry.attributes.position.array;
        lightPositions[0] = this.lightBasePos.x;
        lightPositions[1] = this.lightBasePos.y;
        lightPositions[2] = this.lightBasePos.z + 50;  // Z offset for base height
        lightPositions[3] = this.lightEndEffector.position.x;
        lightPositions[4] = this.lightEndEffector.position.y;
        lightPositions[5] = this.lightEndEffector.position.z;
        this.lightArmLine.geometry.attributes.position.needsUpdate = true;
    }

    createWorkspace() {
        // Create a highlighted area representing the workspace (XY plane at Z=0)
        const workspaceGeometry = new THREE.PlaneGeometry(300, 300);
        const workspaceMaterial = new THREE.MeshBasicMaterial({
            color: 0x4a90e2,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        const workspace = new THREE.Mesh(workspaceGeometry, workspaceMaterial);
        // PlaneGeometry is in XY by default, no rotation needed
        workspace.position.set(0, 0, 2);
        this.scene.add(workspace);

        // Workspace border
        const borderGeometry = new THREE.EdgesGeometry(workspaceGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0x4a90e2 });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        border.position.set(0, 0, 3);
        this.scene.add(border);
    }

    addSceneLabels() {
        // Labels with Z offset for height (Z is up)
        this.createTextLabel('Camera', this.cameraBasePos.x, this.cameraBasePos.y, this.cameraBasePos.z + 100);
        this.createTextLabel('Light', this.lightBasePos.x, this.lightBasePos.y, this.lightBasePos.z + 100);
        this.createTextLabel('Workspace', 0, 0, 50);
    }

    createTextLabel(text, x, y, z) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        context.fillStyle = '#ffffff';
        context.font = 'Bold 24px Arial';
        context.textAlign = 'center';
        context.fillText(text, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, y, z);
        sprite.scale.set(80, 20, 1);
        this.scene.add(sprite);
    }

    // Set poses data from backend
    setPoses(poses) {
        this.poses = poses;
        console.log('Poses loaded:', poses.length, 'frames');
    }

    // Update scene for a specific frame
    updateFrame(frameIndex) {
        if (!this.poses || frameIndex >= this.poses.length) {
            return;
        }

        this.currentFrame = frameIndex;
        const pose = this.poses[frameIndex];

        // Update camera position
        // pose.camera.position is in mm [x, y, z] in world coordinates
        const camPos = pose.camera.position;
        const camScenePos = this.worldToScene(camPos[0], camPos[1], camPos[2]);
        this.cameraEndEffector.position.copy(camScenePos);

        // Update camera rotation from rotation matrix
        if (pose.camera.rotation) {
            const r = pose.camera.rotation;
            // Build rotation matrix from camera-to-world rotation
            // r is a 3x3 rotation matrix stored as r[row][col]
            const rotMatrix = new THREE.Matrix4();
            rotMatrix.set(
                r[0][0], r[0][1], r[0][2], 0,
                r[1][0], r[1][1], r[1][2], 0,
                r[2][0], r[2][1], r[2][2], 0,
                0,       0,       0,       1
            );
            // Apply rotation to camera effector
            this.cameraEndEffector.rotation.setFromRotationMatrix(rotMatrix);
            // Camera model's lens points along +Z in local frame
            // OpenGL camera looks along -Z, so rotate 180° around Y to flip
            this.cameraEndEffector.rotateY(Math.PI);
        }

        // Update light position
        const lightPos = pose.light.position;
        const lightScenePos = this.worldToScene(lightPos[0], lightPos[1], lightPos[2]);
        this.lightEndEffector.position.copy(lightScenePos);

        // Update light orientation
        if (pose.light.rotation) {
            const r = pose.light.rotation;
            // Build rotation matrix from light-to-world rotation
            const rotMatrix = new THREE.Matrix4();
            rotMatrix.set(
                r[0][0], r[0][1], r[0][2], 0,
                r[1][0], r[1][1], r[1][2], 0,
                r[2][0], r[2][1], r[2][2], 0,
                0,       0,       0,       1
            );
            // Apply rotation to light effector
            this.lightEndEffector.rotation.setFromRotationMatrix(rotMatrix);
            // Light normal points to (0, -1, 0) in local frame
            // The light model's emitter points along +Z, so we need to adjust
            // Rotate +90° around X to align +Z with -Y (flipped)
            this.lightEndEffector.rotateX(Math.PI / 2);
        }

        // Update arm lines
        this.updateArmLines();
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Global scene instance
let scene3dInstance = null;

// Initialize the 3D scene when the DOM is ready
function initScene() {
    console.log('Initializing 3D scene...');
    scene3dInstance = new RoboticScene3D('scene-3d-container');
    
    // Expose globally for app.js to access
    window.scene3d = scene3dInstance;
    
    // Fetch poses from backend
    fetch('/api/poses')
        .then(response => response.json())
        .then(data => {
            if (data.poses) {
                scene3dInstance.setPoses(data.poses);
                // Dispatch event to notify app.js that poses are loaded
                window.dispatchEvent(new CustomEvent('posesLoaded', { detail: data.poses }));
            }
        })
        .catch(err => console.error('Error fetching poses:', err));
}

// Check if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScene);
} else {
    initScene();
}
