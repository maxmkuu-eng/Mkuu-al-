const fs = require('fs');
const path = require('path');

const root = process.cwd();
const asset = path.join(root, 'src', 'assets', 'mkuu-ai-logo.jpg');
if (fs.existsSync(asset)) {
  const raw = fs.readFileSync(asset);
  if (raw.subarray(0, 3).toString() !== '\xff\xd8\xff') {
    const text = raw.toString('utf8').trim();
    if (text.startsWith('/9j/')) fs.writeFileSync(asset, Buffer.from(text, 'base64'));
  }
}
if (!fs.existsSync(asset)) throw new Error('MKUU AI logo asset missing');
const logo = fs.readFileSync(asset);
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'mkuu-ai-logo.jpg'), logo);
function patch(file, replacements) {
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) throw new Error(`Branding patch target missing in ${path.relative(root, file)}: ${from.slice(0, 120)}`);
    source = source.replace(from, to);
  }
  fs.writeFileSync(file, source);
}
const chat = path.join(root, 'src/components/ChatView.tsx');
patch(chat, [
  ["import { getApiUrl } from '../services/apiConfig';", "import { getApiUrl } from '../services/apiConfig';\nimport mkuuLogo from '../assets/mkuu-ai-logo.jpg';"],
  ['<div className="flex items-center text-xs uppercase tracking-widest text-[#888888] flex-shrink-0"><span className={`status-dot', '<img src={mkuuLogo} alt="MKUU AI" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain bg-black border border-[#D4AF37]/40 shadow-lg mr-2 flex-shrink-0" /><div className="flex items-center text-xs uppercase tracking-widest text-[#888888] flex-shrink-0"><span className={`status-dot'],
  ['<div className="w-14 sm:w-16 h-14 sm:h-16 rounded-2xl glass border border-[#222222] flex items-center justify-center text-[#D4AF37] mb-4 shadow-2xl"><Crown className="w-7 sm:w-8 h-7 sm:h-8 stroke-[1.5]" /></div>', '<img src={mkuuLogo} alt="MKUU AI" className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-contain bg-black border border-[#D4AF37]/40 mb-4 shadow-2xl" />']
]);
const nav = path.join(root, 'src/components/Navigation.tsx');
patch(nav, [
  ["import { ActiveTab, UserProfile } from '../types';", "import { ActiveTab, UserProfile } from '../types';\nimport mkuuLogo from '../assets/mkuu-ai-logo.jpg';"],
  ['<div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center text-black font-bold"><Crown className="w-4 h-4"/></div>', '<img src={mkuuLogo} alt="MKUU AI" className="w-9 h-9 rounded-xl object-contain bg-black border border-[#D4AF37]/40 shadow-lg" />'],
  ['<div><h1 className="serif text-2xl font-bold tracking-widest text-[#D4AF37]">MKUU AI</h1><p className="text-[10px] uppercase tracking-[0.2em] text-[#888888] mt-0.5">Premium Assistant</p></div>', '<div className="flex items-center gap-3"><img src={mkuuLogo} alt="MKUU AI" className="w-12 h-12 rounded-2xl object-contain bg-black border border-[#D4AF37]/40 shadow-lg" /><div><h1 className="serif text-2xl font-bold tracking-widest text-[#D4AF37]">MKUU AI</h1><p className="text-[10px] uppercase tracking-[0.2em] text-[#888888] mt-0.5">Premium Assistant</p></div></div>'],
  ['<span className="font-mono text-[#888888]">v2.5</span></div></div></nav></>};', '<span className="font-mono text-[#888888]">v2.5</span></div><div className="mt-2.5 rounded-xl border border-[#222222] bg-white/[0.02] p-2.5 flex items-center gap-2.5"><img src={mkuuLogo} alt="MKUU AI" className="w-9 h-9 rounded-lg object-contain bg-black border border-[#D4AF37]/30" /><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Kuhusu MKUU AI</div><div className="text-[9px] text-[#888888]">Think • Search • Create • Solve</div></div></div></div></nav></>};']
]);
const manifest = path.join(root, 'android/app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifest)) {
  let s = fs.readFileSync(manifest, 'utf8');
  s = s.replace(/android:icon="@mipmap\/ic_launcher"/g, 'android:icon="@drawable/mkuu_ai_logo"');
  s = s.replace(/android:roundIcon="@mipmap\/ic_launcher_round"/g, 'android:roundIcon="@drawable/mkuu_ai_logo"');
  fs.writeFileSync(manifest, s);
}
const styles = path.join(root, 'android/app/src/main/res/values/styles.xml');
if (fs.existsSync(styles)) {
  let s = fs.readFileSync(styles, 'utf8');
  const marker = '<item name="windowSplashScreenAnimatedIcon">@drawable/mkuu_ai_logo</item>';
  if (!s.includes(marker)) {
    s = s.replace('<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">', '<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">\n        <item name="windowSplashScreenBackground">#000000</item>\n        <item name="windowSplashScreenAnimatedIcon">@drawable/mkuu_ai_logo</item>');
    fs.writeFileSync(styles, s);
  }
}
const drawable = path.join(root, 'android/app/src/main/res/drawable');
fs.mkdirSync(drawable, { recursive: true });
fs.writeFileSync(path.join(drawable, 'mkuu_ai_logo.jpg'), logo);
console.log('[BRANDING] MKUU AI logo applied to app icon, splash, header, home and About section.');
