---
title: 基于 OpenLayers + GeoServer 的 OGC 协议验证平台开发日志——3、查询功能与组件化开发
description: 实现要素点击查询功能，开发 FeatureInfoPopup 组件，以及 Vue3 组件间通信的最佳实践
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

## （1）代码本体

点击要素获取属性，不需要通过`WriteTransaction`（增删改才需要POST请求），直接用 OpenLayers 的交互控件（Interaction）就能实现

我们要写一个新的组件，用于显示各个要素的信息

### `FeatureInfoPopup.vue`

```javascript
<template>
  <div v-if="showPopup" class="feature-info-popup">
    <div class="popup-header">
      <h3>要素属性</h3>
      <button class="close-btn" @click="handleClose">×</button>
    </div>
    <div class="popup-content">
      <div v-if="Object.keys(attrs).length > 0">
        <div v-for="(value, key) in attrs" :key="key" class="attribute-item">
          <div class="attribute-label">{{ key }}</div>
          <div class="attribute-value">{{ value }}</div>
        </div>
      </div>
      <div v-else class="no-attributes">该要素无业务属性</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const showPopup = ref(false)
const attrs = ref({})

const handleClose = () => {
  showPopup.value = false
}

const showFeaturePopup = (feature) => {
  if (!feature) return

  const properties = feature.getProperties()
  const filtered = {}

  for (const [key, value] of Object.entries(properties)) {
    if (key !== 'geometry' && !key.startsWith('_')) {
      filtered[key] = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
    }
  }

  attrs.value = filtered
  showPopup.value = true
}

defineExpose({ showFeaturePopup })
</script>
```

修改了ogclab.vue

```javascript
<template>
  <div id="ol-map-container" class="map-container">
    <FeatureInfoPopup ref="featurePopup" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import { fromLonLat } from 'ol/proj'
import { createTdtVecLayer, createTdtVecAnnoLayer } from '@/utils/baseLayerSources'
import { wfsApi } from '@/api/ogc/wfs'
import { useLayerStore } from '@/stores/layerStore'
import { useOlMap } from '@/composables/useOlMap'
import FeatureInfoPopup from '@/components/FeatureInfoPopup.vue'

let mapInstance = null
const layerStore = useLayerStore()
const featurePopup = ref(null) // 弹窗组件引用
const { addBusinessLayers, setupWatchers, addSelectInteraction } = useOlMap()

onMounted(async () => {
  initMap()
  setupWatchers()

  // 确保弹窗组件已挂载后再初始化选择交互
  await nextTick()
  addSelectInteraction(mapInstance, featurePopup)

  await loadAllLayers()
})

function initMap() {
  mapInstance = new Map({
    target: 'ol-map-container',
    layers: [createTdtVecLayer(), createTdtVecAnnoLayer()],
    view: new View({
      center: fromLonLat([116.4, 39.9]),
      zoom: 10,
    }),
  })
  addBusinessLayers(mapInstance)
}

async function loadAllLayers() {
  try {
    const [pointData, lineData, polygonData] = await Promise.all([
      wfsApi.getFeatures('ogcforge:point'),
      wfsApi.getFeatures('ogcforge:string'),
      wfsApi.getFeatures('ogcforge:polygon'),
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

修改useolmap.js里面的函数

```javascript
// 在 addSelectInteraction 函数里面
select.on("select", (event) => {
  const selectedFeatures = event.selected;
  // 注意这里：换成了 openDialog，并且加了安全判断
  if (selectedFeatures.length > 0 && featurePopup?.value?.openDialog) {
    const feature = selectedFeatures[0];
    featurePopup.value.openDialog(feature); // 👈 改这里！
  }
});
```

## （2）我的逻辑理解与AI回复

其实这次主要是三个最重要的改动，一个是新增FeatureInfoPopup.vue，一个是useOLmap.js，一个是ogclab.vue

首先FeatureInfoPopup.vue，const showPopup = ref(false)定义了弹出框的选项，并定义了showFeaturePopup这个函数并暴露出去，这个函数里面的逻辑是拿到feature，使用getProperties()获取feature里的属性，然后遍历得到内容

useolmap.js则是加入了select，当点击要素的时候触发了showFeaturePopup（feature）把该参数传递了过去，让该组件能够逻辑运行显示正确的数据

而ogclab.vue，在onmounted时候就挂载了addSelectInteraction(mapInstance, featurePopup)，mapInstance则是拿到这个地图示例，以便后续在useolmap.js中添加选择之后的图层，而featurePopup则是控制组件弹出与否

ai回复 你的理解非常准确！👍 基本上抓住了这三个文件的核心逻辑和它们之间的协作关系。让我帮你梳理一下，并补充一些细节：

### 你的理解完全正确，我来帮你确认一下：

#### 1.**FeatureInfoPopup.vue**（弹窗组件）

- ✅ `showPopup = ref(false)`：控制弹窗显示状态的响应式变量
- ✅ `showFeaturePopup(feature)`：接收要素并处理属性的核心方法
- ✅ 通过 `defineExpose`暴露方法给父组件调用
- ✅ 逻辑：获取要素属性 → 过滤几何数据 → 格式化显示

#### 2.**useOlMap.js**（地图交互逻辑）

- ✅ 添加 `Select`交互：监听地图点击事件
- ✅ 当要素被选中时，触发 `showFeaturePopup(feature)`
- ✅ 传递选中的要素对象，让弹窗组件能够处理并显示对应数据
- ✅ 这是 OpenLayers 的选择交互机制，实现了"点击显示属性"的功能

#### 3.**OgcLab.vue**（主组件）

- ✅ 在 `onMounted`中初始化选择交互
- ✅ `mapInstance`：OpenLayers 地图实例，用于添加交互
- ✅ `featurePopup`：弹窗组件的引用，用于调用其方法
- ✅ 确保在地图加载完成后才初始化交互
