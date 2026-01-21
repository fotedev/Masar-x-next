import React from 'react';
import { LatexRenderer } from './LatexRenderer';

interface MathDisplayProps {
  latex: string;
}

const MathDisplay: React.FC<MathDisplayProps> = ({ latex }) => {
  return <LatexRenderer text={latex} />;
};

export default MathDisplay;