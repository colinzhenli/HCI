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

        // Dynamic arm components (for simple line visualization - kept for reference)
        this.cameraArm = null;
        this.lightArm = null;
        this.cameraEndEffector = null;
        this.lightEndEffector = null;
        this.cameraArmLine = null;
        this.lightArmLine = null;

        // IK Arm components
        this.ikChains = {}; // Stores { camera: chain, light: chain }

        // Base positions (in scene coordinates)
        this.cameraBasePos = new THREE.Vector3(0, 0, 0);
        this.lightBasePos = new THREE.Vector3(0, 0, 0);

        // Hand object
        this.hand = null;

        // Pose data
        this.poses = null;
        this.currentFrame = 0;

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
        this.controls.dampingFactor = 0.1;  // Increased damping for smoother movement
        this.controls.target.set(0, 0, 300);
        
        // Zoom settings
        this.controls.zoomSpeed = 0.3;
        this.controls.minDistance = 300;   // Prevent zooming too close
        this.controls.maxDistance = 4000;  // Prevent zooming too far
        
        // Reduce wheel scroll sensitivity by intercepting wheel events
        this.renderer.domElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            // Calculate zoom factor with reduced sensitivity
            const zoomFactor = 1 + (event.deltaY > 0 ? 0.05 : -0.05);  // 5% per scroll
            
            // Get current distance from target
            const currentDistance = this.camera.position.distanceTo(this.controls.target);
            const newDistance = currentDistance * zoomFactor;
            
            // Clamp to min/max distance
            const clampedDistance = Math.max(this.controls.minDistance, 
                                             Math.min(this.controls.maxDistance, newDistance));
            
            // Calculate new camera position
            const direction = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
            this.camera.position.copy(this.controls.target).add(direction.multiplyScalar(clampedDistance));
            
        }, { passive: false });
        
        // Disable OrbitControls' built-in zoom since we handle it manually
        this.controls.enableZoom = false;
        
        this.controls.update();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Use ResizeObserver for container size changes (more reliable for splitter)
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.onWindowResize();
            });
            this.resizeObserver.observe(this.container);
        }
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

        // Create dynamic arm structures (IK arms)
        this.createDynamicArms();

        // Create hand model
        this.createHand();

        // Add workspace indicator
        this.createWorkspace();

        // Add labels
        this.addSceneLabels();
    }

    createTable() {
        // Table on XY plane (Z up) - Larger size
        const tableGeometry = new THREE.BoxGeometry(1200, 1200, 10);
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

    createHand() {
        // Create a simple hand model
        const handGroup = new THREE.Group();

        // Palm
        const palmGeometry = new THREE.BoxGeometry(60, 80, 20);
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5d0c5,
            roughness: 0.8,
            metalness: 0.1
        });
        const palm = new THREE.Mesh(palmGeometry, skinMaterial);
        palm.castShadow = true;
        handGroup.add(palm);

        // Fingers (5 fingers)
        const fingerPositions = [
            { x: -24, y: 50, length: 40 },   // Thumb (shorter, offset)
            { x: -15, y: 55, length: 50 },   // Index
            { x: 0, y: 58, length: 55 },     // Middle (longest)
            { x: 15, y: 55, length: 50 },    // Ring
            { x: 27, y: 48, length: 40 }     // Pinky (shortest)
        ];

        fingerPositions.forEach((pos, index) => {
            const fingerGeometry = new THREE.CylinderGeometry(6, 7, pos.length, 8);
            const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
            finger.position.set(pos.x, pos.y, 0);
            finger.castShadow = true;
            handGroup.add(finger);

            // Fingertip
            const tipGeometry = new THREE.SphereGeometry(6, 8, 8);
            const tip = new THREE.Mesh(tipGeometry, skinMaterial);
            tip.position.set(pos.x, pos.y + pos.length / 2, 0);
            tip.castShadow = true;
            handGroup.add(tip);
        });

        // Wrist
        const wristGeometry = new THREE.CylinderGeometry(25, 30, 30, 16);
        const wrist = new THREE.Mesh(wristGeometry, skinMaterial);
        wrist.position.set(0, -55, 0);
        wrist.castShadow = true;
        handGroup.add(wrist);

        // Orient hand: Fingers point -Y, Palm Up (+Z)
        // Local Y is finger direction, Local Z is palm normal
        handGroup.rotation.z = Math.PI;

        // Smaller hand model
        handGroup.scale.set(0.5, 0.5, 0.5);

        // Initial position
        handGroup.position.set(200, -100, 0);

        this.hand = handGroup;
        this.scene.add(this.hand);
    }

    updateHandPosition(frameIndex) {
        if (!this.hand) return;

        // Animation keyframes:
        // Frames 0-29: Hand at (200, 0, 0)
        // Frames 30-59: Hand interpolates to (300, 0, 0)
        // Frames 60-89: Hand interpolates to (300, 0, 50)

        let targetX, targetY, targetZ;

        if (frameIndex < 30) {
            // Frames 0-29: Stay at initial position
            targetX = 200;
            targetY = 0;
            targetZ = 0;
        } else if (frameIndex < 60) {
            // Frames 30-59: Interpolate from (200,0,0) to (300,0,0)
            const t = (frameIndex - 30) / 30;  // 0 to 1
            targetX = 200 + 100 * t;
            targetY = -100;
            targetZ = 0;
        } else {
            // Frames 60-89: Interpolate from (300,0,0) to (300,0,50)
            const t = (frameIndex - 60) / 30;  // 0 to 1
            targetX = 300;
            targetY = -100;
            targetZ = 50 * t;
        }

        this.hand.position.set(targetX, targetY, targetZ);
    }

    createDynamicArms() {
        // Camera arm base position: Base1 at (0, -300, 0)
        this.cameraBasePos = this.worldToScene(0, -500, 0);
        
        // Light arm base position: Base2 at (0, 300, 0)
        this.lightBasePos = this.worldToScene(0, 500, 0);

        // Create IK arms with WHITE color
        this.ikChains.camera = this.createIKChain('camera', this.cameraBasePos, 0xffffff);
        this.ikChains.light = this.createIKChain('light', this.lightBasePos, 0xffffff);
        
        // Add camera/light models to the end effectors
        this.attachToolsToIKChains();
    }

    createIKChain(name, basePos, color) {
        const chainGroup = new THREE.Group();
        chainGroup.position.copy(basePos);
        this.scene.add(chainGroup);

        const segments = [];
        const numJoints = 3; // Reduced from 5 to 3 for simpler linear model
        const segmentLength = 250; // Increased length to maintain reach (3 * 250 = 750mm)

        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.4,
            metalness: 0.6
        });

        // Base cylinder
        const baseGeom = new THREE.CylinderGeometry(40, 50, 40, 32);
        const baseMesh = new THREE.Mesh(baseGeom, material);
        baseMesh.rotation.x = Math.PI / 2;
        baseMesh.position.z = 20;
        chainGroup.add(baseMesh);

        // Create joints and segments
        let parent = chainGroup;
        
        // Initial position for the first joint (top of base)
        let currentPos = new THREE.Vector3(0, 0, 40); 

        for (let i = 0; i < numJoints; i++) {
            const jointGroup = new THREE.Group();
            jointGroup.position.copy(currentPos); // Relative to parent
            parent.add(jointGroup);
            
            // Visual joint (sphere)
            const jointGeom = new THREE.SphereGeometry(25, 32, 32);
            const jointMesh = new THREE.Mesh(jointGeom, material);
            jointGroup.add(jointMesh);

            // Link geometry (Cylinder pointing along Z)
            const linkGeom = new THREE.CylinderGeometry(15, 15, segmentLength, 16);
            const linkMesh = new THREE.Mesh(linkGeom, material);
            linkMesh.rotation.x = Math.PI / 2; // Align with Z
            linkMesh.position.z = segmentLength / 2;
            jointGroup.add(linkMesh);

            segments.push({
                group: jointGroup,
                length: segmentLength,
                angle: new THREE.Euler(0, 0, 0) // Current angle state
            });

            parent = jointGroup;
            currentPos = new THREE.Vector3(0, 0, segmentLength); // Next joint at end of this link
        }

        // End Effector Group (at the end of last segment)
        const eeGroup = new THREE.Group();
        eeGroup.position.set(0, 0, segmentLength);
        parent.add(eeGroup);

        return {
            root: chainGroup,
            segments: segments,
            endEffector: eeGroup,
            target: new THREE.Vector3() // Current target position
        };
    }

    attachToolsToIKChains() {
        // Attach Camera to Camera Chain EE
        if (this.ikChains.camera) {
            const cameraModel = this.createCameraEffector();
            // Rotate to align with Z-up convention if needed
            // Camera model lens points +Z.
            // We want it to look at the target.
            // Just add it, we'll orient the whole EE.
            this.ikChains.camera.endEffector.add(cameraModel);
            this.cameraEndEffector = this.ikChains.camera.endEffector; // Reference for updates
        }

        // Attach Light to Light Chain EE
        if (this.ikChains.light) {
            const lightModel = this.createLightEffector();
            this.ikChains.light.endEffector.add(lightModel);
            this.lightEndEffector = this.ikChains.light.endEffector;
            
            // Set light arm to fixed initial pose (pointing up and slightly forward)
            // Light base is at (0, 500, 0), so target straight up
            const lightInitialTarget = new THREE.Vector3(0, 500, 500);
            this.updateIKChain('light', lightInitialTarget, null);
        }
    }

    // FABRIK IK Solver with Pole Constraint
    solveIK(chain, targetPos) {
        if (!chain) return;

        const segments = chain.segments;
        const numSegments = segments.length;
        
        // 1. Extract current joint world positions
        // p[0] is base joint, p[numSegments] is end effector
        const p = [];
        const lengths = [];
        
        // Base position (start of first segment)
        const rootWorldPos = new THREE.Vector3();
        chain.root.getWorldPosition(rootWorldPos);
        // Adjust for base cylinder height? First joint is at z=40
        const baseJointWorldPos = new THREE.Vector3(0, 0, 40).applyMatrix4(chain.root.matrixWorld);
        p.push(baseJointWorldPos);
        
        for (let i = 0; i < numSegments; i++) {
            const segment = segments[i];
            lengths.push(segment.length);
            // We need the position of the NEXT joint (or EE)
            // segments[i].group is the joint i. 
            // segments[i].group position is relative to parent.
            // The END of segment i is at segments[i].group's local Z=length.
            // Or simpler: p[i+1] is the start of next joint?
            // createIKChain structure: 
            // segments[0].group is at base.
            // segments[1].group is at end of segment 0.
            // EE group is at end of last segment.
            
            if (i < numSegments - 1) {
                const nextJoint = segments[i+1].group;
                const pos = new THREE.Vector3();
                nextJoint.getWorldPosition(pos);
                p.push(pos);
            } else {
                const eePos = new THREE.Vector3();
                chain.endEffector.getWorldPosition(eePos);
                p.push(eePos);
            }
        }
        
        // Pole Vector: Push intermediate joints towards -X
        // "all joints in the -x region" -> Bias towards negative X
        const poleDir = new THREE.Vector3(-1, 0, 0); 
        
        // FABRIK Iterations
        const iterationCount = 10;
        
        for (let iter = 0; iter < iterationCount; iter++) {
            // Backward Reaching
            p[numSegments].copy(targetPos); // Set EE to target
            
            for (let i = numSegments - 1; i >= 0; i--) {
                const dir = new THREE.Vector3().subVectors(p[i], p[i+1]).normalize();
                p[i].copy(p[i+1]).add(dir.multiplyScalar(lengths[i]));
            }
            
            // Forward Reaching
            p[0].copy(baseJointWorldPos); // Reset Base
            
            for (let i = 0; i < numSegments; i++) {
                // Apply Pole Constraint bias before length constraint
                // Only for intermediate joints (1 to numSegments-1)
                if (i < numSegments - 1) { // i+1 is the joint we are placing
                    // Bias p[i+1] towards -X
                    p[i+1].add(poleDir.clone().multiplyScalar(5)); // Push amount
                }
                
                const dir = new THREE.Vector3().subVectors(p[i+1], p[i]).normalize();
                p[i+1].copy(p[i]).add(dir.multiplyScalar(lengths[i]));
            }
        }
        
        // 2. Apply computed positions to joint rotations
        // segments[i].group needs to rotate to point from p[i] to p[i+1]
        // segments[i].group is at p[i] (conceptually)
        // Its local Z axis should point to p[i+1]
        
        // Update world matrices
        chain.root.updateMatrixWorld(true);
        
        for (let i = 0; i < numSegments; i++) {
            const segment = segments[i];
            const jointNode = segment.group;
            
            // Current world position of this joint
            const currentPos = new THREE.Vector3();
            jointNode.getWorldPosition(currentPos);
            
            // Target position for the end of this link
            const targetLinkEnd = p[i+1];
            
            // Direction vector in World Space
            const worldDir = new THREE.Vector3().subVectors(targetLinkEnd, currentPos).normalize();
            
            // Convert world direction to parent's local space (to set quaternion)
            // parentWorldQuat * localDir = worldDir
            // localDir = parentWorldQuat^-1 * worldDir
            const parentQuat = jointNode.parent.getWorldQuaternion(new THREE.Quaternion());
            const localDir = worldDir.clone().applyQuaternion(parentQuat.clone().invert());
            
            // We want segment's Z axis (0,0,1) to point along localDir
            const alignQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), localDir);
            
            jointNode.quaternion.copy(alignQuat);
            jointNode.updateMatrixWorld(true); // Update for next child calculation
        }
    }

    updateIKChain(name, targetPos, targetRot) {
        const chain = this.ikChains[name];
        if (!chain) return;

        // 1. Smoothly interpolate target position if needed, or just use targetPos
        // "joint movement should be interpolated... consistent between frames"
        // IK naturally handles small changes smoothly.
        
        // 2. Solve IK to reach position
        this.solveIK(chain, targetPos);
        
        // 3. Orient End Effector to match target rotation
        // The IK brings the wrist to the position. 
        // We set the EE (Camera/Light) absolute rotation to match targetRot.
        // Since EE is child of the last joint, we need to set its world rotation.
        
        if (targetRot) {
            // Create rotation matrix from array
            const rotMatrix = new THREE.Matrix4();
            rotMatrix.set(
                targetRot[0][0], targetRot[0][1], targetRot[0][2], 0,
                targetRot[1][0], targetRot[1][1], targetRot[1][2], 0,
                targetRot[2][0], targetRot[2][1], targetRot[2][2], 0,
                0, 0, 0, 1
            );
            
            // Apply orientation directly to EE group (overriding parent transforms)
            // To do this in Three.js scene graph:
            // EE.quaternion = parentWorldQuatInverse * targetWorldQuat
            
            const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
            
            // Adjust for model conventions
            if (name === 'camera') {
                // Camera model lens +Z, OpenGL target -Z. Rotate 180 Y.
                const adjust = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
                targetQuat.multiply(adjust);
            } else {
                // Light model +Z, target -Y. Rotate +90 X to flip normal.
                const adjust = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI/2);
                targetQuat.multiply(adjust);
            }
            
            const parentQuat = chain.endEffector.parent.getWorldQuaternion(new THREE.Quaternion());
            const localQuat = parentQuat.clone().invert().multiply(targetQuat);
            
            chain.endEffector.quaternion.copy(localQuat);
        }
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

        // Camera body - sleek black box
        const bodyGeometry = new THREE.BoxGeometry(50, 35, 70);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.2,
            metalness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        cameraGroup.add(body);

        // Blue accent stripe on top
        const accentGeometry = new THREE.BoxGeometry(50, 5, 70);
        const accentMaterial = new THREE.MeshStandardMaterial({
            color: 0x2196F3,
            roughness: 0.3,
            metalness: 0.6,
            emissive: 0x0d47a1,
            emissiveIntensity: 0.3
        });
        const accent = new THREE.Mesh(accentGeometry, accentMaterial);
        accent.position.y = 20;
        cameraGroup.add(accent);

        // Lens barrel - larger and more visible
        const lensBarrelGeometry = new THREE.CylinderGeometry(18, 20, 35, 24);
        const lensBarrelMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.15,
            metalness: 0.9
        });
        const lensBarrel = new THREE.Mesh(lensBarrelGeometry, lensBarrelMaterial);
        lensBarrel.rotation.x = Math.PI / 2;
        lensBarrel.position.z = 45;
        lensBarrel.castShadow = true;
        cameraGroup.add(lensBarrel);

        // Lens glass - bright blue to indicate viewing direction
        const glassGeometry = new THREE.CircleGeometry(16, 24);
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0x00bcd4,
            roughness: 0.0,
            metalness: 1.0,
            emissive: 0x0097a7,
            emissiveIntensity: 0.8
        });
        const glass = new THREE.Mesh(glassGeometry, glassMaterial);
        glass.position.z = 63;
        cameraGroup.add(glass);

        // Inner lens ring
        const ringGeometry = new THREE.RingGeometry(10, 14, 24);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.z = 64;
        cameraGroup.add(ring);

        // "CAM" label indicator (small box on side)
        const labelGeometry = new THREE.BoxGeometry(5, 15, 30);
        const labelMaterial = new THREE.MeshStandardMaterial({
            color: 0x2196F3,
            emissive: 0x1565c0,
            emissiveIntensity: 0.5
        });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.x = -27;
        cameraGroup.add(label);

        return cameraGroup;
    }

    createLightEffector() {
        const lightGroup = new THREE.Group();

        // Light housing - conical shape for spotlight look (OFF state - darker)
        const housingGeometry = new THREE.CylinderGeometry(15, 30, 50, 24);
        const housingMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.5,
            metalness: 0.5
        });
        const housing = new THREE.Mesh(housingGeometry, housingMaterial);
        housing.rotation.x = Math.PI / 2;
        housing.position.z = -5;
        housing.castShadow = true;
        lightGroup.add(housing);

        // Gray accent ring (OFF state)
        const ringGeometry = new THREE.TorusGeometry(30, 4, 16, 32);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.5,
            metalness: 0.4
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.z = 20;
        lightGroup.add(ring);

        // Light emitter disc - dark (OFF state)
        const emitterGeometry = new THREE.CircleGeometry(25, 32);
        const emitterMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8
        });
        const emitter = new THREE.Mesh(emitterGeometry, emitterMaterial);
        emitter.position.z = 21;
        lightGroup.add(emitter);

        // Inner core - dark (OFF state)
        const coreGeometry = new THREE.CircleGeometry(12, 24);
        const coreMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.8
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.z = 22;
        lightGroup.add(core);

        // Back cap with "OFF" indicator
        const capGeometry = new THREE.CylinderGeometry(15, 15, 10, 24);
        const capMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.5,
            metalness: 0.3
        });
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        cap.rotation.x = Math.PI / 2;
        cap.position.z = -35;
        lightGroup.add(cap);

        // No point light - light is OFF

        return lightGroup;
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

        // --- Camera Arm IK Update ---
        // Target Position
        const camPos = pose.camera.position;
        const camTargetPos = this.worldToScene(camPos[0], camPos[1], camPos[2]);
        
        // Target Rotation
        let camTargetRot = null;
        if (pose.camera.rotation) {
            camTargetRot = pose.camera.rotation;
        }
        
        // Solve IK for Camera Arm
        this.updateIKChain('camera', camTargetPos, camTargetRot);


        // --- Light Arm - Fixed Initial Pose (Light is OFF) ---
        // Light arm stays in initial position, no IK update needed


        // Update hand position based on frame
        this.updateHandPosition(frameIndex);
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
