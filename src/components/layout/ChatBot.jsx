import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Sparkles, FileText, Radio, Maximize2, Minimize2 } from 'lucide-react';
import { useUi } from '../../store/ui';
import { useLive } from '../../store/live';
import { answer, SUGGESTIONS } from '../../ai/chat';
import { SiaThinking, SIA_DELAY_MS } from './SiaKpiModal';

function useTyped(text, active) {
  const [n, setN] = useState(active ? 0 : text.length);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setN((x) => { if (x >= text.length) { clearInterval(t); return x; } return x + 4; }), 12);
    return () => clearInterval(t);
  }, [text, active]);
  return active ? text.slice(0, n) : text;
}

function Rich({ text, typing }) {
  const shown = useTyped(text, typing);
  return shown.split('\n').map((line, i) => (
    <p key={i} className={i ? 'mt-1' : ''}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith('**') && part.endsWith('**') ? <strong key={j} className="font-semibold text-fg">{part.slice(2, -2)}</strong> : <span key={j}>{part}</span>))}
    </p>
  ));
}

export default function ChatBot() {
  const open = useUi((s) => s.chatOpen);
  const setOpen = useUi((s) => s.setChatOpen);
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: 'Hi, I’m **Sia**, the Astrikos AI assistant for Horizon Industrial Parks. I answer from the HIP knowledge base and live park telemetry. Pick a question below or ask your own.', sources: [] },
  ]);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, thinking, open]);

  const ask = (q) => {
    const question = q.trim();
    if (!question || thinking) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setThinking(true);
    setTimeout(() => {
      const { snapshot, advisories } = useLive.getState();
      const res = answer(question, snapshot, advisories);
      setMsgs((m) => [...m, { role: 'bot', text: res.text, sources: res.sources, at: res.at, fresh: true }]);
      setThinking(false);
    }, SIA_DELAY_MS);
  };

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-30 h-12 pl-4 pr-5 rounded-full bg-plum text-white shadow-pop flex items-center gap-2 font-semibold text-[13.5px] hover:brightness-110">
          <Sparkles size={18} /> Ask Sia
        </button>
      )}
      {open && (
        <div className={`fixed z-40 card shadow-pop flex flex-col overflow-hidden animate-fade-up transition-all ${expanded ? 'top-20 bottom-5 right-5 w-[min(980px,calc(100vw-2.5rem))]' : 'bottom-5 right-5 w-[min(580px,calc(100vw-2.5rem))] h-[min(800px,calc(100vh-5.5rem))]'}`}>
          <header className="px-5 py-3.5 bg-plum text-white flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center"><Sparkles size={18} /></span>
            <div className="flex-1 leading-tight">
              <div className="font-semibold text-[16px]">Sia</div>
              <div className="text-[11px] text-white/80 flex items-center gap-1"><Radio size={10} /> Astrikos AI · knowledge base + live telemetry</div>
            </div>
            <button type="button" onClick={() => setExpanded((v) => !v)} className="h-8 w-8 rounded-lg hover:bg-white/15 flex items-center justify-center" aria-label={expanded ? 'Restore size' : 'Expand'} title={expanded ? 'Restore' : 'Expand'}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
            <button type="button" onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg hover:bg-white/15 flex items-center justify-center" aria-label="Close chat"><X size={17} /></button>
          </header>
          <div className="flex-1 overflow-y-auto scroll-thin px-4 py-3 space-y-3 bg-bg">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${m.role === 'user' ? 'bg-plum text-white rounded-br-md' : 'bg-surface border border-plum/20 text-muted rounded-bl-md'}`}>
                  {m.role === 'user' ? m.text : <Rich text={m.text} typing={m.fresh && i === msgs.length - 1} />}
                  {m.sources?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-line flex flex-wrap gap-1.5">
                      {m.sources.map((s) => (
                        <button key={s.id} type="button" onClick={() => navigate(s.route)} className="chip bg-plum/10 text-plum hover:bg-plum/20">
                          {s.live ? <Radio size={10} /> : <FileText size={10} />}
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.at && <div className="text-[10px] text-faint mt-1">Sia · as of {m.at} IST</div>}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="rounded-2xl rounded-bl-md bg-surface border border-plum/20 px-3.5 py-3 w-[78%]">
                <SiaThinking />
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="px-3 pt-2.5 pb-1.5 bg-surface border-t border-line">
            <div className="label-xs mb-1.5 flex items-center gap-1 text-plum"><Sparkles size={10} />Suggested questions</div>
            <div className="flex flex-wrap gap-1.5 pb-1.5 max-h-[96px] overflow-y-auto scroll-thin">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" disabled={thinking} onClick={() => ask(s)} className="chip shrink-0 text-[12px] py-1 bg-plum/10 text-plum hover:bg-plum hover:text-white transition disabled:opacity-50">{s}</button>
              ))}
            </div>
          </div>
          <form className="p-3 pt-1 flex gap-2 bg-surface" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input className="input h-11 text-[14px] focus:border-plum focus:ring-plum/20" placeholder="Ask Sia about trucks, water, power, lights…" value={input} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" disabled={thinking} className="btn h-11 w-11 px-0 bg-plum text-white hover:brightness-110" aria-label="Send"><Send size={16} /></button>
          </form>
        </div>
      )}
    </>
  );
}
