export interface Project {
  title: string;
  description: string;
  category: "gis" | "frontend" | "other";
  featured?: boolean;
  tags: string[];
  highlights?: string[];
  github?: string;
  gitee?: string;
  demo?: string;
  icon?: string;
}

export const projects: Project[] = [
  {
    title: "OGC Forge",
    description:
      "基于 Vue3、OpenLayers、GeoServer 与 PostGIS 的空间数据交互平台，支持要素增删改查，并提供 Turf.js、WPS、PostGIS 三种缓冲区分析路径。",
    category: "gis",
    featured: true,
    tags: [
      "Vue3",
      "OpenLayers",
      "GeoServer",
      "PostGIS",
      "WFS-T",
      "WPS",
      "Node.js",
    ],
    highlights: [
      "通过 WFS / WFS-T 完成要素查询、绘制、编辑与事务回写",
      "对比前端计算、OGC 服务与数据库三种空间分析路径",
      "连接空间数据存储、服务发布与前端交互的数据链路",
    ],
    github: "https://github.com/Attcius/ogc-forge-Atticus",
    gitee: "https://gitee.com/zoey0723/ogc-forge-Atticus",
    icon: "lucide:globe-2",
  },
  {
    title: "矢量 3D Tiles Demo",
    description:
      "基于 CesiumJS 的三维实验项目，加载校园实景三维模型，探索模型高度调整、GeoJSON 与矢量瓦片叠加、要素拾取等交互。模型数据独立配置，仓库提供应用代码与运行说明。",
    category: "gis",
    tags: ["CesiumJS", "3D Tiles", "GeoJSON", "JavaScript", "Vite"],
    gitee: "https://gitee.com/zoey0723/vector-3dtiles-demo",
    icon: "lucide:box",
  },
  {
    title: "JYU AI Compass",
    description:
      "基于开源项目二次开发的心理服务前端，完成 UI 重构并扩展配置化测评，包含 SSE 流式对话、测评历史与 ECharts 数据展示；通过路由懒加载和分包改善首屏加载。",
    category: "frontend",
    tags: ["Vue3", "Pinia", "Vite", "Element Plus", "SSE", "ECharts", "SCSS"],
    github: "https://github.com/Attcius/jyu-ai-compass",
    gitee: "https://gitee.com/zoey0723/jyu-ai-compass",
    icon: "lucide:brain-circuit",
  },
];
