declare module "vite-plugin-cesium" {
  import type { Plugin } from "vite";
  const cesium: () => Plugin;
  export default cesium;
}
