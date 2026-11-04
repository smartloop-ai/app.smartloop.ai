interface LogoProps {
  className?: string;
}

export default function Logo({ className }: LogoProps) {
  return (
    <a href="/" className={`flex items-center gap-0 ${className ?? ''}`}>
      <span className="text-lg font-bold text-content">smartloop</span>
      <span className="text-pink-500 text-lg font-bold">.</span>
    </a>
  );
}
