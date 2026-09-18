/**
 * 门户 SDK 挂钩。CrazyGames / Poki 之后只往这里填，不要散落到玩法代码里。
 * 现在全部是空实现，接 SDK 时保持函数签名即可。
 */

export function onGameStart() {
  // sdk.gameplayStart()
}

export function onGameEnd(_score) {
  // sdk.gameplayStop()
}

export function onShowAd(_reason) {
  // 结算或返回菜单时的插屏
}

export function onHappyTime() {
  // CrazyGames: sdk.game.happytime()  破纪录、高连击
}
