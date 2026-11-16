// SPDX-License-Identifier: AGPL-3.0-only
import type { HomericGender } from './types'

export type KinshipRole =
  | 'parent'
  | 'grandparent'
  | 'great-grandparent'
  | 'child'
  | 'sibling'
  | 'spouse'

const ROLE_LABELS: Record<KinshipRole, Record<HomericGender, string>> = {
  parent: { male: '父亲', female: '母亲', unknown: '父母' },
  grandparent: { male: '祖父', female: '祖母', unknown: '祖父母' },
  'great-grandparent': { male: '曾祖父', female: '曾祖母', unknown: '曾祖父母' },
  child: { male: '儿子', female: '女儿', unknown: '子女' },
  sibling: { male: '兄弟', female: '姐妹', unknown: '兄弟姐妹' },
  spouse: { male: '丈夫', female: '妻子', unknown: '配偶' },
}

export function kinshipRole(
  gender: HomericGender | null | undefined,
  relation: KinshipRole,
  locale: 'zh' | 'en' = 'zh',
) {
  return (locale === 'en' ? ENGLISH_ROLE_LABELS : ROLE_LABELS)[relation][gender || 'unknown']
}

const ENGLISH_ROLE_LABELS: Record<KinshipRole, Record<HomericGender,string>> = {
  parent:{male:'Father',female:'Mother',unknown:'Parent'},
  grandparent:{male:'Grandfather',female:'Grandmother',unknown:'Grandparent'},
  'great-grandparent':{male:'Great-grandfather',female:'Great-grandmother',unknown:'Great-grandparent'},
  child:{male:'Son',female:'Daughter',unknown:'Child'},
  sibling:{male:'Brother',female:'Sister',unknown:'Sibling'},
  spouse:{male:'Husband',female:'Wife',unknown:'Spouse'},
}
