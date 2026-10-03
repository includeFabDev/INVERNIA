const GREENHOUSE = {
  width: 10,
  length: 30,
  sideHeight: 2.5,
  ridgeHeight: 4,
  frameSpacing: 3,
  bedCount: 6,
  bedWidth: 1.15,
  aisleWidth: 0.6,
  bedLengthInset: 0.8,
  bedHeight: 0.22,
  antechamber: {
    width: 4,
    length: 3,
    height: 2.5
  }
};

const IRRIGATION = {
  dripLineCount: 6,
  emitterSpacing: 0.3,
  emitterFlowLph: 2,
  minPressureBar: 0.7,
  maxPressureBar: 1.5,
  serviceCenterX: 6.25,
  serviceCenterZ: -16.2,
  manifoldZ: -14.45,
  lineStartZ: -13.85,
  lineEndZ: GREENHOUSE.length / 2 - GREENHOUSE.bedLengthInset
};

function addSurface(THREE, parent, points, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}

function addTriangle(THREE, parent, points, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}

function addInstancedBeams(THREE, parent, specs, radius, material) {
  const geometry = new THREE.CylinderGeometry(radius, radius, 1, 8, 1);
  const beams = new THREE.InstancedMesh(geometry, material, specs.length);
  const helper = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);

  specs.forEach(([startValues, endValues], index) => {
    const start = new THREE.Vector3(...startValues);
    const end = new THREE.Vector3(...endValues);
    const direction = end.clone().sub(start);
    helper.position.copy(start).add(end).multiplyScalar(0.5);
    helper.quaternion.setFromUnitVectors(up, direction.clone().normalize());
    helper.scale.set(1, direction.length(), 1);
    helper.updateMatrix();
    beams.setMatrixAt(index, helper.matrix);
  });

  beams.instanceMatrix.needsUpdate = true;
  parent.add(beams);
  return beams;
}

function createGround(THREE, parent) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GREENHOUSE.width + 14, GREENHOUSE.length + 14),
    new THREE.MeshStandardMaterial({ color: 0x899680, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.13;
  parent.add(ground);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(GREENHOUSE.width, 0.12, GREENHOUSE.length),
    new THREE.MeshStandardMaterial({ color: 0x725c46, roughness: 1 })
  );
  floor.position.y = -0.06;
  parent.add(floor);

  const vegetation = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.62, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x58764e, roughness: 1 }),
    8
  );
  vegetation.name = 'discreet-rural-edge-vegetation';
  const shrubs = [
    [-7, -12], [-7, -5], [-7, 3], [-7, 11],
    [7, -13], [7, 9], [7, 13], [-7, 17]
  ];
  const helper = new THREE.Object3D();
  shrubs.forEach(([x, z], index) => {
    helper.position.set(x, 0.18, z);
    helper.scale.set(1.1 + (index % 2) * 0.25, 0.45 + (index % 3) * 0.08, 0.9 + (index % 2) * 0.2);
    helper.updateMatrix();
    vegetation.setMatrixAt(index, helper.matrix);
  });
  vegetation.instanceMatrix.needsUpdate = true;
  parent.add(vegetation);
}

function createGreenhouseStructure(THREE, parent) {
  const structure = new THREE.Group();
  structure.name = 'galvanized-structure';
  parent.add(structure);
  const metal = new THREE.MeshStandardMaterial({ color: 0x9daaa7, metalness: 0.72, roughness: 0.3 });
  const frameCount = Math.round(GREENHOUSE.length / GREENHOUSE.frameSpacing);
  const halfWidth = GREENHOUSE.width / 2;
  const halfLength = GREENHOUSE.length / 2;
  const beams = [];

  for (let frame = 0; frame <= frameCount; frame++) {
    const z = -halfLength + frame * GREENHOUSE.frameSpacing;
    for (const x of [-halfWidth, halfWidth]) {
      beams.push([[x, 0, z], [x, GREENHOUSE.sideHeight, z]]);
    }
    beams.push([[-halfWidth, GREENHOUSE.sideHeight, z], [0, GREENHOUSE.ridgeHeight, z]]);
    beams.push([[0, GREENHOUSE.ridgeHeight, z], [halfWidth, GREENHOUSE.sideHeight, z]]);
    beams.push([[0, GREENHOUSE.sideHeight, z], [0, GREENHOUSE.ridgeHeight, z]]);
  }

  const roofRailXs = [-halfWidth, -4, -2, 2, 4, halfWidth];
  for (const x of roofRailXs) {
    const y = GREENHOUSE.sideHeight
      + (GREENHOUSE.ridgeHeight - GREENHOUSE.sideHeight) * (1 - Math.abs(x) / halfWidth);
    beams.push([[x, y, -halfLength], [x, y, halfLength]]);
  }
  for (const x of [-halfWidth, halfWidth]) {
    beams.push([[x, 0, -halfLength], [x, 0, halfLength]]);
  }

  addInstancedBeams(THREE, structure, beams, 0.045, metal);
  return structure;
}

function createGreenhouseCover(THREE, parent) {
  const filmGroup = new THREE.Group();
  filmGroup.name = 'agrofilm-cover';
  const insectMeshGroup = new THREE.Group();
  insectMeshGroup.name = 'anti-aphid-mesh';
  parent.add(filmGroup, insectMeshGroup);
  const halfWidth = GREENHOUSE.width / 2;
  const halfLength = GREENHOUSE.length / 2;
  const eaveX = 0.45;
  const slopeHeight = GREENHOUSE.sideHeight
    + (GREENHOUSE.ridgeHeight - GREENHOUSE.sideHeight) * (1 - eaveX / halfWidth);
  const film = new THREE.MeshPhysicalMaterial({
    color: 0xf4f7ee,
    transparent: true,
    opacity: 0.32,
    roughness: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.MeshPhysicalMaterial({
    color: 0xc6ded0,
    transparent: true,
    opacity: 0.24,
    roughness: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  addSurface(THREE, filmGroup, [
    [-halfWidth, GREENHOUSE.sideHeight, -halfLength], [-eaveX, slopeHeight, -halfLength],
    [-eaveX, slopeHeight, halfLength], [-halfWidth, GREENHOUSE.sideHeight, halfLength]
  ], film);
  addSurface(THREE, filmGroup, [
    [eaveX, slopeHeight, -halfLength], [halfWidth, GREENHOUSE.sideHeight, -halfLength],
    [halfWidth, GREENHOUSE.sideHeight, halfLength], [eaveX, slopeHeight, halfLength]
  ], film);

  for (const x of [-halfWidth, halfWidth]) {
    const side = new THREE.Group();
    side.name = `anti-aphid-mesh-side-${x < 0 ? 'west' : 'east'}`;
    insectMeshGroup.add(side);
    addSurface(THREE, side, [
      [x, 0, -halfLength], [x, GREENHOUSE.sideHeight, -halfLength],
      [x, GREENHOUSE.sideHeight, halfLength], [x, 0, halfLength]
    ], mesh);
    const threadMaterial = new THREE.LineBasicMaterial({ color: 0xd6e7d8, transparent: true, opacity: 0.28 });
    const threads = [];
    for (let y = 0.2; y < GREENHOUSE.sideHeight; y += 0.28) {
      threads.push([[x + (x < 0 ? 0.012 : -0.012), y, -halfLength], [x + (x < 0 ? 0.012 : -0.012), y, halfLength]]);
    }
    for (let z = -halfLength; z <= halfLength; z += 0.3) {
      threads.push([[x + (x < 0 ? 0.014 : -0.014), 0, z], [x + (x < 0 ? 0.014 : -0.014), GREENHOUSE.sideHeight, z]]);
    }
    const positions = new Float32Array(threads.flat(2));
    const threadGeometry = new THREE.BufferGeometry();
    threadGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    side.add(new THREE.LineSegments(threadGeometry, threadMaterial));
  }

  const antechamberEnd = -halfLength;
  const doorWidth = 2.2;
  const sidePanelWidth = (GREENHOUSE.width - doorWidth) / 2;
  for (const xCenter of [-(doorWidth + sidePanelWidth) / 2, (doorWidth + sidePanelWidth) / 2]) {
    addSurface(THREE, insectMeshGroup, [
      [xCenter - sidePanelWidth / 2, 0, antechamberEnd],
      [xCenter + sidePanelWidth / 2, 0, antechamberEnd],
      [xCenter + sidePanelWidth / 2, GREENHOUSE.sideHeight, antechamberEnd],
      [xCenter - sidePanelWidth / 2, GREENHOUSE.sideHeight, antechamberEnd]
    ], mesh);
  }
  addSurface(THREE, insectMeshGroup, [
    [-halfWidth, 0, halfLength], [halfWidth, 0, halfLength],
    [halfWidth, GREENHOUSE.sideHeight, halfLength], [-halfWidth, GREENHOUSE.sideHeight, halfLength]
  ], mesh);

  for (const z of [-halfLength, halfLength]) {
    addTriangle(THREE, filmGroup, [[-halfWidth, GREENHOUSE.sideHeight, z], [0, GREENHOUSE.ridgeHeight, z], [0, GREENHOUSE.sideHeight, z]], film);
    addTriangle(THREE, filmGroup, [[0, GREENHOUSE.sideHeight, z], [0, GREENHOUSE.ridgeHeight, z], [halfWidth, GREENHOUSE.sideHeight, z]], film);
  }
  return { filmGroup, insectMeshGroup };
}

function createRidgeVentilation(THREE, parent, createLabel) {
  const halfLength = GREENHOUSE.length / 2;
  const openingWidth = 0.55;
  const ventilationGroup = new THREE.Group();
  ventilationGroup.name = 'ridge-ventilation';
  parent.add(ventilationGroup);
  const darkOpening = new THREE.Mesh(
    new THREE.BoxGeometry(openingWidth, 0.025, GREENHOUSE.length),
    new THREE.MeshBasicMaterial({ color: 0x33473f })
  );
  darkOpening.position.set(0, GREENHOUSE.ridgeHeight - 0.025, 0);
  ventilationGroup.add(darkOpening);

  const ventCover = new THREE.MeshPhysicalMaterial({
    color: 0xf1f4ea,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const ventFlaps = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * openingWidth / 2, GREENHOUSE.ridgeHeight + 0.015, 0);
    const flap = new THREE.Mesh(
      new THREE.BoxGeometry(openingWidth / 2 + 0.04, 0.035, GREENHOUSE.length - 0.8),
      ventCover
    );
    flap.position.x = -side * (openingWidth / 4 + 0.01);
    hinge.add(flap);
    ventilationGroup.add(hinge);
    ventFlaps.push({ hinge, side });
  }

  addSurface(THREE, ventilationGroup, [
    [-openingWidth / 2, GREENHOUSE.ridgeHeight + 0.12, -halfLength],
    [-openingWidth / 2, GREENHOUSE.ridgeHeight, -halfLength],
    [-openingWidth / 2, GREENHOUSE.ridgeHeight, halfLength],
    [-openingWidth / 2, GREENHOUSE.ridgeHeight + 0.12, halfLength]
  ], ventCover);
  addSurface(THREE, ventilationGroup, [
    [openingWidth / 2, GREENHOUSE.ridgeHeight, -halfLength],
    [openingWidth / 2, GREENHOUSE.ridgeHeight + 0.12, -halfLength],
    [openingWidth / 2, GREENHOUSE.ridgeHeight + 0.12, halfLength],
    [openingWidth / 2, GREENHOUSE.ridgeHeight, halfLength]
  ], ventCover);

  const ventRails = [];
  for (const x of [-openingWidth / 2, openingWidth / 2]) {
    ventRails.push([[x, GREENHOUSE.ridgeHeight, -halfLength], [x, GREENHOUSE.ridgeHeight, halfLength]]);
  }
  addInstancedBeams(THREE, ventilationGroup, ventRails, 0.035,
    new THREE.MeshStandardMaterial({ color: 0x73817e, metalness: 0.7, roughness: 0.35 }));

  const airflow = [];
  for (const z of [-5, 0, 5]) {
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6),
      new THREE.MeshBasicMaterial({ color: 0x55d6d1 })
    );
    shaft.position.y = 0.1;
    arrow.add(shaft);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.16, 6),
      shaft.material
    );
    tip.rotation.x = Math.PI;
    tip.position.y = -0.19;
    arrow.add(tip);
    arrow.position.set(0, GREENHOUSE.ridgeHeight + 0.65, z);
    arrow.visible = false;
    ventilationGroup.add(arrow);
    airflow.push(arrow);
  }

  const closedLabel = createLabel('VENTILACIÓN · CERRADA', '#c7d5ce', 0.2);
  closedLabel.position.set(0, GREENHOUSE.ridgeHeight + 0.45, -halfLength + 2.1);
  ventilationGroup.add(closedLabel);
  const openLabel = createLabel('VENTILACIÓN · ABIERTA', '#55d6d1', 0.2);
  openLabel.position.copy(closedLabel.position);
  openLabel.visible = false;
  ventilationGroup.add(openLabel);

  return {
    group: ventilationGroup,
    ventFlaps,
    airflow,
    closedLabel,
    openLabel
  };
}

function updateVentilationVisualState(ventilation, active, elapsed) {
  ventilation.ventFlaps.forEach(({ hinge, side }) => {
    hinge.rotation.z = active ? -side * 0.58 : 0;
  });
  ventilation.airflow.forEach((arrow, index) => {
    arrow.visible = active;
    if (active) {
      arrow.position.y = GREENHOUSE.ridgeHeight + 0.95
        - ((elapsed * 0.5 + index / ventilation.airflow.length) % 1) * 1.6;
    }
  });
  ventilation.closedLabel.visible = !active;
  ventilation.openLabel.visible = active;
  ventilation.lateralFlaps.forEach(({ flap, side }) => {
    flap.rotation.z = active ? -side * 0.38 : 0;
  });
}

function createLateralVentilation(THREE, parent) {
  const group = new THREE.Group();
  group.name = 'lateral-mesh-ventilation';
  parent.add(group);
  const lateralFlaps = [];
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xd8e8dc,
    transparent: true,
    opacity: 0.36,
    roughness: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  for (const side of [-1, 1]) {
    const flap = new THREE.Group();
    flap.position.set(side * (GREENHOUSE.width / 2 - 0.03), 1.52, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, GREENHOUSE.length - 1), material);
    panel.position.x = -side * 0.03;
    flap.add(panel);
    group.add(flap);
    lateralFlaps.push({ flap, side });
  }
  return { group, lateralFlaps };
}

function createBeds(THREE, parent, createLabel) {
  const occupiedWidth = GREENHOUSE.bedCount * GREENHOUSE.bedWidth
    + (GREENHOUSE.bedCount - 1) * GREENHOUSE.aisleWidth;
  const firstCenter = -occupiedWidth / 2 + GREENHOUSE.bedWidth / 2;
  const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x76553b, roughness: 1 });
  const bedGroup = new THREE.Group();
  bedGroup.name = 'six-horticultural-beds';
  const bedCenters = [];
  const bedMeshes = [];

  for (let index = 0; index < GREENHOUSE.bedCount; index++) {
    const x = firstCenter + index * (GREENHOUSE.bedWidth + GREENHOUSE.aisleWidth);
    bedCenters.push(x);
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(GREENHOUSE.bedWidth, GREENHOUSE.bedHeight, GREENHOUSE.length - GREENHOUSE.bedLengthInset * 2),
      soilMaterial
    );
    bed.position.set(x, GREENHOUSE.bedHeight / 2, 0);
    bed.userData.bedIndex = index;
    bed.userData.bedId = `C${index + 1}`;
    bedGroup.add(bed);
    bedMeshes.push(bed);

    const label = createLabel(`C${index + 1}`, '#c4d9b0', 0.27);
    label.position.set(x, GREENHOUSE.bedHeight + 0.08, GREENHOUSE.length / 2 - GREENHOUSE.bedLengthInset / 2);
    bedGroup.add(label);
  }

  const cropGroup = new THREE.Group();
  cropGroup.name = 'horticultural-crop-representation';
  bedGroup.add(cropGroup);
  const cropTypes = [
    { geometry: new THREE.ConeGeometry(0.27, 1.75, 7), material: new THREE.MeshStandardMaterial({ color: 0x367c3c, roughness: 0.9 }), indexes: [0, 1] },
    { geometry: new THREE.ConeGeometry(0.25, 1.5, 7), material: new THREE.MeshStandardMaterial({ color: 0x4c9148, roughness: 0.9 }), indexes: [2] },
    { geometry: new THREE.SphereGeometry(0.25, 7, 5), material: new THREE.MeshStandardMaterial({ color: 0x72a84b, roughness: 0.95 }), indexes: [3] },
    { geometry: new THREE.ConeGeometry(0.24, 0.92, 7), material: new THREE.MeshStandardMaterial({ color: 0x5d9340, roughness: 0.95 }), indexes: [4, 5] }
  ];
  const helper = new THREE.Object3D();
  cropTypes.forEach(({ geometry, material, indexes }) => {
    const plantCount = indexes.length * 24;
    const plants = new THREE.InstancedMesh(geometry, material, plantCount);
    const foliage = geometry.type === 'SphereGeometry' ? null : new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.19, 6, 5),
      new THREE.MeshStandardMaterial({ color: material.color.clone().multiplyScalar(1.08), roughness: 0.94 }),
      plantCount * 3
    );
    let instance = 0;
    let foliageInstance = 0;
    indexes.forEach((bedIndex) => {
      const x = bedCenters[bedIndex];
      for (let row = 0; row < 24; row++) {
        const z = -13.2 + row * 1.12;
        const plantX = x + ((row % 2) ? 0.14 : -0.14);
        const plantY = GREENHOUSE.bedHeight + (geometry.type === 'SphereGeometry' ? 0.16 : 0.75);
        helper.rotation.set(0, 0, 0);
        helper.position.set(plantX, plantY, z);
        helper.scale.set(1, geometry.type === 'SphereGeometry' ? 0.72 : 0.72 + (row % 3) * 0.12, 1);
        helper.updateMatrix();
        plants.setMatrixAt(instance++, helper.matrix);
        if (foliage) {
          for (let leaf = 0; leaf < 3; leaf++) {
            const angle = (leaf / 3) * Math.PI * 2 + (row % 2) * 0.4;
            helper.position.set(plantX + Math.cos(angle) * 0.13, plantY - 0.2 + leaf * 0.28, z + Math.sin(angle) * 0.13);
            helper.rotation.set(0, -angle, (leaf - 1) * 0.22);
            helper.scale.set(0.75, 0.52, 1.35);
            helper.updateMatrix();
            foliage.setMatrixAt(foliageInstance++, helper.matrix);
          }
        }
      }
    });
    plants.instanceMatrix.needsUpdate = true;
    cropGroup.add(plants);
    if (foliage) {
      foliage.instanceMatrix.needsUpdate = true;
      cropGroup.add(foliage);
    }
  });

  const trellisGroup = new THREE.Group();
  trellisGroup.name = 'lightweight-crop-trellis';
  cropGroup.add(trellisGroup);
  const trellisBedX = bedCenters[2];
  const trellisBeams = [];
  for (let z = -13; z <= 13; z += 3.25) {
    trellisBeams.push([[trellisBedX - 0.42, 0.25, z], [trellisBedX - 0.42, 2.15, z]]);
    trellisBeams.push([[trellisBedX + 0.42, 0.25, z], [trellisBedX + 0.42, 2.15, z]]);
  }
  for (const y of [1.2, 2.12]) {
    trellisBeams.push([[trellisBedX - 0.42, y, -13], [trellisBedX + 0.42, y, -13]]);
    trellisBeams.push([[trellisBedX - 0.42, y, -13], [trellisBedX - 0.42, y, 13]]);
    trellisBeams.push([[trellisBedX + 0.42, y, -13], [trellisBedX + 0.42, y, 13]]);
  }
  addInstancedBeams(THREE, trellisGroup, trellisBeams, 0.018,
    new THREE.MeshStandardMaterial({ color: 0xadb9a7, metalness: 0.25, roughness: 0.7 }));

  parent.add(bedGroup);
  return { group: bedGroup, cropGroup, trellisGroup, centers: bedCenters, meshes: bedMeshes };
}

function createBedSelection(THREE, parent, bedMeshes) {
  const material = new THREE.LineBasicMaterial({ color: 0x6be6d0, transparent: true, opacity: 0.95 });
  const outlines = bedMeshes.map((bed) => {
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(bed.geometry), material);
    outline.position.copy(bed.position);
    outline.visible = false;
    parent.add(outline);
    return outline;
  });

  return {
    setBedHighlight(camellon) {
      const index = Number(String(camellon || '').replace('C', '')) - 1;
      outlines.forEach((outline, outlineIndex) => { outline.visible = outlineIndex === index; });
    }
  };
}

function createAntechamber(THREE, parent, createLabel) {
  const { width, length, height } = GREENHOUSE.antechamber;
  const group = new THREE.Group();
  group.name = 'double-door-antechamber';
  parent.add(group);
  const z = -GREENHOUSE.length / 2 - length / 2;
  const wallMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x93b7a3,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
  });
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.08, length),
    new THREE.MeshStandardMaterial({ color: 0x675946, roughness: 1 })
  );
  floor.position.set(0, -0.01, z);
  group.add(floor);

  const frame = [];
  const halfWidth = width / 2;
  const halfLength = length / 2;
  for (const x of [-halfWidth, halfWidth]) {
    for (const endZ of [z - halfLength, z + halfLength]) {
      frame.push([[x, 0, endZ], [x, height, endZ]]);
    }
  }
  for (const y of [0, height]) {
    for (const endZ of [z - halfLength, z + halfLength]) {
      frame.push([[-halfWidth, y, endZ], [halfWidth, y, endZ]]);
    }
    frame.push([[-halfWidth, y, z - halfLength], [-halfWidth, y, z + halfLength]]);
    frame.push([[halfWidth, y, z - halfLength], [halfWidth, y, z + halfLength]]);
  }
  addInstancedBeams(THREE, group, frame, 0.035,
    new THREE.MeshStandardMaterial({ color: 0x95a29d, metalness: 0.65, roughness: 0.35 }));

  for (const x of [-halfWidth, halfWidth]) {
    addSurface(THREE, group, [
      [x, 0, z - halfLength], [x, height, z - halfLength],
      [x, height, z + halfLength], [x, 0, z + halfLength]
    ], wallMaterial);
  }
  const doorWidth = 1.5;
  const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x9daaa7, metalness: 0.68, roughness: 0.34 });
  const doorLeafMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd6e6db, transparent: true, opacity: 0.34, roughness: 0.72, side: THREE.DoubleSide });
  for (const endZ of [z - halfLength, z + halfLength]) {
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -halfWidth : doorWidth / 2;
      const x1 = side < 0 ? -doorWidth / 2 : halfWidth;
      addSurface(THREE, group, [[x0, 0, endZ], [x1, 0, endZ], [x1, height, endZ], [x0, height, endZ]], wallMaterial);
    }
    const door = new THREE.Group();
    door.name = endZ < z ? 'antechamber-door-1-exterior' : 'antechamber-door-2-interior';
    door.position.set(0, 0, endZ);
    group.add(door);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.08, height - 0.08, 0.045), doorLeafMaterial);
    leaf.position.set(0, (height - 0.08) / 2, 0);
    door.add(leaf);
    const doorFrame = [];
    for (const x of [-doorWidth / 2, 0, doorWidth / 2]) doorFrame.push([[x, 0, 0], [x, height, 0]]);
    doorFrame.push([[-doorWidth / 2, height, 0], [doorWidth / 2, height, 0]]);
    addInstancedBeams(THREE, door, doorFrame, 0.035, doorFrameMaterial);
    const label = createLabel(endZ < z ? 'PUERTA 1 · EXTERIOR' : 'PUERTA 2 · INVERNADERO', '#d8e4d7', 0.2);
    label.position.set(0, height + 0.28, 0);
    door.add(label);
  }

  const label = createLabel('ANTECÁMARA · DOBLE ACCESO', '#d8e4d7', 0.32);
  label.position.set(0, height + 0.18, z - halfLength);
  group.add(label);
  return group;
}

function createZoneGroups(THREE, parent, createLabel) {
  const zones = {};
  const zoneTints = {};
  const zoneTargets = [];
  const zoneLength = GREENHOUSE.length / 3;
  const colors = [0x70a98e, 0x9ba577, 0x6c9cb0];
  ['A', 'B', 'C'].forEach((name, index) => {
    const group = new THREE.Group();
    const startZ = -GREENHOUSE.length / 2 + index * zoneLength;
    const floorTint = new THREE.Mesh(
      new THREE.PlaneGeometry(GREENHOUSE.width, zoneLength),
      new THREE.MeshBasicMaterial({ color: colors[index], transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false })
    );
    floorTint.rotation.x = -Math.PI / 2;
    floorTint.position.set(0, 0.004, startZ + zoneLength / 2);
    group.add(floorTint);
    zoneTints[name] = floorTint;
    floorTint.userData.iotZone = name;
    zoneTargets.push(floorTint);
    const label = createLabel(`ZONA ${name}`, '#c4d7cb', 0.25);
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.035, startZ + 0.9);
    group.add(label);
    group.userData = { zone: name, startZ, endZ: startZ + zoneLength };
    zones[`zone${name}`] = group;
    parent.add(group);
  });
  return {
    ...zones,
    zoneTargets,
    setZoneHighlight(zone) {
      for (const [name, tint] of Object.entries(zoneTints)) {
        tint.material.opacity = zone === 'GENERAL' ? 0.055 : (name === zone ? 0.12 : 0.025);
      }
    }
  };
}

function setIoTDeviceMetadata(object, metadata) {
  const device = { ...metadata };
  object.userData.iotDevice = device;
  object.traverse((child) => {
    if (child.isMesh) child.userData.iotDevice = device;
  });
  return object;
}

function createEsp32Nodes(THREE, zoneGroups, createLabel) {
  const nodes = [];
  const zoneNames = ['A', 'B', 'C'];
  const zoneLength = GREENHOUSE.length / zoneNames.length;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x315e52, roughness: 0.55 });
  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x4cb78b, roughness: 0.48 });
  const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x252d2b, metalness: 0.35, roughness: 0.4 });

  zoneNames.forEach((zoneName, index) => {
    const zoneGroup = zoneGroups[`zone${zoneName}`];
    const centerZ = -GREENHOUSE.length / 2 + (index + 0.5) * zoneLength;
    const node = new THREE.Group();
    node.name = `esp32-node-${zoneName}`;
    node.position.set(-4.58, 1.15, centerZ);

    const enclosure = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.25, 0.14), bodyMaterial);
    node.add(enclosure);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.17, 0.025), boardMaterial);
    board.position.z = 0.083;
    node.add(board);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), antennaMaterial);
    antenna.position.set(0.12, 0.22, -0.025);
    node.add(antenna);

    const label = createLabel(`ESP32-${zoneName}`, '#d8f0df', 0.18);
    label.position.set(0, 0.24, 0.16);
    node.add(label);
    setIoTDeviceMetadata(node, {
      id: `ESP32-${zoneName}`,
      name: `ESP32-${zoneName}`,
      type: 'controller',
      zone: zoneName,
      variable: null,
      unit: null,
      description: `Nodo controlador de la Zona ${zoneName}.`,
      logicalRef: `zona-${zoneName.toLowerCase()}`,
      associatedDeviceIds: [
        `ENV-${zoneName}`,
        `SOIL-C${firstSoilId(zoneName)}`,
        `SOIL-C${firstSoilId(zoneName) + 1}`
      ]
    });
    zoneGroup.add(node);
    nodes.push(node);
  });

  return nodes;
}

function createIoTStations(THREE, zoneGroups, createLabel) {
  const stations = [];
  const zoneNames = ['A', 'B', 'C'];
  const zoneLength = GREENHOUSE.length / zoneNames.length;
  const housingMaterial = new THREE.MeshStandardMaterial({ color: 0xd5ddd2, roughness: 0.72 });
  const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x687c72, roughness: 0.6 });
  const sensorMaterial = new THREE.MeshStandardMaterial({ color: 0xe9bd62, metalness: 0.25, roughness: 0.45 });

  zoneNames.forEach((zoneName, index) => {
    const zoneGroup = zoneGroups[`zone${zoneName}`];
    const centerZ = -GREENHOUSE.length / 2 + (index + 0.5) * zoneLength;
    const station = new THREE.Group();
    station.name = `environment-station-${zoneName}`;
    station.position.set(4.05, 1.48, centerZ);

    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 10), housingMaterial);
    station.add(shield);
    for (const y of [-0.1, -0.02, 0.06, 0.14]) {
      const louver = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 5, 12), ventMaterial);
      louver.position.y = y;
      station.add(louver);
    }
    const lightSensor = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), sensorMaterial);
    lightSensor.position.y = 0.24;
    station.add(lightSensor);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 6), ventMaterial);
    stem.position.y = -0.3;
    station.add(stem);

    const label = createLabel(`ESTACIÓN ${zoneName}`, '#e2eee6', 0.17);
    label.position.set(0, 0.35, 0.15);
    station.add(label);
    setIoTDeviceMetadata(station, {
      id: `ENV-${zoneName}`,
      name: `Estación ambiental ${zoneName}`,
      type: 'environmental_station',
      zone: zoneName,
      variable: ['temperatura_c', 'humedad_pct', 'iluminancia_lux', 'co2_ppm'],
      unit: { temperatura_c: '°C', humedad_pct: '%', iluminancia_lux: 'lux', co2_ppm: 'ppm' },
      description: `Estación ambiental asignada a la Zona ${zoneName}.`,
      logicalRef: `zona-${zoneName.toLowerCase()}`
    });
    zoneGroup.add(station);
    stations.push(station);
  });

  return stations;
}

function createSoilMoistureSensors(THREE, zoneGroups, bedCenters, createLabel) {
  const sensors = [];
  const zoneNames = ['A', 'B', 'C'];
  const zoneLength = GREENHOUSE.length / zoneNames.length;
  const probeMaterial = new THREE.MeshStandardMaterial({ color: 0x465450, metalness: 0.42, roughness: 0.48 });
  const capMaterial = new THREE.MeshStandardMaterial({ color: 0x6cae81, roughness: 0.48 });

  zoneNames.forEach((zoneName, zoneIndex) => {
    const zoneGroup = zoneGroups[`zone${zoneName}`];
    const centerZ = -GREENHOUSE.length / 2 + (zoneIndex + 0.5) * zoneLength;
    const firstBedIndex = zoneIndex * 2;
    for (let bedOffset = 0; bedOffset < 2; bedOffset++) {
      const bedIndex = firstBedIndex + bedOffset;
      const sensor = new THREE.Group();
      sensor.name = `soil-moisture-C${bedIndex + 1}`;
      sensor.position.set(bedCenters[bedIndex] + 0.28, GREENHOUSE.bedHeight, centerZ);

      const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.3, 7), probeMaterial);
      probe.position.y = 0.04;
      sensor.add(probe);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), capMaterial);
      cap.position.y = 0.2;
      sensor.add(cap);
      const label = createLabel(`C${bedIndex + 1}-HS`, '#d7e8ce', 0.15);
      label.position.set(0.03, 0.34, 0.15);
      sensor.add(label);

      setIoTDeviceMetadata(sensor, {
        id: `SOIL-C${bedIndex + 1}`,
        name: `Sensor de humedad de suelo ${bedIndex + 1}`,
        type: 'soil_moisture_sensor',
        zone: zoneName,
        variable: 'humedad_suelo_pct',
        unit: '%',
        description: `Sensor de humedad del suelo asignado al camellón C${bedIndex + 1}.`,
        logicalRef: `camellon-C${bedIndex + 1}`,
        camellon: `C${bedIndex + 1}`
      });

      zoneGroup.add(sensor);
      sensors.push(sensor);
    }
  });

  return sensors;
}

function createPhSensor(THREE, parent, createLabel) {
  const serviceMount = parent.getObjectByName('phProbeMount');
  if (!serviceMount) throw new Error('Irrigation service pH mount was not found');

  const sensor = new THREE.Group();
  sensor.name = 'irrigation-water-ph-sensor';
  sensor.position.set(0.22, 0.03, 0.12);
  const probeMaterial = new THREE.MeshStandardMaterial({ color: 0xd8ded7, metalness: 0.58, roughness: 0.32 });
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 8), probeMaterial);
  probe.rotation.z = Math.PI / 2;
  sensor.add(probe);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0x5ea8a0, roughness: 0.4 }));
  collar.rotation.z = Math.PI / 2;
  collar.position.x = -0.08;
  sensor.add(collar);
  const label = createLabel('pH', '#e5f3e9', 0.18);
  label.position.set(0.08, 0.28, 0.16);
  sensor.add(label);
  setIoTDeviceMetadata(sensor, {
    id: 'PH-01',
    name: 'Sensor de pH de riego',
    type: 'ph_sensor',
    zone: 'SERVICIO',
    variable: 'ph',
    unit: 'pH',
    description: 'Sensor de pH del agua de riego en el punto de servicio; mantiene el equilibrio del sustrato y del fertirriego para evitar estrés nutricional.',
    logicalRef: 'agua-solucion-riego'
  });
  serviceMount.add(sensor);
  return sensor;
}

function createIoTArchitecture(THREE, parent, zones, bedCenters, createLabel) {
  const esp32Nodes = createEsp32Nodes(THREE, zones, createLabel);
  const environmentalStations = createIoTStations(THREE, zones, createLabel);
  const soilMoistureSensors = createSoilMoistureSensors(THREE, zones, bedCenters, createLabel);
  const phSensor = createPhSensor(THREE, parent, createLabel);
  const pickMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    colorWrite: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const selectableDevices = [
    ...esp32Nodes,
    ...environmentalStations,
    ...soilMoistureSensors,
    phSensor
  ];
  const pickTargets = selectableDevices.map((device) => {
    const metadata = device.userData.iotDevice;
    const geometry = metadata.type === 'controller'
      ? new THREE.BoxGeometry(0.62, 0.62, 0.48)
      : metadata.type === 'environmental_station'
        ? new THREE.SphereGeometry(0.38, 8, 6)
        : metadata.type === 'soil_moisture_sensor'
          ? new THREE.SphereGeometry(0.28, 8, 6)
          : new THREE.SphereGeometry(0.3, 8, 6);
    const target = new THREE.Mesh(geometry, pickMaterial);
    target.name = `iot-pick-${metadata.id}`;
    target.userData.iotDevice = metadata;
    target.userData.iotRoot = device;
    device.add(target);
    return target;
  });
  return {
    zones,
    esp32Nodes,
    environmentalStations,
    soilMoistureSensors,
    phSensor,
    selectableDevices,
  pickTargets,
    summaryByZone: {
      A: selectableDevices.filter((device) => device.userData.iotDevice.zone === 'A'),
      B: selectableDevices.filter((device) => device.userData.iotDevice.zone === 'B'),
      C: selectableDevices.filter((device) => device.userData.iotDevice.zone === 'C')
    },
    counts: {
      esp32: esp32Nodes.length,
      environmentalStations: environmentalStations.length,
      soilMoistureSensors: soilMoistureSensors.length,
      phSensors: 1,
      total: esp32Nodes.length + environmentalStations.length + soilMoistureSensors.length + 1
    }
  };
}

function addCylinderBetween(THREE, parent, startValues, endValues, radius, material, radialSegments = 10) {
  const start = new THREE.Vector3(...startValues);
  const end = new THREE.Vector3(...endValues);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), radialSegments),
    material
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

function createIrrigationService(THREE, parent, createLabel) {
  const irrigationServiceGroup = new THREE.Group();
  irrigationServiceGroup.name = 'irrigationServiceGroup';
  irrigationServiceGroup.position.set(IRRIGATION.serviceCenterX, 0, IRRIGATION.serviceCenterZ);
  parent.add(irrigationServiceGroup);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 0.12, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x59645d, roughness: 0.82 })
  );
  base.position.set(-0.05, 0.04, 0);
  irrigationServiceGroup.add(base);

  const pipeOff = new THREE.MeshStandardMaterial({ color: 0x344b4c, metalness: 0.52, roughness: 0.42 });
  const pipeOn = new THREE.MeshStandardMaterial({ color: 0x23a7c4, emissive: 0x08758e, emissiveIntensity: 0.12, metalness: 0.5, roughness: 0.32 });
  const valveOff = new THREE.MeshStandardMaterial({ color: 0x68716e, metalness: 0.62, roughness: 0.34 });
  const valveOn = new THREE.MeshStandardMaterial({ color: 0x35c995, emissive: 0x087750, emissiveIntensity: 0.18, metalness: 0.54, roughness: 0.3 });
  const filterOff = new THREE.MeshStandardMaterial({ color: 0x929b97, metalness: 0.68, roughness: 0.35 });
  const filterOn = new THREE.MeshStandardMaterial({ color: 0x6ab6c3, emissive: 0x0c6270, emissiveIntensity: 0.12, metalness: 0.55, roughness: 0.3 });
  const pipeSegments = [];

  pipeSegments.push(addCylinderBetween(THREE, irrigationServiceGroup, [1.65, 0.42, 0], [0.92, 0.42, 0], 0.075, pipeOff, 12));
  const inletCap = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 18), pipeOff);
  inletCap.position.set(1.64, 0.42, 0);
  inletCap.rotation.y = Math.PI / 2;
  irrigationServiceGroup.add(inletCap);
  const inletLabel = createLabel('RAMAL DE ENTRADA', '#dce7df', 0.2);
  inletLabel.position.set(1.05, 0.82, 0.12);
  irrigationServiceGroup.add(inletLabel);

  const tankGroup = new THREE.Group();
  tankGroup.name = 'irrigation-water-entry';
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1.15, 14),
    new THREE.MeshStandardMaterial({ color: 0x879993, metalness: 0.22, roughness: 0.56 })
  );
  tank.position.set(2.25, 0.66, -0.28);
  tankGroup.add(tank);
  const tankTop = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 14), tank.material);
  tankTop.position.set(2.25, 1.28, -0.28);
  tankGroup.add(tankTop);
  const tankLabel = createLabel('ENTRADA DE AGUA', '#dce7df', 0.18);
  tankLabel.position.set(2.25, 1.48, -0.28);
  tankGroup.add(tankLabel);
  irrigationServiceGroup.add(tankGroup);

  pipeSegments.push(addCylinderBetween(THREE, irrigationServiceGroup, [0.92, 0.42, 0], [0.48, 0.42, 0], 0.11, valveOff, 12));
  const valveBody = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), valveOff);
  valveBody.position.set(0, 0.42, 0);
  irrigationServiceGroup.add(valveBody);
  const valveHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.045, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x515b57, metalness: 0.62, roughness: 0.34 })
  );
  valveHandle.position.set(0, 0.64, 0);
  irrigationServiceGroup.add(valveHandle);
  const valveLabel = createLabel('VÁLVULA', '#dce7df', 0.22);
  valveLabel.position.set(0, 0.92, 0.05);
  irrigationServiceGroup.add(valveLabel);

  const valveGroup = new THREE.Group();
  valveGroup.name = 'irrigation-valve';
  valveGroup.add(valveBody, valveHandle);
  valveGroup.add(valveLabel);
  irrigationServiceGroup.add(valveGroup);

  const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.48, 12), filterOff);
  filter.rotation.z = Math.PI / 2;
  filter.position.set(0.68, 0.42, 0);
  irrigationServiceGroup.add(filter);
  const filterRings = [];
  for (const x of [0.5, 0.68, 0.86]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 6, 16), filterOff);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, 0.42, 0);
    irrigationServiceGroup.add(ring);
    filterRings.push(ring);
  }
  const filterLabel = createLabel('FILTRO DE MALLA', '#dce7df', 0.21);
  filterLabel.position.set(0.68, 0.84, 0.03);
  irrigationServiceGroup.add(filterLabel);
  const filterGroup = new THREE.Group();
  filterGroup.name = 'irrigation-filter';
  filterGroup.add(filter, ...filterRings, filterLabel);
  irrigationServiceGroup.add(filterGroup);

  const biolGroup = new THREE.Group();
  biolGroup.name = 'biol-application-point';
  const injector = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0x9b8250, metalness: 0.24, roughness: 0.5 }));
  injector.position.set(-0.95, 0.67, 0.58);
  biolGroup.add(injector);
  const injectorTee = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.48, 8), pipeOff);
  injectorTee.rotation.z = Math.PI / 2;
  injectorTee.position.set(-0.95, 0.44, 0.58);
  biolGroup.add(injectorTee);
  const biolLabel = createLabel('PUNTO DE APLICACIÓN DE BIOL', '#dce7df', 0.17);
  biolLabel.position.set(-0.95, 1.02, 0.66);
  biolGroup.add(biolLabel);
  irrigationServiceGroup.add(biolGroup);

  const gaugeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.1, 20),
    new THREE.MeshStandardMaterial({ color: 0xc7d0cb, metalness: 0.45, roughness: 0.3 })
  );
  gaugeBody.position.set(-0.5, 0.77, 0.02);
  irrigationServiceGroup.add(gaugeBody);
  const gaugeFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.145, 20),
    new THREE.MeshBasicMaterial({ color: 0xe7eee8, side: THREE.DoubleSide })
  );
  gaugeFace.position.set(-0.5, 0.77, 0.08);
  irrigationServiceGroup.add(gaugeFace);
  const gaugeNeedle = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.105, 0.012),
    new THREE.MeshBasicMaterial({ color: 0x40544d })
  );
  gaugeNeedle.position.set(-0.5, 0.8, 0.095);
  gaugeNeedle.rotation.z = -0.35;
  irrigationServiceGroup.add(gaugeNeedle);
  const gaugeLabel = createLabel(`${IRRIGATION.minPressureBar}-${IRRIGATION.maxPressureBar} bar`, '#dce7df', 0.2);
  gaugeLabel.position.set(-0.5, 0.48, 0.12);
  irrigationServiceGroup.add(gaugeLabel);

  pipeSegments.push(addCylinderBetween(THREE, irrigationServiceGroup, [-0.35, 0.42, 0], [-1.15, 0.42, 0], 0.075, pipeOff, 12));
  pipeSegments.push(addCylinderBetween(THREE, irrigationServiceGroup, [-1.15, 0.42, 0], [-1.15, 0.42, 1.1], 0.075, pipeOff, 12));
  pipeSegments.push(addCylinderBetween(THREE, irrigationServiceGroup,
    [-1.15, 0.42, 1.1],
    [GREENHOUSE.width / 2 - IRRIGATION.serviceCenterX, 0.42, IRRIGATION.manifoldZ - IRRIGATION.serviceCenterZ],
    0.075, pipeOff, 12));

  const phPort = new THREE.Group();
  phPort.name = 'phProbeMount';
  const portBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.08, 12), pipeOff);
  portBase.position.y = 0.13;
  phPort.add(portBase);
  const portLabel = createLabel('PUNTO pH', '#dce7df', 0.18);
  portLabel.position.set(0, 0.38, 0.02);
  phPort.add(portLabel);
  phPort.position.set(-0.85, 0, 0.52);
  irrigationServiceGroup.add(phPort);

  return {
    group: irrigationServiceGroup,
    tankGroup,
    valveGroup,
    filterGroup,
    biolGroup,
    inletGroup: tankGroup,
    materials: { pipeOff, pipeOn, valveOff, valveOn, filterOff, filterOn },
    valveBody,
    valveHandle,
    filter,
    filterRings,
    gaugeNeedle,
    pipeSegments
  };
}

function createIrrigationManifold(THREE, parent, bedCenters, service, createLabel) {
  const irrigationManifoldGroup = new THREE.Group();
  irrigationManifoldGroup.name = 'irrigationManifoldGroup';
  parent.add(irrigationManifoldGroup);

  const collectorMaterial = new THREE.MeshStandardMaterial({ color: 0x465958, metalness: 0.5, roughness: 0.4 });
  const collector = addCylinderBetween(THREE, irrigationManifoldGroup,
    [-GREENHOUSE.width / 2, 0.42, IRRIGATION.manifoldZ],
    [GREENHOUSE.width / 2, 0.42, IRRIGATION.manifoldZ],
    0.065, collectorMaterial, 12);
  collector.name = 'six-outlet-collector';
  const collectorLabel = createLabel('COLECTOR · 6 SALIDAS', '#a7d9e0', 0.22);
  collectorLabel.position.set(0, 0.62, IRRIGATION.manifoldZ + 0.1);
  irrigationManifoldGroup.add(collectorLabel);

  const dripLines = [];
  const outlets = [];
  const purgeGroup = new THREE.Group();
  purgeGroup.name = 'drip-line-purges';
  irrigationManifoldGroup.add(purgeGroup);
  for (let index = 0; index < IRRIGATION.dripLineCount; index++) {
    const x = bedCenters[index];
    const outlet = addCylinderBetween(THREE, irrigationManifoldGroup,
      [x, 0.42, IRRIGATION.manifoldZ],
      [x, GREENHOUSE.bedHeight + 0.02, IRRIGATION.lineStartZ],
      0.035, service.materials.pipeOff, 8);
    outlet.name = `collector-outlet-C${index + 1}`;
    outlets.push(outlet);

    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x354a4b, metalness: 0.25, roughness: 0.55 });
    const line = addCylinderBetween(THREE, irrigationManifoldGroup,
      [x, GREENHOUSE.bedHeight + 0.02, IRRIGATION.lineStartZ],
      [x, GREENHOUSE.bedHeight + 0.02, IRRIGATION.lineEndZ],
      0.018, lineMaterial, 8);
    line.name = `drip-line-C${index + 1}`;
    line.userData.bedId = `C${index + 1}`;
    dripLines.push(line);
    const purge = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0x7e9387, metalness: 0.35, roughness: 0.5 }));
    purge.position.set(x, GREENHOUSE.bedHeight + 0.11, IRRIGATION.lineEndZ + 0.07);
    purgeGroup.add(purge);
  }

  return { group: irrigationManifoldGroup, collector, dripLines, outlets, collectorLabel, purgeGroup };
}

function createOutdoorConnectivity(THREE, parent, esp32Nodes, createLabel) {
  const group = new THREE.Group();
  group.name = 'outdoor-satellite-connectivity';
  parent.add(group);

  const routerGroup = new THREE.Group();
  routerGroup.name = 'outdoor-access-point';
  routerGroup.position.set(6.5, 1.15, 1.5);
  const router = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x394842, metalness: 0.38, roughness: 0.46 }));
  routerGroup.add(router);
  for (const x of [-0.22, 0.22]) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: 0xb1bdb6, metalness: 0.6, roughness: 0.35 }));
    antenna.position.set(x, 0.28, 0);
    routerGroup.add(antenna);
  }
  const apLabel = createLabel('AP / ROUTER', '#bde7dc', 0.2);
  apLabel.position.set(0, 0.52, 0.3);
  routerGroup.add(apLabel);
  group.add(routerGroup);

  const internalNetwork = new THREE.Group();
  internalNetwork.name = 'internal-network-node';
  internalNetwork.position.set(7.8, 2.05, -1.65);
  const networkNode = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x5e7169, metalness: 0.32, roughness: 0.46 }));
  internalNetwork.add(networkNode);
  const networkLabel = createLabel('RED INTERNA', '#bde7dc', 0.16);
  networkLabel.position.y = 0.3;
  internalNetwork.add(networkLabel);
  group.add(internalNetwork);

  const satelliteGroup = new THREE.Group();
  satelliteGroup.name = 'satellite-dish-and-mast';
  satelliteGroup.position.set(9.2, 0, -4.5);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 2.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x9daaa7, metalness: 0.72, roughness: 0.32 }));
  mast.position.y = 1.4;
  satelliteGroup.add(mast);
  const dishProfile = [
    new THREE.Vector2(0.04, 0), new THREE.Vector2(0.14, 0.025),
    new THREE.Vector2(0.27, 0.09), new THREE.Vector2(0.41, 0.2),
    new THREE.Vector2(0.55, 0.36)
  ];
  const dishMaterial = new THREE.MeshStandardMaterial({ color: 0xd7dfd8, metalness: 0.54, roughness: 0.38, side: THREE.DoubleSide });
  const dish = new THREE.Mesh(new THREE.LatheGeometry(dishProfile, 20), dishMaterial);
  dish.position.y = 2.42;
  satelliteGroup.add(dish);
  const dishRim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.018, 6, 28), dishMaterial);
  dishRim.position.y = 2.78;
  dishRim.rotation.x = Math.PI / 2;
  satelliteGroup.add(dishRim);
  const feedMaterial = new THREE.MeshStandardMaterial({ color: 0x77857d, metalness: 0.64, roughness: 0.35 });
  addCylinderBetween(THREE, satelliteGroup, [0, 2.5, 0], [0, 2.86, 0.24], 0.022, feedMaterial, 6);
  const feed = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), feedMaterial);
  feed.position.set(0, 2.86, 0.24);
  satelliteGroup.add(feed);
  const dishLabel = createLabel('ANTENA SATELITAL', '#dce7df', 0.2);
  dishLabel.position.set(0, 3.55, 0);
  satelliteGroup.add(dishLabel);
  group.add(satelliteGroup);

  const linkMaterial = new THREE.LineBasicMaterial({ color: 0x55c9d2, transparent: true, opacity: 0.48 });
  const linkSegments = [];
  const apPosition = routerGroup.position.clone();
  esp32Nodes.forEach((node) => {
    const nodePosition = new THREE.Vector3();
    node.getWorldPosition(nodePosition);
    linkSegments.push([nodePosition.toArray(), [apPosition.x, apPosition.y, apPosition.z]]);
  });
  linkSegments.push([[apPosition.x, apPosition.y, apPosition.z], internalNetwork.position.toArray()]);
  linkSegments.push([internalNetwork.position.toArray(), satelliteGroup.position.clone().add(new THREE.Vector3(0, 3, 0)).toArray()]);
  const linkPositions = new Float32Array(linkSegments.flat(2));
  const linkGeometry = new THREE.BufferGeometry();
  linkGeometry.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
  group.add(new THREE.LineSegments(linkGeometry, linkMaterial));

  return { group, routerGroup, satelliteGroup };
}

function createEmitters(THREE, parent, bedCenters) {
  const lineLength = IRRIGATION.lineEndZ - IRRIGATION.lineStartZ;
  const emittersPerLine = Math.floor(lineLength / IRRIGATION.emitterSpacing) + 1;
  const emitterCount = IRRIGATION.dripLineCount * emittersPerLine;
  const geometry = new THREE.SphereGeometry(0.027, 6, 4);
  const material = new THREE.MeshStandardMaterial({
    color: 0x3b5353,
    emissive: 0x000000,
    roughness: 0.5
  });
  const emitters = new THREE.InstancedMesh(geometry, material, emitterCount);
  const helper = new THREE.Object3D();
  let instance = 0;

  for (const x of bedCenters) {
    for (let index = 0; index < emittersPerLine; index++) {
      helper.position.set(x, GREENHOUSE.bedHeight + 0.005, IRRIGATION.lineStartZ + index * IRRIGATION.emitterSpacing);
      helper.updateMatrix();
      emitters.setMatrixAt(instance++, helper.matrix);
    }
  }
  emitters.instanceMatrix.needsUpdate = true;
  emitters.name = 'drip-emitters-instanced';
  parent.add(emitters);
  return { mesh: emitters, perLine: emittersPerLine, count: emitterCount };
}

function createWaterPulses(THREE, parent, bedCenters) {
  const count = bedCenters.length;
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.055, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x5adff5 }),
    count
  );
  mesh.name = 'drip-water-pulses';
  mesh.visible = false;
  const helper = new THREE.Object3D();
  const phases = bedCenters.map((_, index) => index / count);
  parent.add(mesh);

  function update(active, elapsed = 0) {
    mesh.visible = active;
    if (!active) return;
    const lineLength = IRRIGATION.lineEndZ - IRRIGATION.lineStartZ;
    bedCenters.forEach((x, index) => {
      const progress = (elapsed * 0.12 + phases[index]) % 1;
      helper.position.set(x, GREENHOUSE.bedHeight + 0.09, IRRIGATION.lineStartZ + lineLength * progress);
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  return update;
}

function updateIrrigationVisualState(THREE, service, manifold, emitters, updatePulses, active, elapsed) {
  service.pipeSegments.forEach((pipe) => {
    pipe.material = active ? service.materials.pipeOn : service.materials.pipeOff;
  });
  service.valveBody.material = active ? service.materials.valveOn : service.materials.valveOff;
  service.valveHandle.material = active ? service.materials.valveOn : service.materials.valveOff;
  service.valveHandle.rotation.z = active ? Math.PI / 2 : 0;
  service.filter.material = active ? service.materials.filterOn : service.materials.filterOff;
  service.filterRings.forEach((ring) => {
    ring.material = active ? service.materials.filterOn : service.materials.filterOff;
  });
  service.gaugeNeedle.rotation.z = active ? -0.9 : -0.35;
  manifold.outlets.forEach((outlet) => {
    outlet.material = active ? service.materials.pipeOn : service.materials.pipeOff;
  });
  manifold.collector.material.emissive.setHex(active ? 0x08758e : 0x000000);
  manifold.collector.material.color.setHex(active ? 0x2494a8 : 0x465958);
  manifold.dripLines.forEach((line) => {
    line.material.color.setHex(active ? 0x1aa3bd : 0x354a4b);
    line.material.emissive.setHex(active ? 0x08758e : 0x000000);
  });
  emitters.mesh.material.color.setHex(active ? 0x64dcf0 : 0x3b5353);
  emitters.mesh.material.emissive.setHex(active ? 0x08758e : 0x000000);
  emitters.mesh.material.emissiveIntensity = active ? 0.32 : 0;
  updatePulses(active, elapsed);
}

export function createGreenhouseModel(THREE, createLabel) {
  const group = new THREE.Group();
  group.name = 'invernia-greenhouse-30x10';
  createGround(THREE, group);
  const beds = createBeds(THREE, group, createLabel);
  const structure = createGreenhouseStructure(THREE, group);
  const cover = createGreenhouseCover(THREE, group);
  const ridgeVentilation = createRidgeVentilation(THREE, group, createLabel);
  const lateralVentilation = createLateralVentilation(THREE, group);
  ridgeVentilation.lateralFlaps = lateralVentilation.lateralFlaps;
  const antechamber = createAntechamber(THREE, group, createLabel);
  const zones = createZoneGroups(THREE, group, createLabel);
  const irrigationService = createIrrigationService(THREE, group, createLabel);
  const serviceHighlight = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.028, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0x6be6d0, transparent: true, opacity: 0.9, depthWrite: false })
  );
  serviceHighlight.rotation.x = -Math.PI / 2;
  serviceHighlight.position.set(IRRIGATION.serviceCenterX, 0.08, IRRIGATION.serviceCenterZ);
  serviceHighlight.visible = false;
  group.add(serviceHighlight);
  const manifold = createIrrigationManifold(THREE, group, beds.centers, irrigationService, createLabel);
  const emitters = createEmitters(THREE, group, beds.centers);
  const updatePulses = createWaterPulses(THREE, group, beds.centers);
  const iotArchitecture = createIoTArchitecture(THREE, group, zones, beds.centers, createLabel);
    const connectivity = createOutdoorConnectivity(THREE, group, iotArchitecture.esp32Nodes, createLabel);
  const bedSelection = createBedSelection(THREE, group, beds.meshes);
  const irrigation = {
    serviceGroup: irrigationService.group,
    manifoldGroup: manifold.group,
    dripLines: manifold.dripLines,
    outletCount: manifold.outlets.length,
    emitterCount: emitters.count,
    emittersPerLine: emitters.perLine,
    updateVisualState: (active, elapsed) => updateIrrigationVisualState(
      THREE, irrigationService, manifold, emitters, updatePulses, active, elapsed
    )
  };
  const bedMeshes = [...beds.meshes];
  const educationalComponents = {};
  const registerEducationalComponent = (id, category, name, description, objects, focusDirection = [1, 0.58, 1], focusOptions = {}) => {
    educationalComponents[id] = {
      id,
      category,
      name,
      description,
      objects: Array.isArray(objects) ? objects : [objects],
      focusDirection,
      ...focusOptions
    };
  };
  registerEducationalComponent('overview', 'general', 'INVERNADERO HORTÍCOLA · 300 m²',
    'Invernadero hortícola de 30,00 × 10,00 m, estructura tubular galvanizada y cubierta agrícola.', group, [1, 0.68, 1]);
  registerEducationalComponent('structure', 'greenhouse', 'ESTRUCTURA GALVANIZADA',
    'Estructura tubular metálica galvanizada. Altura lateral 2,50 m y cumbrera 4,00 m.', structure, [1, 0.5, 1], {
      focusPoint: [0, 2.5, 0], focusDistance: 19
    });
  registerEducationalComponent('agrofilm', 'greenhouse', 'AGROFILM',
    'Cubierta de polietileno de larga duración con tratamiento UV. Espesor: 150–200 micrones.', cover.filmGroup, [0.8, 0.72, 1], {
      material: 'Polietileno de larga duración con tratamiento UV',
      specification: '150–200 micrones',
      focusPoint: [0, 3.2, 0],
      focusDistance: 11
    });
  registerEducationalComponent('insectMesh', 'greenhouse', 'MALLA ANTIÁFIDO',
    'Cerramiento lateral protegido con malla antiáfido, diferenciado visualmente de la cubierta de agrofilm.', cover.insectMeshGroup, [1.8, 0.32, 0.7], {
      focusPoint: [5, 1.5, 0], focusDistance: 9
    });
  registerEducationalComponent('ridgeVent', 'greenhouse', 'VENTILACIÓN CENITAL',
    'Sistema regulable ubicado en la cumbrera para favorecer la renovación natural del aire.', ridgeVentilation.group, [1, 1, 1], {
      focusPoint: [0, 4, 0], focusDistance: 11
    });
  registerEducationalComponent('lateralVent', 'greenhouse', 'VENTILACIÓN LATERAL',
    'Aperturas laterales protegidas con malla antiáfido; se muestran reducidas o abiertas junto con la ventilación cenital.', lateralVentilation.group, [1.8, 0.28, 0.65], {
      focusPoint: [5, 1.5, 0], focusDistance: 9
    });
  registerEducationalComponent('ventilation', 'greenhouse', 'VENTILACIÓN CENITAL + LATERAL',
    'La ventilación regulable de cumbrera y las aperturas laterales con malla se muestran juntas.',
    [ridgeVentilation.group, lateralVentilation.group], [1.5, 0.8, 1]);
  registerEducationalComponent('antechamber', 'greenhouse', 'ANTECÁMARA · DOBLE ACCESO',
    'Acceso exterior por puerta 1, antecámara y puerta 2 hacia el invernadero, como dos barreras de entrada.', antechamber, [0.12, 0.36, -1], {
      focusPoint: [0, 1.4, -16.5], focusDistance: 8
    });
  registerEducationalComponent('beds', 'crops', 'CAMELLONES C1–C6',
    'Seis camellones de 1,15 m de ancho y pasillos de 0,60 m; sustrato mejorado con compost.', beds.group, [1, 0.42, 0.38], {
      focusPoint: [0, 0.55, 0], focusDistance: 34
    });
  beds.meshes.forEach((bed, index) => {
    registerEducationalComponent(`bedC${index + 1}`, 'crops', `CAMELLÓN C${index + 1}`,
      `Camellón C${index + 1} con sustrato mejorado con compost; ancho nominal 1,15 m.`, bed, [0.1, 1.2, 0.9], {
        bedId: `C${index + 1}`,
        focusPoint: [bed.position.x, 0.65, 0],
        focusDistance: 9
      });
  });
  registerEducationalComponent('crops', 'crops', 'PRODUCCIÓN HORTÍCOLA',
    'Representación visual diversa de hortalizas altas, guiadas, de hoja baja y de porte medio. Es ilustrativa, no asigna cultivos a camellones.', beds.cropGroup, [1, 0.42, 0.38], {
      focusPoint: [0, 1.2, 0], focusDistance: 34
    });
  registerEducationalComponent('waterEntry', 'irrigation', 'ENTRADA DE AGUA',
    'Entrada visual del circuito de riego que conduce hacia el filtro, la válvula y el colector.', irrigationService.tankGroup, [1.4, 0.55, 1.2]);
  registerEducationalComponent('irrigationFilter', 'irrigation', 'FILTRO DE MALLA',
    'Elemento de filtrado del agua antes de su distribución por el sistema de goteo.', irrigationService.filterGroup, [1.7, 0.65, 1.2]);
  registerEducationalComponent('irrigationValve', 'irrigation', 'VÁLVULA',
    'Válvula manual representada en la línea de servicio del riego.', irrigationService.valveGroup, [1.7, 0.65, 1.2]);
  registerEducationalComponent('irrigationCollector', 'irrigation', 'COLECTOR',
    'Colector con seis salidas, una hacia cada lateral de goteo.', manifold.collector, [0.2, 1.4, 1.4]);
  registerEducationalComponent('dripLines', 'irrigation', 'LÍNEAS DE GOTEO',
    'Seis laterales de goteo distribuidos sobre los seis camellones.', [...manifold.dripLines, emitters.mesh], [0.1, 1.9, 0.8]);
  registerEducationalComponent('irrigationSystem', 'irrigation', 'RIEGO POR GOTEO',
    'Entrada de agua → filtro → válvula → colector → seis laterales de goteo → purgas finales.',
    [irrigationService.group, manifold.group], [1, 0.42, 0.38], { focusPoint: [0.4, 0.75, -2], focusDistance: 34 });
  registerEducationalComponent('purges', 'irrigation', 'PURGAS',
    'Terminaciones de purga visibles al final de los laterales de goteo.', manifold.purgeGroup, [0.5, 1.2, 1.8]);
  registerEducationalComponent('biolPoint', 'irrigation', 'PUNTO DE APLICACIÓN DE BIOL',
    'Punto previsto para aplicación de biol diluido y previamente filtrado mediante inyector o aplicación manual. No es automatizado.', irrigationService.biolGroup, [1.7, 0.7, 1.2]);
  iotArchitecture.selectableDevices.forEach((device) => {
    const metadata = device.userData.iotDevice;
    const id = metadata.id === 'PH-01' ? 'phSensor'
      : metadata.type === 'controller' ? `esp32${metadata.zone}`
        : metadata.type === 'environmental_station' ? `station${metadata.zone}`
          : `soilC${metadata.camellon.slice(1)}`;
    const category = metadata.type === 'ph_sensor' ? 'iot'
      : metadata.type === 'soil_moisture_sensor' ? 'iot'
        : 'iot';
    const description = metadata.type === 'ph_sensor'
      ? 'Medición de pH del agua o solución utilizada en el sistema de riego/fertirriego.'
      : metadata.type === 'soil_moisture_sensor'
        ? `${metadata.description} Humedad actual del suelo y camellón asociados disponibles en la ficha.`
        : metadata.type === 'environmental_station'
          ? `${metadata.description} Lecturas ambientales existentes disponibles en la ficha.`
          : `${metadata.description} Función: adquirir señales de sus sensores de zona y comunicarlas por la red local.`;
    const componentName = metadata.type === 'soil_moisture_sensor'
      ? `SENSOR DE SUELO ${metadata.camellon}`
      : metadata.name.toUpperCase();
    const focusDirection = metadata.type === 'controller' ? [-1, 0.38, 0.72]
      : metadata.type === 'soil_moisture_sensor' ? [0.25, 0.9, 1]
        : metadata.type === 'ph_sensor' ? [1, 0.5, 1]
          : [1, 0.42, 0.65];
    registerEducationalComponent(id, category, componentName, description, device, focusDirection);
  });
  registerEducationalComponent('iotArchitecture', 'iot', 'ARQUITECTURA IoT',
    'Tres nodos ESP32, tres estaciones ambientales, seis sensores de humedad de suelo y un sensor de pH. Se reutilizan los 13 dispositivos del modelo.',
    iotArchitecture.selectableDevices, [0.15, 0.6, 1], { focusPoint: [0, 1.2, 0], focusDistance: 27 });
  registerEducationalComponent('accessPoint', 'connectivity', 'PUNTO DE ACCESO / ROUTER',
    'Punto de acceso exterior que concentra la comunicación Wi‑Fi local y enlaza con la red interna.', connectivity.routerGroup, [1.7, 0.7, 1.2]);
  registerEducationalComponent('satelliteAntenna', 'connectivity', 'ANTENA SATELITAL',
    'Antena satelital exterior sobre mástil, separada de la cubierta del invernadero.', connectivity.satelliteGroup, [1.8, 0.72, 1.3]);
  registerEducationalComponent('connectivityArchitecture', 'connectivity', 'ARQUITECTURA DE CONECTIVIDAD',
    'ESP32 → Wi‑Fi local → AP/router → red interna → internet satelital. Los nodos no se conectan directamente a la antena.', connectivity.group, [0.25, 0.55, 0.9], {
      focusPoint: [2.5, 1.8, 0], focusDistance: 29
    });

  group.userData = { dimensions: { ...GREENHOUSE }, bedCenters: beds.centers, bedMeshes, irrigation, ventilation: {
    group: ridgeVentilation.group,
    lateralGroup: lateralVentilation.group,
    updateVisualState: (active, elapsed) => updateVentilationVisualState(ridgeVentilation, active, elapsed)
  }, iotArchitecture, connectivity, educationalComponents, setBedHighlight: bedSelection.setBedHighlight, setServiceHighlight: (active) => {
    serviceHighlight.visible = active;
  }, ...zones };
  return group;
}

function firstSoilId(zoneName) {
  return (['A', 'B', 'C'].indexOf(zoneName) * 2) + 1;
}