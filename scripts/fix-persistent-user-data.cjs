const fs = require('fs');

function patch(path, marker, transform) {
  let text = fs.readFileSync(path, 'utf8');
  if (text.includes(marker)) {
    console.log(`[PERSISTENCE] ${path}: already patched`);
    return;
  }
  text = transform(text);
  fs.writeFileSync(path, text);
  console.log(`[PERSISTENCE] ${path}: patched`);
}

const storagePath = 'src/services/localChatStorage.ts';
patch(storagePath, 'mkuu_local_data_initialized_v3', (storage) => {
  storage = storage.replace(
    "  USER: 'mkuu_local_user_profile_v2',",
    "  USER: 'mkuu_local_user_profile_v2',\n  DATA_INITIALIZED: 'mkuu_local_data_initialized_v3',"
  );

  const seedStart = `    // Seed User Profile\n    if (!localStorage.getItem(LS_KEYS.USER)) {\n      saveToLocalStorage(LS_KEYS.USER, DEFAULT_USER);\n    }\n\n    // Seed Memories\n    const existingMems = await this.getMemories();\n    if (!existingMems || existingMems.length === 0) {\n      for (const m of DEFAULT_MEMORIES) {\n        await this.saveMemory(m);\n      }\n    }\n\n    // Seed People\n    const existingPeople = await this.getPeople();\n    if (!existingPeople || existingPeople.length === 0) {\n      for (const p of DEFAULT_PEOPLE) {\n        await this.savePerson(p);\n      }\n    }\n\n    // Seed AutoReply Settings\n    if (!localStorage.getItem(LS_KEYS.SETTINGS)) {\n      saveToLocalStorage(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);\n    }\n\n    // Seed default conversation if none exists\n    const convs = await this.getAllConversations();\n    if (convs.length === 0) {`;

  const seedReplacement = `    // Seed only once on a genuinely fresh installation.\n    // After the owner has used or deleted data, an empty collection is valid state\n    // and must never cause the original sample data to come back.\n    const initialized = localStorage.getItem(LS_KEYS.DATA_INITIALIZED) === '1';\n    if (!initialized) {\n      const hasLegacyState = [\n        LS_KEYS.CONVERSATIONS,\n        LS_KEYS.MEMORIES,\n        LS_KEYS.PEOPLE,\n        LS_KEYS.FILES,\n        LS_KEYS.SETTINGS,\n        LS_KEYS.USER,\n      ].some((key) => localStorage.getItem(key) !== null);\n\n      if (!hasLegacyState) {\n        saveToLocalStorage(LS_KEYS.USER, DEFAULT_USER);\n        for (const m of DEFAULT_MEMORIES) await this.saveMemory(m);\n        for (const p of DEFAULT_PEOPLE) await this.savePerson(p);\n        saveToLocalStorage(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);\n      } else if (!localStorage.getItem(LS_KEYS.USER)) {\n        saveToLocalStorage(LS_KEYS.USER, DEFAULT_USER);\n      }\n\n      localStorage.setItem(LS_KEYS.DATA_INITIALIZED, '1');\n    }\n\n    // Welcome conversation is created only on a genuinely fresh installation.\n    const convs = await this.getAllConversations();\n    if (convs.length === 0 && !localStorage.getItem(LS_KEYS.CONVERSATIONS)) {`;

  if (!storage.includes(seedStart)) throw new Error('[PERSISTENCE] localChatStorage init seed block not found');
  storage = storage.replace(seedStart, seedReplacement);

  // Once LocalStorage has been initialized, it is the authoritative copy. This prevents
  // a stale IndexedDB record from resurrecting something the owner deleted.
  storage = storage.replace(
    "          const localList = getFromLocalStorage<Conversation[]>(LS_KEYS.CONVERSATIONS, []);\n\n          const map = new Map<string, Conversation>();",
    "          const localList = getFromLocalStorage<Conversation[]>(LS_KEYS.CONVERSATIONS, []);\n          if (localStorage.getItem(LS_KEYS.CONVERSATIONS) !== null) {\n            resolve(localList.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));\n            return;\n          }\n\n          const map = new Map<string, Conversation>();"
  );

  storage = storage.replace('const localList = getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, DEFAULT_MEMORIES);', 'const localList = getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, []);');
  storage = storage.replace('resolve(combined.length > 0 ? combined : DEFAULT_MEMORIES);', 'resolve(combined);');
  storage = storage.replace('resolve(getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, DEFAULT_MEMORIES));', 'resolve(getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, []));');
  storage = storage.replace('return getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, DEFAULT_MEMORIES);', 'return getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, []);');
  storage = storage.replace(
    "          const localList = getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, []);\n\n          const map = new Map<string, Memory>();",
    "          const localList = getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, []);\n          if (localStorage.getItem(LS_KEYS.MEMORIES) !== null) {\n            resolve(localList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));\n            return;\n          }\n\n          const map = new Map<string, Memory>();"
  );

  storage = storage.replace('const localList = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, DEFAULT_PEOPLE);', 'const localList = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []);');
  storage = storage.replace('resolve(combined.length > 0 ? combined : DEFAULT_PEOPLE);', 'resolve(combined);');
  storage = storage.replace('resolve(getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, DEFAULT_PEOPLE));', 'resolve(getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []));');
  storage = storage.replace('return getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, DEFAULT_PEOPLE);', 'return getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []);');
  storage = storage.replace(
    "          const localList = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []);\n\n          const map = new Map<string, Person>();",
    "          const localList = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []);\n          if (localStorage.getItem(LS_KEYS.PEOPLE) !== null) {\n            resolve(localList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));\n            return;\n          }\n\n          const map = new Map<string, Person>();"
  );

  return storage;
});

const appPath = 'src/App.tsx';
patch(appPath, 'MKUU_PERSISTENCE_V3', (app) => {
  app = app.replace(
    "  const [memories, setMemories] = useState<Memory[]>([",
    "  // MKUU_PERSISTENCE_V3: local storage is the source of truth for owner data.\n  const [memories, setMemories] = useState<Memory[]>([]);\n  /* MKUU_PERSISTENCE_V3_SAMPLE_DISABLED\n  const [memories, setMemories] = useState<Memory[]>(["
  );

  const memoriesEnd = "  ]);\n  const [people, setPeople] = useState<Person[]>([";
  if (!app.includes(memoriesEnd)) throw new Error('[PERSISTENCE] App memories block end not found');
  app = app.replace(memoriesEnd, "  ]);\n  */\n  const [people, setPeople] = useState<Person[]>([]);\n  /* MKUU_PERSISTENCE_V3_SAMPLE_DISABLED\n  const [people, setPeople] = useState<Person[]>([");

  const peopleEnd = "  ]);\n  const [files, setFiles] = useState<GeneratedFileSummary[]>([]);";
  if (!app.includes(peopleEnd)) throw new Error('[PERSISTENCE] App people block end not found');
  app = app.replace(peopleEnd, "  ]);\n  */\n  const [files, setFiles] = useState<GeneratedFileSummary[]>([]);");

  app = app.replace("      if (localMems && localMems.length > 0) {\n        setMemories(localMems);\n      }", "      setMemories(localMems || []);");
  app = app.replace("      if (localPeople && localPeople.length > 0) {\n        setPeople(localPeople);\n      }", "      setPeople(localPeople || []);");

  const localInitAnchor = `      await localChatStorage.init();\n      \n      // Load local files`;
  const localInitReplacement = `      await localChatStorage.init();\n\n      // MKUU_PERSISTENCE_V3: restore owner-controlled settings/logs locally.\n      setAutoReplySettings(localChatStorage.getAutoReplySettings());\n      setAutoReplyLogs(localChatStorage.getAutoReplyLogs());\n      \n      // Load local files`;
  if (app.includes(localInitAnchor)) app = app.replace(localInitAnchor, localInitReplacement);

  app = app.replace(
    "      } else {\n        // Create initial default conversation",
    "      } else if (!localStorage.getItem('mkuu_local_data_initialized_v3')) {\n        // Create initial default conversation"
  );

  // The backend filesystem may be ephemeral. Never let its startup snapshot resurrect
  // deleted samples or overwrite the owner's latest local IndexedDB/LocalStorage state.
  const remoteBlockStart = "      // Memories\n      const memData = await fetchJson<Memory[]>('/api/memories');";
  const remoteBlockEnd = "      // Fetch conversations from server and merge into local DB";
  if (!app.includes(remoteBlockStart) || !app.includes(remoteBlockEnd)) {
    throw new Error('[PERSISTENCE] App remote user-data sync block not found');
  }
  const start = app.indexOf(remoteBlockStart);
  const end = app.indexOf(remoteBlockEnd);
  const remoteUserDataBlock = app.slice(start, end);
  const disabledUserDataBlock = `      // MKUU_PERSISTENCE_V3\n      // Local IndexedDB/LocalStorage is authoritative for owner data.\n      if (false) {\n${remoteUserDataBlock}\n      }\n\n`;
  app = app.slice(0, start) + disabledUserDataBlock + app.slice(end);

  const settingsAnchor = `  const handleUpdateAutoReplySettings = async (newSettings: Partial<AutoReplySettings>): Promise<void> => {\n    setAutoReplySettings((prev) => ({ ...prev, ...newSettings }));\n    try {`;
  const settingsReplacement = `  const handleUpdateAutoReplySettings = async (newSettings: Partial<AutoReplySettings>): Promise<void> => {\n    setAutoReplySettings((prev) => {\n      const next = { ...prev, ...newSettings };\n      localChatStorage.saveAutoReplySettings(next);\n      return next;\n    });\n    try {`;
  if (app.includes(settingsAnchor)) app = app.replace(settingsAnchor, settingsReplacement);

  const emergencyAnchor = `    setAutoReplySettings((prev) => ({ ...prev, emergencyStop: newState }));\n    try {`;
  const emergencyReplacement = `    setAutoReplySettings((prev) => {\n      const next = { ...prev, emergencyStop: newState };\n      localChatStorage.saveAutoReplySettings(next);\n      return next;\n    });\n    try {`;
  if (app.includes(emergencyAnchor)) app = app.replace(emergencyAnchor, emergencyReplacement);

  return app;
});

console.log('[PERSISTENCE] User data persistence hardening complete.');
