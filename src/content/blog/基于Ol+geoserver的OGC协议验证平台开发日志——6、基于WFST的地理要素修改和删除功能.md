---
title: 基于 OpenLayers + GeoServer 的 OGC 协议验证平台开发日志——6、WFS-T 地理要素修改和删除功能
description: 实现 WFS-T 的 Update 和 Delete 操作，通过手工拼接 XML 完成地理要素的属性修改和删除
pubDate: 04 26 2026
image: /geoserver.png
categories:
  - Development
  - WebGIS
tags:
  - OpenLayers
  - GeoServer
  - WFS-T
---

ol里面的draw有两个版本，一个是单纯的draw，另一个自带修改的

这里不多讲关于Modify，讲一下update

这里是useolmap.js

```javascript
// ==================== 7. 拼装 Update XML (新增) ====================
function buildUpdateXml(feature, layerName, fid) {
  const gmlGeom = _buildGmlGeom(feature.getGeometry());
  // Update 的结构：指定 typeName -> 声明修改哪个属性 -> 给出新的值 -> 用 Filter 指定修改哪条数据(FID)
  return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:ogcforge="http://www.ogcforge.com" xmlns:gml="http://www.opengis.net/gml">
  <wfs:Update typeName="ogcforge:${layerName}">
    <wfs:Property>
      <wfs:Name>geom</wfs:Name>
      <wfs:Value>${gmlGeom}</wfs:Value>
    </wfs:Property>
    <ogc:Filter>
      <ogc:FeatureId fid="${fid}"/>
    </ogc:Filter>
  </wfs:Update>
</wfs:Transaction>`;
}
```

delete

```javascript
// ==================== 11. 拼装删除 XML (新增) ====================
function buildDeleteXml(layerName, fid) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:ogcforge="http://www.ogcforge.com">
  <wfs:Delete typeName="ogcforge:${layerName}">
    <ogc:Filter>
      <ogc:FeatureId fid="${fid}"/>
    </ogc:Filter>
  </wfs:Delete>
</wfs:Transaction>`;
}

return {
  // ... 前面的不变 ...
  buildBatchUpdatePropertyXml,
  buildDeleteXml, // 【新增】暴露删除方法
};
```

可以看到，现在属性修改和删除，本质上都是调用wfs的方法，具体的内容我们可以在geoserver的demorequest里面找到
