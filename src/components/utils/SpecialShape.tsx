import React, { useEffect, useState } from "react";
import SvgCard from "./SvgCard";
import { getSvgContent } from "./assetUtils";

interface SpecialShapeProps {
  svgUrl: string;
  name: string;
  description: string;
  widthInMeters?: number;
  heightInMeters?: number;
}

/**
 * A component that loads SVG content and displays it as a card
 * This simplifies the process of adding SVG-based shapes to the Special Panel
 */
const SpecialShape: React.FC<SpecialShapeProps> = ({
  svgUrl,
  name,
  description,
  widthInMeters,
  heightInMeters,
}) => {
  const [svgContent, setSvgContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load the SVG content when the component mounts
  useEffect(() => {
    setIsLoading(true);
    getSvgContent(svgUrl)
      .then((content) => {
        setSvgContent(content);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load SVG:", err);
        setError("Failed to load shape");
        setIsLoading(false);
      });
  }, [svgUrl]);

  if (isLoading) {
    return <div className="loading-card">Loading {name}...</div>;
  }

  if (error || !svgContent) {
    return <div className="error-card">{error || "Failed to load shape"}</div>;
  }

  return (
    <SvgCard
      svgUrl={svgUrl}
      svgContent={svgContent}
      name={name}
      description={description}
      widthInMeters={widthInMeters}
      heightInMeters={heightInMeters}
    />
  );
};

export default SpecialShape;
