import React, { useState } from "react";

/**
 * An <img> that disappears cleanly if its address stops working (for example a photo hosted by a third
 * party that was removed). The container's own background and caption stay, so the page never shows a
 * broken-image icon or stray alt text.
 */
export const SafeImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ onError, ...props }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      {...props}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
};
