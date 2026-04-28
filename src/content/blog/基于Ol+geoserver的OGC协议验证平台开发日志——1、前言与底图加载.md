---
title: 基于 OpenLayers + GeoServer 的 OGC 协议验证平台开发日志——1、前言与底图加载
description: 从课堂项目到展示作品的改造历程，分享天地图底图加载和 Vue3 与 OpenLayers 集成的技术要点
pubDate: 04 26 2026
image: /geoserver.png
categories:
  - Development
  - WebGIS
tags:
  - OpenLayers
  - GeoServer
  - Vue3
---

首先这个专栏的内容是我打算把之前上课时候老师讲得项目给变成可以拿来出展示的作品，因此很大程度上我的代码受到了以前上课时候的影响，但是也会有创新点和新收获

之前的代码写得太乱了，因此这次重新让AI帮我设计架构
![[Pasted image 20260428150404.png]]
暂时让AI帮我分了这些架构， 我就开始做第一步，底图加载

这次要用的是天地图，老实说我一开始还像以前一样直接去官网拿着api就进去填了，这里遇到了一个关于天地图的加载的问题吧，不过这个问题来自于我以前鼓捣cesium的时候

二维天地图和三维天地图加载的区别很大，前者只需要引入ol的xyz，再创一个tilelayer图层（瓦片图层），而后者则需要一系列的设置，这里详情可以看以后的文章

以下是我加载天地图的代码，我把他放在了src/utils/baseLayerSources.js下

```javascript
import XYZ from "ol/source/XYZ";
import TileLayer from "ol/layer/Tile";
// 创建天地图【矢量】底图图层
export function createTdtVecLayer() {
  return new TileLayer({
    source: new XYZ({
      url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${TDT_TOKEN}`,
      crossOrigin: "anonymous",
    }),
    visible: true,
  });
}
// 创建天地图【矢量】注记图层（路名、地名）
export function createTdtVecAnnoLayer() {
  return new TileLayer({
    source: new XYZ({
      url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${TDT_TOKEN}`,
      crossOrigin: "anonymous",
    }),
    visible: true,
  });
}
```

接下来遇到了一个重点

绝对不要用 ref() 包裹 Map 实例

这是 Vue3 结合任何重型第三方库（不仅是 OpenLayers，包括 Three.js、ECharts、百度地图等）时，**必须跨过的第一道生死坎**。

首先ref做了什么？他怎么做到响应式？

在 Vue3 中，当你写`const map = ref(null)`，然后赋值`map.value = new Map(...)`时，Vue 为了能监听到数据的变化，会在底层使用 ES6 的`Proxy`机制，**递归地**把`new Map()`返回的这个对象里的**每一个属性、每一个子属性、每一个嵌套对象**，全部包装成 Proxy 代理。

而为什么不能用于重型第三方库？

OpenLayers 不是为 Vue 写的，它是一个原生的、有着极其复杂继承链的 JavaScript 库。一个`ol/Map`实例里面包含了什么？

- DOM 元素引用（`target`）
- 庞大的图层集合（`layers`）
- 各种交互控制器（`interactions`，比如鼠标拖拽、滚轮缩放）
- 底层的 Canvas/WebGL 渲染器（`renderer`）
- 无数的内部状态变量和事件监听器（几百上千个深层嵌套属性）

因此如果用ref()来包裹，计算量太大，不好运行的同时难以清理
