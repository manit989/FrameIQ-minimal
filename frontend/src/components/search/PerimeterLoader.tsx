export function PerimeterLoader() {
  return (
    <>
      <style>{`
        @keyframes perimeter-trace {
          0% {
            stroke-dashoffset: 0;
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          88% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -100;
            opacity: 0;
          }
        }
        .animate-perimeter-loop {
          stroke-dasharray: 18 82;
          animation: perimeter-trace 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <svg className="absolute inset-0 h-full w-full pointer-events-none z-10 overflow-visible">
        <defs>
          <linearGradient id="luxury-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#ef4444" stopOpacity="1" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <rect
          x="0.6"
          y="0.6"
          width="calc(100% - 1.2px)"
          height="calc(100% - 1.2px)"
          rx="16"
          fill="none"
          stroke="url(#luxury-red)"
          strokeWidth="1.2"
          pathLength="100"
          className="animate-perimeter-loop"
        />
      </svg>
    </>
  )
}