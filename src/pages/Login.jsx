import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Sun, Moon, ArrowRight, ShieldCheck } from 'lucide-react';
import { useUi } from '../store/ui';
import { HipLogo, AstrikosLogo, PoweredBy } from '../components/Brand';
import { PORTFOLIO_FACTS } from '../config/parks';

function Field({ icon: Icon, trailing, children }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"><Icon size={16} /></span>
      {children}
      {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  );
}

const SLIDES = [
  { src: '/hip/malur-aerial.jpg', caption: 'Horizon Industrial Park, Malur · Bengaluru' },
  { src: '/hip/malur-trucks-road.webp', caption: 'HIP Malur · internal truck route' },
  { src: '/hip/malur-docks.webp', caption: 'HIP Malur · dock apron & truck court' },
  { src: '/hip/malur-gate-road.webp', caption: 'HIP Malur · gate road' },
  { src: '/hip/malur-solar-warehouse.webp', caption: 'HIP Malur · IGBC Platinum warehousing' },
];

/** Real Horizon Industrial Parks photography, cross-fading with a slow Ken Burns. */
function HeroSlides() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 6500); return () => clearInterval(t); }, []);
  return (
    <>
      {SLIDES.map((sl, k) => (
        <div key={sl.src} className={`hero-slide absolute inset-0 ${k === i ? 'is-on opacity-100' : 'opacity-0'}`}>
          <img src={sl.src} alt={sl.caption} className="h-full w-full object-cover" />
        </div>
      ))}
      <div className="absolute bottom-6 right-8 z-20 flex items-center gap-3">
        <span className="text-[11.5px] text-white/85 bg-black/35 backdrop-blur px-2.5 py-1 rounded-full">{SLIDES[i].caption}</span>
        <span className="flex gap-1.5">{SLIDES.map((sl, k) => <button key={sl.src} type="button" aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />)}</span>
      </div>
    </>
  );
}

/** Logo lock-up on a white card (always the dark-ink logos). */
function LogoCard() {
  return (
    <div className="inline-flex items-center gap-4 rounded-2xl bg-white px-6 py-4 shadow-pop">
      <img src="/brand/Horizon_black.svg" alt="Horizon Industrial Parks" className="h-9 w-auto" />
      <span className="h-9 w-px bg-black/15" />
      <img src="/brand/astrikos-light.svg" alt="Astrikos" className="h-9 w-auto" />
    </div>
  );
}

export default function Login() {
  const login = useUi((s) => s.login);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setErr('');
    if (!username.trim()) return setErr('Enter your username');
    if (!password) return setErr('Enter your password');
    setBusy(true);
    setTimeout(() => {
      if (login(username, password)) navigate('/portfolio', { replace: true });
      else { setErr('Invalid username or password'); setBusy(false); }
    }, 500);
  };

  return (
    <div className="min-h-full w-full flex bg-bg">
      {/* 60% — imagery */}
      <section className="relative hidden lg:flex lg:w-[60%] overflow-hidden">
        <HeroSlides />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,10,12,.35) 0%, rgba(10,10,12,.15) 35%, rgba(10,10,12,.78) 100%)' }} />
        <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ background: 'linear-gradient(110deg, #8F53A1 0%, transparent 45%)' }} />
        <div className="relative z-10 flex flex-col justify-between w-full p-12">
          <div><LogoCard /></div>
          <div className="max-w-[640px]">
            <div className="text-[13px] font-bold tracking-[0.28em] text-[#F7A35C] uppercase">Horizon Industrial Parks</div>
            <h1 className="mt-3 text-[46px] leading-[1.05] font-semibold text-white tracking-tight">Facility Management<br />Command Center</h1>
            <p className="mt-4 text-[16px] text-white/80 max-w-[520px]">Executive digital twins and live facility intelligence across India’s largest Grade-A industrial & logistics network.</p>
            <div className="mt-7 flex gap-8 text-white">
              {[[PORTFOLIO_FACTS.ilpCount, 'I&L parks'], [PORTFOLIO_FACTS.incityCount, 'InCity centers'], [`${PORTFOLIO_FACTS.ilpPotentialMsf}`, 'MN sq ft potential']].map(([v, l]) => (
                <div key={l}><div className="text-[26px] font-semibold num">{v}</div><div className="text-[12px] text-white/70">{l}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 40% — sign in */}
      <section className="relative w-full lg:w-[40%] flex flex-col bg-surface">
        <div className="flex items-center justify-between px-6 sm:px-10 h-20">
          <div className="flex items-center gap-3 lg:invisible">
            <HipLogo className="h-7" />
            <span className="h-7 w-px bg-line-strong" />
            <AstrikosLogo className="h-7" />
          </div>
          <button type="button" onClick={toggleTheme} className="icon-btn border border-line bg-surface" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-16">
          <div className="w-full max-w-[400px]">
            <h2 className="text-[30px] font-semibold tracking-tight">Sign in</h2>
            <p className="text-[14.5px] text-muted mt-1.5">Access the Facility Management Command Center.</p>
            <div className="h-1 w-14 grad-bg rounded-full mt-4 mb-8" />

            <form onSubmit={submit} autoComplete="off" className="space-y-5">
              <div>
                <label className="label-xs block mb-1.5" htmlFor="u">Username</label>
                <Field icon={User}>
                  <input id="u" className="input h-12 pl-10" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
                </Field>
              </div>
              <div>
                <label className="label-xs block mb-1.5" htmlFor="p">Password</label>
                <Field icon={Lock} trailing={(
                  <button type="button" onClick={() => setShow((v) => !v)} className="h-8 w-8 rounded-md flex items-center justify-center text-faint hover:text-fg" aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}>
                  <input id="p" type={show ? 'text' : 'password'} className="input h-12 pl-10 pr-11" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </Field>
              </div>
              {err && <div className="text-[12.5px] font-semibold text-crit">{err}</div>}
              <button type="submit" disabled={busy} className="btn-primary w-full h-12 text-[15px]">
                {busy ? 'Signing in…' : (<>Sign in <ArrowRight size={16} /></>)}
              </button>
            </form>

            <p className="flex items-center gap-1.5 text-[12px] text-faint mt-6"><ShieldCheck size={13} />Authorised Horizon Industrial Parks personnel only</p>
          </div>
        </div>

        <div className="border-t border-line px-6 sm:px-10 py-4 flex justify-center">
          <PoweredBy />
        </div>
      </section>
    </div>
  );
}
