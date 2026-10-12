function createSourceReference(section, notes, idSuffix = 'legacy') {
  return {
    id: `${section}-${idSuffix}`,
    author: null,
    year: null,
    title: null,
    institution: null,
    url: null,
    section,
    notes,
    verificationStatus: 'pending_verification'
  };
}

const CROP_PROFILE_CATALOG = [
  {
    id: 'tomate',
    slug: 'tomate',
    name: 'Tomate',
    scientificName: 'Solanum lycopersicum',
    family: 'Solanaceae',
    category: 'fruit',
    categoryLabel: 'Hortaliza de fruto',
    waterNeed: 'media-alta',
    source: 'INVERNIA: catálogo agronómico previo',
    sourceReferences: [
      createSourceReference('catalog', 'No existe evidencia documental específica para este perfil en el repositorio; se conserva como valor heredado y provisional.')
    ],
    validationStatus: 'preliminary',
    validationNotes: 'Parámetros base conservadores. La semántica agronómica y las duraciones se mantienen como datos heredados, no documentados por fuente verificable.',
    parameterValidation: {
      scientificName: { status: 'documented', notes: 'Nombre científico registrado en el catálogo vigente.' },
      family: { status: 'documented', notes: 'Familia botánica incluida como dato de catálogo.' },
      phenology: { status: 'pending_verification', notes: 'Las etapas se conservan con valor heredado.' },
      durationDays: { status: 'pending_verification', notes: 'Duraciones heredadas del catálogo previo; sin respaldo documental específico.' },
      recommendedZones: { status: 'provisional', notes: 'No existe recomendación validada para camellones específicos.' },
      waterNeed: { status: 'provisional', notes: 'No hay referencia documental específica en este repositorio.' }
    },
    plantingWindow: {
      startMonth: 3,
      endMonth: 10,
      notes: 'Trasplante en fases de temperatura estable; ajustar según riesgo de helada.'
    },
    phenology: [
      { code: 'V0', name: 'Germinación', durationDays: 7, durationEvidenceStatus: 'pending_verification', description: 'Inicio de emergencia y establecimiento inicial.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'V1', name: 'Plántula', durationDays: 15, durationEvidenceStatus: 'pending_verification', description: 'Desarrollo de raíces y primer follaje.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'V2', name: 'Vegetativo', durationDays: 25, durationEvidenceStatus: 'pending_verification', description: 'Crecimiento activo de tallo y hojas.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'R1', name: 'Floración', durationDays: 20, durationEvidenceStatus: 'pending_verification', description: 'Formación de flores y primera fructificación.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'R2', name: 'Fructificación', durationDays: 30, durationEvidenceStatus: 'pending_verification', description: 'Engorde y maduración de frutos.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'R3', name: 'Cosecha', durationDays: 15, durationEvidenceStatus: 'pending_verification', description: 'Periodo final de producción y renovación.', notes: 'Duración heredada; sin respaldo documental específico.' }
    ],
    recommendedZones: [],
    legacyRecommendedZones: ['C1', 'C2', 'C3', 'C4', 'C5'],
    recommendedZonesStatus: 'provisional_legacy',
    recommendedBeds: null,
    compatibleWith: ['pimenton', 'lechuga', 'acelga'],
    irrigationConflictRisk: 'media',
    notes: 'Requiere soporte estructural, control de humedad y manejo de floración para evitar estrés térmico.',
    agronomicLimitations: ['Sensibilidad reproductiva al calor durante floración y fructificación.']
  },
  {
    id: 'pimenton',
    slug: 'pimenton',
    name: 'Pimentón',
    scientificName: 'Capsicum annuum',
    family: 'Solanaceae',
    category: 'fruit',
    categoryLabel: 'Hortaliza de fruto',
    waterNeed: 'media',
    source: 'INVERNIA: catálogo agronómico previo',
    sourceReferences: [
      createSourceReference('catalog', 'No existe evidencia documental específica para este perfil en el repositorio; se conserva como valor heredado y provisional.')
    ],
    validationStatus: 'preliminary',
    validationNotes: 'Perfil conservador orientado a etapas de establecimiento y fructificación.',
    parameterValidation: {
      scientificName: { status: 'documented', notes: 'Nombre científico registrado en el catálogo vigente.' },
      family: { status: 'documented', notes: 'Familia botánica incluida como dato de catálogo.' },
      phenology: { status: 'pending_verification', notes: 'Las etapas se conservan como heredadas.' },
      durationDays: { status: 'pending_verification', notes: 'Duraciones heredadas del catálogo previo; sin respaldo documental específico.' },
      recommendedZones: { status: 'provisional', notes: 'No existe recomendación validada para camellones específicos.' },
      waterNeed: { status: 'provisional', notes: 'No hay referencia documental específica en este repositorio.' }
    },
    plantingWindow: {
      startMonth: 3,
      endMonth: 9,
      notes: 'Necesita temperaturas estables para evitar caída floral.'
    },
    phenology: [
      { code: 'S1', name: 'Germinación', durationDays: 8, durationEvidenceStatus: 'pending_verification', description: 'Emergencia inicial y raíz primaria.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'S2', name: 'Plántula', durationDays: 18, durationEvidenceStatus: 'pending_verification', description: 'Desarrollo vegetativo temprano.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'S3', name: 'Vegetativo', durationDays: 25, durationEvidenceStatus: 'pending_verification', description: 'Expansión de follaje y raíz.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'F1', name: 'Floración', durationDays: 18, durationEvidenceStatus: 'pending_verification', description: 'Aparición y fijación de flores.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'F2', name: 'Fructificación', durationDays: 32, durationEvidenceStatus: 'pending_verification', description: 'Engorde de frutos y acumulación de biomasa.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'F3', name: 'Maduración', durationDays: 16, durationEvidenceStatus: 'pending_verification', description: 'Cosecha y ajuste de calidad.', notes: 'Duración heredada; sin respaldo documental específico.' }
    ],
    recommendedZones: [],
    legacyRecommendedZones: ['C2', 'C3', 'C4', 'C5'],
    recommendedZonesStatus: 'provisional_legacy',
    recommendedBeds: null,
    compatibleWith: ['tomate', 'lechuga', 'acelga'],
    irrigationConflictRisk: 'media',
    notes: 'Buena compatibilidad con cultivos de menor altura cuando se evita la competencia por humedad.',
    agronomicLimitations: ['Riesgos térmicos durante floración y cuajado.']
  },
  {
    id: 'locoto',
    slug: 'locoto',
    name: 'Locoto',
    scientificName: 'Capsicum pubescens',
    family: 'Solanaceae',
    category: 'fruit',
    categoryLabel: 'Hortaliza de fruto',
    waterNeed: 'media',
    source: 'INVERNIA: catálogo agronómico previo',
    sourceReferences: [
      createSourceReference('catalog', 'No existe evidencia documental específica para este perfil en el repositorio; se conserva como valor heredado y provisional.')
    ],
    validationStatus: 'preliminary',
    validationNotes: 'Se mantiene en un rango de desarrollo conservador por sensibilidad térmica.',
    parameterValidation: {
      scientificName: { status: 'documented', notes: 'Nombre científico registrado en el catálogo vigente.' },
      family: { status: 'documented', notes: 'Familia botánica incluida como dato de catálogo.' },
      phenology: { status: 'pending_verification', notes: 'Las etapas se conservan como heredadas.' },
      durationDays: { status: 'pending_verification', notes: 'Duraciones heredadas del catálogo previo; sin respaldo documental específico.' },
      recommendedZones: { status: 'provisional', notes: 'No existe recomendación validada para camellones específicos.' },
      waterNeed: { status: 'provisional', notes: 'No hay referencia documental específica en este repositorio.' }
    },
    plantingWindow: {
      startMonth: 2,
      endMonth: 9,
      notes: 'Ajustar a la temporada de clima cálido sin estrés frío extremo.'
    },
    phenology: [
      { code: 'L0', name: 'Emergencia', durationDays: 8, durationEvidenceStatus: 'pending_verification', description: 'Inicio de brotes.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'L1', name: 'Plántula', durationDays: 20, durationEvidenceStatus: 'pending_verification', description: 'Desarrollo inicial y soporte foliar.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'L2', name: 'Vegetativo', durationDays: 28, durationEvidenceStatus: 'pending_verification', description: 'Crecimiento de tallo y hojas.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'L3', name: 'Floración', durationDays: 18, durationEvidenceStatus: 'pending_verification', description: 'Inicio de flores y fijación.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'L4', name: 'Fructificación', durationDays: 28, durationEvidenceStatus: 'pending_verification', description: 'Formación y engorde de frutos.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'L5', name: 'Maduración', durationDays: 18, durationEvidenceStatus: 'pending_verification', description: 'Pérdida de estrés y cosecha.', notes: 'Duración heredada; sin respaldo documental específico.' }
    ],
    recommendedZones: [],
    legacyRecommendedZones: ['C3', 'C4', 'C5'],
    recommendedZonesStatus: 'provisional_legacy',
    recommendedBeds: null,
    compatibleWith: ['tomate', 'pimenton', 'espinaca'],
    irrigationConflictRisk: 'alta',
    notes: 'Sensibilidad moderada a temperatura y humedad; requiere seguimiento de flujo de riego compartido.',
    agronomicLimitations: ['Adaptación climática incierta en tierras bajas cálidas de Beni; la producción no debe presentarse como garantizada.']
  },
  {
    id: 'pepino',
    slug: 'pepino',
    name: 'Pepino',
    scientificName: 'Cucumis sativus',
    family: 'Cucurbitaceae',
    category: 'fruit',
    categoryLabel: 'Hortaliza de fruto',
    waterNeed: 'alta',
    source: 'INVERNIA: catálogo agronómico previo',
    sourceReferences: [
      createSourceReference('catalog', 'No existe evidencia documental específica para este perfil en el repositorio; se conserva como valor heredado y provisional.')
    ],
    validationStatus: 'preliminary',
    validationNotes: 'Perfil sensible a estrés hídrico y a riego compartido del sector.',
    parameterValidation: {
      scientificName: { status: 'documented', notes: 'Nombre científico registrado en el catálogo vigente.' },
      family: { status: 'documented', notes: 'Familia botánica incluida como dato de catálogo.' },
      phenology: { status: 'pending_verification', notes: 'Las etapas se conservan como heredadas.' },
      durationDays: { status: 'pending_verification', notes: 'Duraciones heredadas del catálogo previo; sin respaldo documental específico.' },
      recommendedZones: { status: 'provisional', notes: 'No existe recomendación validada para camellones específicos.' },
      waterNeed: { status: 'provisional', notes: 'No hay referencia documental específica en este repositorio.' }
    },
    plantingWindow: {
      startMonth: 3,
      endMonth: 10,
      notes: 'Muy dependiente de humedad uniforme y buen drenaje.'
    },
    phenology: [
      { code: 'P0', name: 'Emergencia', durationDays: 7, durationEvidenceStatus: 'pending_verification', description: 'Brotes iniciales y enraizamiento.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'P1', name: 'Plántula', durationDays: 12, durationEvidenceStatus: 'pending_verification', description: 'Fase de crecimiento y adaptación.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'P2', name: 'Vegetativo', durationDays: 22, durationEvidenceStatus: 'pending_verification', description: 'Ramificación y expansión foliar.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'P3', name: 'Floración', durationDays: 14, durationEvidenceStatus: 'pending_verification', description: 'Aparición de flores macho y hembra.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'P4', name: 'Fructificación', durationDays: 22, durationEvidenceStatus: 'pending_verification', description: 'Engorde y calidad del fruto.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'P5', name: 'Cosecha', durationDays: 18, durationEvidenceStatus: 'pending_verification', description: 'Producción continuada y retiro de frutos.', notes: 'Duración heredada; sin respaldo documental específico.' }
    ],
    recommendedZones: [],
    legacyRecommendedZones: ['C1', 'C2', 'C4'],
    recommendedZonesStatus: 'provisional_legacy',
    recommendedBeds: null,
    compatibleWith: ['lechuga', 'acelga'],
    irrigationConflictRisk: 'alta',
    notes: 'Debe evitarse el trasvase intensivo de riego compartido con cultivos de mayor demanda uniforme.',
    agronomicLimitations: ['Necesidades de manejo, humedad uniforme y tutorado.']
  },
  {
    id: 'lechuga',
    slug: 'lechuga',
    name: 'Lechuga',
    scientificName: 'Lactuca sativa',
    family: 'Asteraceae',
    category: 'leaf',
    categoryLabel: 'Hortaliza de hoja',
    waterNeed: 'alta',
    source: 'INVERNIA: catálogo agronómico previo',
    sourceReferences: [
      createSourceReference('catalog', 'No existe evidencia documental específica para este perfil en el repositorio; se conserva como valor heredado y provisional.')
    ],
    validationStatus: 'preliminary',
    validationNotes: 'Perfil de hoja con alta sensibilidad a humedad y temperatura.',
    parameterValidation: {
      scientificName: { status: 'documented', notes: 'Nombre científico registrado en el catálogo vigente.' },
      family: { status: 'documented', notes: 'Familia botánica incluida como dato de catálogo.' },
      phenology: { status: 'pending_verification', notes: 'Las etapas se conservan como heredadas.' },
      durationDays: { status: 'pending_verification', notes: 'Duraciones heredadas del catálogo previo; sin respaldo documental específico.' },
      recommendedZones: { status: 'provisional', notes: 'No existe recomendación validada para camellones específicos.' },
      waterNeed: { status: 'provisional', notes: 'No hay referencia documental específica en este repositorio.' }
    },
    plantingWindow: {
      startMonth: 2,
      endMonth: 11,
      notes: 'Fácil de ajustar en producción escalonada.'
    },
    phenology: [
      { code: 'CH1', name: 'Emergencia', durationDays: 5, durationEvidenceStatus: 'pending_verification', description: 'Inicio de desarrollo inicial.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'CH2', name: 'Roseta', durationDays: 14, durationEvidenceStatus: 'pending_verification', description: 'Formación de hoja base.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'CH3', name: 'Crecimiento vegetativo', durationDays: 20, durationEvidenceStatus: 'pending_verification', description: 'Expansión foliar y biomasa.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'CH4', name: 'Ajuste de hoja', durationDays: 10, durationEvidenceStatus: 'pending_verification', description: 'Encerado y compactación.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'CH5', name: 'Cosecha', durationDays: 12, durationEvidenceStatus: 'pending_verification', description: 'Cosecha comercial y renovación.', notes: 'Duración heredada; sin respaldo documental específico.' }
    ],
    recommendedZones: [],
    legacyRecommendedZones: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
    recommendedZonesStatus: 'provisional_legacy',
    recommendedBeds: null,
    compatibleWith: ['tomate', 'pimenton', 'acelga', 'espinaca'],
    irrigationConflictRisk: 'media',
    notes: 'Excelente alternativa para rotación con cultivos de fruto; requiere manejo cuidadoso de humedad para evitar marchitez.',
    agronomicLimitations: ['Riesgo de espigado con calor.']
  },
  {
    id: 'acelga',
    slug: 'acelga',
    name: 'Acelga',
    scientificName: 'Beta vulgaris, grupo Cicla',
    family: 'Amaranthaceae',
    category: 'leaf',
    categoryLabel: 'Hortaliza de hoja',
    waterNeed: 'media-alta',
    source: 'INVERNIA: catálogo agronómico previo',
    sourceReferences: [
      createSourceReference('catalog', 'No existe evidencia documental específica para este perfil en el repositorio; se conserva como valor heredado y provisional.')
    ],
    validationStatus: 'preliminary',
    validationNotes: 'Buen perfil para rotación y compatibilidad con prácticas de humedad controlada.',
    parameterValidation: {
      scientificName: { status: 'documented', notes: 'Nombre científico registrado en el catálogo vigente.' },
      family: { status: 'documented', notes: 'Familia botánica incluida como dato de catálogo.' },
      phenology: { status: 'pending_verification', notes: 'Las etapas se conservan como heredadas.' },
      durationDays: { status: 'pending_verification', notes: 'Duraciones heredadas del catálogo previo; sin respaldo documental específico.' },
      recommendedZones: { status: 'provisional', notes: 'No existe recomendación validada para camellones específicos.' },
      waterNeed: { status: 'provisional', notes: 'No hay referencia documental específica en este repositorio.' }
    },
    plantingWindow: {
      startMonth: 2,
      endMonth: 11,
      notes: 'Se adapta bien a estaciones templadas y a producción continua.'
    },
    phenology: [
      { code: 'A1', name: 'Emergencia', durationDays: 6, durationEvidenceStatus: 'pending_verification', description: 'Inicio del desarrollo radical y foliar.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'A2', name: 'Roseta', durationDays: 16, durationEvidenceStatus: 'pending_verification', description: 'Formación de hojas basales.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'A3', name: 'Vegetativo', durationDays: 24, durationEvidenceStatus: 'pending_verification', description: 'Crecimiento foliar activo.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'A4', name: 'Maturación', durationDays: 12, durationEvidenceStatus: 'pending_verification', description: 'Engrosamiento y calidad comercial.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'A5', name: 'Cosecha', durationDays: 14, durationEvidenceStatus: 'pending_verification', description: 'Recorte y producción repetida.', notes: 'Duración heredada; sin respaldo documental específico.' }
    ],
    recommendedZones: [],
    legacyRecommendedZones: ['C2', 'C3', 'C4', 'C5', 'C6'],
    recommendedZonesStatus: 'provisional_legacy',
    recommendedBeds: null,
    compatibleWith: ['tomate', 'pimenton', 'lechuga', 'espinaca'],
    irrigationConflictRisk: 'media',
    notes: 'Se recomienda para rotación o asociación con especies menos exigentes en altura.',
    agronomicLimitations: ['Posibilidad de cosechas sucesivas; no debe asumirse una recomendación de ubicación por camellón.']
  },
  {
    id: 'espinaca',
    slug: 'espinaca',
    name: 'Espinaca',
    scientificName: 'Spinacia oleracea',
    family: 'Amaranthaceae',
    category: 'leaf',
    categoryLabel: 'Hortaliza de hoja',
    waterNeed: 'alta',
    source: 'INVERNIA: catálogo agronómico previo',
    sourceReferences: [
      createSourceReference('catalog', 'No existe evidencia documental específica para este perfil en el repositorio; se conserva como valor heredado y provisional.')
    ],
    validationStatus: 'preliminary',
    validationNotes: 'Requiere control constante de humedad y temperatura para evitar amargamiento o marchitez.',
    parameterValidation: {
      scientificName: { status: 'documented', notes: 'Nombre científico registrado en el catálogo vigente.' },
      family: { status: 'documented', notes: 'Familia botánica incluida como dato de catálogo.' },
      phenology: { status: 'pending_verification', notes: 'Las etapas se conservan como heredadas.' },
      durationDays: { status: 'pending_verification', notes: 'Duraciones heredadas del catálogo previo; sin respaldo documental específico.' },
      recommendedZones: { status: 'provisional', notes: 'No existe recomendación validada para camellones específicos.' },
      waterNeed: { status: 'provisional', notes: 'No hay referencia documental específica en este repositorio.' }
    },
    plantingWindow: {
      startMonth: 2,
      endMonth: 10,
      notes: 'Se recomienda para ventanas frescas y producción regular.'
    },
    phenology: [
      { code: 'E1', name: 'Emergencia', durationDays: 5, durationEvidenceStatus: 'pending_verification', description: 'Brotes y establecimiento inicial.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'E2', name: 'Roseta', durationDays: 12, durationEvidenceStatus: 'pending_verification', description: 'Formación de hojas tempranas.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'E3', name: 'Vegetativo', durationDays: 18, durationEvidenceStatus: 'pending_verification', description: 'Crecimiento foliar activo.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'E4', name: 'Follaje comercial', durationDays: 14, durationEvidenceStatus: 'pending_verification', description: 'Hojas listas para cosecha.', notes: 'Duración heredada; sin respaldo documental específico.' },
      { code: 'E5', name: 'Cosecha', durationDays: 10, durationEvidenceStatus: 'pending_verification', description: 'Cosecha y sucesión de rebrotes.', notes: 'Duración heredada; sin respaldo documental específico.' }
    ],
    recommendedZones: [],
    legacyRecommendedZones: ['C3', 'C4', 'C5', 'C6'],
    recommendedZonesStatus: 'provisional_legacy',
    recommendedBeds: null,
    compatibleWith: ['locoto', 'lechuga', 'acelga'],
    irrigationConflictRisk: 'alta',
    notes: 'El manejo de humedad uniforme es crítico para mantener calidad y evitar estrés intenso.',
    agronomicLimitations: ['Alta sensibilidad al calor y riesgo de espigado.']
  }
];

const CROP_INDEX = new Map(CROP_PROFILE_CATALOG.map((crop) => [crop.slug, crop]));

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getCropCatalog() {
  return deepClone(CROP_PROFILE_CATALOG);
}

export function getCropBySlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  return deepClone(CROP_INDEX.get(normalized) || null);
}

export function getCropCategories() {
  return [
    { category: 'fruit', label: 'Hortalizas de fruto' },
    { category: 'leaf', label: 'Hortalizas de hoja' }
  ];
}

export function getCropCount() {
  return CROP_PROFILE_CATALOG.length;
}

export function estimateCropStage(cropSlug, options = {}) {
  const crop = getCropBySlug(cropSlug) || options.crop;
  if (!crop) {
    return {
      crop: null,
      stage: null,
      percentage: 0,
      daysElapsed: 0,
      stageDurationDays: 0,
      notes: 'Cultivo no encontrado.'
    };
  }

  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const plantDate = options.plantDate ? new Date(options.plantDate) : null;
  const transplantDate = options.transplantDate ? new Date(options.transplantDate) : null;
  const manualStageCode = options.manualStageCode || options.manualStage || null;

  let daysElapsed = 0;
  if (plantDate && !Number.isNaN(plantDate.getTime())) {
    daysElapsed = Math.max(0, Math.round((referenceDate.getTime() - plantDate.getTime()) / 86400000));
  } else if (transplantDate && !Number.isNaN(transplantDate.getTime())) {
    daysElapsed = Math.max(0, Math.round((referenceDate.getTime() - transplantDate.getTime()) / 86400000));
  }

  const totalDuration = crop.phenology.reduce((sum, stage) => sum + stage.durationDays, 0);
  if (manualStageCode) {
    const manualStage = crop.phenology.find((stage) => stage.code.toLowerCase() === String(manualStageCode).trim().toLowerCase());
    const stageEvidenceStatus = manualStage ? (manualStage.durationEvidenceStatus || 'provisional') : 'pending_verification';
    return {
      crop: crop.slug,
      stage: manualStage ? manualStage.name : 'Manual',
      stageCode: manualStage ? manualStage.code : manualStageCode,
      percentage: 50,
      daysElapsed,
      stageDurationDays: manualStage ? manualStage.durationDays : 0,
      stageEvidenceStatus,
      notes: manualStage
        ? `${manualStage.description} La duración utilizada es provisional y no tiene respaldo documental específico.`
        : 'Etapa manual aplicada sin coincidencia con el catálogo.'
    };
  }

  let cumulative = 0;
  let stage = crop.phenology[0];
  for (const currentStage of crop.phenology) {
    const nextCumulative = cumulative + currentStage.durationDays;
    if (daysElapsed <= nextCumulative) {
      stage = currentStage;
      break;
    }
    cumulative = nextCumulative;
    stage = currentStage;
  }

  const stageDuration = stage.durationDays || 1;
  const stageStart = cumulative;
  const localElapsed = Math.max(0, daysElapsed - stageStart);
  const percentage = Math.min(100, Math.max(0, (localElapsed / stageDuration) * 100));

  const stageEvidenceStatus = stage.durationEvidenceStatus || 'provisional';
  return {
    crop: crop.slug,
    stage: stage.name,
    stageCode: stage.code,
    percentage: Number(percentage.toFixed(1)),
    daysElapsed,
    totalDuration,
    stageDurationDays: stageDuration,
    stageStartDay: stageStart,
    stageEvidenceStatus,
    notes: stage.notes || stage.description
  };
}

export function buildCompatibilityRecommendations(assignments = []) {
  const normalizedAssignments = Array.isArray(assignments) ? assignments : [];
  const crops = normalizedAssignments
    .map((row) => {
      const technicalCrop = getCropBySlug(row.slug || row.crop || row.id);
      if (!technicalCrop) return null;
      return technicalCrop;
    })
    .filter(Boolean);

  return crops.map((crop) => ({
    crop: crop.name,
    category: crop.category,
    compatibleWith: crop.compatibleWith,
    risk: crop.irrigationConflictRisk,
    notes: crop.notes
  }));
}

export function calculateTemporalSpatialOccupancy(assignments = []) {
  const rows = Array.isArray(assignments) ? assignments : [];
  const occupiedBeds = new Set();
  const occupiedSegments = new Set();
  const totalOccupiedDays = rows.reduce((sum, row) => {
    const crop = getCropBySlug(row.slug || row.crop || row.id);
    const duration = crop ? crop.phenology.reduce((acc, stage) => acc + stage.durationDays, 0) : 0;
    if (row.bed) occupiedBeds.add(String(row.bed));
    if (row.segment) occupiedSegments.add(String(row.segment));
    return sum + Math.max(0, Number(row.days || duration || 0));
  }, 0);

  return {
    totalBeds: occupiedBeds.size,
    totalSegments: occupiedSegments.size,
    totalOccupiedDays,
    assignments: rows.map((row) => ({
      bed: row.bed || null,
      segment: row.segment || null,
      crop: row.slug || row.crop || row.id || null,
      days: Number(row.days || 0)
    }))
  };
}

export function detectSharedIrrigationConflicts(assignments = []) {
  const rows = Array.isArray(assignments) ? assignments : [];
  const conflicts = rows
    .map((row) => {
      const crop = getCropBySlug(row.slug || row.crop || row.id);
      if (!crop) return null;
      return {
        crop: crop.name,
        segment: row.segment || null,
        risk: crop.irrigationConflictRisk,
        message: crop.notes
      };
    })
    .filter((item) => item && (item.risk === 'alta' || item.risk === 'media'));

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}

export function createAgronomicPlan(payload = {}) {
  const crop = payload.crop ? getCropBySlug(payload.crop) : null;
  const referenceDate = payload.referenceDate ? new Date(payload.referenceDate) : new Date();
  const cropEstimate = estimateCropStage(crop ? crop.slug : null, {
    plantDate: payload.plantDate,
    transplantDate: payload.transplantDate,
    referenceDate,
    manualStageCode: payload.manualStageCode || payload.manualStage
  });

  return {
    crop: crop ? { ...crop } : null,
    cropEstimate,
    compatibility: buildCompatibilityRecommendations(payload.assignments || []),
    occupancy: calculateTemporalSpatialOccupancy(payload.assignments || []),
    irrigationConflicts: detectSharedIrrigationConflicts(payload.assignments || []),
    source: 'INVERNIA agronomic module',
    validationStatus: crop ? crop.validationStatus : 'unknown',
    evidenceSummary: {
      durationStatus: cropEstimate.stageEvidenceStatus || 'provisional',
      zoneRecommendationStatus: crop ? (crop.recommendedZonesStatus || 'provisional_legacy') : 'unknown',
      notes: crop
        ? 'La estimación fenológica se conserva como provisional; la recomendación por camellones no cuenta con respaldo documental validado.'
        : 'No disponible'
    }
  };
}

export { CROP_PROFILE_CATALOG };
