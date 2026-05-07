---
title: 基于 OpenLayers + GeoServer 的 OGC 协议验证平台开发日志——9、使用 PostGIS + Node.js 进行空间分析
description: 使用 PostGIS 数据库进行专业级空间分析，深入理解 Geometry 与 Geography 数据类型的区别与应用场景
pubDate: 04 26 2026
image: /geoserver.png
categories:
  - Development
  - WebGIS
tags:
  - OpenLayers
  - GeoServer
  - PostGIS
  - Node.js
  - 空间分析
---

我讲一下我理解的流程吧，usePostgisAnalysis.js里面有个函数usePostgisAnalysis()，其中有generatePostgisBuffer，其肯定在FeatureInfoPopup.vue里面，传输地图要素，半径和地图示例，先转坐标，再转wkt，把wkt和半径发给后端，后端返回GeoJSOn，再转成ol的feature

```javascript
// src/composables/usePostgisAnalysis.js
import axios from 'axios'
import { WKT, GeoJSON } from 'ol/format'
import { Feature } from 'ol'
import { Vector as VectorLayer } from 'ol/layer'
import { Vector as VectorSource } from 'ol/source'
import { Stroke, Fill, Style } from 'ol/style'

// 可以复用之前 WPS 的图层，或者单独建一个紫色的 PostGIS 专属图层
let postgisLayer = null

export function usePostgisAnalysis() {
  const getPostgisLayer = (map) => {
    if (postgisLayer) return postgisLayer

    const existing = map
      .getLayers()
      .getArray()
      .find((l) => l.get('name') === 'postgis-analysis-layer')
    if (existing) {
      postgisLayer = existing
      return postgisLayer
    }

    postgisLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        fill: new Fill({ color: 'rgba(147, 112, 219, 0.4)' }), // 紫色半透明
        stroke: new Stroke({ color: '#8A2BE2', width: 2 }),
      }),
      zIndex: 16,
    })
    postgisLayer.set('name', 'postgis-analysis-layer')
    map.addLayer(postgisLayer)
    return postgisLayer
  }

  const generatePostgisBuffer = async (feature, radius, map) => {
    if (!feature || !map) return

    try {
      // 1. 坐标转换：3857 -> 4326
      const clonedFeature = feature.clone()
      clonedFeature.getGeometry().transform('EPSG:3857', 'EPSG:4326')

      // 2. 转 WKT
      const wktFormat = new WKT()
      const wkt = wktFormat.writeFeature(clonedFeature)

      // 3. 发送给 Node.js 后端 (注意修改为你真实的后端地址)
      const response = await axios.post('http://localhost:3000/api/buffer', {
        wkt,
        radius,
      })

      // 4. 解析返回的 GeoJSON 并转换投影
      const geoJsonFormat = new GeoJSON()
      const geometry = geoJsonFormat.readGeometry(response.data, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      })

      if (!geometry) throw new Error('GeoJSON 转换失败')

      // 5. 包装成 Feature 并渲染
      const bufferedFeature = new Feature({ geometry })
      const layer = getPostgisLayer(map)
      layer.getSource().addFeature(bufferedFeature)

      console.log(`✅ [PostGIS] 已生成 ${radius} 米缓冲区`)
      return bufferedFeature
    } catch (error) {
      console.error('❌ [PostGIS Buffer Failed]:', error)
      throw error
    }
  }

  return { generatePostgisBuffer }
}
```

而后端实际上最重要的是调用了

```javascript
// 核心SQL：利用 ::geography 确保按米计算，避免椭圆变形[4](@ref)
const sql = `
SELECT ST_AsGeoJSON(
ST_Buffer(
ST_GeomFromText($1, 4326)::geography,
$2
)::geometry
) AS buffer
```

其实就是操作sql

# **数据类型Geometry和Geography**

Geometry和Geography：数据类型（像int、text一样），前者用于平面计算，后者用于球面计算，这个就是根本区别。

范围小的时候用geometry，范围大用geography，因为范围大的时候，地球有了不可忽视的弧度，比如4326就是我们所知道的地理坐标系，地理坐标系因为他存储是用度的，所以我们一开始返回的时候就是度，如果要转米，这种时候两个办法

一个是直接转成geography（ST_Distance(geom1::geography, geom2::geography)），

一个是转成投影坐标系（ST_Transform(geom, 26986)），

无论哪个转哪个，都必须经过4326，也就是WGS84，其他geom坐标先转4326才能转geog，geog转geom时，也只能先转成4326



在咱们的后端文件里，使用的是转成geography

```javascript
// PostGIS 缓冲区分析服务
import express from 'express'
import cors from 'cors'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// 基础中间件
app.use(cors())
app.use(express.json())

// 数据库连接池
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ogcforge',
  password: process.env.DB_PASSWORD || '123456',
  port: process.env.DB_PORT || 5432,
})

/**
 * 缓冲区分析接口
 * POST /api/buffer
 */
app.post('/api/buffer', async (req, res) => {
  const { wkt, radius } = req.body

  if (!wkt || !radius || typeof radius !== 'number' || radius <= 0) {
    return res
      .status(400)
      .json({ success: false, error: '参数无效：需要有效的 wkt 和大于 0 的 radius' })
  }

  try {
    // 核心SQL：利用 ::geography 确保按米计算，避免椭圆变形[4](@ref)
    const sql = `
      SELECT ST_AsGeoJSON(
        ST_Buffer(
          ST_GeomFromText($1, 4326)::geography,
          $2
        )::geometry
      ) AS buffer
    `
    const result = await pool.query(sql, [wkt, radius])

    if (result.rows[0]?.buffer) {
      res.setHeader('Content-Type', 'application/json')
      res.send(result.rows[0].buffer)
    } else {
      res.status(404).json({ success: false, error: '缓冲区计算失败' })
    }
  } catch (error) {
    console.error('数据库查询错误:', error)
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

// 健康检查
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 PostGIS分析服务已启动: http://localhost:${PORT}`)
  console.log(`💡 缓冲区接口: POST http://localhost:${PORT}/api/buffer`)
})
```