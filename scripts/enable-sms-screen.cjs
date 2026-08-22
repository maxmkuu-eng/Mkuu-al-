const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patch = (file, transform) => {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) throw new Error(`MKUU SMS: ${file} not found.`);
  const source = fs.readFileSync(p, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(p, next);
};

patch('src/App.tsx', (source) => {
  let s = source;
  if (!s.includes("import { SmsCenter } from './components/SmsCenter';")) {
    s = s.replace("import { PeopleCenter } from './components/PeopleCenter';", "import { PeopleCenter } from './components/PeopleCenter';\nimport { SmsCenter } from './components/SmsCenter';");
  }
  if (!s.includes("activeTab === 'sms'")) {
    const marker = "        {activeTab === 'autoreply' && (";
    if (s.includes(marker)) {
      s = s.replace(marker, "        {activeTab === 'sms' && <SmsCenter />}\n\n" + marker);
    }
  }
  return s;
});

patch('src/components/Navigation.tsx', (source) => {
  let s = source;
  if (!s.includes("id:'sms' as ActiveTab")) {
    const marker = "{id:'people' as ActiveTab,label:'Watu wa Karibu',sub:'Max Identify',icon:Users,count:peopleCount},";
    const item = marker + "{id:'sms' as ActiveTab,label:'SMS',sub:'Tuma SMS kupitia SIM',icon:MessageSquare,badge:'DIRECT'},";
    if (!s.includes(marker)) throw new Error('MKUU SMS: navigation people marker not found.');
    s = s.replace(marker, item);
  }
  return s;
});

console.log('MKUU SMS: dedicated SMS screen enabled.');
