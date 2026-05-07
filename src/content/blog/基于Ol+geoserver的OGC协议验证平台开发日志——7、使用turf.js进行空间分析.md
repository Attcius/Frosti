---
title: 基于 OpenLayers + GeoServer 的 OGC 协议验证平台开发日志——7、使用 turf.js 进行空间分析
description: 客户端缓冲区分析方案，使用 turf.js 在前端直接进行地理计算，无需后端支持
pubDate: 04 26 2026
image: /geoserver.png
categories:
  - Development
  - WebGIS
tags:
  - OpenLayers
  - GeoServer
  - Turf.js
  - 空间分析
---

我们了解到核心逻辑 **OL 几何 → GeoJSON → Turf 缓冲区 → OL 几何 → 新要素渲染 因此**新建核心逻辑文件`src/composables/useTurfAnalysis.js`

```javascript
// src/composables/useTurfAnalysis.js
import * as turf from '@turf/turf'
import { GeoJSON } from 'ol/format'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Style, Fill, Stroke } from 'ol/style'

const format = new GeoJSON()

// 缓冲区结果图层（单例，避免重复创建）
let analysisLayer = null

export function useTurfAnalysis() {
  /**
   * 获取或创建分析结果图层
   */
  const getAnalysisLayer = (map) => {
    if (!analysisLayer) {
      analysisLayer = new VectorLayer({
        source: new VectorSource(),
        style: new Style({
          fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' }),
          stroke: new Stroke({ color: '#ff0000', width: 2 }),
          zIndex: 100, // 保证在最上层
        }),
      })
      map.addLayer(analysisLayer)
    }
    return analysisLayer
  }

  /**
   * 清空分析结果
   */
  const clearAnalysis = () => {
    if (analysisLayer) {
      analysisLayer.getSource().clear()
    }
  }

  /**
   * 核心方法：执行缓冲区分析
   * @param {import('ol/Feature').default} feature OL要素
   * @param {number} radius 缓冲半径
   * @param {string} units 单位 ('meters' | 'kilometers' | 'degrees')
   * @param {import('ol/Map').default} map 地图实例
   */
  const generateBuffer = (feature, radius, units, map) => {
    if (!feature || !map) return

    // 1. 清空之前的结果
    clearAnalysis()

    // 2. 坐标转换：EPSG:3857 (Web墨卡托) -> EPSG:4326 (经纬度)
    // Turf.js 需要 GeoJSON 标准（经纬度）
    const feature4326 = feature.clone()
    feature4326.getGeometry().transform('EPSG:3857', 'EPSG:4326')

    // 3. OL Feature -> Turf GeoJSON
    const geoJsonObj = format.writeFeatureObject(feature4326)

    // 4. Turf 计算
    // 注意：turf.buffer 返回的是 Feature<Polygon | MultiPolygon>
    const buffered = turf.buffer(geoJsonObj, Number(radius), { units })

    if (!buffered) {
      console.warn('缓冲区生成失败，可能半径过小')
      return
    }

    // 5. Turf GeoJSON -> OL Feature
    // readFeature 会将 GeoJSON 转回 OL 对象
    const bufferedFeature = format.readFeature(buffered)

    // 6. 坐标还原：EPSG:4326 -> EPSG:3857 (匹配地图投影)
    bufferedFeature.getGeometry().transform('EPSG:4326', 'EPSG:3857')

    // 7. 渲染到地图
    const layer = getAnalysisLayer(map)
    layer.getSource().addFeature(bufferedFeature)

    // 8. 视图定位到结果区域（可选）
    // map.getView().fit(bufferedFeature.getGeometry().getExtent(), { duration: 500, padding: [50, 50, 50, 50] })
    
    return bufferedFeature
  }

  return {
    generateBuffer,
    clearAnalysis,
    getAnalysisLayer,
  }
}
```

修改src/components/FeatureInfoPopup.vue

```vue
<template>
  <div v-if="showPopup" class="feature-info-popup">
    <div class="popup-header">
      <h3>要素属性</h3>
      <div class="header-actions">
        <!-- 【新增】缓冲区分析按钮 -->
        <button
          v-if="!isEditing"
          class="action-btn analysis-btn"
          @click="handleBufferAnalysis"
        >
          缓冲分析
        </button>

        <!-- 非编辑状态：显示编辑和删除按钮 -->
        <button
          v-if="!isEditing && Object.keys(attrs).length > 0"
          class="action-btn edit-btn"
          @click="isEditing = true"
        >
          编辑
        </button>
        <button
          v-if="!isEditing && Object.keys(attrs).length > 0"
          class="action-btn delete-btn"
          @click="handleDelete"
        >
          删除
        </button>

        <!-- 编辑状态：显示保存和取消按钮 -->
        <button v-if="isEditing" class="action-btn save-btn" @click="handleSave">保存</button>
        <button v-if="isEditing" class="action-btn cancel-btn" @click="handleCancel">取消</button>

        <button class="close-btn" @click="handleClose">×</button>
      </div>
    </div>

    <div class="popup-content">
      <div v-if="Object.keys(attrs).length > 0">
        <div v-for="(value, key) in attrs" :key="key" class="attribute-item">
          <div class="attribute-label">{{ key }}</div>
          <!-- 展示模式 -->
          <div v-if="!isEditing" class="attribute-value">{{ value }}</div>
          <!-- 编辑模式 -->
          <input v-else class="attribute-input" v-model="attrs[key]" />
        </div>
      </div>
      <div v-else class="no-attributes">该要素无业务属性</div>
    </div>

    <!-- 【新增】缓冲区参数输入区域 -->
    <div v-if="showBufferInput" class="buffer-input-area">
      <div class="buffer-row">
        <label>半径(米):</label>
        <input type="number" v-model.number="bufferRadius" class="buffer-input" />
        <button class="confirm-btn" @click="executeBuffer">确定</button>
        <button class="cancel-small-btn" @click="showBufferInput = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { wfsApi } from '@/api/ogc/wfs'
import { useOlMap } from '@/composables/useOlMap'
// 【新增】引入分析逻辑
import { useTurfAnalysis } from '@/composables/useTurfAnalysis'

const { buildBatchUpdatePropertyXml, buildDeleteXml } = useOlMap()
// 【重要】解构出 generateBuffer 方法
const { generateBuffer } = useTurfAnalysis()

// 【关键修复】拿到的是 ref，使用时需要加 .value
const mapInstanceRef = inject('mapInstance')

const showPopup = ref(false)
const isEditing = ref(false)
const attrs = ref({})
let currentFeature = null
let originalAttrs = {}

// 【新增】缓冲区分析相关状态
const showBufferInput = ref(false)
const bufferRadius = ref(100)

const handleClose = () => {
  showPopup.value = false
  isEditing.value = false
  showBufferInput.value = false // 关闭时顺便关掉输入框
}

const handleCancel = () => {
  attrs.value = { ...originalAttrs }
  isEditing.value = false
}

const showFeaturePopup = (feature) => {
  if (!feature) return
  currentFeature = feature

  const properties = feature.getProperties()
  const filtered = {}

  for (const [key, value] of Object.entries(properties)) {
    // 排除 geometry、内部字段 和 主键 id
    if (key !== 'geometry' && !key.startsWith('_') && key !== 'id') {
      filtered[key] = typeof value === 'object' ? JSON.stringify(value, null, 2) : value
    }
  }

  attrs.value = filtered
  originalAttrs = { ...filtered }
  isEditing.value = false
  showPopup.value = true
}

// 提取公共逻辑：通过要素获取图层名
const getLayerNameByFeature = (feature) => {
  const geoType = feature.getGeometry().getType()
  if (geoType.includes('Point')) return 'point'
  if (geoType.includes('Line')) return 'string'
  if (geoType.includes('Polygon')) return 'polygon'
  return ''
}

// 【新增】点击“缓冲分析”按钮
const handleBufferAnalysis = () => {
  // 弹出输入框让用户确认半径
  showBufferInput.value = true
}

// 【新增】执行分析
const executeBuffer = () => {
  if (!currentFeature) return
  generateBuffer(currentFeature, bufferRadius.value, 'meters', mapInstanceRef.value)
  showBufferInput.value = false
  console.log(`已生成 ${bufferRadius.value} 米缓冲区`)
}

const handleSave = async () => {
  if (!currentFeature) return
  const fid = currentFeature.getId()
  if (!fid) return alert('修改失败：找不到要素 FID')

  const layerName = getLayerNameByFeature(currentFeature)

  try {
    const xmlString = buildBatchUpdatePropertyXml(layerName, fid, attrs.value)
    console.log('📝 [Update Props] 发送 XML:\n', xmlString)
    const result = await wfsApi.postTransaction(xmlString)
    console.log('✅ [Update Props] 成功:\n', result)

    isEditing.value = false
    originalAttrs = { ...attrs.value }
    alert('属性修改成功！')
  } catch (error) {
    console.error('❌ [Update Props] 失败:', error)
    alert('属性修改失败，请查看控制台')
  }
}

const handleDelete = async () => {
  if (!currentFeature) return
  if (!confirm('⚠️ 确定要删除这个要素吗？此操作不可逆！')) return

  const fid = currentFeature.getId()
  const layerName = getLayerNameByFeature(currentFeature)

  try {
    const xmlString = buildDeleteXml(layerName, fid)
    console.log('🗑️ [Delete] 发送 XML:\n', xmlString)
    const result = await wfsApi.postTransaction(xmlString)
    console.log('✅ [Delete] 成功:\n', result)

    // 【关键修复】加上 .value 获取真实 map 实例，实现“秒没”
    mapInstanceRef.value
      .getLayers()
      .getArray()
      .forEach((layer) => {
        const source = layer.getSource()
        if (source && typeof source.getFeatures === 'function') {
          if (source.getFeatures().includes(currentFeature)) {
            source.removeFeature(currentFeature)
          }
        }
      })

    showPopup.value = false
  } catch (error) {
    console.error('❌ [Delete] 失败:', error)
    alert('删除失败，请查看控制台')
  }
}

defineExpose({ showFeaturePopup })
</script>

<style scoped>
.feature-info-popup {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}

.popup-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
}

.edit-btn {
  background: #e6f7ff;
  color: #1890ff;
}
.edit-btn:hover {
  background: #bae7ff;
}

.save-btn {
  background: #f6ffed;
  color: #52c41a;
}
.save-btn:hover {
  background: #d9f7be;
}

.cancel-btn {
  background: #fff1f0;
  color: #ff4d4f;
}
.cancel-btn:hover {
  background: #ffccc7;
}

.delete-btn {
  background: #fff1f0;
  color: #ff4d4f;
}
.delete-btn:hover {
  background: #ffccc7;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #909399;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  color: #606266;
}

.popup-content {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.attribute-item {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.attribute-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.attribute-label {
  font-size: 12px;
  font-weight: 500;
  color: #909399;
  margin-bottom: 4px;
}

.attribute-value {
  font-size: 13px;
  color: #303133;
  word-break: break-all;
}

.attribute-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
  color: #303133;
  outline: none;
  transition: border 0.2s;
}
.attribute-input:focus {
  border-color: #409eff;
}

.no-attributes {
  text-align: center;
  color: #999;
  padding: 20px 0;
}

.popup-content::-webkit-scrollbar {
  width: 6px;
}
.popup-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}
.popup-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}
.popup-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 【新增】缓冲区按钮样式 */
.analysis-btn {
  background: #f0f9eb;
  color: #67c23a;
}
.analysis-btn:hover {
  background: #e1f3d8;
}

/* 【新增】缓冲区输入区域样式 */
.buffer-input-area {
  padding: 10px 16px;
  background: #fdf6ec;
  border-top: 1px solid #faecd8;
}
.buffer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.buffer-row label {
  font-size: 12px;
  color: #666;
}
.buffer-input {
  width: 60px;
  padding: 4px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.confirm-btn {
  background: #67c23a;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.cancel-small-btn {
  background: transparent;
  border: 1px solid #dcdfe6;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
```

以下是我与AI的对话 我的理解： 可以了，我想我觉得你的说法是对的，我们的核心逻辑是OL 几何 → GeoJSON → Turf 缓冲区 → OL 几何 → 新要素渲染

我接下来用自己的话说一遍，你看看理解的对不对，首先在useTurfAnalysis.js中，我们有两个关键函数，一个是getAnalysisLayer，其用于创建图层本身，这个图层来源于

还有一个是generateBuffer，其有四个参数feature, radius, units, map，

在组件中，我们本身在点击该要素的时候，就已经通过

```javascript
const showFeaturePopup = (feature) => {
  if (!feature) return
  currentFeature = feature
```

拿到了要素feature

showBufferInput.value是用户自己输入，单位是米固定的，而map则是从父组件ogclab.vue里面拿到的const mapInstanceRef = inject('mapInstance')的地图实例

然后通过getGeometry().transform('EPSG:3857', 'EPSG:4326')将3857的坐标转4326，接着使用ormat.writeFeatureObject(feature4326)转成geojson，使用turf.buffer执行缓冲区分析，参数分别是geojson，半径，单位，然后  

```javascript
const bufferedFeature = format.readFeature(buffered)
    // 6. 坐标还原：EPSG:4326 -> EPSG:3857 (匹配地图投影)
    bufferedFeature.getGeometry().transform('EPSG:4326', 'EPSG:3857')
    // 7. 渲染到地图
    const layer = getAnalysisLayer(map)
    layer.getSource().addFeature(bufferedFeature)
    // 8. 视图定位到结果区域（可选）
    // map.getView().fit(bufferedFeature.getGeometry().getExtent(), { duration: 500, padding: [50, 50, 50, 50] })
    return bufferedFeature
```

实际上就是将这些geojson转回ol的对象，再转回坐标系

而这段代码实在定义数据类型

```javascript
/**
   * 核心方法：执行缓冲区分析
   * @param {import('ol/Feature').default} feature OL要素
   * @param {number} radius 缓冲半径
   * @param {string} units 单位 ('meters' | 'kilometers' | 'degrees')
   * @param {import('ol/Map').default} map 地图实例
   */
```

这种写法叫做**JSDoc**，它是 JavaScript 官方的注释规范。因为 JavaScript 本身是弱类型语言（定义变量不需要写`int`,`String`等），这在多人协作或项目变大时很容易出错（比如你以为传的是字符串，结果传了数字，运行直接报错）

**`import('...')`** ： `{import('ol/Feature').default}` 是什么鬼。这叫**动态类型导入语法**。 因为我们是在普通的 `.js` 文件里，不能像 TS 那样直接 `import type { Feature } from 'ol/Feature'`，所以我们在注释里用 `import('ol/Feature')` 告诉编辑器：“这个参数的类型，你去 `ol/Feature` 这个包里找”。