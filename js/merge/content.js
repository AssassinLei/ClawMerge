// All authored progression is data, so new areas and episodes do not alter game rules.
const req = (chainId, level, quantity = 1) => ({ chainId, level, quantity });
const AREAS = [
  { id: 'gate', name: '迎风小院', subtitle: '让每一位朋友都有地方回家', color: '#E2EBCF', shape: 'gate', perk: '修复 1 次解锁饮品吧，2 次解锁果香小屋', lines: ['擦亮门牌', '铺好花径', '挂上灯串', '打开大门'],
    costs: [{coins: 40, stars: 2, items: [req('friends', 2)]}, {coins: 80, stars: 3, items: [req('snacks', 2)]}, {coins: 160, stars: 4, items: [req('garden', 3)]}, {coins: 240, stars: 5, items: [req('garden', 4), req('snacks', 3)]}] },
  { id: 'meadow', name: '噜噜草坪', subtitle: '不用赶路，也能到达幸福', color: '#D9EDD6', shape: 'meadow', perk: '居民离线收入提高；亲密礼物更有效', lines: ['整理草地', '安放木椅', '架起秋千', '围成野餐圈'],
    costs: [{coins: 100, stars: 3, items: [req('garden', 2, 2)]}, {coins: 180, stars: 4, items: [req('snacks', 3)]}, {coins: 280, stars: 5, items: [req('garden', 4)]}, {coins: 420, stars: 7, items: [req('snacks', 5)]}] },
  { id: 'pond', name: '月光水岸', subtitle: '在倒影里找回遗失的勇气', color: '#D9EBEB', shape: 'pond', perk: '仓库可扩至 12 格；每日奖励增加', lines: ['清理池塘', '修复石桥', '种下睡莲', '点亮水灯'],
    costs: [{coins: 160, stars: 4, items: [req('garden', 3, 2)]}, {coins: 260, stars: 5, items: [req('friends', 4)]}, {coins: 380, stars: 7, items: [req('garden', 4, 2)]}, {coins: 520, stars: 9, items: [req('garden', 5)]}] },
  { id: 'bakery', name: '暖糖厨房', subtitle: '为第一次来的人多留一杯饮料', color: '#F3E0D2', shape: 'bakery', perk: '饮品礼物加成；订单金币奖励增加', lines: ['整理茶台', '摆上长桌', '打开窗口', '举办分享会'],
    costs: [{coins: 240, stars: 5, items: [req('snacks', 3, 2)]}, {coins: 360, stars: 6, items: [req('snacks', 4)]}, {coins: 500, stars: 8, items: [req('friends', 5), req('snacks', 4)]}, {coins: 720, stars: 10, items: [req('snacks', 5, 2)]}] },
  { id: 'forest', name: '回声森林', subtitle: '每一种声音，都值得被听见', color: '#D6E3DA', shape: 'forest', perk: '拆分剪刀的庆典奖励增加', lines: ['清出小路', '找回风铃', '建起树屋', '邀请合唱团'],
    costs: [{coins: 340, stars: 6, items: [req('garden', 4)]}, {coins: 500, stars: 8, items: [req('friends', 6)]}, {coins: 680, stars: 9, items: [req('garden', 5)]}, {coins: 880, stars: 12, items: [req('friends', 6), req('snacks', 5)]}] },
  { id: 'sky', name: '星光山丘', subtitle: '把小小的心愿，放在最亮的地方', color: '#E5DFF1', shape: 'sky', perk: '最终开园纪念；离线收益提高', lines: ['修整台阶', '布置观星台', '放飞纸星星', '重新开园'],
    costs: [{coins: 480, stars: 8, items: [req('garden', 5)]}, {coins: 660, stars: 9, items: [req('friends', 7)]}, {coins: 880, stars: 12, items: [req('snacks', 5, 2)]}, {coins: 1200, stars: 15, items: [req('friends', 8), req('garden', 5)]}] },
];

const task = (title, type, target, text, extra = {}) => ({ title, type, target, text, ...extra });
const CHAPTERS = [
  { title: '一封没有署名的信', speaker: '哈巴狗', intro: '你收到一把生锈的钥匙，和一张只写着“这里还等着你”的明信片。门后，是一座很久没有开门的动物园。',
    tasks: [task('让小院热闹起来', 'merges', 4, '把四对相同的萌友合在一起，空荡的小院开始有了脚步声。'), task('第一次招呼客人', 'orders', 2, '完成两个心愿，赚到修复大门的第一笔积蓄。'), task('擦亮旧门牌', 'build', 1, '门牌背面刻着一个小爪印。哈巴狗说，它记得这个地方。', {area: 0}), task('给朋友一个家', 'resident', 1, '哈巴狗没有问你为什么回来，只把自己的小毯子带了过来。', {level: 1})],
    ending: '信的角落藏着一句话：“这里不是收藏动物的地方，是收藏一起度过的日子的地方。”你决定把这句话挂在门口。', choices: ['先摆一篮果实', '先点一盏灯'] },
  { title: '草坪上的慢时光', speaker: '水豚噜噜', intro: '噜噜拖着一张旧野餐垫出现：“先坐一下，再想怎么办。”它说草坪上曾经有一架秋千。',
    tasks: [task('带一点甜味回来', 'donate', 1, '把一杯茉莉奶绿留在野餐垫上。今天的风闻起来是甜的。', {items: [req('snacks', 2)]}), task('把草坪收拾好', 'build', 1, '先铺好小院花径，再整理草地。杂草里藏着秋千的绳子。', {area: 1}), task('噜噜决定住下来', 'resident', 1, '噜噜只带了一个空杯子：“以后，我们可以一起装满它。”', {level: 2}), task('第一份心意', 'gifts', 2, '送两杯饮料给居民。你开始知道他们各自喜欢什么。')],
    ending: '野餐垫下面有第二张明信片。画面上八个小爪印围着一颗树，可最后一个爪印只有一半。', choices: ['留下安静的角落', '准备分享的长桌'] },
  { title: '水面下的星星', speaker: '月薪猫', intro: '月薪猫把池塘称作“星星的存款箱”。它记得，有人曾把许愿纸折成小船，送向对岸。',
    tasks: [task('一捧蓝色小星星', 'donate', 1, '把两份蓝莓送到水边，陪等候小船的朋友分享一点酸甜。', {items: [req('garden', 3, 2)]}), task('让池塘重新呼吸', 'build', 1, '水清了，倒影里第一次映出了你。', {area: 2}), task('接回迷路的朋友', 'puzzles', 2, '在解救萌友中完成两关，学会给一步之外的未来留空间。'), task('打开第三间小屋', 'resident-count', 3, '三个朋友留下来，门口的钥匙串终于不再孤单。')],
    ending: '你在石桥底下发现一封旧信：“我走得匆忙，但不是不想回来。”你开始明白，寄信的人也许并没有遗忘这里。', choices: ['替它保存小船', '写一封新的回信'] },
  { title: '一杯奶茶的距离', speaker: '肥嘟嘟', intro: '肥嘟嘟坐在厨房门口，用小手搭着肚子：“我不渴，我是在等朋友。”茶台边还留着上一次野餐的手写饮品单。',
    tasks: [task('修复暖糖厨房', 'build', 1, '暖灯重新照亮窗口，奶茶的香气开始沿着小路散开。', {area: 3}), task('准备泰奶红茶', 'donate', 1, '这一杯泰奶不庆祝生日，只庆祝大家又聚在一起。', {items: [req('snacks', 4)]}), task('听听朋友的心事', 'friendship', 3, '让任意居民达到亲密 3 级，它会把一封只写给你的来信交出来。'), task('留出第四把椅子', 'resident-count', 4, '四位居民入住，长桌上的椅子终于都有人坐了。')],
    ending: '饮品单背面写着：“就算做不好，也有人愿意坐着等你。”懵兔点点头，替你喝完了那杯泡得有点浓的红茶。', choices: ['保留旧饮品单', '写上大家的名字'] },
  { title: '森林没有沉默', speaker: '耳朵龙', intro: '耳朵龙听见森林里有微弱的铃声。它有时听不清别人，却从没错过朋友需要它的声音。',
    tasks: [task('走进回声森林', 'build', 1, '一条新路出现，风铃在树叶后面轻轻响起。', {area: 4}), task('把甜意送给朋友', 'donate', 1, '两颗苹果献给那些没有说出口的感谢，愿朋友每天平安。', {items: [req('garden', 4, 2)]}), task('把信带给更多朋友', 'orders', 5, '完成五个心愿，把“动物园重新开门”的消息慢慢传出去。'), task('给森林一个拥抱', 'build', 3, '树屋的窗户亮起来，所有声音都有了可以停留的地方。', {area: 4})],
    ending: '铃铛里藏着最后一段留言：“寄信的人就是曾经期待这里的你。谢谢现在的你，替我们把门重新打开。”', choices: ['挂上所有风铃', '留一只铃铛给明天'] },
  { title: '开园的那一天', speaker: '爪爪鸟', intro: '爪爪鸟叼来一颗纸星星。没有人宣布庆典开始，朋友们只是自然地聚到了山丘上。',
    tasks: [task('把山丘交给星光', 'build', 1, '你们修好台阶，最慢的朋友也能一起看见星星。', {area: 5}), task('带一杯快乐出发', 'donate', 1, '把一杯黑巧美式带上山丘，再浓的心事，也能慢慢分享。', {items: [req('snacks', 5)]}), task('为所有小屋点灯', 'build-total', 18, '完成十八次园区修复。那些细小的努力，已经长成了一个家。'), task('把大门再打开一次', 'build', 4, '山丘的最后一盏灯亮了。你终于可以把“等你回来”改成“欢迎回家”。', {area: 5})],
    ending: '大门打开时，没有烟花，只有八种不同的脚步声。那封没有署名的信被放进图鉴的最后一页。动物园的故事没有结束：明天，也会有值得一起度过的日子。', choices: ['欢迎每一次回来', '把温柔传给下一位'] },
];

const RESIDENTS = [
  {level: 1, area: 0, favorite: 1, role: '门口的小小迎宾员', letters: ['我以前总担心，自己太普通，不会有人记得。你留下的第一把椅子让我知道：普通也有位置。', '今天我第一次敢跑到门口招呼陌生朋友。不是因为不害怕了，是因为知道你就在后面。', '如果哪天你很累，不用完成什么任务。回来摸摸我的头，就已经很好。']},
  {level: 2, area: 1, favorite: 2, role: '最会休息的草坪管家', letters: ['你坐下来时，我很高兴。快乐不必每次都用力追。', '我把最舒服的一块野餐垫留给你。你不来时，我也会替你晒晒太阳。', '我们把慢慢走的日子过成了好日子。谢谢你没有催我。']},
  {level: 3, area: 2, favorite: 3, role: '星星与零钱的收藏家', letters: ['我曾以为，攒够金币才有底气。后来发现，有人等着才是最大的存款。', '今天我把一颗最亮的星星记在账本上。备注写的是你的名字。', '账本的最后一页没有数字。那里是我们一起度过的时间。']},
  {level: 4, area: 3, favorite: 4, role: '长桌边的暖心伙伴', letters: ['大家都说我坐得太久。你却问我，是不是在等谁。谢谢你看见了等待。', '你送来的泰奶很好喝。但我喜欢的，是你愿意陪我坐一下。', '肚子里装着饮料，心里装着朋友。现在两边都满满的。']},
  {level: 5, area: 3, favorite: 6, role: '不太懂也愿意听的朋友', letters: ['嗯嗯。有些事我真的没听懂，但我知道你很认真。', '你难过的时候，我可以不说话，只坐在旁边。这个我很擅长。', '现在我懂了：不是每件事都要有答案。陪伴本身就是答案。']},
  {level: 6, area: 4, favorite: 5, role: '把心事听进心里的守林员', letters: ['我的耳朵很大，也常常漏听。不过你的脚步，我一直认得。', '我学会了问：“可以再说一次吗？”原来不必假装听懂，朋友也不会离开。', '森林里有很多声音。你让我相信，我的声音也值得被听见。']},
  {level: 7, area: 4, favorite: 7, role: '把温柔分给大家的主厨', letters: ['我想把每一顿饭都做好，可偶尔还是会烤糊。你说，那也算今天的味道。', '大家把我的厨房当成了客厅。这比任何赞美都让我开心。', '温柔可以像黄油一样，一点一点融进每一天。我们一起慢慢来。']},
  {level: 8, area: 5, favorite: 8, role: '替大家保管愿望的信使', letters: ['我收到过好多愿望，却不知道把它们放在哪里。现在，我把它们夹在果香小屋的留言板上。', '今天我飞过每一盏亮着的灯。那些光连起来，就像一个大大的爪印。', '明天的信还没写，但我知道寄往哪里。欢迎回家，亲爱的园长。']},
];
const FESTIVALS = [
  {name: '果香丰收', tag: '果实合成额外 +2 果香', chain: 'garden', color: '#DCE9CF', intro: '为第一次来访的朋友，在门口准备一篮新鲜果实。'},
  {name: '草坪野餐', tag: '饮品合成额外 +2 果香', chain: 'snacks', color: '#F5E6C5', intro: '今天的野餐，没有人需要一个人坐。'},
  {name: '星光邮局', tag: '动物合成额外 +2 星光', chain: 'friends', color: '#E5DFF0', intro: '把还没说出口的感谢，折成一颗纸星星。'},
];
const DAILY = [
  {id: 'merge', name: '整理小院', type: 'merges', target: 8},
  {id: 'orders', name: '传递心意', type: 'orders', target: 3},
  {id: 'puzzle', name: '今日救援', type: 'puzzles', target: 1},
];
module.exports = { AREAS, CHAPTERS, RESIDENTS, FESTIVALS, DAILY };
