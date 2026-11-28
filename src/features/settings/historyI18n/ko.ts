/** Repository history strings (SY-03, M6-09), loaded with the settings section (not the boot dictionary). */
export const ko = {
  'history.size': '저장소 크기: {size}',
  'history.sizeUnknown': '저장소 크기: 알 수 없음',
  'history.big': '저장소가 큽니다. 기록 정리를 권장합니다.',
  'history.run': '저장소 기록 정리',
  'history.running': '기록 정리 중…',
  'history.confirmTitle': '저장소 기록을 정리할까요?',
  'history.confirm':
    '지금 상태만 남기고 GitHub의 이전 커밋 기록을 지웁니다. 데이터는 그대로이며 다른 기기도 계속 동기화됩니다. 되돌릴 수 없으니, 다른 기기에서 먼저 동기화를 마쳐 주세요.',
  'history.confirmRun': '기록 정리',
  'history.done': '저장소 기록을 정리했습니다',
  'history.moved': '그 사이 다른 기기가 저장해서 정리하지 않았습니다. 잠시 뒤 다시 시도하세요.',
  'history.empty': '정리할 기록이 없습니다',
  'history.hint': '커밋 기록이 쌓여 저장소가 커지면 지금 상태로 새로 시작합니다 (GitHub가 크기를 늦게 갱신할 수 있음).',
}
export type HistoryKey = keyof typeof ko
