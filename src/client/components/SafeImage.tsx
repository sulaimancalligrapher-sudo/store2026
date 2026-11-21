import React, { useState } from 'react';
import { Package } from 'lucide-react';

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
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
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
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={className}
        loading="lazy"
      />
    </div>
  );
};
