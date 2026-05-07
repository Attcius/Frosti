---
title: 基于 OpenLayers + GeoServer 的 OGC 协议验证平台开发日志——8、使用 OGC-WPS 进行空间分析
description: 利用 GeoServer WPS 服务进行服务端缓冲区分析，深度理解 WPS Execute 请求与 XML 拼接
pubDate: 04 26 2026
image: /geoserver.png
categories:
  - Development
  - WebGIS
tags:
  - OpenLayers
  - GeoServer
  - WPS
  - 空间分析
---

我们可以看到wps demorequest里面的示例，这里有很多输入的数据类型

这里我们选择wkt，我选择了这个要素，然后把他转成wkt，发送到geoserver调用wps服务，然后再输出geojson 核心逻辑就是：**选中要素 → 坐标转4326 → 转WKT → 拼接XML发给GeoServer WPS → 接收GeoJSON → 坐标转回3857 → 渲染**。

因此我们要单独写一个wps的服务

```javascript
// src/api/ogc/wps.js
import axios from 'axios'

// WPS 和 WFS 共用同一个 OWS 入口，保持与 wfs.js 一致
const WPS_BASE = '/geoserver/ogcforge/ows'

export const wpsApi = {
  /**
   * 发送 WPS Execute 请求 (针对 geo:buffer 返回 RawDataOutput JSON)
   * @param {string} xmlString 符合 WPS 1.0.0 规范的 Execute 请求 XML
   * @returns {Promise<object>} 返回 GeoJSON 结果对象
   */
  async postExecute(xmlString) {
    try {
      const res = await axios.post(WPS_BASE, xmlString, {
        headers: {
          'Content-Type': 'application/xml',
        },
      })

      // 因为我们在 XML 中指定了 mimeType="application/json"，axios 会自动解析为 JSON 对象
      // 做一层基本校验，确保返回的是 GeoJSON 几何对象
      // 支持三种格式：1. 原始几何对象  2. FeatureCollection  3. Feature
      if (res.data && res.data.type && res.data.coordinates) {
        // 情况1：直接返回几何对象（如 {"type": "Polygon", "coordinates": [...]}）
        return res.data
      } else if (
        res.data &&
        res.data.type === 'FeatureCollection' &&
        res.data.features &&
        res.data.features.length > 0
      ) {
        // 情况2：返回 FeatureCollection，提取第一个 Feature 的几何
        console.log('📝 [WPS] 返回 FeatureCollection，提取第一个 Feature 的几何')
        return res.data.features[0].geometry
      } else if (res.data && res.data.type === 'Feature' && res.data.geometry) {
        // 情况3：返回 Feature，直接提取其 geometry 属性
        console.log('📝 [WPS] 返回 Feature，提取其几何')
        return res.data.geometry
      } else {
        console.error('WPS 返回的非预期 JSON 结构:', res.data)
        throw new Error('WPS服务返回的JSON格式不符合预期')
      }
    } catch (error) {
      // 提取 axios 的错误信息
      const errMsg = error.response?.data || error.message
      console.error('WPS Execute 请求异常:', errMsg)
      throw error
    }
  },
}
```

首先wps.js这个不用多说，其实是为了发送xml数据出去，我们之前也讨论过，核心逻辑就是：选中要素 → 坐标转4326 → 转WKT → 拼接XML发给GeoServer WPS → 接收GeoJSON → 坐标转回3857 → 渲染。

其实主要逻辑在useWpsAnalysis.js里面，我们在FeatureInfoPopup.vue组件引入了generateWpsBuffer(currentFeature, radius, map)，传入了当前的要素，半径和地图实例，而generateWpsBuffer则来源于useWpsAnalysis()，useWpsAnalysis()下除了generateWpsBuffer还有getWpsAnalysisLayer，这个主要是用于绘制图层的；其中还有一个构建xml的函数，其传入了wkt和距离，而这些参数真正来源于generateWpsBuffer，在接收到当前的要素，半径和地图实例后，先坐标转换，再把米转度，随后转wkt，发送请求，再接受返回来的GeoJSON，转成ol的要素渲染到图层上



```javascript
// src/composables/useWpsAnalysis.js
import { WKT, GeoJSON } from 'ol/format'
import { Vector as VectorLayer } from 'ol/layer'
import { Vector as VectorSource } from 'ol/source'
import { Stroke, Fill, Style } from 'ol/style'
import { Feature } from 'ol'
import { getCenter } from 'ol/extent' // 引入获取中心点的方法
import { wpsApi } from '@/api/ogc/wps'

let wpsAnalysisLayer = null

export function useWpsAnalysis() {
  const getWpsAnalysisLayer = (map) => {
    if (wpsAnalysisLayer) return wpsAnalysisLayer

    const existingLayer = map
      .getLayers()
      .getArray()
      .find((layer) => layer.get('name') === 'wps-analysis-layer')
    if (existingLayer) {
      wpsAnalysisLayer = existingLayer
      return wpsAnalysisLayer
    }

    wpsAnalysisLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 165, 0, 0.4)' }),
        stroke: new Stroke({ color: '#ff8c00', width: 2 }),
      }),
      zIndex: 15,
    })
    wpsAnalysisLayer.set('name', 'wps-analysis-layer')
    map.addLayer(wpsAnalysisLayer)

    return wpsAnalysisLayer
  }

  const buildWPSBufferXml = (geometryWKT, distanceInDegrees) => {
    // 干净的 XML 模板
    return `<?xml version="1.0" encoding="UTF-8"?>
<wps:Execute version="1.0.0" service="WPS" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.opengis.net/wps/1.0.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:wps="http://www.opengis.net/wps/1.0.0" xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:wcs="http://www.opengis.net/wcs/1.1.1" xmlns:xlink="http://www.w3.org/1999/xlink" xsi:schemaLocation="http://www.opengis.net/wps/1.0.0 http://schemas.opengis.net/wps/1.0.0/wpsAll.xsd">
  <ows:Identifier>geo:buffer</ows:Identifier>
  <wps:DataInputs>
    <wps:Input>
      <ows:Identifier>geom</ows:Identifier>
      <wps:Data>
        <wps:ComplexData mimeType="application/wkt"><![CDATA[${geometryWKT}]]></wps:ComplexData>
      </wps:Data>
    </wps:Input>
    <wps:Input>
      <ows:Identifier>distance</ows:Identifier>
      <wps:Data>
        <wps:LiteralData>${distanceInDegrees}</wps:LiteralData>
      </wps:Data>
    </wps:Input>
  </wps:DataInputs>
  <wps:ResponseForm>
    <wps:RawDataOutput mimeType="application/json">
      <ows:Identifier>result</ows:Identifier>
    </wps:RawDataOutput>
  </wps:ResponseForm>
</wps:Execute>`
  }

  const generateWpsBuffer = async (feature, radius, map) => {
    if (!feature || !map) return

    try {
      const clonedFeature = feature.clone()

      // 1. 坐标转换：3857 -> 4326
      clonedFeature.getGeometry().transform('EPSG:3857', 'EPSG:4326')

      // 【关键修复】2. 根据要素所在纬度，将米转换为度
      const extent = clonedFeature.getGeometry().getExtent()
      const center = getCenter(extent)
      const latitude = center[1] // 获取中心点纬度
      const latRad = (latitude * Math.PI) / 180

      // 近似公式：在当前纬度下，1度对应的米数
      const meterPerDegree = 111320 * Math.cos(latRad)
      const distanceInDegrees = radius / meterPerDegree

      console.log(
        `📝 [WPS] 半径换算: ${radius}米 ➡️ ${distanceInDegrees.toFixed(6)}度 (纬度:${latitude.toFixed(4)})`,
      )

      // 3. 转换为 WKT
      const wktFormat = new WKT()
      const geometryWKT = wktFormat.writeFeature(clonedFeature)

      // 4. 构建 XML (传入换算后的度)
      const xmlRequest = buildWPSBufferXml(geometryWKT, distanceInDegrees)

      // 5. 发送请求
      const resultGeoJSON = await wpsApi.postExecute(xmlRequest)

      // 6. GeoJSON 转 OL Geometry (带投影转换)
      const geoJsonFormat = new GeoJSON()
      const geometry = geoJsonFormat.readGeometry(resultGeoJSON, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      })

      if (!geometry) throw new Error('WPS返回的GeoJSON转换为OL几何失败')

      // 7. 包装成 Feature 并渲染
      const bufferedFeature = new Feature({ geometry })
      const layer = getWpsAnalysisLayer(map)
      layer.getSource().addFeature(bufferedFeature)

      return bufferedFeature
    } catch (error) {
      console.error('❌ [WPS Buffer Failed]:', error)
      throw error
    }
  }

  return {
    getWpsAnalysisLayer,
    generateWpsBuffer,
  }
}
```