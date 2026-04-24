// src/data/techStack.ts
export interface TechItem {
  name: string;
  icon: string;
  color: string;
  level: number;
  useText?: boolean;
  iconText?: string;
}

export const frontendTech: TechItem[] = [
  {
    name: "HTML / CSS",
    icon: "simple-icons:html5",
    color: "oklch(0.7 0.2 30)",
    level: 2,
  },
  {
    name: "SCSS",
    icon: "simple-icons:sass",
    color: "oklch(0.7 0.2 330)",
    level: 2,
  },
  {
    name: "JavaScript",
    icon: "simple-icons:javascript",
    color: "oklch(0.8 0.2 80)",
    level: 3,
  },
  {
    name: "TypeScript",
    icon: "simple-icons:typescript",
    color: "oklch(0.6 0.2 250)",
    level: 1,
  },
  {
    name: "Vue.js",
    icon: "simple-icons:vuedotjs",
    color: "oklch(0.65 0.2 150)",
    level: 3,
  },
  {
    name: "前端工程化",
    icon: "simple-icons:vite",
    color: "oklch(0.7 0.2 250)",
    level: 2,
  },
];

export const gisTech: TechItem[] = [
  {
    name: "GIS 基础",
    icon: "lucide:globe",
    color: "oklch(0.6 0.2 160)",
    level: 3,
  },
  {
    name: "OGC 标准协议",
    icon: "lucide:file-cog",
    color: "oklch(0.6 0.2 260)",
    level: 4,
  },
  {
    name: "空间分析",
    icon: "lucide:scan",
    color: "oklch(0.65 0.2 180)",
    level: 3,
  },
  {
    name: "现代数据规范(3dtiles)",
    icon: "lucide:box",
    color: "oklch(0.7 0.15 60)",
    level: 2,
  },
  {
    name: "遥感基础",
    icon: "lucide:satellite",
    color: "oklch(0.5 0.2 250)",
    level: 1,
  },
  {
    name: "QGIS/ArcGIS",
    icon: "lucide:map-pinned",
    color: "oklch(0.6 0.2 260)",
    level: 3,
  },
  {
    name: "服务器GIS(geoserver）",
    icon: "lucide:server",
    color: "oklch(0.6 0.15 160)",
    level: 3,
  },
  {
    name: "空间数据库(PostgreSQL/PostGIS)",
    icon: "simple-icons:postgresql",
    color: "oklch(0.6 0.2 240)",
    level: 3,
  },
];

export const frontendLibs: TechItem[] = [
  {
    name: "Axios",
    icon: "simple-icons:axios",
    color: "oklch(0.6 0.2 250)",
    level: 3,
  },
  {
    name: "Element Plus / Vant",
    icon: "lucide:layout-grid",
    color: "oklch(0.6 0.2 30)",
    level: 2,
  },
  {
    name: "ECharts",
    icon: "simple-icons:apacheecharts",
    color: "oklch(0.7 0.2 280)",
    level: 2,
  },
  {
    name: "Astro",
    icon: "simple-icons:astro",
    color: "oklch(0.6 0.2 280)",
    level: 2,
  },
];

export const gisLibs: TechItem[] = [
  {
    name: "OpenLayers",
    icon: "simple-icons:openlayers",
    color: "oklch(0.6 0.2 200)",
    level: 4,
  },
  {
    name: "Cesium",
    icon: "simple-icons:cesium",
    color: "oklch(0.7 0.15 60)",
    level: 2,
  },
  {
    name: "Turf.js",
    icon: "lucide:pentagon",
    color: "oklch(0.6 0.15 120)",
    level: 2,
  },
  {
    name: "ArcGIS API / 超图",
    icon: "simple-icons:esri",
    color: "oklch(0.5 0.2 260)",
    level: 1,
  },
];

export const others: TechItem[] = [
  {
    name: "服务器部署",
    icon: "lucide:cloud",
    color: "oklch(0.6 0.2 220)",
    level: 3,
  },
  {
    name: "cc/cursor/trae",
    icon: "lucide:bot",
    color: "oklch(0.7 0.2 30)",
    level: 3,
  },
  {
    name: "node.js/py",
    icon: "simple-icons:nodedotjs",
    color: "oklch(0.7 0.2 140)",
    level: 2,
  },
  {
    name: "Docker",
    icon: "simple-icons:docker",
    color: "oklch(0.6 0.2 220)",
    level: 2,
  },
  {
    name: "Nginx",
    icon: "simple-icons:nginx",
    color: "oklch(0.6 0.2 180)",
    level: 2,
  },
  {
    name: "Git",
    icon: "simple-icons:git",
    color: "oklch(0.7 0.2 30)",
    level: 2,
  },
];
