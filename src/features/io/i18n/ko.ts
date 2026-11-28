/** Import / export strings (`io.*`), loaded with the settings section (core/i18n `addMessages`). */
export const ko = {
  'io.title': '가져오기·내보내기',
  'io.desc':
    'Markdown·텍스트·HTML 파일(이미지 포함), Notion에서 "Markdown & CSV"로 내보낸 zip을 가져오거나, 이 워크스페이스를 Notion이 읽는 형식으로 내보냅니다. 내보낸 zip에는 WebNota 전용 정보(webnota.json)도 들어 있어 다시 가져오면 그대로 복원됩니다.',
  'io.import': '파일 가져오기',
  'io.importFolder': '폴더 가져오기',
  'io.filesSpace': '가져온 파일',
  'io.export': '모두 내보내기',
  'io.working': '처리 중…',
  'io.imported': '{pages}개 페이지, {databases}개 데이터베이스를 새 스페이스로 가져왔습니다',
  'io.skipped': '첨부 파일 {count}개는 가져오지 못했습니다',
  'io.exported': '{pages}개 페이지, {databases}개 데이터베이스를 내보냈습니다',
  'io.failed': '가져오지 못했습니다: {error}',
  'io.exportFailed': '내보내지 못했습니다: {error}',
  'io.nothing': '가져올 Markdown·텍스트·HTML·CSV 파일을 찾지 못했습니다',
  'io.notionSpace': 'Notion',
  'io.importedSpace': '가져온 페이지',
  'io.target': '가져올 곳',
  'io.targetNew': '새 스페이스',
  'io.targetCurrent': '현재 스페이스 ({name})',
  'io.cancel': '멈추기',
  'io.cancelled': '멈췄습니다. 그때까지 가져온 내용은 남아 있습니다.',
  'io.hintCurrent': '현재 스페이스 맨 아래에 추가합니다. 기존 페이지는 바뀌지 않습니다.',
  'io.hint': '가져오기는 항상 새 스페이스를 만들며 기존 페이지는 바뀌지 않습니다.',
}
export type IoKey = keyof typeof ko
