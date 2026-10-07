export interface TechItem {
  name: string;
  icon: string;
  color: string;
  level: number;
  useText?: boolean;
  iconText?: string;
}

function tech(
  name: string,
  icon: string,
  level: number,
  color = "oklch(0.65 0.2 250)",
): TechItem {
  return { name, icon, color, level };
}

export const frontendTech: TechItem[] = [
  tech("HTML / CSS", "simple-icons:html5", 4, "oklch(0.7 0.2 30)"),
  tech("JavaScript", "simple-icons:javascript", 4, "oklch(0.8 0.2 80)"),
  tech("TypeScript", "simple-icons:typescript", 4),
  tech("Less / Sass", "simple-icons:sass", 3, "oklch(0.7 0.2 330)"),
  tech("原子化 CSS", "lucide:layout", 3),
  tech("Flex / Grid 与移动端适配", "lucide:layout", 3),
  tech("HTTP / Web API", "lucide:code-2", 3),
  tech("WebSocket / SSE", "lucide:code-2", 3),
];

export const frontendLibs: TechItem[] = [
  tech("Vue2/3", "simple-icons:vuedotjs", 4, "oklch(0.65 0.2 150)"),
  tech("React 19", "simple-icons:react", 2),
  tech("Vue Router", "lucide:boxes", 4),
  tech("Pinia", "lucide:boxes", 4),
  tech("Axios", "simple-icons:axios", 4),
  tech("Element Plus", "lucide:layout", 4),
  tech("Vant", "lucide:layout", 2),
  tech("Uniapp", "lucide:layout", 3),
  tech("Astro", "simple-icons:astro", 2),
];

export const visualizationTech: TechItem[] = [
  tech("ECharts", "simple-icons:apacheecharts", 3, "oklch(0.7 0.2 280)"),
  tech("AntV", "lucide:scan", 3),
  tech("可视化大屏与图表联动", "lucide:layout", 3),
  tech("three.js", "lucide:box", 3),
  tech("WebGL", "lucide:box", 2),
];

export const gisTech: TechItem[] = [
  tech("GIS 基础", "lucide:globe", 3, "oklch(0.6 0.2 160)"),
  tech("OGC 标准协议", "lucide:file-cog", 4),
  tech("空间分析", "lucide:scan", 3),
  tech("OpenLayers", "simple-icons:openlayers", 4, "oklch(0.6 0.2 200)"),
  tech("Cesium", "simple-icons:cesium", 3, "oklch(0.7 0.15 60)"),
  tech("Turf.js", "lucide:scan", 3),
  tech("GeoScene Maps SDK", "simple-icons:esri", 3),
  tech("SuperMap iClient", "lucide:map-pinned", 3),
  tech("3D Tiles", "lucide:box", 2),
  tech("GeoJSON / GML / WKT", "lucide:file-cog", 3),
  tech("坐标系与投影转换", "lucide:globe", 3),
  tech("QGIS / ArcGIS Pro", "lucide:map-pinned", 4),
  tech("GeoServer", "lucide:server", 3),
  tech("GeoScene Enterprise / Pro", "lucide:server", 3),
  tech("SuperMap iServer", "lucide:server", 3),
  tech("PostGIS 空间 SQL", "simple-icons:postgresql", 3),
  tech("遥感基础", "lucide:satellite", 1),
];

export const engineeringTech: TechItem[] = [
  tech("Vite", "simple-icons:vite", 4),
  tech("Webpack", "simple-icons:webpack", 4),
  tech("Git", "simple-icons:git", 4),
  tech("ESLint", "lucide:file-cog", 4),
  tech("Prettier", "lucide:code-2", 4),
  tech("Figma 设计稿还原", "lucide:layout", 4),
  tech("前后端接口联调", "lucide:code-2", 4),
  tech("Codex", "lucide:bot", 4),
  tech("Claude Code", "lucide:bot", 4),
  tech("MCP / Skill", "lucide:bot", 3),
];

export const others: TechItem[] = [
  tech("Node.js", "simple-icons:nodedotjs", 2, "oklch(0.7 0.2 140)"),
  tech("Python / ArcPy", "lucide:code-2", 2),
  tech("PostgreSQL", "simple-icons:postgresql", 4),
  tech("MySQL", "lucide:server", 4),
  tech("Linux", "lucide:server", 2),
  tech("Docker", "simple-icons:docker", 2),
  tech("Nginx", "simple-icons:nginx", 2),
  tech("服务器部署", "lucide:cloud", 3),
];
