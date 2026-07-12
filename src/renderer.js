import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class RoomRenderer {
  constructor(container) {
    this.container = container;
    this.roomGroup = new THREE.Group();
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.wallThickness = 0.15;
    this.wallMeshes = [];
    this.furnitureMeshes = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.tooltipCallback = null;
    this._hoveredMesh = null;
    this._onMouseMove = this._onMouseMove.bind(this);
  }

  init() {
    // Setup Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a1a1a'); // Archviz dark bg
    this.scene.fog = new THREE.Fog('#1a1a1a', 5, 20);

    // Setup Camera
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(5, 4, 5);

    // Setup Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Add canvas to DOM
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);
    
    // Soft fill light
    const fillLight = new THREE.DirectionalLight(0xfff0dd, 0.3);
    fillLight.position.set(-5, 3, -5);
    this.scene.add(fillLight);

    // Axes Helper (X=Red, Y=Green, Z=Blue)
    const axesHelper = new THREE.AxesHelper(4);
    axesHelper.position.y = 0.02; // Slightly above floor
    this.scene.add(axesHelper);

    // Grid Helper - Major (1 meter squares)
    // Centered at (5,0,5) so the grid lines align perfectly with the (0,0,0) origin
    const gridHelper1m = new THREE.GridHelper(10, 10, 0x888888, 0x444444);
    gridHelper1m.position.set(5, -0.01, 5);
    this.scene.add(gridHelper1m);

    // Grid Helper - Minor (10 cm squares)
    const gridHelper10cm = new THREE.GridHelper(10, 100, 0x333333, 0x222222);
    gridHelper10cm.position.set(5, -0.02, 5);
    this.scene.add(gridHelper10cm);

    this.scene.add(this.roomGroup);

    // Resize handler
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Mouse move for hover tooltip
    this.renderer.domElement.addEventListener('mousemove', this._onMouseMove);

    // Animation Loop
    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setTooltipCallback(fn) {
    this.tooltipCallback = fn;
  }

  _onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.furnitureMeshes, false);

    const hit = hits.length > 0 ? hits[0].object : null;
    if (hit !== this._hoveredMesh) {
      this._hoveredMesh = hit;
      if (this.tooltipCallback) {
        this.tooltipCallback(
          hit ? hit.userData.furnitureName : null,
          event.clientX,
          event.clientY
        );
      }
    } else if (hit && this.tooltipCallback) {
      // Update position even if same mesh
      this.tooltipCallback(hit.userData.furnitureName, event.clientX, event.clientY);
    }
  }

  clearRoom() {
    this.wallMeshes = [];
    this.furnitureMeshes = [];
    this._hoveredMesh = null;
    while (this.roomGroup.children.length > 0) {
      const child = this.roomGroup.children[0];
      this.roomGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  loadRoom(data) {
    this.clearRoom();
    
    if (!data || !data.room) return;

    // Convert dimensions from cm (JSON) to meters (Three.js internal)
    const cmToM = (val) => typeof val === 'number' ? val / 100 : val;
    
    const parsedData = {
      room: {
        width: cmToM(data.room.width),
        depth: cmToM(data.room.depth),
        height: cmToM(data.room.height),
        wallColor: data.room.wallColor,
        floorColor: data.room.floorColor,
        wallOpacity: data.room.wallOpacity !== undefined ? data.room.wallOpacity : 1.0
      },
      door: data.door ? {
        wall: data.door.wall,
        x_offset: cmToM(data.door.x_offset),
        y_offset: cmToM(data.door.y_offset),
        width: cmToM(data.door.width),
        height: cmToM(data.door.height)
      } : null,
      window: data.window ? {
        wall: data.window.wall,
        x_offset: cmToM(data.window.x_offset),
        y_offset: cmToM(data.window.y_offset),
        width: cmToM(data.window.width),
        height: cmToM(data.window.height)
      } : null,
      furniture: data.furniture ? data.furniture.map(f => ({
        ...f,
        position: { x: cmToM(f.position?.x), y: cmToM(f.position?.y), z: cmToM(f.position?.z) },
        size: { x: cmToM(f.size?.x), y: cmToM(f.size?.y), z: cmToM(f.size?.z) },
        shape: f.shape ? f.shape.map(p => ({ x: cmToM(p.x), z: cmToM(p.z) })) : undefined,
        thickness: cmToM(f.thickness),
        elevation: cmToM(f.elevation)
      })) : []
    };

    this.buildFloor(parsedData.room);
    this.buildWalls(parsedData);
    
    if (parsedData.furniture) {
      parsedData.furniture.forEach(item => this.buildFurniture(item));
    }

    // Center camera on room
    if (data.room.initialCamera) {
      this.camera.position.set(
        cmToM(data.room.initialCamera.position.x),
        cmToM(data.room.initialCamera.position.y),
        cmToM(data.room.initialCamera.position.z)
      );
      this.controls.target.set(
        cmToM(data.room.initialCamera.target.x),
        cmToM(data.room.initialCamera.target.y),
        cmToM(data.room.initialCamera.target.z)
      );
    } else {
      const centerX = parsedData.room.width / 2;
      const centerZ = parsedData.room.depth / 2;
      this.controls.target.set(centerX, 0, centerZ);
      this.camera.position.set(centerX + 4, 3, centerZ + 4);
    }
    this.controls.update();
  }

  // Build Floor
  buildFloor(roomData) {
    const geo = new THREE.PlaneGeometry(roomData.width, roomData.depth);
    const mat = new THREE.MeshStandardMaterial({ 
      color: roomData.floorColor,
      roughness: 0.8,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(roomData.width / 2, 0, roomData.depth / 2);
    mesh.receiveShadow = true;
    this.roomGroup.add(mesh);
  }

  // Build Walls
  buildWalls(data) {
    const { room, door, window: win } = data;
    const { width, depth, height, wallColor, wallOpacity } = room;
    
    // Define the 4 walls: id, start(x,z), end(x,z)
    const walls = [
      { id: 'bottom', start: [0, 0], end: [width, 0] },
      { id: 'right', start: [width, 0], end: [width, depth] },
      { id: 'top', start: [width, depth], end: [0, depth] },
      { id: 'left', start: [0, depth], end: [0, 0] }
    ];

    walls.forEach(w => {
      // Find cutouts for this wall
      const cutouts = [];
      if (door && door.wall === w.id) {
        cutouts.push({ ...door, offset: door.x_offset || 0, y: door.y_offset || 0 }); // doors are on floor
      }
      if (win && win.wall === w.id) {
        // assume window is placed at 0.9m height if not specified
        const winY = win.y_offset !== undefined ? win.y_offset : 0.9;
        cutouts.push({ ...win, offset: win.x_offset || 0, y: winY });
      }

      this.createWall(w.start, w.end, height, this.wallThickness, wallColor, cutouts, wallOpacity);
    });
  }

  createWall(start, end, height, thickness, color, cutouts, opacity) {
    // Distance between start and end
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.sqrt(dx * dx + dz * dz);
    
    // Create 2D Shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height);
    shape.lineTo(0, height);
    shape.lineTo(0, 0);

    // Add Holes
    cutouts.forEach(c => {
      const hole = new THREE.Path();
      hole.moveTo(c.offset, c.y);
      hole.lineTo(c.offset + c.width, c.y);
      hole.lineTo(c.offset + c.width, c.y + c.height);
      hole.lineTo(c.offset, c.y + c.height);
      hole.lineTo(c.offset, c.y);
      shape.holes.push(hole);
    });

    // Extrude Geometry
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    const material = new THREE.MeshStandardMaterial({ 
      color: color,
      roughness: 0.9,
      metalness: 0.05,
      transparent: opacity < 1.0,
      opacity: opacity,
      side: opacity < 1.0 ? THREE.DoubleSide : THREE.FrontSide // renders both sides if transparent
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position and Rotation
    mesh.position.set(start[0], 0, start[1]);
    
    // Angle in XZ plane
    const angle = Math.atan2(-dz, dx);
    mesh.rotation.y = angle;

    // Extrude outwards from the room center
    mesh.translateZ(-thickness);

    this.wallMeshes.push(mesh);
    this.roomGroup.add(mesh);
  }

  updateWallOpacity(opacity) {
    this.wallMeshes.forEach(mesh => {
      mesh.material.opacity = opacity;
      mesh.material.transparent = opacity < 1.0;
      mesh.material.side = opacity < 1.0 ? THREE.DoubleSide : THREE.FrontSide;
      mesh.material.needsUpdate = true;
    });
  }

  // Build Furniture
  buildFurniture(item) {
    const posX = item.position?.x || 0;
    const posY = item.position?.y || 0;
    const posZ = item.position?.z || 0;

    const sizeX = item.size?.x || 1;
    const sizeY = item.size?.y || 1;
    const sizeZ = item.size?.z || 1;

    const rotX = item.rotation?.x || 0;
    const rotY = item.rotation?.y || 0;
    const rotZ = item.rotation?.z || 0;

    if (item.model) {
      // Future support for GLB
      this.gltfLoader.load(item.model, (gltf) => {
        const model = gltf.scene;
        model.position.set(posX, posY, posZ);
        model.rotation.set(
          THREE.MathUtils.degToRad(rotX),
          THREE.MathUtils.degToRad(rotY),
          THREE.MathUtils.degToRad(rotZ)
        );
        model.scale.set(sizeX, sizeY, sizeZ);
        
        model.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        this.roomGroup.add(model);
      });
    } else {
      let geo;
      if (item.shape) {
        // Procedural custom polygonal shape
        const shape = new THREE.Shape();
        shape.moveTo(item.shape[0].x, item.shape[0].z);
        for (let i = 1; i < item.shape.length; i++) {
          shape.lineTo(item.shape[i].x, item.shape[i].z);
        }
        shape.lineTo(item.shape[0].x, item.shape[0].z);

        const depth = item.thickness !== undefined ? item.thickness : sizeY;
        const extrudeSettings = { depth: depth, bevelEnabled: false };
        geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // ExtrudeGeometry extrudes along local +Z. 
        // We rotate X by +90 to extrude along -Y (downwards) and map shape +Y to world +Z
        geo.rotateX(Math.PI / 2);
        
        // Elevate if specified
        if (item.elevation) {
          geo.translate(0, item.elevation, 0);
        }
      } else {
        // Procedural box representation
        geo = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
        // Move pivot to bottom center
        geo.translate(0, sizeY / 2, 0);
      }
      
      const mat = new THREE.MeshStandardMaterial({ 
        color: item.color || '#cccccc',
        roughness: 0.7,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Tag mesh with furniture name for raycasting tooltip
      const label = item.type
        ? item.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : 'Furniture';
      mesh.userData.furnitureName = label;
      this.furnitureMeshes.push(mesh);
      
      mesh.position.set(posX, posY, posZ);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(rotX),
        THREE.MathUtils.degToRad(rotY),
        THREE.MathUtils.degToRad(rotZ)
      );
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Add edges for better visibility/planner style
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }));
      mesh.add(line);

      this.roomGroup.add(mesh);
    }
  }
}
