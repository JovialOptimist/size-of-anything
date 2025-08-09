// src/vite-env.d.ts
/**
 * Type declarations for Vite environment and module imports.
 * Provides TypeScript types for Vite-specific features and SVG imports.
 */
/// <reference types="vite/client" />

// Allow importing SVG files
declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}
