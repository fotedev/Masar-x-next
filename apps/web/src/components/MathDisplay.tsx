import { type FC } from "react";
import { LatexRenderer } from './LatexRenderer';

interface MathDisplayProps {
  latex: string;
}

const MathDisplay: FC<MathDisplayProps> = ({ latex }) => {
  return <LatexRenderer text={latex} />;
};

export default MathDisplay;