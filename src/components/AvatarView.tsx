import React, { useState } from 'react';

interface AvatarViewProps {
  src?: string;
  alt: string;
  fallback: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  ring?: 'none' | 'unread' | 'viewed';
}

export const AvatarView: React.FC<AvatarViewProps> = ({
  src,
  alt,
  fallback,
  color = '#00A884',
  size = 'md',
  online,
  ring = 'none',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  }[size];

  const ringClasses = {
    none: '',
    unread: 'ring-2 ring-[#00A884] ring-offset-2 ring-offset-[#111B21]',
    viewed: 'ring-2 ring-[#8696A0]/50 ring-offset-2 ring-offset-[#111B21]',
  }[ring];

  return (
    <div className="relative inline-flex shrink-0 select-none">
      <div
        className={`${sizeClasses} ${ringClasses} rounded-full overflow-hidden flex items-center justify-center font-display font-semibold text-white`}
        style={{ backgroundColor: color }}
      >
        {src && !imgError ? (
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{fallback}</span>
        )}
      </div>
      {online && (
        <span
          title="Online"
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#111B21]"
        />
      )}
    </div>
  );
};
