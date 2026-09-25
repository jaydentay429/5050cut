/**
 * 十个场景 × 十件可切物品。建模、贴图、体积、图鉴都读这一份。
 */

export const WORLD_ORDER = [
  "fruit",
  "veg",
  "flower",
  "pastry",
  "candy",
  "stationery",
  "kitchen",
  "night",
  "toys",
  "mineral",
];

export const WORLD_BACKDROP = {
  fruit: "assets/env/fruit_stall.jpg",
  veg: "assets/env/veg.jpg",
  flower: "assets/env/flower.jpg",
  pastry: "assets/env/pastry.jpg",
  candy: "assets/env/candy.jpg",
  stationery: "assets/env/stationery.jpg",
  kitchen: "assets/env/kitchen.jpg",
  night: "assets/env/night.jpg",
  toys: "assets/env/toys.jpg",
  mineral: "assets/env/mineral.jpg",
};

export const WORLDS = {
  fruit: {
    name: "水果摊",
    objects: ["apple", "pear", "orange", "banana", "strawberry", "lemon", "mango", "peach", "juice", "fruit_box"],
    clear: "#e09048",
    ground: "#7a4a28",
    wall: "#c47840",
    fog: "#d08040",
    hemiSky: "#ffd4a8",
    hemiGround: "#8a3a18",
    board: "#c88848",
    sfx: "fruit",
    stallLift: -0.38,
  },
  veg: {
    name: "菜园",
    objects: ["carrot", "cucumber", "corn", "eggplant", "tomato", "pepper", "radish", "pumpkin", "watering_can", "sickle"],
    clear: "#6aaa48",
    ground: "#4a6a28",
    wall: "#3a6a28",
    fog: "#a8c878",
    hemiSky: "#e8ffd0",
    hemiGround: "#3a4a18",
    board: "#7a5a30",
    sfx: "veg",
    stallLift: 0.42,
  },
  flower: {
    name: "花园",
    objects: ["rose", "tulip", "daisy", "sunflower", "lily", "poppy", "lavender", "orchid", "hose", "fertilizer"],
    clear: "#8ec8f0",
    ground: "#3f6e32",
    wall: "#3a7a32",
    fog: "#b8d8e8",
    hemiSky: "#f4fbff",
    hemiGround: "#3a5a28",
    board: "#9aa090",
    sfx: "flower",
    stallLift: 0.28,
  },
  pastry: {
    name: "点心房",
    objects: ["cake", "bread", "cheese", "onigiri", "croissant", "donut", "cookie", "bagel", "rolling_pin", "pastry_box"],
    clear: "#f0d0b0",
    ground: "#8a6a48",
    wall: "#e8d4bc",
    fog: "#e0c8a8",
    hemiSky: "#fff4e8",
    hemiGround: "#6a4a30",
    board: "#f4e8d0",
    sfx: "pastry",
    stallLift: 0.48,
  },
  candy: {
    name: "糖果屋",
    objects: ["lollipop", "chocolate", "macaron", "popsicle", "gumdrop", "marshmallow", "candy_cane", "mint", "candy_jar", "tin"],
    clear: "#f090b8",
    ground: "#c05078",
    wall: "#f8b0c8",
    fog: "#f0a0c0",
    hemiSky: "#ffe8f4",
    hemiGround: "#8a3050",
    board: "#fff0f6",
    sfx: "candy",
    stallLift: 0.55,
  },
  stationery: {
    name: "书桌",
    objects: ["pencil", "eraser", "crayon", "ruler", "pen", "marker", "chalk", "glue", "scissors", "inkwell"],
    clear: "#d4c4a4",
    ground: "#6a5844",
    wall: "#e8dcc4",
    fog: "#c8b89a",
    hemiSky: "#fff6e8",
    hemiGround: "#5a4a38",
    board: "#f2e6cc",
    sfx: "wood",
    stallLift: 1.05,
  },
  kitchen: {
    name: "厨房",
    objects: ["sausage", "egg", "mushroom", "garlic", "ham", "tofu", "dumpling", "baguette", "cleaver", "pan"],
    clear: "#c8a078",
    ground: "#5a3a28",
    wall: "#d8b898",
    fog: "#c4a07a",
    hemiSky: "#ffe8d0",
    hemiGround: "#4a2a18",
    board: "#e8d0b0",
    sfx: "veg",
    stallLift: 1.12,
  },
  night: {
    name: "夜市",
    objects: ["skewer", "bao", "waffle", "churro", "takoyaki", "corn_dog", "tanghulu", "boba", "sauce", "paper_bag"],
    clear: "#3a2460",
    ground: "#241838",
    wall: "#4a3080",
    fog: "#2a1848",
    hemiSky: "#ffd8a0",
    hemiGround: "#1a1028",
    board: "#5a3a28",
    sfx: "pastry",
    stallLift: 0.7,
  },
  toys: {
    name: "玩具箱",
    objects: ["block", "ball", "duck", "top", "yoyo", "whistle", "train", "robot", "teddy", "hammer"],
    clear: "#58b0e8",
    ground: "#2a6a98",
    wall: "#7ec8f0",
    fog: "#80c0e8",
    hemiSky: "#e8f8ff",
    hemiGround: "#245a80",
    board: "#ffe08a",
    sfx: "wood",
    stallLift: 0.38,
  },
  mineral: {
    name: "矿洞",
    objects: ["crystal", "geode", "coal", "gold_bar", "ruby", "emerald", "amethyst", "fossil", "pickaxe", "lantern"],
    clear: "#2a3048",
    ground: "#1a1c28",
    wall: "#3a4258",
    fog: "#242838",
    hemiSky: "#c8d0e8",
    hemiGround: "#181820",
    board: "#4a4e58",
    sfx: "wood",
    stallLift: 0.82,
  },
};

/** @type {Record<string, object>} */
export const ITEMS = {
  apple: { label: "苹果", family: "special", profile: "apple", tint: "#ff4a38", flesh: "#f3e6c4", glossy: true, axis: 0.5, axisMax: 0.68, realScale: 1, model: "assets/models/fruit/apple/apple.glb", slice: "assets/slices/fruit/apple.jpg", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  pear: { label: "梨", family: "special", profile: "pear", tint: "#e8ee58", flesh: "#efe8c0", glossy: true, axis: 0.62, axisMax: 1.45, realScale: 0.85, model: "assets/models/fruit/pear/pear.glb", slice: "assets/slices/fruit/pear.jpg", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  orange: { label: "橙子", family: "lathe", profile: "orange", tint: "#ff9a28", flesh: "#ff9c28", glossy: true, bumpy: true, squashY: 0.9, axis: 0.5, axisMax: 1.15, realScale: 1, model: "assets/models/fruit/orange/orange.glb", slice: "assets/slices/fruit/orange.jpg", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  banana: { label: "香蕉", family: "banana", profile: "banana", tint: "#ffe88a", flesh: "#f6e7a0", radius: 0.16, bend: 0.72, roughness: 0.5, axis: 0.78, axisMax: 1.7, realScale: 0.85, model: "assets/models/fruit/banana/banana.glb", slice: "assets/slices/fruit/banana.jpg", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  strawberry: { label: "草莓", family: "special", profile: "strawberry", tint: "#ff6a70", flesh: "#e85a68", glossy: true, axis: 0.42, axisMax: 0.98, realScale: 0.42, model: "assets/models/fruit/strawberry/strawberry.glb", slice: "assets/slices/fruit/strawberry.jpg", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  lemon: { label: "柠檬", family: "special", profile: "lemon", tint: "#ffe56a", flesh: "#fff3a8", glossy: true, bumpy: true, axis: 0.58, axisMax: 1.32, realScale: 0.75, model: "assets/models/fruit/lemon/lemon.glb", slice: "assets/slices/fruit/lemon.jpg", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  mango: { label: "芒果", family: "lathe", profile: "mango", tint: "#ff9a1a", flesh: "#ffb038", glossy: true, axis: 0.72, axisMax: 1.65, realScale: 0.95, model: "assets/models/fruit/mango/mango.glb", slice: "assets/slices/fruit/mango.jpg", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  peach: { label: "桃子", family: "lathe", profile: "peach", tint: "#ffb060", flesh: "#ffc888", glossy: true, squashY: 0.9, axis: 0.5, axisMax: 1.12, realScale: 0.92, model: "assets/models/fruit/peach/peach.glb", slice: "assets/slices/fruit/peach.jpg", keepRoot: true, keepUpright: true, envIntensity: 0.55 },
  kiwi: { label: "猕猴桃", family: "lathe", profile: "kiwi", tint: "#8a6a38", flesh: "#86b83a", bumpy: true, squashY: 0.78, axis: 0.48, axisMax: 1.08, realScale: 0.82, slice: "assets/slices/fruit/kiwi.jpg" },
  grape: { label: "葡萄", family: "cluster", tint: "#8a3860", flesh: "#e6d0dc", glossy: true, axis: 0.58, axisMax: 1.28, height: 0.42, realScale: 1.12 },
  juice: { label: "果汁", family: "prop", profile: "apple", tint: "#ff8a28", flesh: "#ffb048", glossy: true, axis: 0.48, realScale: 0.7, height: 0.42, model: "assets/models/fruit/juice/juice.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  fruit_box: { label: "水果礼盒", family: "prop", profile: "cheese", tint: "#c45a48", flesh: "#e8c090", box: true, axis: 0.5, realScale: 1.45, height: 0.32, depth: 0.28, model: "assets/models/fruit/fruit_box/fruit_box.glb", keepRoot: true, keepUpright: true, envIntensity: 0.55 },

  carrot: { label: "胡萝卜", family: "special", profile: "carrot", tint: "#ff7a28", flesh: "#ff9a40", bumpy: true, axis: 0.7, realScale: 0.7, bits: ["carrot"], model: "assets/models/veg/carrot/carrot.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  cucumber: { label: "黄瓜", family: "special", profile: "cucumber", tint: "#5aaa38", flesh: "#c8e878", bumpy: true, axis: 0.78, realScale: 0.7, bits: ["cucumber"], model: "assets/models/veg/cucumber/cucumber.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  corn: { label: "玉米", family: "special", profile: "corn", tint: "#f4cc38", flesh: "#ffe070", bumpy: true, axis: 0.62, realScale: 0.5, bits: ["corn"], model: "assets/models/veg/corn/corn.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  eggplant: { label: "茄子", family: "special", profile: "eggplant", tint: "#8a38b0", flesh: "#d8b0e8", glossy: true, axis: 0.7, realScale: 0.5, bits: ["eggplant"], model: "assets/models/veg/eggplant/eggplant.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  tomato: { label: "番茄", family: "lathe", profile: "apple", tint: "#e03828", flesh: "#f07060", glossy: true, squashY: 0.82, axis: 0.46, realScale: 0.85, bits: ["calyx"], model: "assets/models/veg/tomato/tomato.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  pepper: { label: "青椒", family: "lathe", profile: "eggplant", tint: "#3aa848", flesh: "#c8e878", glossy: true, axis: 0.58, realScale: 0.8, bits: ["calyx"], model: "assets/models/veg/pepper/pepper.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  radish: { label: "萝卜", family: "lathe", profile: "carrot", tint: "#f2f0ea", flesh: "#fff4e8", axis: 0.62, realScale: 0.55, bits: ["tops"], model: "assets/models/veg/radish/radish.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  pumpkin: { label: "南瓜", family: "lathe", profile: "orange", tint: "#f07818", flesh: "#f0c060", bumpy: true, squashY: 0.72, axis: 0.52, realScale: 1.85, bits: ["stem"], model: "assets/models/veg/pumpkin/pumpkin.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  potato: { label: "土豆", family: "lathe", profile: "lemon", tint: "#d2b06a", flesh: "#e8d0a0", bumpy: true, axis: 0.5, realScale: 0.95, bits: ["eyes"] },
  onion: { label: "洋葱", family: "lathe", profile: "apple", tint: "#e8c8a0", flesh: "#f4e8d0", glossy: true, axis: 0.46, realScale: 0.9, bits: ["tops"] },
  watering_can: { label: "洒水壶", family: "prop", profile: "apple", tint: "#3a8ad0", flesh: "#8ab8e0", axis: 0.55, realScale: 1.5, model: "assets/models/veg/watering_can/watering_can.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  sickle: { label: "镰刀", family: "prop", profile: "banana", tint: "#8a9088", flesh: "#c8ccc8", axis: 0.72, realScale: 0.55, radius: 0.04, bend: 0.7, model: "assets/models/veg/sickle/sickle.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },

  rose: { label: "玫瑰", family: "rose", profile: "rose", tint: "#e24a62", flesh: "#f090a0", glossy: true, axis: 0.78, height: 0.5, depth: 0.52, realScale: 0.7, model: "assets/models/flower/rose/rose.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  tulip: { label: "郁金香", family: "special", profile: "tulip", tint: "#e84820", flesh: "#f09070", glossy: true, axis: 0.9, height: 0.4, depth: 0.42, realScale: 0.45, bits: ["tulip"], model: "assets/models/flower/tulip/tulip.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  daisy: { label: "雏菊", family: "special", profile: "daisy", tint: "#fff8ee", flesh: "#fff4c8", axis: 0.9, height: 0.22, depth: 0.78, realScale: 0.7, bits: ["daisy"], model: "assets/models/flower/daisy/daisy.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  sunflower: { label: "向日葵", family: "special", profile: "sunflower", tint: "#f0c430", flesh: "#f8e070", axis: 0.9, height: 0.28, depth: 0.86, realScale: 0.85, bits: ["sunflower"], model: "assets/models/flower/sunflower/sunflower.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  lily: { label: "百合", family: "bloom", profile: "tulip", tint: "#fff4d8", flesh: "#fff8e8", bloom: { style: "egg", color: "#fff4d8", inner: "#f0c868", count: 6 }, axis: 0.88, height: 0.38, depth: 0.44, realScale: 0.8, model: "assets/models/flower/lily/lily.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  poppy: { label: "罂粟", family: "bloom", profile: "rose", tint: "#d42828", flesh: "#e86868", bloom: { style: "cup", color: "#d42828", inner: "#2a1a10", count: 6 }, axis: 0.8, height: 0.42, depth: 0.46, realScale: 0.55, model: "assets/models/flower/poppy/poppy.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  lavender: { label: "薰衣草", family: "spike", profile: "carrot", tint: "#a070d0", flesh: "#d0b8e8", axis: 0.82, height: 0.28, depth: 0.28, realScale: 0.68, model: "assets/models/flower/lavender/lavender.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  orchid: { label: "兰花", family: "bloom", profile: "tulip", tint: "#e878c8", flesh: "#f4c0e0", bloom: { style: "egg", color: "#e878c8", inner: "#fff0f8", count: 5 }, axis: 0.86, height: 0.4, depth: 0.48, realScale: 0.55, model: "assets/models/flower/orchid/orchid.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  carnation: { label: "康乃馨", family: "bloom", profile: "rose", tint: "#f090b0", flesh: "#f8c0d0", bloom: { style: "cup", color: "#f090b0", inner: "#e06890", count: 10 }, axis: 0.8, height: 0.44, depth: 0.48, realScale: 1.1 },
  bluebell: { label: "风铃草", family: "bloom", profile: "tulip", tint: "#5878e0", flesh: "#a0b4f0", bloom: { style: "egg", color: "#5878e0", inner: "#c8d4ff", count: 5 }, axis: 0.86, height: 0.36, depth: 0.4, realScale: 1.05 },
  hose: { label: "水管", family: "prop", profile: "orange", tint: "#3a78c8", flesh: "#88b0d8", axis: 0.55, realScale: 0.7, height: 0.22, depth: 0.52, model: "assets/models/flower/hose/hose.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  fertilizer: { label: "肥料", family: "prop", profile: "cheese", tint: "#c47828", flesh: "#e0b070", box: true, axis: 0.5, realScale: 0.9, height: 0.38, depth: 0.22, model: "assets/models/flower/fertilizer/fertilizer.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },

  cake: { label: "蛋糕", family: "cake", profile: "cake", tint: "#f4c8d4", flesh: "#fff0e0", glossy: true, axis: 0.48, height: 0.38, realScale: 1.2, model: "assets/models/pastry/cake/cake.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  bread: { label: "面包", family: "special", profile: "bread", tint: "#c48a42", flesh: "#f0d8a8", bumpy: true, roughness: 0.78, axis: 0.72, realScale: 1.15, bits: ["bread"], model: "assets/models/pastry/bread/bread.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  cheese: { label: "芝士", family: "cheese", profile: "cheese", tint: "#f0c43a", flesh: "#ffe080", box: true, axis: 0.42, height: 0.4, depth: 0.22, roughness: 0.68, realScale: 1.05, model: "assets/models/pastry/cheese/cheese.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  onigiri: { label: "饭团", family: "onigiri", profile: "onigiri", tint: "#f4f0e4", flesh: "#fff8ee", box: true, axis: 0.42, height: 0.58, depth: 0.34, roughness: 0.86, realScale: 0.85, model: "assets/models/pastry/onigiri/onigiri.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  croissant: { label: "可颂", family: "banana", profile: "banana", tint: "#e0a050", flesh: "#f4d090", radius: 0.16, bend: 0.72, roughness: 0.74, axis: 0.58, realScale: 0.55, model: "assets/models/pastry/croissant/croissant.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  donut: { label: "甜甜圈", family: "torus", tint: "#e890b0", flesh: "#f4c8d8", glossy: true, axis: 0.5, height: 0.22, depth: 0.52, realScale: 1.05, model: "assets/models/pastry/donut/donut.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  cookie: { label: "饼干", family: "lathe", profile: "orange", tint: "#c47828", flesh: "#e0a060", squashY: 0.28, axis: 0.42, realScale: 0.85, bits: ["chips"], model: "assets/models/pastry/cookie/cookie.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  bagel: { label: "贝果", family: "torus", tint: "#c48a48", flesh: "#e8c890", axis: 0.48, height: 0.18, depth: 0.48, realScale: 1.0, model: "assets/models/pastry/bagel/bagel.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  pie: { label: "派", family: "cake", profile: "cake", tint: "#d49038", flesh: "#f0c070", axis: 0.46, height: 0.28, realScale: 1.2 },
  pretzel: { label: "蝴蝶饼", family: "torus", tint: "#a86830", flesh: "#d4a070", axis: 0.5, height: 0.16, depth: 0.5, realScale: 1.05 },
  rolling_pin: { label: "擀面杖", family: "prop", profile: "pencil", tint: "#c48a52", flesh: "#e0b888", axis: 0.72, realScale: 0.55, radius: 0.07, height: 0.16, model: "assets/models/pastry/rolling_pin/rolling_pin.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  pastry_box: { label: "点心盒", family: "prop", profile: "cheese", tint: "#f4e0c0", flesh: "#fff4e0", box: true, axis: 0.55, realScale: 1.1, height: 0.22, depth: 0.28, model: "assets/models/pastry/pastry_box/pastry_box.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },

  lollipop: { label: "棒棒糖", family: "lollipop", profile: "lollipop", tint: "#e04870", flesh: "#f090b0", glossy: true, axis: 0.72, height: 0.46, depth: 0.46, realScale: 0.55, model: "assets/models/candy/lollipop/lollipop.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  chocolate: { label: "巧克力", family: "chocolate", profile: "chocolate", tint: "#5a2a14", flesh: "#8a4a28", box: true, axis: 0.42, height: 0.3, depth: 0.12, roughness: 0.48, realScale: 0.45, model: "assets/models/candy/chocolate/chocolate.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  macaron: { label: "马卡龙", family: "macaron", profile: "macaron", tint: "#f4a0b8", flesh: "#f8c8d8", glossy: true, axis: 0.38, height: 0.22, depth: 0.42, realScale: 0.5, model: "assets/models/candy/macaron/macaron.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  popsicle: { label: "冰棒", family: "popsicle", profile: "popsicle", tint: "#ff8098", flesh: "#ffb0c0", glossy: true, box: true, axis: 0.55, height: 0.22, depth: 0.14, roughness: 0.4, realScale: 0.4, model: "assets/models/candy/popsicle/popsicle.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  gumdrop: { label: "软糖", family: "lathe", profile: "strawberry", tint: "#58d070", flesh: "#a8e8b8", glossy: true, axis: 0.4, realScale: 0.35, model: "assets/models/candy/gumdrop/gumdrop.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  marshmallow: { label: "棉花糖", family: "capsule", tint: "#fff4f8", flesh: "#fff8fc", axis: 0.48, radius: 0.11, height: 0.22, realScale: 0.4, model: "assets/models/candy/marshmallow/marshmallow.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  candy_cane: { label: "拐杖糖", family: "banana", profile: "banana", tint: "#f4f0ea", flesh: "#ffe8e8", radius: 0.08, bend: 0.7, roughness: 0.35, axis: 0.6, realScale: 0.45, stripe: "#d42838", model: "assets/models/candy/candy_cane/candy_cane.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  mint: { label: "薄荷糖", family: "lathe", profile: "orange", tint: "#d8fff0", flesh: "#f0fff8", glossy: true, squashY: 0.22, axis: 0.36, realScale: 0.52, model: "assets/models/candy/mint/mint.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  gummy: { label: "小熊糖", family: "lathe", profile: "pear", tint: "#f07040", flesh: "#f8b090", glossy: true, axis: 0.42, realScale: 0.55 },
  wafer: { label: "威化", family: "box", tint: "#e8c078", flesh: "#f4dca8", box: true, axis: 0.5, height: 0.16, depth: 0.22, roughness: 0.62, realScale: 1.05 },
  candy_jar: { label: "糖果罐", family: "prop", profile: "apple", tint: "#e84870", flesh: "#f090a8", glossy: true, axis: 0.48, realScale: 0.85, height: 0.4, model: "assets/models/candy/candy_jar/candy_jar.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  tin: { label: "铁盒", family: "prop", profile: "orange", tint: "#d0b040", flesh: "#e8d078", glossy: true, squashY: 0.35, axis: 0.48, realScale: 0.9, model: "assets/models/candy/tin/tin.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },

  pencil: { label: "铅笔", family: "pencil", profile: "pencil", tint: "#f0c430", flesh: "#f8e090", axis: 1, roughness: 0.42, realScale: 0.45, model: "assets/models/stationery/pencil/pencil.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  eraser: { label: "橡皮", family: "eraser", profile: "eraser", tint: "#f2a4b6", flesh: "#f8c8d4", box: true, axis: 0.4, height: 0.22, depth: 0.42, roughness: 0.82, realScale: 0.4, model: "assets/models/stationery/eraser/eraser.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  crayon: { label: "蜡笔", family: "crayon", profile: "crayon", tint: "#3a68e8", flesh: "#88a8f0", axis: 0.52, roughness: 0.48, realScale: 0.22, model: "assets/models/stationery/crayon/crayon.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  ruler: { label: "尺子", family: "ruler", profile: "ruler", tint: "#e8d8a8", flesh: "#f4ead0", box: true, axis: 1, height: 0.36, depth: 0.055, roughness: 0.4, realScale: 0.35, model: "assets/models/stationery/ruler/ruler.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  pen: { label: "钢笔", family: "capsule", tint: "#2a4a8a", flesh: "#6888c0", glossy: true, axis: 0.7, radius: 0.045, height: 0.1, realScale: 0.2, model: "assets/models/stationery/pen/pen.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  marker: { label: "马克笔", family: "capsule", tint: "#e84828", flesh: "#f09078", axis: 0.6, radius: 0.07, height: 0.14, realScale: 0.25, model: "assets/models/stationery/marker/marker.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  chalk: { label: "粉笔", family: "capsule", tint: "#f4f0e4", flesh: "#fffaf0", axis: 0.5, radius: 0.055, height: 0.11, realScale: 0.18, model: "assets/models/stationery/chalk/chalk.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  glue: { label: "胶水", family: "capsule", tint: "#f8f4e8", flesh: "#fffaf0", axis: 0.52, radius: 0.08, height: 0.16, realScale: 0.32, model: "assets/models/stationery/glue/glue.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  sharpener: { label: "卷笔刀", family: "box", tint: "#e05050", flesh: "#f09090", box: true, axis: 0.32, height: 0.22, depth: 0.22, roughness: 0.5, realScale: 0.55 },
  notebook: { label: "笔记本", family: "box", tint: "#3a6ab0", flesh: "#f4f0e4", box: true, axis: 0.55, height: 0.42, depth: 0.08, roughness: 0.55, realScale: 1.25 },
  scissors: { label: "剪刀", family: "prop", profile: "banana", tint: "#8a98a8", flesh: "#c8d0d8", axis: 0.62, realScale: 0.4, model: "assets/models/stationery/scissors/scissors.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  inkwell: { label: "墨水瓶", family: "prop", profile: "apple", tint: "#1a2040", flesh: "#3a4878", glossy: true, axis: 0.4, realScale: 0.7, model: "assets/models/stationery/inkwell/inkwell.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },

  sausage: { label: "香肠", family: "capsule", tint: "#c45a48", flesh: "#e88878", axis: 0.62, radius: 0.09, height: 0.18, realScale: 0.45, model: "assets/models/kitchen/sausage/sausage.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  egg: { label: "鸡蛋", family: "lathe", profile: "lemon", tint: "#fff6dc", flesh: "#fff0b0", axis: 0.44, realScale: 0.7, model: "assets/models/kitchen/egg/egg.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  mushroom: { label: "蘑菇", family: "lathe", profile: "strawberry", tint: "#e8d0b8", flesh: "#f4e8d8", axis: 0.42, realScale: 0.7, bits: ["cap"], model: "assets/models/kitchen/mushroom/mushroom.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  garlic: { label: "蒜头", family: "lathe", profile: "apple", tint: "#f2ead4", flesh: "#fff8ee", axis: 0.4, realScale: 0.65, bits: ["tops"], model: "assets/models/kitchen/garlic/garlic.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  ham: { label: "火腿", family: "box", tint: "#e87890", flesh: "#f4b0c0", box: true, axis: 0.55, height: 0.28, depth: 0.22, roughness: 0.7, realScale: 1.1, model: "assets/models/kitchen/ham/ham.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  tofu: { label: "豆腐", family: "box", tint: "#f4f0e0", flesh: "#fffaf0", box: true, axis: 0.4, height: 0.28, depth: 0.28, roughness: 0.88, realScale: 0.95, model: "assets/models/kitchen/tofu/tofu.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  dumpling: { label: "饺子", family: "lathe", profile: "pear", tint: "#f0e0c0", flesh: "#fff4e0", axis: 0.4, squashY: 0.55, realScale: 0.7, model: "assets/models/kitchen/dumpling/dumpling.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  baguette: { label: "法棍", family: "lathe", profile: "bread", tint: "#d4a060", flesh: "#f0d8a8", bumpy: true, axis: 0.82, realScale: 0.85, model: "assets/models/kitchen/baguette/baguette.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  scallion: { label: "葱", family: "lathe", profile: "carrot", tint: "#4aaa48", flesh: "#c8e8a0", axis: 0.75, realScale: 1.7 },
  chili: { label: "辣椒", family: "lathe", profile: "carrot", tint: "#d42020", flesh: "#f07060", glossy: true, axis: 0.55, realScale: 1.15, bits: ["calyx"] },
  cleaver: { label: "菜刀", family: "prop", profile: "ruler", tint: "#c8d0d8", flesh: "#e8ecee", box: true, axis: 0.62, realScale: 0.45, height: 0.28, depth: 0.06, model: "assets/models/kitchen/cleaver/cleaver.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  pan: { label: "平底锅", family: "prop", profile: "orange", tint: "#4a5058", flesh: "#8a9098", glossy: true, axis: 0.62, realScale: 1.6, height: 0.12, depth: 0.58, model: "assets/models/kitchen/pan/pan.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },

  skewer: { label: "烤串", family: "capsule", tint: "#8a3a22", flesh: "#c87858", axis: 0.7, radius: 0.055, height: 0.12, realScale: 0.22, model: "assets/models/night/skewer/skewer.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  bao: { label: "包子", family: "lathe", profile: "apple", tint: "#fff4e0", flesh: "#fff8ee", squashY: 0.78, axis: 0.44, realScale: 0.85, model: "assets/models/night/bao/bao.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  waffle: { label: "华夫饼", family: "box", tint: "#e0a048", flesh: "#f0c878", box: true, axis: 0.48, height: 0.12, depth: 0.48, roughness: 0.7, realScale: 1.0, model: "assets/models/night/waffle/waffle.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  churro: { label: "吉拿棒", family: "capsule", tint: "#c47828", flesh: "#e0a060", axis: 0.62, radius: 0.06, height: 0.12, realScale: 0.28, model: "assets/models/night/churro/churro.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  takoyaki: { label: "章鱼烧", family: "lathe", profile: "apple", tint: "#c46a28", flesh: "#e09050", glossy: true, axis: 0.38, realScale: 0.7, model: "assets/models/night/takoyaki/takoyaki.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  corn_dog: { label: "玉米狗", family: "capsule", tint: "#e0a028", flesh: "#f0c060", axis: 0.62, radius: 0.09, height: 0.18, realScale: 0.4, model: "assets/models/night/corn_dog/corn_dog.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  tanghulu: { label: "糖葫芦", family: "cluster", tint: "#c42828", flesh: "#e86868", glossy: true, axis: 0.7, height: 0.28, cluster: "skewer", realScale: 0.22, model: "assets/models/night/tanghulu/tanghulu.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  boba: { label: "珍珠奶茶", family: "capsule", tint: "#e8c090", flesh: "#f4d8b0", glossy: true, axis: 0.48, radius: 0.12, height: 0.24, realScale: 0.7, model: "assets/models/night/boba/boba.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  yakitori: { label: "鸡肉串", family: "capsule", tint: "#a85828", flesh: "#d48858", axis: 0.65, radius: 0.06, height: 0.12, realScale: 1.55 },
  mochi: { label: "麻薯", family: "lathe", profile: "apple", tint: "#f8c0d0", flesh: "#ffe0e8", glossy: true, squashY: 0.7, axis: 0.38, realScale: 0.55 },
  sauce: { label: "酱瓶", family: "prop", profile: "apple", tint: "#c42828", flesh: "#e86848", glossy: true, axis: 0.48, realScale: 0.32, model: "assets/models/night/sauce/sauce.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  paper_bag: { label: "纸袋", family: "prop", profile: "cheese", tint: "#d4b078", flesh: "#ead4a8", box: true, axis: 0.5, realScale: 0.7, height: 0.42, depth: 0.22, model: "assets/models/night/paper_bag/paper_bag.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },

  block: { label: "积木", family: "box", tint: "#e04848", flesh: "#f09090", box: true, axis: 0.38, height: 0.32, depth: 0.32, roughness: 0.55, realScale: 0.7, model: "assets/models/toys/block/block.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  ball: { label: "皮球", family: "lathe", profile: "orange", tint: "#e84838", flesh: "#f09088", glossy: true, axis: 0.44, realScale: 0.95, model: "assets/models/toys/ball/ball.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  duck: { label: "小黄鸭", family: "lathe", profile: "pear", tint: "#ffe034", flesh: "#fff0a0", glossy: true, axis: 0.48, realScale: 1.0, bits: ["beak"], model: "assets/models/toys/duck/duck.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  top: { label: "陀螺", family: "lathe", profile: "strawberry", tint: "#3a8ae0", flesh: "#88b8f0", glossy: true, axis: 0.4, realScale: 0.7, model: "assets/models/toys/top/top.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  yoyo: { label: "悠悠球", family: "lathe", profile: "orange", tint: "#48a0e8", flesh: "#88c8f0", squashY: 0.42, axis: 0.4, realScale: 0.55, model: "assets/models/toys/yoyo/yoyo.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  whistle: { label: "哨子", family: "lathe", profile: "lemon", tint: "#d8dce0", flesh: "#f0f2f4", glossy: true, axis: 0.4, realScale: 0.4, model: "assets/models/toys/whistle/whistle.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  train: { label: "火车", family: "box", tint: "#c43030", flesh: "#e07070", box: true, axis: 0.58, height: 0.26, depth: 0.22, roughness: 0.48, realScale: 1.2, model: "assets/models/toys/train/train.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  robot: { label: "机器人", family: "box", tint: "#8a98a8", flesh: "#c0c8d0", box: true, axis: 0.4, height: 0.42, depth: 0.22, roughness: 0.4, realScale: 0.7, model: "assets/models/toys/robot/robot.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  rattle: { label: "拨浪鼓", family: "lollipop", profile: "lollipop", tint: "#f07090", flesh: "#f8b0c0", axis: 0.55, height: 0.36, depth: 0.36, realScale: 1.05 },
  crayon_box: { label: "蜡笔盒", family: "box", tint: "#f0c430", flesh: "#f8e080", box: true, axis: 0.5, height: 0.2, depth: 0.28, roughness: 0.55, realScale: 1.08 },
  teddy: { label: "小熊", family: "prop", profile: "pear", tint: "#c48a48", flesh: "#e0b888", axis: 0.5, realScale: 1.1, model: "assets/models/toys/teddy/teddy.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  hammer: { label: "玩具锤", family: "prop", profile: "pencil", tint: "#e04848", flesh: "#f09090", axis: 0.58, realScale: 0.5, model: "assets/models/toys/hammer/hammer.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },

  crystal: { label: "水晶", family: "lathe", profile: "carrot", tint: "#a8e0ff", flesh: "#d8f4ff", glossy: true, axis: 0.55, realScale: 0.8, model: "assets/models/mineral/crystal/crystal.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  geode: { label: "晶洞", family: "lathe", profile: "orange", tint: "#6a5a78", flesh: "#c8a0e0", bumpy: true, axis: 0.48, realScale: 0.95, model: "assets/models/mineral/geode/geode.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  coal: { label: "煤炭", family: "lathe", profile: "lemon", tint: "#2a2a30", flesh: "#4a4a50", bumpy: true, axis: 0.42, realScale: 0.8, model: "assets/models/mineral/coal/coal.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  gold_bar: { label: "金条", family: "box", tint: "#e0b020", flesh: "#f0d060", box: true, glossy: true, axis: 0.5, height: 0.16, depth: 0.22, roughness: 0.28, realScale: 0.5, model: "assets/models/mineral/gold_bar/gold_bar.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  ruby: { label: "红宝石", family: "lathe", profile: "apple", tint: "#c01838", flesh: "#e07088", glossy: true, axis: 0.4, realScale: 0.55, model: "assets/models/mineral/ruby/ruby.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  emerald: { label: "翡翠", family: "lathe", profile: "apple", tint: "#20a060", flesh: "#70d0a0", glossy: true, axis: 0.4, realScale: 0.75, model: "assets/models/mineral/emerald/emerald.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  amethyst: { label: "紫晶", family: "lathe", profile: "carrot", tint: "#7a48c0", flesh: "#b088e0", glossy: true, axis: 0.5, realScale: 0.85, model: "assets/models/mineral/amethyst/amethyst.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  fossil: { label: "化石", family: "lathe", profile: "lemon", tint: "#b8a078", flesh: "#d8c8a8", bumpy: true, axis: 0.5, realScale: 0.9, model: "assets/models/mineral/fossil/fossil.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  pebble: { label: "卵石", family: "lathe", profile: "lemon", tint: "#8a8a90", flesh: "#c0c0c4", bumpy: true, axis: 0.44, realScale: 0.7 },
  pearl: { label: "珍珠", family: "lathe", profile: "orange", tint: "#f4ead8", flesh: "#fff8f0", glossy: true, axis: 0.36, realScale: 0.38 },
  pickaxe: { label: "镐", family: "prop", profile: "banana", tint: "#6a7068", flesh: "#a8aca8", axis: 0.7, realScale: 2.2, model: "assets/models/mineral/pickaxe/pickaxe.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
  lantern: { label: "矿灯", family: "prop", profile: "apple", tint: "#c47828", flesh: "#f0d060", glossy: true, axis: 0.42, realScale: 0.55, model: "assets/models/mineral/lantern/lantern.glb", keepRoot: true, keepUpright: true, envIntensity: 0.7 },
};
for (const id of WORLD_ORDER) {
  const objects = WORLDS[id].objects;
  objects.forEach((type, i) => {
    const item = ITEMS[type];
    if (!item) return;
    if (i === objects.length - 1) item.rarity = "secret";
    else if (i === objects.length - 2) item.rarity = "rare";
    else if (!item.rarity) item.rarity = "common";
  });
}

export function getItem(type) {
  const item = ITEMS[type];
  if (!item) return { label: type, family: "lathe", profile: "apple", tint: "#c8c0b0", axis: 0.5, rarity: "common" };
  return item;
}

export function dailyThemeId(now = Date.now()) {
  const day = Math.floor(now / 86400000);
  return WORLD_ORDER[((day % WORLD_ORDER.length) + WORLD_ORDER.length) % WORLD_ORDER.length];
}

export function itemLabel(type) {
  return getItem(type).label || type;
}

export function worldOf(type) {
  for (const id of WORLD_ORDER) {
    if (WORLDS[id].objects.includes(type)) return id;
  }
  return WORLD_ORDER[0];
}

export function catalogSpec() {
  const out = {};
  for (const [id, item] of Object.entries(ITEMS)) {
    out[id] = { roughness: item.roughness ?? (item.glossy ? 0.38 : 0.58) };
    if (item.height != null) out[id].height = item.height;
    if (item.depth != null) out[id].depth = item.depth;
    if (item.radius != null) out[id].radius = item.radius;
    if (item.bend != null) out[id].bend = item.bend;
  }
  return out;
}

export function themeBlock() {
  const themes = { order: WORLD_ORDER, cutsPerTheme: 5 };
  for (const id of WORLD_ORDER) themes[id] = { ...WORLDS[id] };
  return themes;
}

export function boxTypeSet() {
  return new Set(Object.entries(ITEMS).filter(([, item]) => item.box).map(([id]) => id));
}
