import { useUi } from '../store/ui';

export function HipLogo({ className = 'h-8' }) {
  const theme = useUi((s) => s.theme);
  return <img src={theme === 'dark' ? '/brand/Horizon_White.svg' : '/brand/Horizon_black.svg'} alt="Horizon Industrial Parks" className={`${className} w-auto block`} />;
}

export function AstrikosLogo({ className = 'h-7' }) {
  const theme = useUi((s) => s.theme);
  return <img src={theme === 'dark' ? '/brand/astrikos-dark.svg' : '/brand/astrikos-light.svg'} alt="Astrikos" className={`${className} w-auto block`} />;
}

export function PoweredBy({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[11px] text-faint whitespace-nowrap">Powered by</span>
      <AstrikosLogo className="h-6" />
    </div>
  );
}
