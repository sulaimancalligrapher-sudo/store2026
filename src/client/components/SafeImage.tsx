import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { getImageCandidates } from '../../shared/imageUrl.ts';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  aspectClass?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = 'h-full w-full object-cover',
  aspectClass = 'aspect-[4/3]',
}) => {
  const candidates = useMemo(() => getImageCandidates(src), [src]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [src]);

  const activeSrc = candidates[attempt];

  if (!activeSrc) {
    return (
      <div
        className={`${aspectClass} flex flex-col items-center justify-center bg-[#EFECE6] text-[#8A847B] p-4 text-center`}
      >
        <Package className="h-8 w-8 mb-2 opacity-60" />
        <span className="text-xs font-medium line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`${aspectClass} overflow-hidden bg-[#EFECE6]`}>
      <img
        src={activeSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setAttempt((prev) => prev + 1)}
        className={className}
        loading="lazy"
      />
    </div>
  );
};
