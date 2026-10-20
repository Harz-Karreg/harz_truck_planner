(function () {
  const namespace = "harz-karreg";
  const keys = {
    conducteurs: `${namespace}:conducteurs`,
    camions: `${namespace}:camions`,
    bennes: `${namespace}:bennes`,
    remorques: `${namespace}:remorques`,
    tournees: `${namespace}:tournees`,
    disponibilites: `${namespace}:disponibilites`,
    matieres: `${namespace}:matieres`,
    adresses: `${namespace}:adresses`,
    configuration: `${namespace}:configuration`
  };

  function weekDate(offset) {
    const now = new Date();
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1 + offset);
    return monday.toISOString().slice(0, 10);
  }

  const seed = {
    conducteurs: [
      {
        id: "drv-amine",
        nom: "Karreg",
        prenom: "Amine",
        telephone: "+33 6 12 48 90 22",
        permis: "CE",
        validite: "2028-10-14",
        statut: "Disponible",
        photo: ""
      },
      {
        id: "drv-sarah",
        nom: "Le Gall",
        prenom: "Sarah",
        telephone: "+33 6 77 31 05 18",
        permis: "CE",
        validite: "2027-05-03",
        statut: "En mission",
        photo: ""
      },
      {
        id: "drv-noah",
        nom: "Briand",
        prenom: "Noah",
        telephone: "+33 7 43 19 64 11",
        permis: "C",
        validite: "2029-02-21",
        statut: "En repos",
        photo: ""
      }
    ],
    camions: [
      {
        id: "trk-renault-t-01",
        marque: "Renault Trucks",
        modele: "T High",
        immatriculation: "HK-310-TR"
      },
      {
        id: "trk-scania-r-02",
        marque: "Scania",
        modele: "R 500",
        immatriculation: "HK-512-SC"
      }
    ],
    bennes: [
      {
        id: "bin-btp-01",
        nom: "Benne BTP Nord",
        statut: "Grande"
      },
      {
        id: "bin-ville-02",
        nom: "Benne urbaine",
        statut: "Petite"
      }
    ],
    remorques: [
      {
        id: "trl-benne-42",
        immatriculation: "HK-421-QA",
        type: "Benne",
        statut: "Disponible",
        photo: "",
        observations: "Bache neuve, controle pression OK."
      },
      {
        id: "trl-frigo-18",
        immatriculation: "HK-018-RF",
        type: "Frigo",
        statut: "Maintenance",
        photo: "",
        observations: "Revision groupe froid programmee."
      },
      {
        id: "trl-plateau-77",
        immatriculation: "HK-777-PL",
        type: "Plateau",
        statut: "Disponible",
        photo: "",
        observations: "Arrimage complet."
      }
    ],
    tournees: [
      {
        id: "run-brest-rennes",
        nom: "Brest - Rennes Express",
        depart: "Brest",
        arrivee: "Rennes",
        date: weekDate(0),
        heure: "07:30",
        conducteurId: "drv-amine",
        remorqueId: "trl-benne-42",
        camionId: "trk-renault-t-01",
        benneId: "bin-btp-01",
        description: "Materiaux BTP pour chantier nord.",
        statut: "Planifiee"
      },
      {
        id: "run-nantes-quimper",
        nom: "Nantes - Quimper Froid",
        depart: "Nantes",
        arrivee: "Quimper",
        date: weekDate(2),
        heure: "05:45",
        conducteurId: "drv-sarah",
        remorqueId: "trl-frigo-18",
        camionId: "trk-scania-r-02",
        benneId: "",
        description: "Livraison alimentaire sous temperature dirigee.",
        statut: "En cours"
      },
      {
        id: "run-lorient-vannes",
        nom: "Lorient - Vannes Plateau",
        depart: "Lorient",
        arrivee: "Vannes",
        date: weekDate(4),
        heure: "10:15",
        conducteurId: "drv-noah",
        remorqueId: "trl-plateau-77",
        camionId: "trk-renault-t-01",
        benneId: "bin-ville-02",
        description: "Materiel industriel.",
        statut: "Planifiee"
      }
    ],
    disponibilites: [],
    matieres: [
      { id: "mat-cuivre", code: "CU", nom: "Cuivre" },
      { id: "mat-laiton", code: "LAI", nom: "Laiton" },
      { id: "mat-aluminium", code: "ALU", nom: "Aluminium" }
    ],
    adresses: [
      { id: "adr-eurometal", nom: "Eurometal", adresse: "9 Boulevard Monge, 69330 Meyzieu", ordre: 0 }
    ],
    configuration: [
      { id: "general", logo: "", planningVerrouille: false, planningVue: "bennes", planningDuree: 15, planningEcrans: ["bennes", "semi", "porteurs"], verrouillageMotDePasse: "", verrouillageFond: "" }
    ]
  };

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function ensure(collection) {
    if (!keys[collection]) {
      throw new Error(`Collection inconnue: ${collection}`);
    }
  }

  function read(collection) {
    ensure(collection);
    const value = localStorage.getItem(keys[collection]);
    return value ? JSON.parse(value) : [];
  }

  function write(collection, data) {
    ensure(collection);
    localStorage.setItem(keys[collection], JSON.stringify(data));
    return data;
  }

  function save(collection, entity) {
    const next = { ...entity, id: entity.id || uid(collection.slice(0, 3)) };
    write(collection, [...read(collection), next]);
    return next;
  }

  function load(collection) {
    return read(collection);
  }

  function update(collection, id, patch) {
    const updated = read(collection).map((item) => (item.id === id ? { ...item, ...patch, id } : item));
    write(collection, updated);
    return updated.find((item) => item.id === id);
  }

  function remove(collection, id) {
    write(collection, read(collection).filter((item) => item.id !== id));
  }

  function getById(collection, id) {
    return read(collection).find((item) => item.id === id);
  }

  function seedIfEmpty() {
    Object.keys(keys).forEach((collection) => {
      if (localStorage.getItem(keys[collection]) === null) {
        write(collection, seed[collection]);
      }
    });
  }

  window.HKStorage = { getById, load, remove, save, seedIfEmpty, update };
})();
