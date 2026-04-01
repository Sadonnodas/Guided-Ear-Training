import React from 'react';
import './Tooltip.css';

interface TooltipProps {
  text: string;
}

const Tooltip: React.FC<TooltipProps> = ({ text }) => {
  if (!text) return null;

  return (
    <div className="tooltip-container">
      {text}
    </div>
  );
};

export default Tooltip;
