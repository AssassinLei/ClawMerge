// Add a new chain here; rules, gallery, renderer and order generation use this data.
const CHAINS = [
  {
    id: 'friends',
    name: '萌友家族',
    levels: [
      { id: 'pug', name: '哈巴狗', image: 'images/characters/pug.png', color: '#F4E1C6', reward: 8, note: '小小的开始，也有大大的可爱。' },
      { id: 'capybara', name: '水豚噜噜', image: 'images/characters/capybara.png', color: '#F8E6A2', reward: 20, note: '慢悠悠地笑，把烦恼都泡软。' },
      { id: 'cat', name: '月薪猫', image: 'images/characters/cat.png', color: '#E5E8F5', reward: 48, note: '发薪日的快乐，是猫猫给的。' },
      { id: 'kangaroo', name: '肥嘟嘟', image: 'images/characters/kangaroo.png', color: '#F9E7A5', reward: 112, note: '小手搭肚肚，快乐坐着等你来。' },
      { id: 'rabbit', name: '懵兔', image: 'images/characters/rabbit.png', color: '#FAE9E9', reward: 256, note: '嗯嗯，听懂了，又好像没懂。' },
      { id: 'dragon', name: '耳朵龙', image: 'images/characters/dragon.png', color: '#DDEDE2', reward: 576, note: '耳朵很大，听不听见全看心情。' },
      { id: 'bear', name: '黄油小熊', image: 'images/characters/bear.png', color: '#F5E4B7', reward: 1280, note: '像黄油一样，融化所有坏心情。' },
      { id: 'bird', name: '爪爪鸟', image: 'images/characters/bird.png', color: '#F6DDD9', reward: 2816, note: '把今天的小确幸，轻轻捧在爪爪里。' },
    ],
  },
  {
    id: 'snacks', name: '暖心饮品',
    levels: [
      { id: 'lemon-tea', name: 'VC柠檬茶', image: 'images/drinks/lemon-tea.png', color: '#F6E4A2', reward: 6, note: '一杯酸甜，把小院的阳光叫醒。' },
      { id: 'jasmine-milk', name: '茉莉奶绿', image: 'images/drinks/jasmine-milk.png', color: '#E1EACF', reward: 16, note: '淡淡茉莉香，慢慢喝就很好。' },
      { id: 'latte', name: '拿铁', image: 'images/drinks/latte.png', color: '#E9D5BD', reward: 38, note: '咖啡和牛奶，留给朋友的暖心一杯。' },
      { id: 'thai-tea', name: '泰奶红茶', image: 'images/drinks/thai-tea.png', color: '#F3CCA8', reward: 88, note: '橙棕色的香甜，像一场南洋午后。' },
      { id: 'chocolate-americano', name: '黑巧美式', image: 'images/drinks/chocolate-americano.png', color: '#D7C3B5', reward: 200, note: '黑巧遇见咖啡，浓浓的心意不必多说。' },
      { id: 'brown-sugar-boba', name: '黑糖珍珠', image: 'images/drinks/brown-sugar-boba.png', color: '#E5C8A5', reward: 450, note: '一颗颗软糯珍珠，把陪伴藏进甜味里。' },
      { id: 'guava-jasmine', name: '芭乐茉莉', image: 'images/drinks/guava-jasmine.png', color: '#F1CFCD', reward: 1000, note: '粉芭乐和茉莉香，像草坪上的小小庆典。' },
      { id: 'strawberry-boba', name: 'QQ美莓奶茶', image: 'images/drinks/strawberry-boba.png', color: '#F4C8D7', reward: 2200, note: '草莓果粒和Q弹珍珠，送给最想念的朋友。' },
    ],
  },
  {
    id: 'garden', name: '果香好礼',
    levels: [
      { id: 'coffee-beans', name: '咖啡豆', image: 'images/fruits/coffee-beans.png', color: '#DDC8B7', reward: 5, note: '小小一颗香气，叫醒小院的清晨。' },
      { id: 'almonds', name: '巴旦木坚果', image: 'images/fruits/almonds.png', color: '#EAD7B9', reward: 14, note: '把香脆的好心情，留一份给朋友。' },
      { id: 'blueberries', name: '蓝莓', image: 'images/fruits/blueberries.png', color: '#D9DCF2', reward: 34, note: '一捧蓝色小星星，藏着酸甜的惊喜。' },
      { id: 'apple', name: '苹果', image: 'images/fruits/apple.png', color: '#F2CFC9', reward: 80, note: '红扑扑的甜意，是今天的平安问候。' },
      { id: 'guava', name: '芭乐', image: 'images/fruits/guava.png', color: '#E1E8CC', reward: 184, note: '青绿的外衣里，装着粉粉的温柔。' },
      { id: 'lemon', name: '柠檬', image: 'images/fruits/lemon.png', color: '#F4E8A8', reward: 420, note: '酸一点也没关系，阳光会慢慢变甜。' },
      { id: 'tangerine', name: '沙糖桔', image: 'images/fruits/tangerine.png', color: '#F5D3AC', reward: 940, note: '剥开一瓣小太阳，分给身边的朋友。' },
      { id: 'pomelo', name: '柚子', image: 'images/fruits/pomelo.png', color: '#E9E7BF', reward: 2080, note: '厚厚的外衣，护着一份大大的团圆。' },
    ],
  },
];

const CONFIG = {
  version: 3,
  storageKey: 'paw-zoo-2.0-save',
  title: '爪爪动物园',
  columns: 7,
  rows: 7,
  initialEnergy: 100,
  orderSlots: 3,
  chains: CHAINS,
  // Each producer can contain weighted outputs from one or several chains.
  producers: [{ id: 'friends-home', name: '萌友小窝', energyCost: 1, outputs: [
    { chainId: 'friends', level: 1, weight: 65 },
    { chainId: 'friends', level: 2, weight: 20 },
    { chainId: 'friends', level: 3, weight: 10 },
    { chainId: 'friends', level: 4, weight: 5 },
  ] },
  { id: 'snack-cart', name: '暖心饮品吧', chainId: 'snacks', unlock: 1, energyCost: 1, outputs: [
    { chainId: 'snacks', level: 1, weight: 75 }, { chainId: 'snacks', level: 2, weight: 20 }, { chainId: 'snacks', level: 3, weight: 5 },
  ] },
  { id: 'seed-house', name: '果香小屋', chainId: 'garden', unlock: 2, energyCost: 1, outputs: [
    { chainId: 'garden', level: 1, weight: 80 }, { chainId: 'garden', level: 2, weight: 20 },
  ] }],
  starterFill: [{ chainId: 'friends', level: 1, count: 22 }, { chainId: 'friends', level: 2, count: 10 }],
  starterOrders: [
    { requirements: [{ chainId: 'friends', level: 3, quantity: 1 }, { chainId: 'friends', level: 2, quantity: 1 }] },
    { requirements: [{ chainId: 'friends', level: 4, quantity: 1 }, { chainId: 'friends', level: 3, quantity: 1 }] },
    { kind: 'challenge', requirements: [{ chainId: 'friends', level: 5, quantity: 1 }, { chainId: 'friends', level: 4, quantity: 1 }] },
  ],
  progression: { ordersPerChapter: 5, maxDifficulty: 4, chapterBonus: 50, refreshCost: 30, comboStart: 3, comboRewardCap: 6 },
  orderMix: { easyWeight: 60, mediumWeight: 30, advancedWeight: 10, easyMaxLevel: 3, easyMaxValue: 8, mediumMaxLevel: 5 },
  chapterNames: ['小院开张', '萌友聚会', '热闹街区', '合成大师'],
};

function getChain(chainId) { return CONFIG.chains.find(chain => chain.id === chainId); }
function getItem(item) {
  const chain = item && getChain(item.chainId);
  return chain && chain.levels[item.level - 1];
}
function isValidItem(item) {
  return !!item && Number.isInteger(item.level) && item.level > 0 && !!getItem(item);
}

module.exports = { CONFIG, getChain, getItem, isValidItem };
