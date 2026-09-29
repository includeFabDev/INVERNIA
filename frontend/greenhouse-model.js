const GREENHOUSE = {
  width: 10,
  length: 30,
  sideHeight: 2.5,
  ridgeHeight: 4,
  frameSpacing: 3,
  bedCount: 6,
  bedWidth: 1,
  aisleWidth: 0.45,
  bedLengthInset: 0.8,
  bedHeight: 0.22,
  antechamber: {
    width: 4,
    length: 3,
    height: 2.5
  }
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
}

function createGreenhouseStructure(THREE, parent) {
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

  addInstancedBeams(THREE, parent, beams, 0.045, metal);
}

function createGreenhouseCover(THREE, parent) {
  const halfWidth = GREENHOUSE.width / 2;
  const halfLength = GREENHOUSE.length / 2;
  const eaveX = 0.45;
  const slopeHeight = GREENHOUSE.sideHeight
    + (GREENHOUSE.ridgeHeight - GREENHOUSE.sideHeight) * (1 - eaveX / halfWidth);
  const film = new THREE.MeshPhysicalMaterial({
    color: 0xf4f7ee,
    transparent: true,
    opacity: 0.32,
    roughness: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.MeshPhysicalMaterial({
    color: 0x72b7a0,
    transparent: true,
    opacity: 0.17,
    roughness: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  addSurface(THREE, parent, [
    [-halfWidth, GREENHOUSE.sideHeight, -halfLength], [-eaveX, slopeHeight, -halfLength],
    [-eaveX, slopeHeight, halfLength], [-halfWidth, GREENHOUSE.sideHeight, halfLength]
  ], film);
  addSurface(THREE, parent, [
    [eaveX, slopeHeight, -halfLength], [halfWidth, GREENHOUSE.sideHeight, -halfLength],
    [halfWidth, GREENHOUSE.sideHeight, halfLength], [eaveX, slopeHeight, halfLength]
  ], film);

  for (const x of [-halfWidth, halfWidth]) {
    addSurface(THREE, parent, [
      [x, 0, -halfLength], [x, GREENHOUSE.sideHeight, -halfLength],
      [x, GREENHOUSE.sideHeight, halfLength], [x, 0, halfLength]
    ], mesh);
  }

  const antechamberEnd = -halfLength;
  const doorWidth = 2.2;
  const sidePanelWidth = (GREENHOUSE.width - doorWidth) / 2;
  for (const xCenter of [-(doorWidth + sidePanelWidth) / 2, (doorWidth + sidePanelWidth) / 2]) {
    addSurface(THREE, parent, [
      [xCenter - sidePanelWidth / 2, 0, antechamberEnd],
      [xCenter + sidePanelWidth / 2, 0, antechamberEnd],
      [xCenter + sidePanelWidth / 2, GREENHOUSE.sideHeight, antechamberEnd],
      [xCenter - sidePanelWidth / 2, GREENHOUSE.sideHeight, antechamberEnd]
    ], mesh);
  }
  addSurface(THREE, parent, [
    [-halfWidth, 0, halfLength], [halfWidth, 0, halfLength],
    [halfWidth, GREENHOUSE.sideHeight, halfLength], [-halfWidth, GREENHOUSE.sideHeight, halfLength]
  ], mesh);

  for (const z of [-halfLength, halfLength]) {
    addTriangle(THREE, parent, [[-halfWidth, GREENHOUSE.sideHeight, z], [0, GREENHOUSE.ridgeHeight, z], [0, GREENHOUSE.sideHeight, z]], film);
    addTriangle(THREE, parent, [[0, GREENHOUSE.sideHeight, z], [0, GREENHOUSE.ridgeHeight, z], [halfWidth, GREENHOUSE.sideHeight, z]], film);
  }
}

function createRidgeVentilation(THREE, parent) {
  const halfLength = GREENHOUSE.length / 2;
  const openingWidth = 0.55;
  const darkOpening = new THREE.Mesh(
    new THREE.BoxGeometry(openingWidth, 0.025, GREENHOUSE.length),
    new THREE.MeshBasicMaterial({ color: 0x33473f })
  );
  darkOpening.position.set(0, GREENHOUSE.ridgeHeight - 0.025, 0);
  parent.add(darkOpening);

  const ventCover = new THREE.MeshPhysicalMaterial({
    color: 0xf1f4ea,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  addSurface(THREE, parent, [
    [-openingWidth / 2, GREENHOUSE.ridgeHeight + 0.12, -halfLength],
    [-openingWidth / 2, GREENHOUSE.ridgeHeight, -halfLength],
    [-openingWidth / 2, GREENHOUSE.ridgeHeight, halfLength],
    [-openingWidth / 2, GREENHOUSE.ridgeHeight + 0.12, halfLength]
  ], ventCover);
  addSurface(THREE, parent, [
    [openingWidth / 2, GREENHOUSE.ridgeHeight, -halfLength],
    [openingWidth / 2, GREENHOUSE.ridgeHeight + 0.12, -halfLength],
    [openingWidth / 2, GREENHOUSE.ridgeHeight + 0.12, halfLength],
    [openingWidth / 2, GREENHOUSE.ridgeHeight, halfLength]
  ], ventCover);

  const ventRails = [];
  for (const x of [-openingWidth / 2, openingWidth / 2]) {
    ventRails.push([[x, GREENHOUSE.ridgeHeight, -halfLength], [x, GREENHOUSE.ridgeHeight, halfLength]]);
  }
  addInstancedBeams(THREE, parent, ventRails, 0.035,
    new THREE.MeshStandardMaterial({ color: 0x73817e, metalness: 0.7, roughness: 0.35 }));
}

function createBeds(THREE, parent, createLabel) {
  const occupiedWidth = GREENHOUSE.bedCount * GREENHOUSE.bedWidth
    + (GREENHOUSE.bedCount - 1) * GREENHOUSE.aisleWidth;
  const firstCenter = -occupiedWidth / 2 + GREENHOUSE.bedWidth / 2;
  const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x76553b, roughness: 1 });
  const bedGroup = new THREE.Group();
  const bedCenters = [];

  for (let index = 0; index < GREENHOUSE.bedCount; index++) {
    const x = firstCenter + index * (GREENHOUSE.bedWidth + GREENHOUSE.aisleWidth);
    bedCenters.push(x);
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(GREENHOUSE.bedWidth, GREENHOUSE.bedHeight, GREENHOUSE.length - GREENHOUSE.bedLengthInset * 2),
      soilMaterial
    );
    bed.position.set(x, GREENHOUSE.bedHeight / 2, 0);
    bedGroup.add(bed);

    const label = createLabel(`C${index + 1}`, '#c4d9b0', 0.27);
    label.position.set(x, GREENHOUSE.bedHeight + 0.08, GREENHOUSE.length / 2 - GREENHOUSE.bedLengthInset / 2);
    bedGroup.add(label);
  }
  parent.add(bedGroup);
  return { group: bedGroup, centers: bedCenters };
}

function createAntechamber(THREE, parent, createLabel) {
  // Approximation graphique only: antechamber dimensions need confirmation from the final plan.
  const { width, length, height } = GREENHOUSE.antechamber;
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
  parent.add(floor);

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
  addInstancedBeams(THREE, parent, frame, 0.035,
    new THREE.MeshStandardMaterial({ color: 0x95a29d, metalness: 0.65, roughness: 0.35 }));

  for (const x of [-halfWidth, halfWidth]) {
    addSurface(THREE, parent, [
      [x, 0, z - halfLength], [x, height, z - halfLength],
      [x, height, z + halfLength], [x, 0, z + halfLength]
    ], wallMaterial);
  }
  addSurface(THREE, parent, [
    [-halfWidth, 0, z - halfLength], [halfWidth, 0, z - halfLength],
    [halfWidth, height, z - halfLength], [-halfWidth, height, z - halfLength]
  ], wallMaterial);

  const label = createLabel('ANTECÁMARA · APROX.', '#d8e4d7', 0.32);
  label.position.set(0, height + 0.18, z - halfLength);
  parent.add(label);
}

function createZoneGroups(THREE, parent) {
  const zones = {};
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
    group.userData = { zone: name, startZ, endZ: startZ + zoneLength };
    zones[`zone${name}`] = group;
    parent.add(group);
  });
  return zones;
}

export function createGreenhouseModel(THREE, createLabel) {
  const group = new THREE.Group();
  group.name = 'invernia-greenhouse-30x10';
  createGround(THREE, group);
  const beds = createBeds(THREE, group, createLabel);
  createGreenhouseStructure(THREE, group);
  createGreenhouseCover(THREE, group);
  createRidgeVentilation(THREE, group);
  createAntechamber(THREE, group, createLabel);
  const zones = createZoneGroups(THREE, group);
  group.userData = { dimensions: { ...GREENHOUSE }, bedCenters: beds.centers, ...zones };
  return group;
}