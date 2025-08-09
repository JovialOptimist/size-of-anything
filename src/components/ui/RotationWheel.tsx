// src/components/ui/RotationWheel.tsx
/**
 * Interactive wheel control for rotating map elements.
 * Allows users to precisely adjust the rotation angle of shapes.
 */
import React, { useRef, useState, useEffect } from "react";

interface RotationWheelProps {
  rotationAngle: number;
  onChange: (angle: number) => void;
  size?: number;
}

const RotationWheel: React.FC<RotationWheelProps> = ({
  rotationAngle,
  onChange,
  size = 36,
}) => {
  const wheelRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartAngle, setDragStartAngle] = useState(0);
  const [startRotation, setStartRotation] = useState(0);

  // Calculate angle from center to point
  const calculateAngle = (
    center: { x: number; y: number },
    point: { x: number; y: number }
  ) => {
    return Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI);
  };

  // Normalize angle to 0-359 degrees
  const normalizeAngle = (angle: number) => {
    return ((angle % 360) + 360) % 360;
  };

  // Handle mouse down to start dragging
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!wheelRef.current) return;

    // Get wheel center and calculate starting angle
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = calculateAngle(
      { x: centerX, y: centerY },
      { x: e.clientX, y: e.clientY }
    );

    setDragStartAngle(startAngle);
    setStartRotation(rotationAngle);
    setIsDragging(true);

    e.preventDefault();
  };

  // Track the last reported angle to avoid frequent updates
  const lastReportedAngle = useRef(rotationAngle);

  // Handle mouse move during drag
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !wheelRef.current) return;

    // Calculate current angle and the difference from start
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currentAngle = calculateAngle(
      { x: centerX, y: centerY },
      { x: e.clientX, y: e.clientY }
    );

    // Calculate angle difference and apply to starting rotation
    // Invert the difference to match the shape rotation direction
    let angleDiff = dragStartAngle - currentAngle;
    let newRotation = normalizeAngle(startRotation + angleDiff);

    // Round to the nearest integer and only update if changed by at least 1 degree
    const roundedRotation = Math.round(newRotation);
    if (Math.abs(roundedRotation - lastReportedAngle.current) >= 1) {
      lastReportedAngle.current = roundedRotation;
      onChange(roundedRotation);
    }
  };

  // Handle mouse up to end dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle wheel event for scroll-based rotation
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    // Determine direction and increment (5 degrees per scroll step)
    // Invert the direction to match shape rotation
    const increment = e.deltaY > 0 ? -5 : 5;
    const newRotation = normalizeAngle(rotationAngle + increment);

    // Only update if we haven't reported this angle recently
    if (newRotation !== lastReportedAngle.current) {
      lastReportedAngle.current = newRotation;
      onChange(newRotation);
    }
  };

  // Add and remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStartAngle, startRotation]);

  // Update last reported angle when rotation angle prop changes
  useEffect(() => {
    lastReportedAngle.current = rotationAngle;
  }, [rotationAngle]);

  // Ensure we always work with normalized angles
  useEffect(() => {
    // If the rotation angle isn't normalized (0-359), normalize it
    const normalizedAngle = normalizeAngle(rotationAngle);
    if (normalizedAngle !== rotationAngle) {
      onChange(normalizedAngle);
    }
  }, [rotationAngle, onChange]);

  // Marks for the wheel (every 30 degrees)
  const tickMarks = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const innerRadius = size * 0.35;
    const outerRadius = size * 0.45;

    return (
      <line
        key={i}
        x1={size / 2 + innerRadius * Math.cos(angle)}
        y1={size / 2 + innerRadius * Math.sin(angle)}
        x2={size / 2 + outerRadius * Math.cos(angle)}
        y2={size / 2 + outerRadius * Math.sin(angle)}
        stroke="#888"
        strokeWidth={i % 3 === 0 ? 2 : 1}
      />
    );
  });

  // Indicator for current rotation
  // Add Math.PI to point to the opposite side for more intuitive visualization
  const indicatorAngle = (rotationAngle * Math.PI) / 180;
  const indicatorX =
    size / 2 - size * 0.38 * Math.cos(indicatorAngle - Math.PI / 2);
  const indicatorY =
    size / 2 + size * 0.38 * Math.sin(indicatorAngle - Math.PI / 2);

  return (
    <div className="rotation-wheel-container">
      <svg
        ref={wheelRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        className="rotation-wheel"
      >
        {/* Outer circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 1}
          fill="transparent"
          stroke="#aaa"
          strokeWidth="1"
        />

        {/* Tick marks */}
        {tickMarks}

        {/* Inner circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.2}
          fill="#4287f5"
          className="rotation-wheel-inner"
        />

        {/* Indicator */}
        <circle
          cx={indicatorX}
          cy={indicatorY}
          r={size * 0.08}
          fill="var(--default-fg)"
        />

        {/* Invisible overlay for better mouse interaction */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2}
          fill="transparent"
          className="rotation-wheel-overlay"
        />
      </svg>
    </div>
  );
};

export default RotationWheel;
