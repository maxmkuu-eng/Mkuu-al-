import React,{useState} from 'react';
import App from './App';
import AssistantManager from './components/AssistantManager';
import { LayoutDashboard, X } from 'lucide-react';

export const MkuuRoot:React.FC=()=>{
 const [open,setOpen]=useState(false);
 return <><App/><button aria-label="Fungua Assistant Manager" title="Assistant Manager" onClick={()=>setOpen(true)} className="fixed right-4 bottom-20 z-[80] w-12 h-12 rounded-full bg-[#D4AF37] text-black shadow-2xl flex items-center justify-center"> <LayoutDashboard className="w-5 h-5"/></button>{open&&<div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm p-2 md:p-5"><div className="h-full rounded-2xl overflow-hidden border border-[#D4AF37]/30 bg-[#07090e] relative"><button aria-label="Funga Assistant Manager" onClick={()=>setOpen(false)} className="absolute right-3 top-3 z-[100] p-2 rounded-lg bg-black/70 text-white border border-white/10"><X className="w-5 h-5"/></button><AssistantManager/></div></div>}</>;
};
export default MkuuRoot;
