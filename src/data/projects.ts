// 定义项目的数据结构类型
export interface Project {
  title: string;
  description: string;
  category: "gis" | "frontend" | "other"; // 三大分类
  featured?: boolean; // 是否为主打项目（大卡片），默认 false
  tags: string[];
  highlights?: string[]; // 主打项目的核心亮点列表
  github: string;
  demo?: string; // 在线演示地址（可选）
  icon?: string; // Astro Iconify 的图标名
}

// 项目数据库
export const projects: Project[] = [
  {
    title: "OGC Forge",
    description:
      "一个基于 OpenLayers 和 Vue3 的 OGC 标准全链路实践项目。不仅实现了规范的地图服务接入，更深入探索了空间数据的增删改查及多维度的空间分析逻辑。",
    category: "gis",
    featured: true,
    tags: ["Vue 3", "OpenLayers", "JavaScript", "OGC"],
    highlights: [
      "完整的空间要素 CRUD 工作流",
      "实现三种不同方法的空间分析对比",
      "遵循 OGC 标准，对接 WMS/WFS 等服务",
    ],
    github: "https://github.com/Zoeylee0723/ogc-forge-Atticus",
    icon: "lucide:globe-2",
  },
  {
    title: "JYU AI Compass",
    description:
      "基于开源AI心理平台的深度定制化改造，集成SSE流式输出与ECharts数据可视化，提升交互体验。",
    category: "frontend",
    featured: false,
    tags: ["Vue 3", "ECharts", "SSE"],
    github: "https://github.com/Zoeylee0723/jyu-ai-compass",
    icon: "lucide:brain-circuit",
  },
  {
    title: "Frosti Blog (Customized)",
    description:
      "基于 EveSunMaple 的 Frosti 主题进行的二次开发与个性化改造，优化了部分 UI 与交互逻辑。",
    category: "other",
    featured: false,
    tags: ["Astro", "TailwindCSS", "DaisyUI"],
    github: "https://github.com/Zoeylee0723/Frosti",
    icon: "lucide:palette",
  },
  // 👉 以后添加新项目，只需要在这里追加对象即可！
];
