/**
 * ATELIER FASSBINDER — HYPER-REALISTIC CONTEMPORARY MUSEUM 3D ENGINE (MoMA EDITION)
 * Features:
 * - Polished Granite Flooring with Organic Black Mineral Veins (Color, Roughness & Bump PBR maps)
 * - Tactile Textured Architectural Walls (Venetian Plaster / Micro-Cement & Fluted Stone Alcoves with Raking Light)
 * - Clean Architectural Skylight Coffered Ceiling & Recessed ERCO Museum Track Spotlights (No colored Pompidou pipes)
 * - High-Contrast Dramatic Museum Lighting + High-Definition PMREM Image-Based Reflections
 */
(function () {
  'use strict';

  const CAT_LABEL = {
    figuren: 'Figuren & Plastiken',
    reliefs: 'Reliefs & Wandarbeiten',
    bau: 'Kunst am Bau & Außenraum',
    ansichten: 'Atelier & Ansichten'
  };

  const ALL_WORKS = window.WORKS || [];
  const ASSETS = window.ATELIER_ASSETS || {};

  // Populate Artist Portraits & Studio Photos inside the Mini-Biography Dossier if present
  const setImg = (id, src) => { const el = document.getElementById(id); if (el && src) el.src = src; };
  setImg('bio-img-portrait', ASSETS.portrait_bw);
  setImg('bio-img-stele', ASSETS.artist_with_stele);
  if (window.ATELIER_PHOTO_47 && window.ATELIER_PHOTO_47.img) {
    setImg('bio-img-photo47', window.ATELIER_PHOTO_47.img);
  }
  setImg('bio-img-worktable', ASSETS.atelier_worktable);
  setImg('bio-img-exhibition', ASSETS.exhibition_view);

  const workSelectEl = document.getElementById('collector-work');
  if (workSelectEl) {
    ALL_WORKS.forEach((w) => {
      const opt = document.createElement('option');
      opt.value = `Foto Nr. ${w.n} (${CAT_LABEL[w.cat]})`;
      opt.textContent = `Werk Nr. ${w.n} — ${CAT_LABEL[w.cat]} (${w.alt.slice(0, 44)}…)`;
      workSelectEl.appendChild(opt);
    });
  }

  /* ==========================================================================
     1. THREE.JS RENDERER, ACES FILMIC TONE MAPPING & HYPER-REALISTIC IBL
     ========================================================================== */
  const canvas = document.getElementById('webgl-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8d3ca);
  scene.fog = new THREE.FogExp2(0xd8d3ca, 0.0046);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 260);
  const EYE_HEIGHT = 1.72;

  // High-contrast architectural museum reflection environment (PMREM IBL)
  function buildHyperRealEnvironmentMap() {
    if (!THREE.PMREMGenerator) return;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileCubemapShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xaba49a);

    // Bright zenithal skylight coffers for realistic specular reflections on polished granite & ceramics
    for (let z = -70; z <= 70; z += 18) {
      const coffer = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      coffer.rotation.x = Math.PI / 2;
      coffer.position.set(0, 11, z);
      envScene.add(coffer);
    }

    // Warm gallery wall bounce planes
    const wallBox = new THREE.Mesh(
      new THREE.BoxGeometry(44, 14, 170),
      new THREE.MeshBasicMaterial({ color: 0xe6dfd3, side: THREE.BackSide })
    );
    wallBox.position.y = 5;
    envScene.add(wallBox);

    // Dark granite floor grounding plane in reflection map
    const floorRef = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 170),
      new THREE.MeshBasicMaterial({ color: 0x5c5852, side: THREE.DoubleSide })
    );
    floorRef.rotation.x = -Math.PI / 2;
    floorRef.position.y = 0;
    envScene.add(floorRef);

    // Intense 3000K halogen accent point reflections along both gallery sides
    for (let z = -65; z <= 65; z += 16) {
      [-9, 9].forEach((x) => {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(1.4, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xffe6be })
        );
        bulb.position.set(x, 9.5, z);
        envScene.add(bulb);
      });
    }

    const envRT = pmremGenerator.fromScene(envScene, 0.025);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();
  }
  buildHyperRealEnvironmentMap();

  /* ==========================================================================
     2. MULTI-LAYERED HYPER-REALISTIC MUSEUM LIGHTING
     ========================================================================== */
  // Soft zenithal daylight ambient fill
  const hemiLight = new THREE.HemisphereLight(0xfffcf7, 0x8f887d, 1.35);
  hemiLight.position.set(0, 18, 0);
  scene.add(hemiLight);

  // Main angled skylight sun casting crisp architectural shadows
  const dirLight = new THREE.DirectionalLight(0xfff6e8, 2.85);
  dirLight.position.set(13, 29, 15);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.bias = -0.00025;
  const d = 74;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);

  // Raking side light to emphasize the 3D relief of the textured walls and ceramic sculptures
  const rakingLightLeft = new THREE.DirectionalLight(0xffeed6, 1.35);
  rakingLightLeft.position.set(-22, 16, -20);
  scene.add(rakingLightLeft);

  const rakingLightRight = new THREE.DirectionalLight(0xeef4ff, 1.05);
  rakingLightRight.position.set(22, 18, -50);
  scene.add(rakingLightRight);

  // Dynamic 3000K gallery spotlight following the visitor
  const visitorSpot = new THREE.PointLight(0xffe8c2, 3.8, 20, 1.5);
  visitorSpot.position.set(0, 3.6, 0);
  scene.add(visitorSpot);

  /* ==========================================================================
     3. HYPER-REALISTIC PBR TEXTURES (BLACK-VEINED GRANITE & TEXTURED WALLS)
     ========================================================================== */
  // A. Polished Granite Floor with Dramatic Black Mineral Veins (Color, Roughness & Bump)
  function createBlackVeinedGraniteTextures() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');

    const roughC = document.createElement('canvas');
    roughC.width = 1024;
    roughC.height = 1024;
    const rCtx = roughC.getContext('2d');

    // Base crystalline grey-pearl granite tone
    ctx.fillStyle = '#c8c3ba';
    ctx.fillRect(0, 0, 1024, 1024);

    // Low roughness base (polished mirror-like granite slab)
    rCtx.fillStyle = '#2b2b2b';
    rCtx.fillRect(0, 0, 1024, 1024);

    // 1. Mineral clouds (quartz & smoky feldspar clusters)
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const rad = 25 + Math.random() * 95;
      const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
      if (i % 3 === 0) {
        g.addColorStop(0, 'rgba(242, 239, 232, 0.24)');
      } else if (i % 3 === 1) {
        g.addColorStop(0, 'rgba(95, 90, 84, 0.18)');
      } else {
        g.addColorStop(0, 'rgba(45, 42, 39, 0.14)');
      }
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Fine crystalline granite speckles (black biotite, white quartz, grey feldspar)
    const graniteGrains = [
      'rgba(18, 17, 16, 0.58)',
      'rgba(42, 40, 38, 0.45)',
      'rgba(248, 246, 242, 0.52)',
      'rgba(155, 148, 138, 0.42)'
    ];
    for (let i = 0; i < 11000; i++) {
      ctx.fillStyle = graniteGrains[i % graniteGrains.length];
      const gw = 1 + (i % 3);
      const gh = 1 + ((i * 7) % 3);
      ctx.fillRect((i * 197) % 1024, (i * 541 + (i % 37) * 13) % 1024, gw, gh);
    }

    // 3. Dramatic Organic Black & Charcoal Mineral Veins (Nero/Bianco Granite Veining)
    function drawGraniteVein(startX, startY, angle, length, maxThickness, opacity) {
      ctx.save();
      rCtx.save();
      let x = startX;
      let y = startY;
      let curAngle = angle;

      for (let step = 0; step < length; step++) {
        const t = step / length;
        const wave = Math.sin(t * Math.PI * 3.5) * 0.045 + Math.cos(step * 0.09) * 0.035;
        curAngle += wave;
        x += Math.cos(curAngle) * 3.2;
        y += Math.sin(curAngle) * 3.2;

        const w = Math.max(0.8, maxThickness * Math.sin(t * Math.PI) * (0.7 + 0.3 * Math.sin(step * 0.2)));

        // Outer smoky halo of the black vein
        ctx.fillStyle = `rgba(28, 26, 24, ${opacity * 0.25})`;
        ctx.beginPath();
        ctx.arc(x, y, w * 2.1, 0, Math.PI * 2);
        ctx.fill();

        // Core deep black mineral vein
        ctx.fillStyle = `rgba(14, 13, 12, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, w * 0.75, 0, Math.PI * 2);
        ctx.fill();

        // Slight roughness variation along the mineral vein
        rCtx.fillStyle = 'rgba(65, 65, 65, 0.35)';
        rCtx.beginPath();
        rCtx.arc(x, y, w, 0, Math.PI * 2);
        rCtx.fill();

        // Occasional secondary capillary micro-branch
        if (step % 42 === 18 && maxThickness > 3.5) {
          drawGraniteVein(x, y, curAngle + (step % 2 === 0 ? 0.55 : -0.55), 55, maxThickness * 0.42, opacity * 0.8);
        }
      }
      ctx.restore();
      rCtx.restore();
    }

    // Primary & secondary black veins crossing the granite slabs
    drawGraniteVein(-20, 120, 0.48, 360, 7.5, 0.85);
    drawGraniteVein(180, -20, 0.92, 340, 6.0, 0.78);
    drawGraniteVein(520, 40, 0.65, 320, 8.2, 0.88);
    drawGraniteVein(40, 560, 0.32, 350, 6.8, 0.82);
    drawGraniteVein(640, 480, 1.05, 290, 5.5, 0.75);
    drawGraniteVein(310, 720, -0.28, 280, 6.2, 0.80);

    // 4. Rectified Monumental Granite Slab Joints (512x512 slabs)
    ctx.strokeStyle = 'rgba(35, 33, 30, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(0, 0, 1024, 1024);
    ctx.beginPath();
    ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
    ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
    ctx.stroke();

    rCtx.strokeStyle = '#c0c0c0';
    rCtx.lineWidth = 4;
    rCtx.strokeRect(0, 0, 1024, 1024);
    rCtx.beginPath();
    rCtx.moveTo(512, 0); rCtx.lineTo(512, 1024);
    rCtx.moveTo(0, 512); rCtx.lineTo(1024, 512);
    rCtx.stroke();

    const colorMap = new THREE.CanvasTexture(c);
    colorMap.encoding = THREE.sRGBEncoding;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(5, 32);
    colorMap.anisotropy = 8;

    const roughnessMap = new THREE.CanvasTexture(roughC);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(5, 32);
    roughnessMap.anisotropy = 8;

    return { colorMap, roughnessMap };
  }

  // B. Visibly Textured Architectural Plaster / Travertine Stucco Walls (Color & High-Relief Bump)
  function createTexturedWallMaps() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');

    const bumpC = document.createElement('canvas');
    bumpC.width = 1024;
    bumpC.height = 1024;
    const bCtx = bumpC.getContext('2d');

    // Warm mineral plaster base
    ctx.fillStyle = '#ece7df';
    ctx.fillRect(0, 0, 1024, 1024);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 1024, 1024);

    // 1. Artisanal Venetian Plaster / Micro-Cement Trowel Sweeps & Mineral Striations
    for (let i = 0; i < 950; i++) {
      const x = (i * 137) % 1024;
      const y = (i * 293) % 1024;
      const w = 45 + (i % 140);
      const h = 4 + (i % 18);

      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 253, 249, 0.34)' : 'rgba(185, 175, 160, 0.22)';
      ctx.fillRect(x, y, w, h);

      bCtx.fillStyle = i % 2 === 0 ? 'rgba(225, 225, 225, 0.42)' : 'rgba(45, 45, 45, 0.42)';
      bCtx.fillRect(x, y, w, h);
    }

    // 2. Travertine-style horizontal porous veins & tactile mineral relief
    for (let y = 0; y < 1024; y += 4) {
      const v = Math.sin(y * 0.06) * 12;
      ctx.fillStyle = y % 8 === 0 ? 'rgba(165, 155, 142, 0.14)' : 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(0, y, 1024, 2);

      bCtx.fillStyle = v > 0 ? 'rgba(210, 210, 210, 0.28)' : 'rgba(60, 60, 60, 0.28)';
      bCtx.fillRect(0, y, 1024, 2);
    }

    // 3. Subtle architectural panel shadow joints
    ctx.strokeStyle = 'rgba(140, 132, 120, 0.32)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 1024, 1024);
    ctx.beginPath();
    ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
    ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
    ctx.stroke();

    bCtx.strokeStyle = '#181818';
    bCtx.lineWidth = 4;
    bCtx.strokeRect(0, 0, 1024, 1024);
    bCtx.beginPath();
    bCtx.moveTo(512, 0); bCtx.lineTo(512, 1024);
    bCtx.moveTo(0, 512); bCtx.lineTo(1024, 512);
    bCtx.stroke();

    const colorMap = new THREE.CanvasTexture(c);
    colorMap.encoding = THREE.sRGBEncoding;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(14, 3);
    colorMap.anisotropy = 8;

    const bumpMap = new THREE.CanvasTexture(bumpC);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(14, 3);
    bumpMap.anisotropy = 8;

    return { colorMap, bumpMap };
  }

  // C. Fluted / Bush-Hammered Limestone-Concrete Texture for Partition Alcove Walls
  function createFlutedStoneFinMaps() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    const bumpC = document.createElement('canvas');
    bumpC.width = 512;
    bumpC.height = 512;
    const bCtx = bumpC.getContext('2d');

    ctx.fillStyle = '#ddd6ca';
    ctx.fillRect(0, 0, 512, 512);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 512, 512);

    // Vertical architectural stone fluting + bush-hammered grain
    for (let x = 0; x < 512; x += 8) {
      ctx.fillStyle = x % 16 === 0 ? 'rgba(255, 252, 246, 0.35)' : 'rgba(130, 122, 110, 0.24)';
      ctx.fillRect(x, 0, 4, 512);

      bCtx.fillStyle = x % 16 === 0 ? '#dadada' : '#323232';
      bCtx.fillRect(x, 0, 4, 512);
    }

    for (let i = 0; i < 2800; i++) {
      const gx = (i * 97) % 512;
      const gy = (i * 181) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(90, 84, 76, 0.18)' : 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(gx, gy, 3, 2);
      bCtx.fillStyle = i % 2 === 0 ? '#202020' : '#e5e5e5';
      bCtx.fillRect(gx, gy, 3, 2);
    }

    const colorMap = new THREE.CanvasTexture(c);
    colorMap.encoding = THREE.sRGBEncoding;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(2, 2);

    const bumpMap = new THREE.CanvasTexture(bumpC);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(2, 2);

    return { colorMap, bumpMap };
  }

  // D. Warm White Oak Wood Texture for Museum Benches
  function createWhiteOakTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c59e6d';
    ctx.fillRect(0, 0, 512, 256);
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(120, 80, 42, 0.16)' : 'rgba(240, 212, 175, 0.14)';
      ctx.fillRect(0, y, 512, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // E. Soft Radial Contact Shadow / Floor Light Pool Texture
  function createSoftRadialTexture(innerColor, outerColor) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(1, outerColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* ==========================================================================
     4. HYPER-REALISTIC CONTEMPORARY MUSEUM ARCHITECTURE (NO COLORED POMPIDOU BARS)
     ========================================================================== */
  const museumGroup = new THREE.Group();
  scene.add(museumGroup);
  const ceilingGroup = new THREE.Group();
  scene.add(ceilingGroup);

  const graniteMaps = createBlackVeinedGraniteTextures();
  const wallMaps = createTexturedWallMaps();
  const finMaps = createFlutedStoneFinMaps();
  const oakTex = createWhiteOakTexture();
  const aoShadowTex = createSoftRadialTexture('rgba(12, 11, 10, 0.48)', 'rgba(12, 11, 10, 0)');
  const lightPoolTex = createSoftRadialTexture('rgba(255, 240, 208, 0.34)', 'rgba(255, 240, 208, 0)');

  // Polished Granite Floor with Black Mineral Veins
  const floorMat = new THREE.MeshStandardMaterial({
    map: graniteMaps.colorMap,
    roughnessMap: graniteMaps.roughnessMap,
    bumpMap: graniteMaps.roughnessMap,
    bumpScale: 0.004,
    roughness: 0.16,
    metalness: 0.12,
    envMapIntensity: 1.45
  });

  // Visibly Textured Venetian Plaster / Travertine Stucco Perimeter Walls
  const outerWallMat = new THREE.MeshStandardMaterial({
    map: wallMaps.colorMap,
    bumpMap: wallMaps.bumpMap,
    bumpScale: 0.036,
    roughness: 0.68,
    metalness: 0.03,
    envMapIntensity: 0.85
  });

  // Fluted & Bush-Hammered Stone Alcove Partition Walls
  const finWallMat = new THREE.MeshStandardMaterial({
    map: finMaps.colorMap,
    bumpMap: finMaps.bumpMap,
    bumpScale: 0.048,
    roughness: 0.62,
    metalness: 0.04,
    envMapIntensity: 0.9
  });

  // Anodized Dark Bronze / Graphite Architectural Trim & ERCO Track Channels
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1d1b19,
    roughness: 0.32,
    metalness: 0.78
  });
  const warmCoveMat = new THREE.MeshBasicMaterial({ color: 0xfff2d6 });
  const skylightGlassMat = new THREE.MeshBasicMaterial({ color: 0xfdfcf9, side: THREE.DoubleSide });
  const oakMat = new THREE.MeshStandardMaterial({ map: oakTex, roughness: 0.46, metalness: 0.05 });

  const WALL_H = 5.6;

  // Main Polished Black-Veined Granite Floor
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 158), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, 0, -62);
  floorMesh.receiveShadow = true;
  museumGroup.add(floorMesh);

  // Textured Perimeter Gallery Walls + Recessed Dark Shadow-Gap Baseboards + Upper Wall-Washer Cove
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, WALL_H, 158), outerWallMat);
  leftWall.position.set(-12, WALL_H / 2 + 0.06, -62);
  leftWall.receiveShadow = true;
  museumGroup.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, WALL_H, 158), outerWallMat);
  rightWall.position.set(12, WALL_H / 2 + 0.06, -62);
  rightWall.receiveShadow = true;
  museumGroup.add(rightWall);

  const leftBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 158), darkMetalMat);
  leftBaseboard.position.set(-11.95, 0.04, -62);
  museumGroup.add(leftBaseboard);

  const rightBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 158), darkMetalMat);
  rightBaseboard.position.set(11.95, 0.04, -62);
  museumGroup.add(rightBaseboard);

  // Continuous Warm Linear Wall-Grazer LED Cove Strips at top of textured perimeter walls
  [-11.65, 11.65].forEach((cx) => {
    const coveStrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 156), warmCoveMat);
    coveStrip.position.set(cx, WALL_H - 0.05, -62);
    ceilingGroup.add(coveStrip);
  });

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(24.4, WALL_H, 0.4), outerWallMat);
  frontWall.position.set(0, WALL_H / 2, 16.5);
  museumGroup.add(frontWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(24.4, WALL_H, 0.4), outerWallMat);
  backWall.position.set(0, WALL_H / 2, -140.5);
  museumGroup.add(backWall);

  // Sleek Recessed Black ERCO Museum Track-Lighting Channels (Left & Right Gallery Lanes)
  const pipeLen = 156;
  const pipeZ = -62;
  [-4.8, 4.8, -9.2, 9.2].forEach((trackX) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, pipeLen), darkMetalMat);
    rail.position.set(trackX, WALL_H - 0.12, pipeZ);
    ceilingGroup.add(rail);
  });

  // Fluted Stone Alcove Fins, Clean Architectural Skylight Coffers, ERCO Spotlights & Oak Benches
  const spotCanGeo = new THREE.CylinderGeometry(0.065, 0.085, 0.28, 14);
  const spotLensGeo = new THREE.CircleGeometry(0.06, 12);
  const spotLensMat = new THREE.MeshBasicMaterial({ color: 0xfff0cc });

  for (let z = 6; z >= -132; z -= 12) {
    // 1. Fluted & Textured Limestone Alcove Partition Walls
    const finGeo = new THREE.BoxGeometry(3.2, WALL_H, 0.42);
    const lFin = new THREE.Mesh(finGeo, finWallMat);
    lFin.position.set(-10.2, WALL_H / 2, z);
    lFin.castShadow = true;
    lFin.receiveShadow = true;
    museumGroup.add(lFin);

    const rFin = new THREE.Mesh(finGeo, finWallMat);
    rFin.position.set(10.2, WALL_H / 2, z);
    rFin.castShadow = true;
    rFin.receiveShadow = true;
    museumGroup.add(rFin);

    // 2. Clean Architectural Coffered Ceiling Beams (Anodized Dark Graphite + Warm Plaster Soffit)
    const mainBeam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.34, 0.48), darkMetalMat);
    mainBeam.position.set(0, WALL_H + 0.12, z);
    ceilingGroup.add(mainBeam);

    // Recessed Luminous Barrisol Skylight Coffer + Fine Mullion Grid
    const skylight = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 9.6), skylightGlassMat);
    skylight.rotation.x = Math.PI / 2;
    skylight.position.set(0, WALL_H + 0.36, z - 6);
    ceilingGroup.add(skylight);

    [-4.4, 0, 4.4].forEach((mx) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 9.6), darkMetalMat);
      mullion.position.set(mx, WALL_H + 0.32, z - 6);
      ceilingGroup.add(mullion);
    });

    // 3. ERCO Track Spotlight Cans with Glowing Warm Lenses aimed at Sculptures & Textured Walls
    [-4.8, 4.8, -9.2, 9.2].forEach((tx) => {
      const canGroup = new THREE.Group();
      canGroup.position.set(tx, WALL_H - 0.28, z - 3);
      canGroup.rotation.z = tx < 0 ? 0.38 : -0.38;

      const can = new THREE.Mesh(spotCanGeo, darkMetalMat);
      canGroup.add(can);

      const lens = new THREE.Mesh(spotLensGeo, spotLensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.y = -0.142;
      canGroup.add(lens);

      ceilingGroup.add(canGroup);
    });

    // 4. Multi-Point Gallery Accent Illumination (Warm 3000K Raking Lights on Left & Right Bays)
    if (z % 24 === 6) {
      const leftBayLight = new THREE.PointLight(0xffedd0, 2.35, 22, 1.45);
      leftBayLight.position.set(-5.8, WALL_H - 0.5, z - 6);
      scene.add(leftBayLight);

      const rightBayLight = new THREE.PointLight(0xffedd0, 2.35, 22, 1.45);
      rightBayLight.position.set(5.8, WALL_H - 0.5, z - 6);
      scene.add(rightBayLight);

      // 5. MoMA Contemporary White-Oak & Blackened-Steel Gallery Bench along central axis
      const benchGroup = new THREE.Group();
      benchGroup.position.set(0, 0, z - 6);

      const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 3.4), oakMat);
      benchSeat.position.y = 0.44;
      benchSeat.castShadow = true;
      benchSeat.receiveShadow = true;
      benchGroup.add(benchSeat);

      [-1.35, 1.35].forEach((bz) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.39, 0.08), darkMetalMat);
        leg.position.set(0, 0.195, bz);
        benchGroup.add(leg);
      });

      const benchShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 4.3),
        new THREE.MeshBasicMaterial({ map: aoShadowTex, transparent: true, depthWrite: false })
      );
      benchShadow.rotation.x = -Math.PI / 2;
      benchShadow.position.y = 0.008;
      benchGroup.add(benchShadow);

      museumGroup.add(benchGroup);
    }
  }

  /* ==========================================================================
     5. MATTERPORT FLOOR HOTSPOTS (18 TELEPORT WAYPOINTS)
     ========================================================================== */
  const floorHotspots = [];
  for (let i = 0; i < 18; i++) {
    const zPos = 10 - i * 8.2;
    let hall = 'Saal I — Figuren & Plastiken';
    if (zPos < -35 && zPos >= -75) hall = 'Saal II — Stelen & Skulpturengruppen';
    else if (zPos < -75 && zPos >= -108) hall = 'Saal III — Reliefs & Wandarbeiten';
    else if (zPos < -108) hall = 'Saal IV — Kunst am Bau & Atelier';

    const group = new THREE.Group();
    group.position.set(0, 0.025, zPos);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.56, 32),
      new THREE.MeshBasicMaterial({ color: 0xc9a44e, side: THREE.DoubleSide, transparent: true, opacity: 0.88 })
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.68 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.userData = { isHotspot: true, targetX: 0, targetZ: zPos, label: `Standpunkt ${i + 1}`, hallName: hall, parentRing: ring };
    group.add(disc);

    scene.add(group);
    floorHotspots.push(disc);
  }

  /* ==========================================================================
     6. 93 VOLUMETRIC 3D CERAMIC SCULPTURES ON ARCHITECTURAL PEDESTALS
     ========================================================================== */
  const plinthWhiteMat = new THREE.MeshStandardMaterial({
    map: wallMaps.colorMap,
    bumpMap: wallMaps.bumpMap,
    bumpScale: 0.012,
    roughness: 0.48,
    metalness: 0.03
  });
  const plinthStoneMat = new THREE.MeshStandardMaterial({
    map: finMaps.colorMap,
    bumpMap: finMaps.bumpMap,
    bumpScale: 0.018,
    roughness: 0.54,
    metalness: 0.06
  });
  const ceramicCoreMat = new THREE.MeshStandardMaterial({ color: 0x342a23, roughness: 0.38, metalness: 0.16 });
  const plaqueMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.25, metalness: 0.5 });

  const interactiveSculptureHitboxes = [];
  const sculptureNodesByNumber = new Map();

  // Generates a displacement/bump depth map with fine chamotte ceramic micro-grain
  function buildDepthMapFromImage(img) {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 240;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 192, 240);
    const imgData = ctx.getImageData(0, 0, 192, 240);
    const data = imgData.data;

    const cornerLum = (data[0] + data[1] + data[2]) / 3;

    for (let y = 0; y < 240; y++) {
      for (let x = 0; x < 192; x++) {
        const i = (y * 192 + x) * 4;
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        const diff = Math.abs(lum - cornerLum);
        const nx = (x / 192) * 2 - 1;
        const ny = (y / 240) * 2 - 1;
        const edgeFade = Math.max(0, 1 - Math.pow(nx * nx * 0.85 + ny * ny * 0.85, 2));
        const grain = ((x * 17 + y * 31) % 9) - 4;
        const heightVal = Math.min(255, Math.max(18, (diff * 1.48 + (255 - lum) * 0.36 + grain) * edgeFade));
        data[i] = heightVal;
        data[i + 1] = heightVal;
        data[i + 2] = heightVal;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return new THREE.CanvasTexture(c);
  }

  ALL_WORKS.forEach((work, idx) => {
    const row = Math.floor(idx / 2);
    const isRight = idx % 2 === 1;
    const z = 8.5 - row * 3.05;
    const isRelief = work.cat === 'reliefs';

    const laneX = isRelief ? (isRight ? 8.8 : -8.8) : (isRight ? (row % 2 === 0 ? 3.4 : 6.0) : (row % 2 === 0 ? -3.4 : -6.0));
    const rotY = isRelief ? (isRight ? -Math.PI / 2 : Math.PI / 2) : (isRight ? -0.42 : 0.42);

    const nodeGroup = new THREE.Group();
    nodeGroup.position.set(laneX, 0, z);
    nodeGroup.rotation.y = rotY;

    // 1. Soft Ambient Occlusion Contact Shadow + Spotlight Warm Floor Pool on the Granite
    const aoPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: aoShadowTex, transparent: true, depthWrite: false })
    );
    aoPlane.rotation.x = -Math.PI / 2;
    aoPlane.position.y = 0.006;
    nodeGroup.add(aoPlane);

    const lightPool = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({ map: lightPoolTex, transparent: true, depthWrite: false })
    );
    lightPool.rotation.x = -Math.PI / 2;
    lightPool.position.y = 0.004;
    nodeGroup.add(lightPool);

    // 2. Architectural Textured Pedestal with Recessed Dark Shadow-Gap Base & Curatorial Plaque
    const plinthH = isRelief ? 0.34 : 0.94;
    const plinthW = isRelief ? 1.48 : 0.92;
    const plinthD = isRelief ? 0.44 : 0.86;

    const toeKick = new THREE.Mesh(
      new THREE.BoxGeometry(plinthW - 0.08, 0.06, plinthD - 0.08),
      darkMetalMat
    );
    toeKick.position.y = 0.03;
    nodeGroup.add(toeKick);

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(plinthW, plinthH - 0.06, plinthD),
      work.n % 3 === 0 ? plinthStoneMat : plinthWhiteMat
    );
    plinth.position.y = 0.06 + (plinthH - 0.06) / 2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    nodeGroup.add(plinth);

    if (!isRelief) {
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.015), plaqueMat);
      plaque.position.set(0, plinthH - 0.18, plinthD / 2 + 0.008);
      nodeGroup.add(plaque);
    }

    // 3. Turntable Group holding the 3D Volumetric Photo-Relief Sculpture
    const sculptureTurntable = new THREE.Group();
    sculptureTurntable.position.y = isRelief ? 2.15 : (plinthH + 1.10);
    nodeGroup.add(sculptureTurntable);

    const coreGeo = new THREE.BoxGeometry(1.32, 2.1, 0.24);
    const coreMesh = new THREE.Mesh(coreGeo, ceramicCoreMat);
    coreMesh.castShadow = true;
    coreMesh.receiveShadow = true;
    sculptureTurntable.add(coreMesh);

    const reliefGeo = new THREE.PlaneGeometry(1.28, 2.06, 48, 60);
    const reliefMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.14,
      envMapIntensity: 1.28
    });

    const frontReliefMesh = new THREE.Mesh(reliefGeo, reliefMat);
    frontReliefMesh.position.z = 0.125;
    frontReliefMesh.castShadow = true;
    frontReliefMesh.receiveShadow = true;
    sculptureTurntable.add(frontReliefMesh);

    const backReliefMesh = new THREE.Mesh(reliefGeo, reliefMat);
    backReliefMesh.rotation.y = Math.PI;
    backReliefMesh.position.z = -0.125;
    sculptureTurntable.add(backReliefMesh);

    const img = new Image();
    img.onload = () => {
      const aspect = THREE.MathUtils.clamp(img.naturalWidth / (img.naturalHeight || 1), 0.52, 1.45);
      const targetH = 2.06;
      const targetW = targetH * aspect;
      const scaleX = targetW / 1.28;

      coreMesh.scale.set(scaleX, 1, 1);
      frontReliefMesh.scale.set(scaleX, 1, 1);
      backReliefMesh.scale.set(scaleX, 1, 1);

      const colorTex = new THREE.Texture(img);
      colorTex.encoding = THREE.sRGBEncoding;
      colorTex.needsUpdate = true;

      const depthTex = buildDepthMapFromImage(img);
      reliefMat.map = colorTex;
      reliefMat.displacementMap = depthTex;
      reliefMat.displacementScale = 0.23;
      reliefMat.bumpMap = depthTex;
      reliefMat.bumpScale = 0.068;
      reliefMat.needsUpdate = true;
    };
    img.src = work.img;

    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.66, 0.72, 36),
      new THREE.MeshBasicMaterial({ color: 0xc9a44e, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.015;
    nodeGroup.add(baseRing);

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 3.3, 1.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 1.65;
    const placement = { x: laneX, y: 0, z, rotY };
    hitbox.userData = { work, nodeGroup, sculptureTurntable, baseRing, placement };
    nodeGroup.add(hitbox);

    scene.add(nodeGroup);
    interactiveSculptureHitboxes.push(hitbox);
    sculptureNodesByNumber.set(work.n, { work, nodeGroup, sculptureTurntable, baseRing, placement });
  });

  window.__FASSBINDER_MUSEUM = {
    CAT_LABEL,
    ALL_WORKS,
    canvas,
    renderer,
    scene,
    camera,
    EYE_HEIGHT,
    visitorSpot,
    ceilingGroup,
    floorHotspots,
    interactiveSculptureHitboxes,
    sculptureNodesByNumber
  };
})();
