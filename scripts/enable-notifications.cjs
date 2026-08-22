const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = path.join(root, 'src/App.tsx');
if (!fs.existsSync(file)) {
  console.log('MKUU: App.tsx not found; skipping notifications patch.');
  process.exit(0);
}

let s = fs.readFileSync(file, 'utf8');

const importMarker = "import { clientGenerateFile } from './services/clientFileGenerator';";
const notificationImport = `${importMarker}\n\nconst initializeMkuuNotifications = async () => {\n  try {\n    const native = Boolean((window as any).Capacitor?.isNativePlatform?.());\n    if (native) {\n      const { LocalNotifications } = await import('@capacitor/local-notifications');\n      const permission = await LocalNotifications.checkPermissions();\n      if (permission.display !== 'granted') {\n        await LocalNotifications.requestPermissions();\n      }\n      return;\n    }\n    if ('Notification' in window && Notification.permission === 'default') {\n      await Notification.requestPermission();\n    }\n  } catch (error) {\n    console.warn('[MKUU] Notification initialization failed:', error);\n  }\n};\n\nconst notifyMkuuReplyReady = async (reply: string) => {\n  try {\n    // Do not interrupt the user while MKUU is already visible.\n    if (typeof document !== 'undefined' && !document.hidden) return;\n    const clean = reply\n      .replace(/https?:\\/\\/\\S+/g, ' ')\n      .replace(/[*_~#`>]+/g, ' ')\n      .replace(/\\s+/g, ' ')\n      .trim();\n    if (!clean) return;\n    const body = clean.length > 180 ? clean.slice(0, 177) + '...' : clean;\n    const native = Boolean((window as any).Capacitor?.isNativePlatform?.());\n    if (native) {\n      const { LocalNotifications } = await import('@capacitor/local-notifications');\n      const permission = await LocalNotifications.checkPermissions();\n      if (permission.display !== 'granted') return;\n      await LocalNotifications.schedule({\n        notifications: [{\n          id: Math.floor(Date.now() / 1000),\n          title: 'MKUU AI',\n          body,\n          schedule: { at: new Date(Date.now() + 250) },\n        }],\n      });\n      return;\n    }\n    if ('Notification' in window && Notification.permission === 'granted') {\n      new Notification('MKUU AI', { body });\n    }\n  } catch (error) {\n    console.warn('[MKUU] Notification delivery failed:', error);\n  }\n};`;

if (!s.includes('const initializeMkuuNotifications = async () =>')) {
  s = s.replace(importMarker, notificationImport);
}

const initAnchor = "  // Monitor network online / offline and interface transitions (Wi-Fi ↔ Mobile Data)\n";
if (!s.includes('initializeMkuuNotifications();')) {
  s = s.replace(initAnchor, "  useEffect(() => {\n    initializeMkuuNotifications();\n  }, []);\n\n" + initAnchor);
}

const responseAnchor = '      const refreshedConvs = await localChatStorage.getAllConversations();\n      setConversations(refreshedConvs);';
if (!s.includes('notifyMkuuReplyReady(chatResult.reply);')) {
  s = s.replace(responseAnchor, responseAnchor + "\n\n      await notifyMkuuReplyReady(chatResult.reply);");
}

fs.writeFileSync(file, s);
console.log('MKUU: Native/background reply notifications enabled.');
