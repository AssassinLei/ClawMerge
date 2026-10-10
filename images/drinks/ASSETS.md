# 暖心饮品素材

日期：2026-10-10。使用内置 image_gen 工具，每款独立生成一张图片；风格参考项目哈巴狗图。运行素材为 256×256 透明 PNG，保留生成透明度，仅缩放尺寸。杯型、饮料颜色、冰块和配料参考检索到的商品图片，再按游戏风格重绘，杯贴统一原创白色爪印。

## 合成顺序与保存路径

1. VC柠檬茶 — images/drinks/lemon-tea.png
2. 茉莉奶绿 — images/drinks/jasmine-milk.png
3. 拿铁 — images/drinks/latte.png
4. 泰奶红茶 — images/drinks/thai-tea.png
5. 黑巧美式 — images/drinks/chocolate-americano.png
6. 黑糖珍珠 — images/drinks/brown-sugar-boba.png
7. 芭乐茉莉 — images/drinks/guava-jasmine.png
8. QQ美莓奶茶 — images/drinks/strawberry-boba.png

## 图片参考

- [瑞幸咖啡官方美式产品图片（杯型、深咖色与冰块参考）](https://www.luckincoffee.co/products?categoryId=2)
- [瑞幸官网泰奶产品（泰式红茶与奶色参考；页面款名为咸法酪泰奶）](https://www.lkcoffee.com/products/non-coffee/salted-cheese-thai-milk-tea)
- [瑞幸拿铁实物图片（蓝杯与奶泡参考）](https://k.sina.cn/article_6496990403_1834034c300100psog.html)
- [蜜雪官方产品图入口（柠檬/茉莉茶饮杯型参考）](https://mixue.hk/)
- [蜜雪奶茶与柠檬茶实物图片（珍珠、柠檬片参考）](https://food.detik.com/info-kuliner/d-6512699/viral-di-indonesia-kini-mixue-merambah-pasar-jepang-dan-korea)
- [茉莉奶绿实物图片（奶色与绿色花纹参考）](https://www.sohu.com/a/799254031_121998144)
- [芭乐茉莉相关产品图与原料参考](https://www.nckfhsm.com/products/min-nan-ba-le-mo-li-bing-cha)
- [一点点 QQ美莓奶茶官方海报及配料说明](https://www.alittle-tea.com/latestnews-detail/109/)

“泰奶红茶”“黑巧美式”的精确同名官网商品图未检索到：前者参考瑞幸泰奶，后者参考瑞幸深色冰美式并加入黑巧方块作为识别配料。其余未指定品牌的茶饮参考同类杯型；所有游戏名称按用户原文保留。

## 最终提示词

共用风格提示：

Use case: stylized-concept. Asset type: one transparent PNG game item sprite for Paw Zoo merge game. Use the referenced pug ONLY as illustration STYLE reference: warm cute polished softly painted dimensional mobile game art, fine brown edge outlines, creamy highlights, rounded shapes. Draw ONE centered drink cup, three-quarter front view, large chunky recognizable silhouette filling 80% of square canvas with safe margins. Transparent background with actual alpha, no ground plane, no scenery, no lettering, no watermark. Original tiny white paw-print cup emblem. Cup lid/straw and ONE small ingredient garnish at its base are part of the single sprite. No face, no eyes, no hands, no animals. Readable at 36px, clean silhouette, not a photograph.

### 1. VC柠檬茶

VC lemon tea: tall transparent tapered takeaway cup, pale golden amber iced tea, TWO very clearly visible large bright lemon wheels inside the front, translucent chunky ice, sunny yellow flat lid and straw, small lemon wedge at base. Reference the fresh lemon tea takeaway appearance, lemon tea is amber/yellow not white milk.

### 2. 茉莉奶绿

Jasmine milk green tea: rounded tall takeaway cup, creamy pale ivory tea tinted subtle pastel jade, green flat sealed lid and green straw, narrow soft green floral sleeve around lower third, TWO small white jasmine blossoms with green leaves at base. Milk green tea stays pale ivory, not bright matcha green.

### 3. 拿铁

Luckin-inspired latte: squat tapered deep navy blue paper takeaway coffee cup with simple white paw emblem, white milk foam on open top with heart-shaped tan latte art, soft caramel coffee ring, two small coffee beans at base. Use blue cup and foam to distinguish this from transparent milk tea cups.

### 4. 泰奶红茶

Luckin-inspired Thai black milk tea: transparent tapered iced takeaway cup, vivid warm burnt orange caramel Thai milk tea with subtle cream swirl, chunky translucent ice, clear beige flat lid and short dark navy straw, white paw emblem, tiny folded tea leaf at base. Color is noticeably orange, richer than beige latte.

### 5. 黑巧美式

Luckin-inspired dark chocolate Americano: transparent tapered iced takeaway cup, dark chestnut brown black coffee (no milk or cream), translucent coffee-tinted ice, clear flat lid and navy straw, tiny original white paw emblem, TWO chunky dark chocolate squares leaning at the base. Strong dark coffee silhouette with golden brown highlights.

### 6. 黑糖珍珠

Brown sugar pearl milk tea: transparent rounded tapered takeaway cup full of ivory milky tea, prominent thick dark caramel tiger stripes down inside cup, chunky glossy BLACK tapioca pearls visibly filling bottom quarter, warm caramel sealed lid and broad cocoa-colored straw, white paw emblem, three spare glossy boba pearls at base. Big pearls and stripe contrast must read at tiny size.

### 7. 芭乐茉莉

Guava jasmine fruit tea: transparent tall tapered iced takeaway cup, translucent soft coral pink guava tea, pale jasmine tea golden layer at top, several pink fruit flecks and clear chunky ice, pale green flat lid and green straw, white paw emblem, ONE small guava half with green rind and vivid pink seeded interior at base. Fruity translucent texture, no milk, no boba.

### 8. QQ美莓奶茶

QQ strawberry milk tea based on 1 Diandian QQ美莓奶茶 official product description: clear tall takeaway cup, creamy peach-pink red-tea milk base, rich red strawberry fruit bits and glossy dark tapioca pearls in the bottom, chunky ice at top, pastel strawberry-pink sealed lid and broad soft green straw, white paw emblem, one small red strawberry with green leafy cap at base. Pink milk tea, contrast strawberry red flecks and black pearls; no whipped cream tower.

缩放与透明度检查脚本：tools/prepare-drinks.py。原始生成路径及完整提示词留在 tools/drink-assets.json。QA 总览：preview/screenshots/v2/drinks-sheet.png。素材说明及开发脚本不上传，八张运行 PNG 上传。
