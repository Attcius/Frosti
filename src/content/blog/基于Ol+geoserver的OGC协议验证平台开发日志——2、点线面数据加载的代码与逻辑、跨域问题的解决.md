---
title: 基于 OpenLayers + GeoServer 的 OGC 协议验证平台开发日志——2、点线面数据加载与跨域问题解决
description: 详解 WFS 协议加载点线面数据的完整流程，从 PostgreSQL 到 GeoServer 再到前端的数据链路，以及跨域问题的解决方案
pubDate: 04 26 2026
image: /geoserver.png
categories:
  - Development
  - WebGIS
tags:
  - OpenLayers
  - GeoServer
  - WFS
---

## （1）代码方面

首先，为了这个实例平台，我准备了点线面三种数据，分别命名为point/string/polygon，其都是shp格式的数据

我们通过以前的方法，将这些数据录入到postgresql，具体的方法可以见[https://mp.csdn.net/mp_blog/creation/editor/155060418](https://mp.csdn.net/mp_blog/creation/editor/155060418)

其中包括了shp数据从放入postgresql再到geoserver的全过程。

由于是wfs，因此我们要加载geojson数据

在以前，我是直接拿了geoserver的一整条wfs数据，里面包裹着参数

```javascript
http://localhost:8080/geoserver/tiger/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=tiger%3Agiant_polygon&outputFormat=application%2Fjson&maxFeatures=50
```

但现在我换了架构，在src/api/wfs.js下，这个只负责请求，不负责vue和ol

```javascript
import axios from 'axios'

const WFS_BASE = '/geoserver/ogcforge/ows'

export const wfsApi = {
  /**
   * 通过 WFS 协议获取要素，返回 GeoJSON
   */
  async getFeatures(typeName) {
    const params = {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
    }
    const res = await axios.get(WFS_BASE, { params })
    return res.data
  },

```

这里面会有一个跨域的问题，我们使用`vite.config.js来解决`

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/geoserver": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
```

在这里还有相关的样式什么的，在`src/utils/featureStyles.js`

```javascript
import { Style, Fill, Stroke, Circle } from "ol/style";

/** 点样式：红色圆点 + 白色描边 */
export function getPointStyle() {
  return new Style({
    image: new Circle({
      radius: 7,
      fill: new Fill({ color: "#e74c3c" }),
      stroke: new Stroke({ color: "#fff", width: 2 }),
    }),
  });
}

/** 线样式：蓝色 3px */
export function getLineStyle() {
  return new Style({
    stroke: new Stroke({
      color: "#2980b9",
      width: 3,
    }),
  });
}

/** 面样式：半透明黄色填充 + 橙色描边 */
export function getPolygonStyle() {
  return new Style({
    fill: new Fill({ color: "rgba(241, 196, 15, 0.3)" }),
    stroke: new Stroke({
      color: "#e67e22",
      width: 2,
    }),
  });
}
```

使用pinia对地图状态进行管理，`src/stores/layerStore.js`

```javascript
import { defineStore } from "pinia";

export const useLayerStore = defineStore("layer", {
  state: () => ({
    pointGeoJson: null,
    lineGeoJson: null,
    polygonGeoJson: null,
  }),
  actions: {
    setPoint(data) {
      this.pointGeoJson = data;
    },
    setLine(data) {
      this.lineGeoJson = data;
    },
    setPolygon(data) {
      this.polygonGeoJson = data;
    },
  },
});
```

这里核心的来了，我们不打算直接在ogclab.vue里面直接加载图层，而是通过引入逻辑的形式，这里是`src/composables/useOlMap.js`

这里在加载的时候记得转坐标

```javascript
pointLayer
  .getSource()
  .addFeatures(format.readFeatures(geojson, projectionOpts));
```

```javascript
import { watch } from "vue";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { GeoJSON } from "ol/format";
import { useLayerStore } from "@/stores/layerStore";
import {
  getPointStyle,
  getLineStyle,
  getPolygonStyle,
} from "@/utils/featureStyles";

export function useOlMap() {
  const layerStore = useLayerStore();
  const format = new GeoJSON();

  // 1. 创建三个业务矢量图层，各自绑定样式
  const pointLayer = new VectorLayer({
    source: new VectorSource(),
    style: getPointStyle(),
  });
  const lineLayer = new VectorLayer({
    source: new VectorSource(),
    style: getLineStyle(),
  });
  const polygonLayer = new VectorLayer({
    source: new VectorSource(),
    style: getPolygonStyle(),
  });

  // 2. 挂载到地图上
  function addBusinessLayers(map) {
    // 注意叠加顺序：面在下，线在中，点在上
    map.addLayer(polygonLayer);
    map.addLayer(lineLayer);
    map.addLayer(pointLayer);
  }

  // 3. 监听 Store → 自动渲染到 OL
  // 核心架构：Vue 管数据，OL 管渲染，watch 是桥梁
  function setupWatchers() {
    // 投影转换配置对象（提炼出来，避免写重复代码）
    const projectionOpts = {
      dataProjection: "EPSG:4326", // 告诉 OL：从 GeoServer 拿到的数据是经纬度
      featureProjection: "EPSG:3857", // 告诉 OL：要画在天地图(3857)上
    };

    watch(
      () => layerStore.pointGeoJson,
      (geojson) => {
        if (geojson) {
          pointLayer.getSource().clear();
          pointLayer
            .getSource()
            .addFeatures(format.readFeatures(geojson, projectionOpts));
        }
      },
    );

    watch(
      () => layerStore.lineGeoJson,
      (geojson) => {
        if (geojson) {
          lineLayer.getSource().clear();
          lineLayer
            .getSource()
            .addFeatures(format.readFeatures(geojson, projectionOpts));
        }
      },
    );

    watch(
      () => layerStore.polygonGeoJson,
      (geojson) => {
        if (geojson) {
          polygonLayer.getSource().clear();
          polygonLayer
            .getSource()
            .addFeatures(format.readFeatures(geojson, projectionOpts));
        }
      },
    );
  }

  return {
    addBusinessLayers,
    setupWatchers,
    pointLayer,
    lineLayer,
    polygonLayer,
  };
}
```

最后给主视图`src/views/OgcLab.vue组装好`

```javascript
<template>
  <div id="ol-map-container" class="map-container"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import { fromLonLat } from 'ol/proj'
import { createTdtVecLayer, createTdtVecAnnoLayer } from '@/utils/baseLayerSources'
import { wfsApi } from '@/api/ogc/wfs'
import { useLayerStore } from '@/stores/layerStore'
import { useOlMap } from '@/composables/useOlMap'

let mapInstance = null
const layerStore = useLayerStore()
const { addBusinessLayers, setupWatchers } = useOlMap()

onMounted(async () => {
  initMap()
  setupWatchers()
  await loadAllLayers()
})

function initMap() {
  mapInstance = new Map({
    target: 'ol-map-container',
    layers: [createTdtVecLayer(), createTdtVecAnnoLayer()],
    view: new View({
      center: fromLonLat([116.4, 39.9]),
      zoom: 10
    })
  })
  addBusinessLayers(mapInstance)
}

async function loadAllLayers() {
  try {
    const [pointData, lineData, polygonData] = await Promise.all([
      wfsApi.getFeatures('ogcforge:point'),
      wfsApi.getFeatures('ogcforge:string'),
      wfsApi.getFeatures('ogcforge:polygon')
    ])
    layerStore.setPoint(pointData)
    layerStore.setLine(lineData)
    layerStore.setPolygon(polygonData)
    console.log('[OgcLab] 图层加载完成')
  } catch (err) {
    console.error('[OgcLab] WFS 加载失败', err)
  }
}
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100vh;
}
</style>

```

## （2）逻辑方面

整个项目的具体逻辑（以下是我的理解）： 首先，ogclab.vue引入了wfs.js的wfsapi方法，当挂载好Onmounted以后就立刻执行loadAllLayers。

loadAllLayers调用了wfsapi里面的getfeatures函数传递了typename，拿到了之后就调用layerStore里面的action的setxxx方法存入数据，数据在layerstore里面被传入states进行状态管理。

与此同时因为states出现了变化useolmap.js里面的watch就发力了，将格式化之后的geojson数据，连着坐标数据projectionOpts一起通过getSource().addFeatures(format.readFeatures())方法添加到了点线面图层中

`ogclab.vue`→`wfs.js`→`layerStore`→`useOlMap.js`→ 地图渲染

以及AI的回复：

1. 你的流程描述（完全正确） ogclab.vue → wfs.js → layerStore → useOlMap.js → 地图渲染 这完美体现了 Vue + OpenLayers 的“单向数据流”架构，就像水流只能从上游往下游流，数据只能从请求到渲染，不会倒流。这种架构的好处是：逻辑清晰，调试方便。 2. 核心机制：watch 是“数据变化的开关” 你提到“states 出现了变化 useOlMap.js 里面的 watch 就发力了”，这是最关键的一步。我们可以把 watch 想象成一个 “数据变化探测器”： 它在 useOlMap.js 初始化时，就“埋”在 layerStore.pointGeoJson 旁边。 当 layerStore.setPoint() 被调用，pointGeoJson 从 null 变成有数据时，这个探测器立刻“叮”一声，触发后面的渲染逻辑。 这就是 Vue 的 “响应式” 核心：数据变化 → 自动触发 UI 更新。 3. 坐标转换：projectionOpts 是“翻译官” 你流程里提到了“连着坐标数据 projectionOpts 一起”，这说明你抓住了之前卡住的“坐标系转换”这个关键点！projectionOpts 就像在 GeoJSON 和 OpenLayers 之间加了一个 “翻译官”： GeoJSON 说：“我讲的是经纬度（4326）。” 翻译官（projectionOpts）告诉 OpenLayers：“请把它翻译成米制坐标（3857），再画在地图上。” 没有 projectionOpts，数据就会“水土不服”，跑到非洲去。
