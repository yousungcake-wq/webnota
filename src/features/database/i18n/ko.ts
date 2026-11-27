/** Database strings (`db.*`), loaded with the database chunk (core/i18n `addMessages`). */
export const ko = {
  'db.comingSoon': '데이터베이스는 준비 중입니다',
  'db.field.name': '이름',
  'db.missing': '데이터베이스를 찾을 수 없습니다',
  'db.comingSoonHint': '다음 업데이트에서 표 보기를 쓸 수 있습니다',
  'db.type.text': '텍스트',
  'db.type.number': '숫자',
  'db.type.select': '선택',
  'db.type.multiSelect': '다중 선택',
  'db.type.date': '날짜',
  'db.type.checkbox': '체크박스',
  'db.type.checklist': '체크리스트',
  'db.type.url': 'URL',
  'db.type.createdTime': '만든 시각',
  'db.type.updatedTime': '수정한 시각',
  'db.type.media': '파일·미디어',
  'db.type.time': '소요 시간',
  'db.type.relation': '관계',
  'db.type.rollup': '롤업',
  'db.type.person': '사람',
  'db.url.open': '링크 열기',
  'db.url.copy': '링크 복사',
  'db.copied': '복사했습니다',
  'db.grid.label': '{title} 표',
  'db.cell.edit': '셀 편집',
}

export type DbKey = keyof typeof ko
