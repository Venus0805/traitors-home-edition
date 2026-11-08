import { useEffect, useRef } from 'react';

export default function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    let w = (c.width = window.innerWidth);
    let h = (c.height = window.innerHeight);
    const colors = ['#2dd4bf', '#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#ffffff'];
    const ps = Array.from({ length: 170 }, () => ({
      x: Math.random() * w, y: -Math.random() * h, r: 4 + Math.random() * 6,
      vx: -1 + Math.random() * 2, vy: 2 + Math.random() * 4, rot: Math.random() * 6,
      vr: -0.2 + Math.random() * 0.4, c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    const onResize = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50" />;
}
