/**
 * ATELIER FASSBINDER — MATTERPORT VIRTUAL TOUR CONTROLLER
 * Handles Floor Hotspot Teleportation, 360° Look-Around, Dollhouse 3D Aerial View,
 * Interactive 2D Floorplan Radar, 3D Sculpture Inspection + 360° Turntable, and Modals.
 */
(function () {
  'use strict';

  const M = window.__FASSBINDER_MUSEUM;
  if (!M) return;

  const {
    CAT_LABEL, ALL_WORKS, canvas, renderer, scene, camera, EYE_HEIGHT,
    visitorSpot, ceilingGroup, floorHotspots, interactiveSculptureHitboxes, sculptureNodesByNumber
  } = M;

  const tourState = {
    mode: 'walk', // 'walk' | 'dollhouse' | 'inspect'
    posX: 0,
    posY: EYE_HEIGHT,
    posZ: 12.0,
    yaw: 0,       // Horizontal look angle in radians (0 = looking down -Z)
    pitch: -0.04, // Vertical look angle in radians
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    pointerMovedDistance: 0,
    activeWork: null,
    activeNode: null,
    turntableAngle: 0
  };

  camera.position.set(tourState.posX, tourState.posY, tourState.posZ);

  const heroOverlay = document.getElementById('hero-overlay');
  const zCoordReadout = document.getElementById('z-coord-readout');
  const zProgressFill = document.getElementById('z-progress-fill');
  const btnDollhouse = document.getElementById('toggle-dollhouse-btn');

  function dismissHeroIfNeeded() {
    if (heroOverlay && heroOverlay.style.opacity !== '0') {
      heroOverlay.style.opacity = '0';
      heroOverlay.style.visibility = 'hidden';
    }
  }

  function updateHUDTelemetry() {
    const progress = THREE.MathUtils.clamp((12.0 - tourState.posZ) / 148.0, 0, 1);
    if (zProgressFill) zProgressFill.style.width = `${(progress * 100).toFixed(1)}%`;

    let hallName = 'SAAL I · FIGUREN & PLASTIKEN';
    if (tourState.posZ < -35 && tourState.posZ >= -75) hallName = 'SAAL II · STELEN & GRUPPEN';
    else if (tourState.posZ < -75 && tourState.posZ >= -108) hallName = 'SAAL III · RELIEFS & WANDARBEITEN';
    else if (tourState.posZ < -108) hallName = 'SAAL IV · KUNST AM BAU & ATELIER';

    if (zCoordReadout) {
      zCoordReadout.textContent = tourState.mode === 'dollhouse'
        ? 'DOLLHOUSE 3D // GESAMTANSICHT (94 SKULPTUREN)'
        : `${hallName} // Z: ${tourState.posZ.toFixed(1)}m`;
    }
  }

  /* ==========================================================================
     1. MATTERPORT TELEPORT TO FLOOR HOTSPOT OR HALL
     ========================================================================== */
  function teleportToPoint(targetX, targetZ, targetYaw = 0) {
    dismissHeroIfNeeded();
    if (tourState.mode === 'inspect') closeSculptureInspection(false);

    if (tourState.mode === 'dollhouse') {
      ceilingGroup.visible = true;
      tourState.mode = 'walk';
      if (btnDollhouse) btnDollhouse.textContent = '⬡ Dollhouse 3D (Maqueta)';
    }

    gsap.to(tourState, {
      posX: THREE.MathUtils.clamp(targetX, -7.5, 7.5),
      posY: EYE_HEIGHT,
      posZ: THREE.MathUtils.clamp(targetZ, -135, 13),
      yaw: targetYaw,
      pitch: -0.03,
      duration: 1.15,
      ease: 'power3.inOut',
      onUpdate: updateHUDTelemetry
    });
  }

  // Toggle Matterport Dollhouse 3D Aerial View
  function toggleDollhouseView() {
    dismissHeroIfNeeded();
    if (tourState.mode === 'inspect') closeSculptureInspection(false);

    if (tourState.mode !== 'dollhouse') {
      tourState.mode = 'dollhouse';
      ceilingGroup.visible = false; // Open roof so user sees inside all 4 halls
      if (btnDollhouse) btnDollhouse.textContent = '👁‍🗨 Vista Peatón (Walk 3D)';

      gsap.to(camera.position, {
        x: 26,
        y: 34,
        z: tourState.posZ - 12,
        duration: 1.35,
        ease: 'power3.inOut'
      });
      updateHUDTelemetry();
    } else {
      ceilingGroup.visible = true;
      tourState.mode = 'walk';
      if (btnDollhouse) btnDollhouse.textContent = '⬡ Dollhouse 3D (Maqueta)';

      gsap.to(camera.position, {
        x: tourState.posX,
        y: EYE_HEIGHT,
        z: tourState.posZ,
        duration: 1.25,
        ease: 'power3.inOut'
      });
      updateHUDTelemetry();
    }
  }

  if (btnDollhouse) btnDollhouse.addEventListener('click', toggleDollhouseView);

  /* ==========================================================================
     2. 360° DRAG LOOK-AROUND, MOUSEWHEEL WALK & KEYBOARD (WASD / ARROWS)
     ========================================================================== */
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2(999, 999);
  let hoveredHitbox = null;
  let hoveredHotspot = null;

  const hoverCaption = document.getElementById('artwork-hover-caption');
  const captionIndex = document.getElementById('caption-index');
  const captionTitle = document.getElementById('caption-title');
  const captionMeta = document.getElementById('caption-meta');

  canvas.addEventListener('pointerdown', (e) => {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    tourState.isDragging = true;
    tourState.dragStartX = e.clientX;
    tourState.dragStartY = e.clientY;
    tourState.pointerMovedDistance = 0;
  });

  // Two-finger pinch / drag support for walking on mobile touchscreens
  let lastPinchDist = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist = Math.hypot(dx, dy);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && lastPinchDist !== null) {
      dismissHeroIfNeeded();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (lastPinchDist - dist) * 0.045;
      lastPinchDist = dist;
      if (tourState.mode === 'walk') {
        tourState.posX = THREE.MathUtils.clamp(tourState.posX - Math.sin(tourState.yaw) * delta * 0.4, -7.2, 7.2);
        tourState.posZ = THREE.MathUtils.clamp(tourState.posZ - Math.cos(tourState.yaw) * delta, -135, 13);
        updateHUDTelemetry();
      } else if (tourState.mode === 'dollhouse') {
        tourState.posZ = THREE.MathUtils.clamp(tourState.posZ - delta * 1.2, -132, 10);
        camera.position.z = tourState.posZ - 12;
        updateHUDTelemetry();
      }
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    lastPinchDist = null;
  }, { passive: true });

  window.addEventListener('pointermove', (e) => {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (!tourState.isDragging) return;
    const dx = e.clientX - tourState.dragStartX;
    const dy = e.clientY - tourState.dragStartY;
    tourState.pointerMovedDistance += Math.abs(dx) + Math.abs(dy);
    tourState.dragStartX = e.clientX;
    tourState.dragStartY = e.clientY;

    if (tourState.mode === 'walk') {
      tourState.yaw -= dx * 0.0045;
      tourState.pitch = THREE.MathUtils.clamp(tourState.pitch - dy * 0.0035, -0.65, 0.65);
    } else if (tourState.mode === 'dollhouse') {
      tourState.posZ = THREE.MathUtils.clamp(tourState.posZ + dy * 0.18, -132, 10);
      camera.position.z = tourState.posZ - 12;
      updateHUDTelemetry();
    } else if (tourState.mode === 'inspect' && tourState.activeNode) {
      // Rotate the 3D sculpture 360° on its pedestal when dragging in inspect mode!
      tourState.activeNode.sculptureTurntable.rotation.y += dx * 0.012;
    }
  });

  window.addEventListener('pointerup', () => {
    tourState.isDragging = false;
  });

  // Mousewheel walks forward/backward along the museum (or pans Dollhouse)
  window.addEventListener('wheel', (e) => {
    if (document.querySelector('dialog[open]')) return;
    dismissHeroIfNeeded();
    if (tourState.mode === 'inspect') return;

    const step = e.deltaY * 0.016;
    if (tourState.mode === 'walk') {
      tourState.posX = THREE.MathUtils.clamp(tourState.posX - Math.sin(tourState.yaw) * step * 0.4, -7.2, 7.2);
      tourState.posZ = THREE.MathUtils.clamp(tourState.posZ - Math.cos(tourState.yaw) * step, -135, 13);
    } else if (tourState.mode === 'dollhouse') {
      tourState.posZ = THREE.MathUtils.clamp(tourState.posZ - step * 1.4, -132, 10);
      camera.position.z = tourState.posZ - 12;
    }
    updateHUDTelemetry();
  }, { passive: true });

  // Keyboard Walk (WASD / Arrow keys)
  window.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (tourState.mode === 'inspect') {
      if (e.key === 'Escape') closeSculptureInspection(true);
      if (e.key === 'ArrowLeft') stepInspectedSculpture(-1);
      if (e.key === 'ArrowRight') stepInspectedSculpture(1);
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      dismissHeroIfNeeded();
      tourState.posZ = Math.max(-135, tourState.posZ - 2.2);
      updateHUDTelemetry();
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      tourState.posZ = Math.min(13, tourState.posZ + 2.2);
      updateHUDTelemetry();
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      tourState.yaw += 0.14;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      tourState.yaw -= 0.14;
    }
  });

  /* ==========================================================================
     3. RAYCASTER HOVER & CLICK (HOTSPOTS + 94 3D SCULPTURES)
     ========================================================================== */
  function updateRaycasterInteractions() {
    if (tourState.mode === 'inspect') return;
    raycaster.setFromCamera(pointerNDC, camera);

    // 1. Check 3D Sculpture Hitboxes
    const visibleHitboxes = interactiveSculptureHitboxes.filter((h) => h.userData.nodeGroup.visible);
    const sculpHits = raycaster.intersectObjects(visibleHitboxes, false);

    if (sculpHits.length > 0 && sculpHits[0].distance < (tourState.mode === 'dollhouse' ? 95 : 24)) {
      const hit = sculpHits[0].object;
      if (hoveredHitbox !== hit) {
        if (hoveredHitbox) hoveredHitbox.userData.baseRing.material.opacity = 0.45;
        hoveredHitbox = hit;
        const { work, baseRing } = hit.userData;
        baseRing.material.opacity = 1.0;
        canvas.style.cursor = 'pointer';

        captionIndex.textContent = `3D-SKULPTUR NR. ${work.n} / 94 · ${CAT_LABEL[work.cat].toUpperCase()}`;
        captionTitle.textContent = `Werk Nr. ${work.n} (Klicken für 360°-Ansicht)`;
        captionMeta.textContent = work.alt;
        hoverCaption.classList.add('is-visible');
      }
      return;
    } else if (hoveredHitbox) {
      hoveredHitbox.userData.baseRing.material.opacity = 0.45;
      hoveredHitbox = null;
      hoverCaption.classList.remove('is-visible');
    }

    // 2. Check Matterport Floor Hotspots
    const spotHits = raycaster.intersectObjects(floorHotspots, false);
    if (spotHits.length > 0 && spotHits[0].distance < 45) {
      const spot = spotHits[0].object;
      if (hoveredHotspot !== spot) {
        if (hoveredHotspot) hoveredHotspot.userData.parentRing.scale.setScalar(1.0);
        hoveredHotspot = spot;
        spot.userData.parentRing.scale.setScalar(1.28);
        canvas.style.cursor = 'pointer';
      }
    } else if (hoveredHotspot) {
      hoveredHotspot.userData.parentRing.scale.setScalar(1.0);
      hoveredHotspot = null;
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'grab';
    }
  }

  canvas.addEventListener('click', (e) => {
    if (tourState.pointerMovedDistance > 14) return; // Ignore drag-releases
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    updateRaycasterInteractions();
    if (hoveredHitbox) {
      inspectSculpture3D(hoveredHitbox.userData.work.n);
    } else if (hoveredHotspot) {
      const { targetX, targetZ } = hoveredHotspot.userData;
      teleportToPoint(targetX, targetZ, 0);
    }
  });

  // Mobile on-screen walk buttons (Forward / Backward)
  const btnStepFwd = document.getElementById('mobile-step-fwd');
  const btnStepBwd = document.getElementById('mobile-step-bwd');
  if (btnStepFwd) {
    btnStepFwd.addEventListener('click', () => {
      dismissHeroIfNeeded();
      if (tourState.mode === 'inspect') closeSculptureInspection(true);
      tourState.posX = THREE.MathUtils.clamp(tourState.posX + Math.sin(tourState.yaw) * 3.2, -7.2, 7.2);
      tourState.posZ = THREE.MathUtils.clamp(tourState.posZ - Math.cos(tourState.yaw) * 3.2, -135, 13);
      updateHUDTelemetry();
    });
  }
  if (btnStepBwd) {
    btnStepBwd.addEventListener('click', () => {
      dismissHeroIfNeeded();
      if (tourState.mode === 'inspect') closeSculptureInspection(true);
      tourState.posX = THREE.MathUtils.clamp(tourState.posX - Math.sin(tourState.yaw) * 3.2, -7.2, 7.2);
      tourState.posZ = THREE.MathUtils.clamp(tourState.posZ + Math.cos(tourState.yaw) * 3.2, -135, 13);
      updateHUDTelemetry();
    });
  }

  /* ==========================================================================
     4. 3D SCULPTURE INSPECTION & 360° TURNTABLE + DETAIL DRAWER
     ========================================================================== */
  const detailPanel = document.getElementById('artwork-detail-panel');

  function inspectSculpture3D(workNumber) {
    const node = sculptureNodesByNumber.get(workNumber);
    if (!node) return;
    dismissHeroIfNeeded();

    ceilingGroup.visible = true;
    tourState.mode = 'inspect';
    tourState.activeWork = node.work;
    tourState.activeNode = node;
    hoverCaption.classList.remove('is-visible');

    const { work, nodeGroup, placement } = node;
    document.getElementById('detail-catalogue').textContent = `3D-SKULPTUR NR. ${work.n} VON 94 · ${CAT_LABEL[work.cat].toUpperCase()}`;
    document.getElementById('detail-title').textContent = `Werk Nr. ${work.n}`;
    document.getElementById('detail-category').textContent = CAT_LABEL[work.cat];
    document.getElementById('detail-alt-text').textContent = work.alt;

    const detailImg = document.getElementById('detail-img');
    detailImg.src = work.img;
    detailImg.alt = work.alt;

    // Position camera right in front of the 3D pedestal so user sees the 3D sculpture next to / above the drawer
    const isMobile = window.innerWidth <= 768;
    const normalX = placement.x > 0 ? -1 : 1;
    const camTargetX = placement.x + normalX * (isMobile ? 2.85 : 2.65);
    const camTargetZ = placement.z + (isMobile ? 2.25 : 1.85);

    tourState.posX = 0;
    tourState.posZ = placement.z + 3.0;

    gsap.to(camera.position, {
      x: camTargetX,
      y: isMobile ? 2.05 : 1.85,
      z: camTargetZ,
      duration: 1.15,
      ease: 'power3.inOut'
    });

    detailPanel.classList.add('is-open');
    detailPanel.setAttribute('aria-hidden', 'false');
  }

  function stepInspectedSculpture(delta) {
    if (!tourState.activeWork) return;
    const idx = ALL_WORKS.findIndex((w) => w.n === tourState.activeWork.n);
    const nextWork = ALL_WORKS[(idx + delta + ALL_WORKS.length) % ALL_WORKS.length];
    inspectSculpture3D(nextWork.n);
  }

  function closeSculptureInspection(returnToWalk = true) {
    detailPanel.classList.remove('is-open');
    detailPanel.setAttribute('aria-hidden', 'true');
    if (tourState.activeNode) {
      gsap.to(tourState.activeNode.sculptureTurntable.rotation, { y: 0, duration: 0.6 });
    }
    if (returnToWalk) {
      tourState.mode = 'walk';
      gsap.to(camera.position, {
        x: tourState.posX,
        y: EYE_HEIGHT,
        z: tourState.posZ,
        duration: 0.95,
        ease: 'power3.inOut'
      });
    }
  }

  document.getElementById('prev-work-btn').addEventListener('click', () => stepInspectedSculpture(-1));
  document.getElementById('next-work-btn').addEventListener('click', () => stepInspectedSculpture(1));
  document.getElementById('close-detail-btn').addEventListener('click', () => closeSculptureInspection(true));

  const rot360Btn = document.getElementById('rotate-360-btn');
  if (rot360Btn) {
    rot360Btn.addEventListener('click', () => {
      if (!tourState.activeNode) return;
      gsap.to(tourState.activeNode.sculptureTurntable.rotation, {
        y: tourState.activeNode.sculptureTurntable.rotation.y + Math.PI * 2,
        duration: 2.4,
        ease: 'power2.inOut'
      });
    });
  }

  window.__FASSBINDER_TOUR = {
    tourState,
    teleportToPoint,
    toggleDollhouseView,
    inspectSculpture3D,
    closeSculptureInspection,
    updateRaycasterInteractions,
    updateHUDTelemetry
  };
})();
/**
 * PART 2: 2D FLOORPLAN RADAR, MODALS, MODERN WEB GUIDANCE & 60FPS RENDER LOOP
 */
(function () {
  'use strict';

  const M = window.__FASSBINDER_MUSEUM;
  const T = window.__FASSBINDER_TOUR;
  if (!M || !T) return;

  const { CAT_LABEL, ALL_WORKS, renderer, scene, camera, EYE_HEIGHT, visitorSpot, floorHotspots, sculptureNodesByNumber } = M;
  const { tourState, teleportToPoint, inspectSculpture3D, closeSculptureInspection, updateRaycasterInteractions } = T;

  // Quick Hall / Category Jump Chips in Bottom Bar
  document.querySelectorAll('.ovr-chip[data-cat]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.ovr-chip[data-cat]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.getAttribute('data-cat');

      ALL_WORKS.forEach((w) => {
        const node = sculptureNodesByNumber.get(w.n);
        node.nodeGroup.visible = (cat === 'all' || w.cat === cat);
      });

      const firstMatch = ALL_WORKS.find((w) => cat === 'all' || w.cat === cat);
      if (firstMatch) {
        const node = sculptureNodesByNumber.get(firstMatch.n);
        teleportToPoint(0, node.placement.z + 3.5, 0);
      }
    });
  });

  document.getElementById('enter-ovr-btn').addEventListener('click', () => teleportToPoint(0, 8.0, 0));
  document.getElementById('nav-ovr-btn').addEventListener('click', () => teleportToPoint(0, 8.0, 0));
  document.getElementById('reset-camera-link').addEventListener('click', (e) => {
    e.preventDefault();
    teleportToPoint(0, 11.5, 0);
  });

  /* ==========================================================================
     5. INTERACTIVE MATTERPORT 2D FLOORPLAN RADAR (MINIMAP)
     ========================================================================== */
  const radarCanvas = document.getElementById('floorplan-radar');
  const radarCtx = radarCanvas ? radarCanvas.getContext('2d') : null;

  if (radarCanvas) {
    radarCanvas.addEventListener('click', (e) => {
      const rect = radarCanvas.getBoundingClientRect();
      const ny = (e.clientY - rect.top) / rect.height;
      const targetZ = 14 - ny * 152;
      teleportToPoint(0, targetZ, 0);
    });
  }

  function renderFloorplanRadar() {
    if (!radarCtx) return;
    const w = radarCanvas.width;
    const h = radarCanvas.height;
    radarCtx.clearRect(0, 0, w, h);

    radarCtx.fillStyle = 'rgba(15, 12, 10, 0.9)';
    radarCtx.fillRect(0, 0, w, h);
    radarCtx.strokeStyle = 'rgba(201, 164, 78, 0.45)';
    radarCtx.lineWidth = 1.5;
    radarCtx.strokeRect(6, 6, w - 12, h - 12);

    // Draw all 94 sculpture pedestals as golden dots on the floorplan
    ALL_WORKS.forEach((work) => {
      const node = sculptureNodesByNumber.get(work.n);
      if (!node.nodeGroup.visible) return;
      const px = w / 2 + (node.placement.x / 12) * (w / 2 - 10);
      const py = 8 + ((14 - node.placement.z) / 152) * (h - 16);
      radarCtx.fillStyle = (tourState.activeWork && tourState.activeWork.n === work.n) ? '#ffffff' : '#c9a44e';
      radarCtx.fillRect(px - 1.5, py - 1.5, 3, 3);
    });

    // Draw Visitor Position & View Cone
    const vx = w / 2 + (tourState.posX / 12) * (w / 2 - 10);
    const vz = 8 + ((14 - tourState.posZ) / 152) * (h - 16);

    radarCtx.save();
    radarCtx.translate(vx, vz);
    radarCtx.rotate(-tourState.yaw);
    radarCtx.beginPath();
    radarCtx.moveTo(0, 0);
    radarCtx.lineTo(-9, -16);
    radarCtx.lineTo(9, -16);
    radarCtx.closePath();
    radarCtx.fillStyle = 'rgba(217, 126, 74, 0.38)';
    radarCtx.fill();

    radarCtx.beginPath();
    radarCtx.arc(0, 0, 3.8, 0, Math.PI * 2);
    radarCtx.fillStyle = '#d97e4a';
    radarCtx.fill();
    radarCtx.restore();
  }

  /* ==========================================================================
     6. MODALS (94-WORK CATALOGUE, ARTIST DOSSIER, AR) & MODERN WEB GUIDANCE
     ========================================================================== */
  const catalogDialog = document.getElementById('catalog-dialog');
  const dossierDialog = document.getElementById('dossier-dialog');
  const arDialog = document.getElementById('ar-dialog');

  // Modern Web Guidance (light-dismiss-a-dialog): Fallback for browsers without native `closedBy` support
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    [catalogDialog, dossierDialog, arDialog].forEach((dialog) => {
      if (!dialog) return;
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        dialog.close();
      });
    });
  }

  const catalogGridEl = document.getElementById('catalog-grid-94');
  const catalogSearchInput = document.getElementById('catalog-search-input');
  const catalogCountLabel = document.getElementById('catalog-count-label');
  let modalCategory = 'all';
  let modalQuery = '';

  function renderCatalogModalGrid() {
    if (!catalogGridEl) return;
    catalogGridEl.innerHTML = '';
    const filtered = ALL_WORKS.filter((w) => {
      if (modalCategory !== 'all' && w.cat !== modalCategory) return false;
      if (!modalQuery) return true;
      return `${w.alt} ${CAT_LABEL[w.cat]} foto ${w.n}`.toLowerCase().includes(modalQuery);
    });

    catalogCountLabel.textContent = filtered.length === ALL_WORKS.length
      ? `Alle ${ALL_WORKS.length} Skulpturen & Werke im 3D-Museum`
      : `${filtered.length} von ${ALL_WORKS.length} Werken`;

    filtered.forEach((w) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'catalog-item';
      btn.innerHTML = `
        <img src="${w.img}" alt="${w.alt}" loading="lazy" decoding="async" />
        <div class="catalog-item-meta">
          <b>Werk Nr. ${w.n} (3D)</b>
          <span>${CAT_LABEL[w.cat]}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        catalogDialog.close();
        const node = sculptureNodesByNumber.get(w.n);
        node.nodeGroup.visible = true;
        inspectSculpture3D(w.n);
      });
      catalogGridEl.appendChild(btn);
    });
  }
  renderCatalogModalGrid();

  catalogSearchInput.addEventListener('input', () => {
    modalQuery = catalogSearchInput.value.trim().toLowerCase();
    renderCatalogModalGrid();
  });

  document.querySelectorAll('#modal-filter-chips .ovr-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#modal-filter-chips .ovr-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      modalCategory = chip.getAttribute('data-modal-cat');
      renderCatalogModalGrid();
    });
  });

  document.getElementById('nav-catalog-btn').addEventListener('click', () => catalogDialog.showModal());
  document.getElementById('hero-catalog-btn').addEventListener('click', () => catalogDialog.showModal());
  document.getElementById('close-catalog-btn').addEventListener('click', () => catalogDialog.close());

  document.getElementById('nav-dossier-btn').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'biografie.html';
  });
  document.getElementById('hero-artist-btn').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'biografie.html';
  });
  document.getElementById('close-dossier-btn').addEventListener('click', () => dossierDialog.close());

  const workSelectEl = document.getElementById('collector-work');
  document.getElementById('inquire-piece-btn').addEventListener('click', () => {
    if (tourState.activeWork && workSelectEl) {
      const val = `Foto Nr. ${tourState.activeWork.n} (${CAT_LABEL[tourState.activeWork.cat]})`;
      for (const opt of workSelectEl.options) {
        if (opt.value === val) opt.selected = true;
      }
    }
    dossierDialog.showModal();
  });

  // AR Room Projection Modal
  const arPreviewBox = document.getElementById('ar-artwork-preview');
  const arDimensionLabel = document.getElementById('ar-dimension-label');
  const arDistanceSlider = document.getElementById('ar-distance-slider');

  document.getElementById('open-ar-btn').addEventListener('click', () => {
    const work = tourState.activeWork || ALL_WORKS[0];
    arPreviewBox.style.backgroundImage = `url(${work.img})`;
    arDimensionLabel.textContent = `Werk Nr. ${work.n} · ${CAT_LABEL[work.cat]} · Distanz: 2.8m`;
    arDistanceSlider.value = '1';
    arPreviewBox.style.transform = 'scale(1)';
    arDialog.showModal();
  });

  document.getElementById('close-ar-btn').addEventListener('click', () => arDialog.close());
  arDistanceSlider.addEventListener('input', (e) => {
    const scaleVal = parseFloat(e.target.value);
    arPreviewBox.style.transform = `scale(${scaleVal})`;
    const work = tourState.activeWork || ALL_WORKS[0];
    const meters = (3.8 - scaleVal * 1.6).toFixed(1);
    arDimensionLabel.textContent = `Werk Nr. ${work.n} · ${CAT_LABEL[work.cat]} · Distanz: ${meters}m`;
  });

  document.getElementById('launch-native-ar-btn').addEventListener('click', (e) => {
    e.preventDefault();
    arDialog.close();
    dossierDialog.showModal();
  });

  // Modern Web Guidance (validate-input-after-interaction)
  const UserInvalidFallback = (() => {
    const dirtyState = new WeakMap();
    const updateState = (input) => {
      const isValid = input.checkValidity();
      input.classList.toggle('user-invalid-fallback', !isValid);
      input.classList.toggle('user-valid-fallback', isValid);
      if (!isValid) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    };
    const handleEvent = (event) => {
      const input = event.target;
      if (event.type === 'reset') {
        for (const control of (input.elements || [])) {
          dirtyState.delete(control);
          control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
          control.removeAttribute('aria-invalid');
        }
        return;
      }
      if (!input.checkValidity) return;
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      if (event.type === 'input' || event.type === 'change') state.hasInteracted = true;
      if (event.type === 'blur') state.hasBlurred = true;
      dirtyState.set(input, state);
      if (state.hasInteracted && state.hasBlurred) updateState(input);
    };
    const init = (root = document) => {
      if (CSS.supports('selector(:user-invalid)')) return;
      root.addEventListener('blur', handleEvent, true);
      root.addEventListener('input', handleEvent);
      root.addEventListener('change', handleEvent);
      root.addEventListener('reset', handleEvent, true);
    };
    return { init };
  })();

  const inquiryForm = document.getElementById('collector-inquiry-form');
  UserInvalidFallback.init(inquiryForm);

  const syncAria = (el) => {
    if (typeof el.matches === 'function' && CSS.supports('selector(:user-invalid)')) {
      el.setAttribute?.('aria-invalid', el.matches(':user-invalid') ? 'true' : 'false');
    }
  };
  inquiryForm.addEventListener('blur', (e) => syncAria(e.target), true);
  inquiryForm.addEventListener('input', (e) => {
    if (e.target.hasAttribute && e.target.hasAttribute('aria-invalid')) syncAria(e.target);
  });

  inquiryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!inquiryForm.checkValidity()) {
      const firstInvalid = inquiryForm.querySelector(':invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    const name = document.getElementById('collector-name').value;
    const work = document.getElementById('collector-work').value;
    const notes = document.getElementById('collector-notes').value;
    const subject = encodeURIComponent(`Anfrage: ${work} — Atelier Fassbinder`);
    const body = encodeURIComponent(`Guten Tag Frau Schmitt-Fassbinder,\n\nName: ${name}\nWerk: ${work}\n\n${notes}`);
    window.location.href = `mailto:info@atelier-fassbinder.de?subject=${subject}&body=${body}`;
    const statusEl = document.getElementById('inquiry-status');
    statusEl.style.display = 'block';
    statusEl.textContent = '✦ E-Mail-Programm geöffnet für info@atelier-fassbinder.de (Atelier Trier).';
  });

  /* ==========================================================================
     7. MAIN 60FPS MATTERPORT RENDER LOOP
     ========================================================================== */
  const clock = new THREE.Clock();
  const lookTarget = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Pulse Matterport floor hotspot rings subtly
    floorHotspots.forEach((spot, i) => {
      const s = 1.0 + Math.sin(t * 2.5 + i * 0.6) * 0.06;
      if (spot !== T.hoveredHotspot) spot.userData.parentRing.scale.set(s, s, 1);
    });

    if (tourState.mode === 'walk') {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, tourState.posX, 0.1);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, EYE_HEIGHT, 0.1);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, tourState.posZ, 0.1);

      const dirX = Math.sin(tourState.yaw) * Math.cos(tourState.pitch);
      const dirY = Math.sin(tourState.pitch);
      const dirZ = -Math.cos(tourState.yaw) * Math.cos(tourState.pitch);
      lookTarget.set(
        camera.position.x + dirX * 10,
        camera.position.y + dirY * 10,
        camera.position.z + dirZ * 10
      );
      camera.lookAt(lookTarget);
      visitorSpot.position.set(camera.position.x, 3.3, camera.position.z);
    } else if (tourState.mode === 'dollhouse') {
      camera.lookAt(0, 0, tourState.posZ - 26);
      visitorSpot.position.set(0, 12, tourState.posZ - 15);
    } else if (tourState.mode === 'inspect' && tourState.activeNode) {
      const p = tourState.activeNode.placement;
      camera.lookAt(p.x, 1.55, p.z);
      visitorSpot.position.set(camera.position.x, 3.0, camera.position.z);
    }

    updateRaycasterInteractions();
    renderFloorplanRadar();
    renderer.render(scene, camera);
  }

  function syncViewportProjection() {
    camera.fov = window.innerWidth < 680 ? 68 : 55;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  syncViewportProjection();
  window.addEventListener('resize', syncViewportProjection);

  animate();
})();
