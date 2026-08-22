const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/App.tsx');
if (!fs.existsSync(file)) throw new Error('MKUU persistence patch: src/App.tsx not found.');
let s = fs.readFileSync(file, 'utf8');

const replacements = [
  [
`const userData = await fetchJson<any>('/api/me');
      if (userData) {
        setUser(userData.user || userData);
      }`,
`const userData = await fetchJson<any>('/api/me');
      const localUserRaw = typeof window !== 'undefined' ? localStorage.getItem('mkuu_local_user_profile_v2') : null;
      let localUser = null;
      try { localUser = localUserRaw ? JSON.parse(localUserRaw) : null; } catch { localUser = null; }
      if (localUser) {
        setUser(localUser);
        await apiFetch('/api/auth/profile', { method:'PUT', body:JSON.stringify(localUser) }).catch(() => undefined);
      } else if (userData) {
        setUser(userData.user || userData);
      }`
  ],
  [
`const memData = await fetchJson<Memory[]>('/api/memories');
      if (memData && Array.isArray(memData)) {
        setMemories(memData);
      }`,
`const memData = await fetchJson<Memory[]>('/api/memories');
      const localMems = await localChatStorage.getMemories();
      const remoteMems = Array.isArray(memData) ? memData : [];
      const remoteMemKeys = new Set(remoteMems.map((m) => m.content + '|' + m.category));
      for (const m of localMems) if (!remoteMemKeys.has(m.content + '|' + m.category)) {
        await apiFetch('/api/memories', { method:'POST', body:JSON.stringify({content:m.content,category:m.category,importance:m.importance,tags:m.tags,source:m.source}) }).catch(() => undefined);
      }
      setMemories([...localMems, ...remoteMems.filter((r) => !localMems.some((l) => l.id === r.id || (l.content === r.content && l.category === r.category)))]);`
  ],
  [
`const peopleData = await fetchJson<Person[]>('/api/people');
      if (peopleData && Array.isArray(peopleData)) {
        setPeople(peopleData);
      }`,
`const peopleData = await fetchJson<Person[]>('/api/people');
      const localPeople = await localChatStorage.getPeople();
      const remotePeople = Array.isArray(peopleData) ? peopleData : [];
      const personKey = (p) => (p.name || '').toLowerCase() + '|' + (p.phone || '');
      const remotePersonKeys = new Set(remotePeople.map(personKey));
      for (const p of localPeople) if (!remotePersonKeys.has(personKey(p))) {
        await apiFetch('/api/people', { method:'POST', body:JSON.stringify({name:p.name,nickname:p.nickname,relationship:p.relationship,phone:p.phone,email:p.email,notes:p.notes,avatarColor:p.avatarColor}) }).catch(() => undefined);
      }
      setPeople([...localPeople, ...remotePeople.filter((r) => !localPeople.some((l) => l.id === r.id || personKey(l) === personKey(r)))]);`
  ],
  [
`const settingsData = await fetchJson<AutoReplySettings>('/api/autoreply/settings');
      if (settingsData && settingsData.userId) {
        setAutoReplySettings(settingsData);
      }`,
`const settingsData = await fetchJson<AutoReplySettings>('/api/autoreply/settings');
      const localSettingsRaw = typeof window !== 'undefined' ? localStorage.getItem('mkuu_local_autoreply_settings_v2') : null;
      let localSettings = null;
      try { localSettings = localSettingsRaw ? JSON.parse(localSettingsRaw) : null; } catch { localSettings = null; }
      if (localSettings) {
        setAutoReplySettings(localSettings);
        await apiFetch('/api/autoreply/settings', { method:'PUT', body:JSON.stringify(localSettings) }).catch(() => undefined);
      } else if (settingsData && settingsData.userId) {
        setAutoReplySettings(settingsData);
      }`
  ]
];
for (const [oldText, newText] of replacements) {
  if (!s.includes(oldText)) throw new Error('MKUU persistence patch: expected App.tsx block not found.');
  s = s.replace(oldText, newText);
}
fs.writeFileSync(file, s);
console.log('MKUU: local + server persistence sync enabled; local data is never replaced by empty remote data.');
