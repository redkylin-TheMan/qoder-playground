// =========================================================
// 粮食小票工具函数 — 从主项目 formatUtil.js 1:1 移植
//  liangyizhilian-drying-pc-fe/src/views/grain/shared/formatUtil.js
// =========================================================

/** 数字千分位格式化 (最多 2 位小数), null/NaN 返回 '0' */
export function formatN(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** 金额转人民币大写 — 与主项目 amountInWords 完全一致 */
export function amountInWords(num) {
  num = Number(num) || 0;
  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
  let head = num < 0 ? '欠' : '';
  num = Math.abs(num);
  let s = '';
  for (let i = 0; i < fraction.length; i++) {
    s += (digit[Math.floor(num * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
  }
  s = s || '整';
  num = Math.floor(num);
  for (let i = 0; i < unit[0].length && num > 0; i++) {
    let p = '';
    for (let j = 0; j < unit[1].length && num > 0; j++) {
      p = digit[num % 10] + unit[1][j] + p;
      num = Math.floor(num / 10);
    }
    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
  }
  return head + s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整');
}

/** 验码: id 末 8 位 (跟后端 tail8 同算法), 用于模拟财务核验码 */
export function tail8(id) {
  if (!id) return '';
  const s = String(id).trim().toLowerCase();
  return s.length >= 8 ? s.slice(-8) : s;
}
