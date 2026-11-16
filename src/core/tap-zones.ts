export type TapZone = 'prev' | 'toggle' | 'next'

export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 依据屏幕坐标判断点击区域：
 * 屏幕正中央的正方形用于开合菜单，其余区域按中线划分——
 * 左半屏固定上一页，右半屏固定下一页。
 */
export function resolveTapZone(rect: RectLike, x: number, y: number): TapZone {
  const side = Math.max(160, Math.min(360, Math.min(rect.width, rect.height) * 0.42))
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const insideSquare =
    Math.abs(x - centerX) <= side / 2 && Math.abs(y - centerY) <= side / 2
  if (insideSquare) return 'toggle'
  return x < centerX ? 'prev' : 'next'
}
