import React from "react";
import appIcon from "../assets/images/appicon.png";

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 40 }) => {
  return (
    <div
      className={`relative flex items-center justify-center rounded-[22%] overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={appIcon}
        alt="Kingo Logo"
        className="w-full h-full object-cover"
      />
    </div>
  );
};
