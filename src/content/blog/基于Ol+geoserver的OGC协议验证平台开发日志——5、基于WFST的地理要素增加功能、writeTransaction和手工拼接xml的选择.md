---
title: 基于 OpenLayers + GeoServer 的 OGC 协议验证平台开发日志——5、WFS-T 地理要素增加功能
description: 对比 writeTransaction 与手工拼接 XML 两种方案，深入解析 XMLSerializer 命名空间问题及解决方案
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

以下是修改后的useolmap.js

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
import Select from "ol/interaction/Select";
import Draw from "ol/interaction/Draw";
import { wfsApi } from "@/api/ogc/wfs";

export function useOlMap() {
  const layerStore = useLayerStore();
  const format = new GeoJSON();
  let currentDraw = null;

  // ==================== 1. 创建三个业务矢量图层 ====================
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

  // 【精简3】映射表：绘制类型 → source + GeoServer 图层名，替代一堆 if/else
  const drawTargetMap = {
    Point: { source: pointLayer.getSource(), layerName: "point" },
    LineString: { source: lineLayer.getSource(), layerName: "string" },
    Polygon: { source: polygonLayer.getSource(), layerName: "polygon" },
  };

  // ==================== 2. 挂载到地图上 ====================
  function addBusinessLayers(map) {
    map.addLayer(polygonLayer);
    map.addLayer(lineLayer);
    map.addLayer(pointLayer);
  }

  // ==================== 3. 监听 Store → 自动渲染到 OL ====================
  // 【精简1】三个重复的 watch 块 → 配置数组 + forEach 循环
  function setupWatchers() {
    const opts = {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    };

    const watchList = [
      { getter: () => layerStore.pointGeoJson, layer: pointLayer },
      { getter: () => layerStore.lineGeoJson, layer: lineLayer },
      { getter: () => layerStore.polygonGeoJson, layer: polygonLayer },
    ];

    watchList.forEach(({ getter, layer }) => {
      watch(getter, (geojson) => {
        if (!geojson) return;
        layer.getSource().clear();
        layer.getSource().addFeatures(format.readFeatures(geojson, opts));
      });
    });
  }

  // ==================== 4. 添加选择交互 ====================
  function addSelectInteraction(map, featurePopup) {
    const select = new Select({
      layers: [pointLayer, lineLayer, polygonLayer],
      style: () => getPointStyle(),
    });

    select.on("select", (event) => {
      if (event.selected.length > 0) {
        featurePopup.value.showFeaturePopup(event.selected[0]);
      }
    });

    map.addInteraction(select);
  }

  // ==================== 5. 手动拼接 WFS-T XML ====================
  function buildInsertXml(feature, layerName) {
    const geometry = feature.getGeometry();
    const geoType = geometry.getType();
    const coords = geometry.getCoordinates();

    let gmlGeom = "";
    if (geoType === "Point") {
      gmlGeom = `<ogcforge:geom>
          <gml:Point srsName="EPSG:4326">
            <gml:coordinates decimal="." cs="," ts=" ">${coords[0]},${coords[1]}</gml:coordinates>
          </gml:Point>
        </ogcforge:geom>`;
    } else if (geoType === "LineString") {
      const coordStr = coords.map((c) => `${c[0]},${c[1]}`).join(" ");
      gmlGeom = `<ogcforge:geom>
          <gml:MultiLineString srsName="EPSG:4326">
            <gml:lineStringMember>
              <gml:LineString>
                <gml:coordinates decimal="." cs="," ts=" ">${coordStr}</gml:coordinates>
              </gml:LineString>
            </gml:lineStringMember>
          </gml:MultiLineString>
        </ogcforge:geom>`;
    } else if (geoType === "Polygon") {
      const coordStr = coords[0].map((c) => `${c[0]},${c[1]}`).join(" ");
      gmlGeom = `<ogcforge:geom>
          <gml:MultiPolygon srsName="EPSG:4326">
            <gml:polygonMember>
              <gml:Polygon>
                <gml:outerBoundaryIs>
                  <gml:LinearRing>
                    <gml:coordinates decimal="." cs="," ts=" ">${coordStr}</gml:coordinates>
                  </gml:LinearRing>
                </gml:outerBoundaryIs>
              </gml:Polygon>
            </gml:polygonMember>
          </gml:MultiPolygon>
        </ogcforge:geom>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction
  service="WFS"
  version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs"
  xmlns:ogcforge="http://www.ogcforge.com"
  xmlns:gml="http://www.opengis.net/gml">
  <wfs:Insert>
    <ogcforge:${layerName}>
      ${gmlGeom}
    </ogcforge:${layerName}>
  </wfs:Insert>
</wfs:Transaction>`;
  }

  // ==================== 6. 绘制 + 发送 WFS-T ====================
  function activateDraw(map, type) {
    deactivateDraw(map);

    // 【精简3】一行查表，替代三个 if/else
    const target = drawTargetMap[type];
    if (!target) return;

    currentDraw = new Draw({ source: target.source, type });

    currentDraw.on("drawend", async (event) => {
      // 【精简2】只 clone + transform 一次，打印和发请求共用
      const clonedFeature = event.feature.clone();
      clonedFeature.getGeometry().transform("EPSG:3857", "EPSG:4326");

      // 打印坐标
      const coords = clonedFeature.getGeometry().getCoordinates();
      console.log(`[绘制完成 - ${type}]`, coords);

      // 拼接 XML 并发送
      try {
        const xmlString = buildInsertXml(clonedFeature, target.layerName);
        console.log("🚀 准备发送的 WFS-T XML:\n", xmlString);
        const result = await wfsApi.postTransaction(xmlString);
        console.log("✅ WFS-T 写入成功！服务器返回:\n", result);
      } catch (error) {
        console.error("❌ WFS-T 写入失败:", error);
      }
    });

    map.addInteraction(currentDraw);
  }

  // ==================== 7. 停止绘制 ====================
  function deactivateDraw(map) {
    if (currentDraw) {
      map.removeInteraction(currentDraw);
      currentDraw = null;
    }
  }

  return {
    addBusinessLayers,
    setupWatchers,
    pointLayer,
    lineLayer,
    polygonLayer,
    addSelectInteraction,
    activateDraw,
    deactivateDraw,
  };
}
```

## （2）我向AI问的问题

如下： 接下来是我的理解，其实这次完成ogc的wfst，和以前不一样，我以前用的是writetransation，但这次我觉得本质上是我们拼接了xml并按照对应的格式发送出去，我没有搞懂为什么之前我老师让我们用writetransation，接下来我用自己的话和你复述我理解的逻辑

首先，wfs.js做了什么？

wfs.js里新增了一个叫做Posttransaction的函数，其发送的是xml数据

而在useolmap.js里面，新增了一个叫做buildinsertxml的函数，起传入要素是图层本身和图层名字，这个函数应该是为了给后面的绘制服务的，其先拿到该要素的geomtry，然后通过gettype、getcoordinates等方法拿到相关信息（我不知道这个是不是ol的方法，我忘记了），然后定义了gml文档，当图层类型不同的时候，就返回不一样的gml字段，最后拼接到xml处。（在这里我有疑问，gml和xml的关系，我在geoserver的演示demorequest里面找到了各个方法的example，其中transactioninsert的example就是我们拼接xml的那段，但是demorequest里面没有我们这里的<?xml version ='1.0',encoding='utf-8'>，也没有<xsi>相关）

接着就是绘制+发送xml，使用activedraw，这个函数我看得不是很懂，但我知道其是根据图层的不同来绘制的，再回画好之后，克隆了一份，还转了坐标系，把这个clonefeature和类型发给了buildinsertxml，然后使用wfsapi的posttransaction函数传出去，最后再添加该要素到图层上

## （3）AI的回复

## 1. 为什么不用`writeTransaction`？老师教错了吗？

老师没教错，`writeTransaction`是正统的、官方推荐的做法。你可以把它理解为 OpenLayers 给你提供的一辆“自动挡汽车”。在 90% 的正常路况下，你踩油门（传参数）它就自己跑了。

但我们这次遇到的是什么路况？是浏览器的`XMLSerializer`这个“叛徒”在捣鬼。自动挡汽车的动力系统（XMLSerializer）会偷偷把关键的命名空间前缀（`ogcforge:`）吃掉，导致到了 GeoServer 那里车门都打不开（找不到`geom`字段）。

既然自动挡坏了，我们就索性打开引擎盖，自己用手动挡（**纯字符串拼接**）把动力一丝不苟地传过去。所以你的理解极准：**本质上就是我们按照 GeoServer 能看懂的格式，手工捏了一份 XML 报文发过去。**

### 2.`wfs.js`做了什么？

**完全正确。**它就是纯粹的“快递员”，不关心包裹里装的是什么，只要是`application/xml`格式，它就原封不动地 POST 给 GeoServer。

### 3.`buildInsertXml`的逻辑与疑问解答

你的流程描述**完全正确**：

- `getType()`、`getCoordinates()`、`clone()`、`transform()` **全都是 OpenLayers 的 API**。OL 帮我们算出了精确的坐标数组，然后我们“过河拆桥”，不用它生成 XML 了。
- 根据不同类型返回不同 GML 字段，最后拼接到外层 XML 里，逻辑无懈可击。

你的疑问：GML 和 XML 是什么关系？为什么 Demo Request 里没有`<?xml...>`和`xsi`？

- **关系**：**XML 是爹，GML 是儿子。** XML 是一种通用的标记语法规则（有头有尾 `<a></a>`）；而 GML（Geography Markup Language）是专门用 XML 语法来描述地理坐标的“方言”。我们拼的 `<gml:coordinates>`就是 GML。
- **Demo 里为什么没有？**
  - `<?xml version="1.0" encoding="UTF-8"?>` 叫做 XML 声明。在规范里它是**可选的**。浏览器/服务器只要看到 `<wfs:Transaction>`就知道这是 XML。加上它是一种“严谨的礼貌”，告诉服务器：“我用的是 UTF-8 编码，别拿 GBK 瞎解码”。
  - `xsi:schemaLocation="..."` 叫做模式引用。意思是：“我这份 XML 是按照哪个规则书（XSD 文件）写的”。**GeoServer 的 Demo 为了让例子看起来简短易读，故意把它们删了。** GeoServer 足够聪明，就算你不给规则书，它也能猜出来。但在正式的生产环境代码中，**带上这两句是最专业的做法**，能避免 1% 的极端解析报错情况。

## （4）我和AI的总结

如果我想实现wfst服务，实际上我们至少有两种方法，一个是writetransaction，一个是手工拼接Xml

以下是writetransaction例子

```javascript
    // WFS 插入事务
    const wfsTransaction = new WFS().writeTransaction(
      [newFeature],
      null,
      null,
      {
        featureNS: 'www.testmap.com',
        featurePrefix: 'testmap',
        featureType: targetLayer,
        srsName: 'EPSG:4326'
      }
    );

    sendWFSRequest(wfsTransaction, 'insert');

  } catch (error) {
    console.error('保存过程中发生错误:', error);
    alert('保存失败: ' + error.message);
  }
}
```

下面深度剖析这两套方案的原理，并精准定位为什么上次行，这次不行。

一、 核心谜团：为什么上次 writeTransaction 好好的？

请你仔细看你发给我的旧代码，再对比这次的代码，差异只在命名空间（featureNS）上：

上次的代码（成功）：featureNS: '[www.testmap.com](http://www.testmap.com)'这次的代码（失败）：featureNS: '[http://www.ogcforge.com](http://www.ogcforge.com)'

罪魁祸首就是那个 http://！

XMLSerializer 的“双标”行为

writeTransaction 生成的不是一个字符串，而是一个内存里的 DOM 节点树（和 HTML 的 DOM 一样）。你必须调用 new XMLSerializer().serializeToString(node) 把它转成字符串才能发出去。

但 XMLSerializer 在转换时，有一个非常变态的底层逻辑：

当它看到 [www.testmap.com（不符合标准](http://www.testmap.com（不符合标准) URI 格式），它觉得“这不是个正规的网址”，于是老老实实保留了前缀，生成：<testmap:geom>。GeoServer 看到了前缀，完美解析！

当它看到 [http://www.ogcforge.com（标准的](http://www.ogcforge.com（标准的) URI 格式），它觉得“这是个标准的默认命名空间”，于是自作聪明地把前缀吃掉了，生成：<geom xmlns="[http://www.ogcforge.com">。GeoServer](http://www.ogcforge.com">。GeoServer) 找不到 ogcforge:geom 前缀，直接懵逼，存成 null！

所以，不是你的代码写错了，也不是 writeTransaction 废了，而是浏览器的 XML 转换器在遇到带 http:// 的标准命名空间时，触发了一个无法关闭的 Bug。

二、 writeTransaction 的原理（你以前的方案）

把你的旧代码拆开，它经历了以下四个步骤：

接收要素：你传入 [newFeature]，这个 Feature 里装了 3857 的坐标。

构建 DOM 树：OpenLayers 在内存中构建一棵 XML 树。它会读取你的配置（featureNS, featurePrefix, featureType），在树里给节点打上 testmap:point、testmap:geom 这样的标签。

处理坐标（隐藏逻辑）：它会自动调用内部的 GML 格式化器，把 3857 坐标转成 4326，并包上 <gml:coordinates>。

输出节点：注意！它返回的是一个 Document 对象（DOM节点），不是字符串！ 你必须在外面套一层 XMLSerializer 才能发网络请求。

总结：它帮你干了脏活累活，但最终交给你的是一个“半成品”（DOM节点），你必须依赖一个不靠谱的翻译官（XMLSerializer）才能把它变成能发的报文。

三、 手工拼接 XML 的原理（我们这次的方案）

我们这次的方案绕开了“构建 DOM 树”和“翻译官”这两个环节：

手动提取坐标：用 OL 的 feature.clone().transform() 把 3857 转成 4326，用 getCoordinates() 拿到纯数字数组 [116.xxx, 39.xxx]。（此时已经跟 XML 毫无关系了）

直接写字符串：用 JS 的模板字符串 `<gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates>`，直接写出最终的报文格式。

直接发请求：拿到手的就是 String，直接扔给 Axios，没有任何中间商赚差价。

总结：我们剥夺了 OpenLayers 生成 XML 的权利，自己当包工头，从坐标数字一直拼到尖括号，100% 掌控最终结果。

四、 终极对比总结

给你的建议

如果你以后写小 Demo，或者确认命名空间不带 http://，继续用 writeTransaction，因为它太爽了，代码短小精悍。

如果你在写公司生产环境，或者对接的是标准的 http:// 命名空间，一定要用手工拼接 XML。因为在生产环境里，“可控”比“省事”重要一万倍。这也是为什么很多资深 GIS 前端，最后都走向了自己写 XML 模板的道路。

## （5）我的理解

也就是说，writetransaction自己根据图层信息生成了gml，比如我给你的示例代码里面的

```javascript
newFeature，和{
        featureNS: 'www.testmap.com',
        featurePrefix: 'testmap',
        featureType: targetLayer,
        srsName: 'EPSG:4326'
      }
```

但是我们发送xml的时候往往因为XMLSerializer导致发送有问题，而手动拼接则不会
