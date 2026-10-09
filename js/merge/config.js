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
];

const CONFIG = {
  version: 2,
  storageKey: 'paw-zoo-save-v2',
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
