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

function createZoneGroups(THREE, parent, createLabel) {
  const zones = {};
  const zoneTints = {};
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
    setZoneHighlight(zone) {
      for (const [name, tint] of Object.entries(zoneTints)) {
        tint.material.opacity = zone === 'GENERAL' ? 0.055 : (name === zone ? 0.12 : 0.025);
      }
    }
  };
}

function setIoTDeviceMetadata(object, metadata) {
  const device = { source: 'simulation', ...metadata };
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
      id: `esp32-${zoneName.toLowerCase()}`,
      name: `ESP32-${zoneName}`,
      type: 'controller',
      zone: zoneName,
      variable: null,
      unit: null,
      description: `Nodo controlador de la Zona ${zoneName}.`,
      logicalRef: `zona-${zoneName.toLowerCase()}`,
      associatedDeviceIds: [
        `station-${zoneName.toLowerCase()}`,
        `soil-${firstSoilId(zoneName)}`,
        `soil-${firstSoilId(zoneName) + 1}`
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
      id: `station-${zoneName.toLowerCase()}`,
      name: `Estación ambiental ${zoneName}`,
      type: 'environmental_station',
      zone: zoneName,
      variable: ['temperatura_c', 'humedad_pct', 'iluminancia_lux', 'co2_ppm'],
      unit: { temperatura_c: '°C', humedad_pct: '%', iluminancia_lux: 'lux', co2_ppm: 'ppm' },
      description: `Representa las variables ambientales agregadas de la Zona ${zoneName}.`,
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
        id: `soil-${bedIndex + 1}`,
        name: `Sensor de humedad de suelo ${bedIndex + 1}`,
        type: 'soil_moisture_sensor',
        zone: zoneName,
        variable: 'humedad_suelo_pct',
        unit: '%',
        description: `Valor simulado agregado de la Zona ${zoneName}; no es una lectura física individual.`,
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
    id: 'ph-1',
    name: 'Sensor de pH de riego',
    type: 'ph_sensor',
    zone: 'GENERAL',
    variable: 'ph',
    unit: 'pH',
    description: 'pH simulado del agua o solución de riego en el punto de servicio.',
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
  const selectableDevices = [
    ...esp32Nodes,
    ...environmentalStations,
    ...soilMoistureSensors,
    phSensor
  ];
  return {
    zones,
    esp32Nodes,
    environmentalStations,
    soilMoistureSensors,
    phSensor,
    selectableDevices,
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

  pipeSegments.push(addCylinderBetween(THREE, irrigationServiceGroup, [0.92, 0.42, 0], [0.48, 0.42, 0], 0.11, valveOff, 12));
  const valveBody = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), valveOff);
  valveBody.position.set(0.68, 0.42, 0);
  irrigationServiceGroup.add(valveBody);
  const valveHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.045, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x515b57, metalness: 0.62, roughness: 0.34 })
  );
  valveHandle.position.set(0.68, 0.64, 0);
  irrigationServiceGroup.add(valveHandle);
  const valveLabel = createLabel('VÁLVULA', '#dce7df', 0.22);
  valveLabel.position.set(0.68, 0.92, 0.05);
  irrigationServiceGroup.add(valveLabel);

  const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.48, 12), filterOff);
  filter.rotation.z = Math.PI / 2;
  filter.position.set(0.08, 0.42, 0);
  irrigationServiceGroup.add(filter);
  const filterRings = [];
  for (const x of [-0.1, 0.08, 0.26]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 6, 16), filterOff);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, 0.42, 0);
    irrigationServiceGroup.add(ring);
    filterRings.push(ring);
  }
  const filterLabel = createLabel('FILTRO · 120 mesh', '#dce7df', 0.21);
  filterLabel.position.set(0.08, 0.84, 0.03);
  irrigationServiceGroup.add(filterLabel);

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
  }

  return { group: irrigationManifoldGroup, collector, dripLines, outlets, collectorLabel };
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
  createGreenhouseStructure(THREE, group);
  createGreenhouseCover(THREE, group);
  const ventilation = createRidgeVentilation(THREE, group, createLabel);
  createAntechamber(THREE, group, createLabel);
  const zones = createZoneGroups(THREE, group, createLabel);
  const irrigationService = createIrrigationService(THREE, group, createLabel);
  const manifold = createIrrigationManifold(THREE, group, beds.centers, irrigationService, createLabel);
  const emitters = createEmitters(THREE, group, beds.centers);
  const updatePulses = createWaterPulses(THREE, group, beds.centers);
  const iotArchitecture = createIoTArchitecture(THREE, group, zones, beds.centers, createLabel);
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
  group.userData = { dimensions: { ...GREENHOUSE }, bedCenters: beds.centers, irrigation, ventilation: {
    group: ventilation.group,
    updateVisualState: (active, elapsed) => updateVentilationVisualState(ventilation, active, elapsed)
  }, iotArchitecture, ...zones };
  return group;
}

function firstSoilId(zoneName) {
  return (['A', 'B', 'C'].indexOf(zoneName) * 2) + 1;
}