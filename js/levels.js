'use strict';
// 关卡设计。坐标：弹弓在 x=0，地面 y=0，单位米。
// B.box(材质, 中心x, 底部y, 宽, 高)  B.col 立柱  B.plank 横板  B.frame 门框(两柱+横梁，返回顶部高度)
// B.pig(类型, x, 底部y)  B.tnt(x, y)  B.ball(材质, x, 底部y, 半径)  B.tri(材质, x, 底部y, 宽, 高, 'up'|'l'|'r')
// B.terrain([[x,y],...]) 静态地形(逆时针凸多边形)  B.hill(x0, x1, 高)
const LEVELS = [
  {
    name: '初出茅庐', theme: 'day', birds: ['red', 'red', 'red'],
    tip: '按住弹弓上的小鸟往后拉，松手发射！',
    build(B) {
      let y = B.frame('wood', 22, 0, 2.6, 2.2);
      B.pig('small', 22, 0);
      B.pig('medium', 22, y);
      B.box('wood', 24.6, 0, 0.8, 0.8);
      B.box('wood', 24.6, 0.8, 0.8, 0.8);
      y = B.frame('wood', 27.5, 0, 2.6, 2.2);
      B.pig('small', 27.5, 0);
      const y2 = B.frame('wood', 27.5, y, 2.0, 1.6);
      B.pig('small', 27.5, y);
      B.tri('wood', 27.5, y2, 2.0, 0.9, 'up');
    },
  },
  {
    name: '冰雪小屋', theme: 'snow', birds: ['blue', 'blue', 'red'],
    tip: '蓝鸟：飞行中点击屏幕，一分为三！对冰块特别有效。',
    build(B) {
      let y = B.frame('ice', 21, 0, 2.4, 1.8);
      B.pig('small', 21, 0);
      y = B.frame('ice', 21, y, 2.4, 1.8);
      B.pig('small', 21, y - 2.1);
      B.pig('medium', 21, y);
      y = B.frame('wood', 27, 0, 3.0, 1.8);
      B.pig('medium', 27, 0);
      const y2 = B.frame('ice', 27, y, 2.2, 1.4);
      B.pig('small', 27, y);
      B.box('ice', 26.3, y2, 0.7, 0.7);
      B.box('ice', 27.7, y2, 0.7, 0.7);
      B.tri('ice', 27, y2 + 0.7, 2.2, 0.8, 'up');
      B.box('ice', 24, 0, 0.6, 0.6);
      B.box('ice', 24, 0.6, 0.6, 0.6);
    },
  },
  {
    name: '黄色闪电', theme: 'day', birds: ['yellow', 'yellow', 'red'],
    tip: '黄鸟：飞行中点击屏幕，瞬间加速冲刺！木头一撞就碎。',
    build(B) {
      let y = B.frame('wood', 23, 0, 2.0, 2.4);
      y = B.frame('wood', 23, y, 2.0, 2.4);
      B.pig('small', 23, y - 2.7);
      y = B.frame('wood', 23, y, 1.6, 1.8);
      B.pig('medium', 23, y);
      B.col('wood', 26.2, 0, 1.2); B.col('wood', 28.2, 0, 1.2);
      B.plank('wood', 27.2, 1.2, 2.6);
      B.pig('small', 27.2, 0);
      y = B.frame('wood', 31.5, 0, 2.0, 2.4);
      y = B.frame('wood', 31.5, y, 2.0, 2.4);
      B.pig('medium', 31.5, y - 2.7);
      B.pig('medium', 31.5, y);
    },
  },
  {
    name: '石头碉堡', theme: 'day', birds: ['black', 'red', 'black'],
    tip: '炸弹鸟：点击引爆，或者撞击后自动爆炸。石头也扛不住！',
    build(B) {
      B.frame('stone', 23.5, 0, 2.6, 1.8);
      B.pig('medium', 23.5, 0);
      B.frame('stone', 27, 0, 2.6, 1.8);
      B.pig('medium', 27, 0);
      B.plank('stone', 25.25, 2.1, 6.2);
      const y = B.frame('stone', 25.25, 2.4, 3.0, 1.6);
      B.pig('helmet', 25.25, 2.4);
      B.tri('stone', 24.35, y, 1.2, 0.8, 'l');
      B.tri('stone', 26.15, y, 1.2, 0.8, 'r');
      B.box('wood', 30.5, 0, 0.9, 0.9);
      B.pig('small', 30.5, 0.9);
    },
  },
  {
    name: 'TNT 派对', theme: 'sunset', birds: ['red', 'red', 'yellow'],
    tip: '打中 TNT 箱子会引发大爆炸，连锁反应更刺激！',
    build(B) {
      B.frame('wood', 21, 0, 2.4, 2.0);
      B.pig('small', 21, 0);
      B.tnt(23.2, 0);
      B.frame('wood', 25.4, 0, 2.4, 2.0);
      B.pig('medium', 25.4, 0);
      B.plank('wood', 23.2, 2.3, 6.8);
      B.tnt(23.2, 2.6);
      B.frame('stone', 21.2, 2.6, 2.0, 1.5);
      B.pig('small', 21.2, 2.6);
      B.frame('stone', 25.2, 2.6, 2.0, 1.5);
      B.pig('small', 25.2, 2.6);
      B.box('stone', 32.5, 0, 0.6, 2.4);
      B.box('stone', 32.5, 2.4, 1.0, 0.4);
      B.tnt(35.5, 0);
      B.plank('ice', 35.5, 0.9, 2.0);
      B.pig('medium', 35.5, 1.2);
      B.box('wood', 38, 0, 0.6, 2.4);
      B.tnt(38, 2.4);
      B.pig('small', 39.5, 0);
    },
  },
  {
    name: '高山堡垒', theme: 'day', birds: ['yellow', 'red', 'black', 'blue'],
    tip: '猪猪躲在悬崖上，试试抛物线高吊射！',
    build(B) {
      B.hill(26, 38, 4.5);
      const b = 4.5;
      B.frame('wood', 29, b, 2.6, 2.0);
      B.pig('medium', 29, b);
      B.frame('wood', 33, b, 2.6, 2.0);
      B.pig('medium', 33, b);
      B.plank('wood', 31, b + 2.3, 6.6);
      const y = B.frame('ice', 31, b + 2.6, 2.4, 1.6);
      B.pig('helmet', 31, b + 2.6);
      B.tri('ice', 31, y, 2.4, 1.0, 'up');
      B.box('stone', 21, 0, 0.6, 2.6);
      B.box('stone', 21, 2.6, 1.2, 0.5);
      B.pig('small', 22.6, 0);
      B.box('wood', 36.5, b, 0.8, 0.8);
      B.pig('small', 36.5, b + 0.8);
    },
  },
  {
    name: '蛋蛋空袭', theme: 'sunset', birds: ['white', 'white', 'red'],
    tip: '白鸟：飞到猪猪头顶时点击，扔下炸弹蛋！',
    build(B) {
      B.box('stone', 20.5, 0, 0.9, 4.6);
      B.col('stone', 24, 0, 1.6, 0.6);
      B.col('stone', 29, 0, 1.6, 0.6);
      B.plank('wood', 26.5, 1.6, 6.0);
      B.pig('small', 25.5, 0);
      B.pig('small', 27.5, 0);
      const y = B.frame('wood', 26.5, 1.9, 2.6, 1.4);
      B.pig('medium', 26.5, 1.9);
      B.tri('ice', 26.5, y, 2.6, 1.0, 'up');
      B.box('stone', 32.5, 0, 0.9, 4.6);
      B.pig('medium', 34.5, 0);
    },
  },
  {
    name: '多米诺骨牌', theme: 'day', birds: ['red', 'blue', 'yellow'],
    tip: '推倒第一块，剩下的交给物理！',
    build(B) {
      const xs = [18.5, 20.1, 21.7, 23.3, 24.9, 26.5];
      xs.forEach(x => B.col('wood', x, 0, 3.6, 0.35));
      B.pig('small', 19.3, 0);
      B.pig('small', 22.5, 0);
      B.pig('small', 25.7, 0);
      let y = B.frame('ice', 30, 0, 3.0, 2.0);
      B.pig('large', 30, 0);
      y = B.frame('ice', 30, y, 2.0, 1.4);
      B.pig('small', 30, y - 1.7);
      B.pig('medium', 30, y);
    },
  },
  {
    name: '滚石落下', theme: 'sunset', birds: ['red', 'yellow', 'red'],
    tip: '打掉挡住石球的木桩，让巨石滚下山坡！',
    build(B) {
      B.terrain([[13.5, 0], [19, 0], [19, 6.0], [13.5, 6.0]]);
      B.terrain([[19, 0], [31, 0], [19, 6.0]]);
      B.col('wood', 18.78, 6.0, 1.0, 0.3);
      B.ball('stone', 17.55, 6.0, 0.7);
      B.ball('stone', 15.95, 6.0, 0.75);
      B.pig('small', 14.5, 6.0);
      B.frame('wood', 33, 0, 2.4, 1.8);
      B.pig('medium', 33, 0);
      B.pig('small', 35.6, 0);
      B.frame('wood', 38.2, 0, 2.4, 1.8);
      B.pig('medium', 38.2, 0);
      B.pig('small', 38.2, 2.1);
    },
  },
  {
    name: '猪猪摩天楼', theme: 'day', birds: ['red', 'yellow', 'black', 'blue'],
    tip: '从下面打还是从上面打？摩天楼一倒，全部完蛋！',
    build(B) {
      let y = B.frame('stone', 26, 0, 3.2, 2.0);
      B.pig('medium', 26, 0);
      y = B.frame('wood', 26, y, 3.2, 2.0);
      B.pig('helmet', 26, y - 2.3);
      y = B.frame('ice', 26, y, 2.8, 1.8);
      B.pig('small', 26, y - 2.1);
      y = B.frame('wood', 26, y, 2.4, 1.9);
      B.pig('king', 26, y - 2.2);
      B.tri('stone', 26, y, 2.4, 1.0, 'up');
      y = B.frame('wood', 31.5, 0, 2.2, 2.0);
      y = B.frame('wood', 31.5, y, 2.2, 2.0);
      B.pig('small', 31.5, y - 2.3);
      B.pig('medium', 31.5, y);
      B.box('ice', 21.5, 0, 0.8, 0.8);
      B.box('ice', 21.5, 0.8, 0.8, 0.8);
      B.pig('small', 21.5, 1.6);
    },
  },
  {
    name: '冰雪宫殿', theme: 'snow', birds: ['blue', 'blue', 'yellow', 'black'],
    tip: '巨大的冰宫！蓝鸟碎冰，炸弹鸟收尾。',
    build(B) {
      for (const [x, t] of [[22, 'small'], [25.5, 'medium'], [29, 'medium'], [32.5, 'small']]) {
        B.frame('ice', x, 0, 2.6, 1.8);
        B.pig(t, x, 0);
      }
      B.tnt(23.75, 0);
      B.tnt(30.75, 0);
      B.plank('ice', 23.75, 2.1, 6.4);
      B.plank('ice', 30.75, 2.1, 6.4);
      B.frame('ice', 23.75, 2.4, 3.0, 1.8);
      B.pig('helmet', 23.75, 2.4);
      B.frame('ice', 30.75, 2.4, 3.0, 1.8);
      B.pig('helmet', 30.75, 2.4);
      B.plank('ice', 27.25, 4.5, 10.2);
      const y = B.frame('wood', 27.25, 4.8, 2.4, 1.6);
      B.pig('large', 27.25, 4.8);
      B.pig('medium', 27.25, y);
      B.tri('ice', 25.2, 4.8, 1.2, 1.2, 'l');
      B.tri('ice', 29.3, 4.8, 1.2, 1.2, 'r');
    },
  },
  {
    name: '猪王城堡', theme: 'night', birds: ['terence', 'yellow', 'black', 'white', 'blue'],
    tip: '最终决战！大红鸟登场，推翻猪王的城堡！',
    build(B) {
      B.hill(25.5, 39.5, 1.5);
      const b = 1.5;
      B.box('stone', 21.4, 0, 0.6, 3.4);
      B.box('stone', 22.6, 0, 0.6, 3.4);
      B.plank('stone', 22, 3.4, 1.8, 0.4);
      B.pig('small', 22, 3.8);
      B.pig('mustache', 24.2, 0);
      B.frame('stone', 27.5, b, 2.6, 2.0);
      B.pig('helmet', 27.5, b);
      B.tnt(30, b);
      B.frame('stone', 32.5, b, 2.6, 2.0);
      B.pig('helmet', 32.5, b);
      B.plank('stone', 30, b + 2.3, 6.6);
      B.frame('wood', 28.2, b + 2.6, 2.2, 1.8);
      B.pig('small', 28.2, b + 2.6);
      B.frame('wood', 31.8, b + 2.6, 2.2, 1.8);
      B.pig('small', 31.8, b + 2.6);
      B.plank('wood', 30, b + 4.7, 6.0);
      const y = B.frame('stone', 30, b + 5.0, 2.8, 2.0);
      B.pig('king', 30, b + 5.0);
      B.tri('ice', 30, y, 2.8, 1.2, 'up');
      let y2 = B.frame('wood', 37, b, 2.4, 2.0);
      y2 = B.frame('wood', 37, y2, 2.0, 1.6);
      B.pig('medium', 37, y2 - 1.9);
      B.pig('small', 37, y2);
      B.tnt(35, b);
    },
  },
];
