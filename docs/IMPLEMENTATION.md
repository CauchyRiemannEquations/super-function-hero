# v0.3 구현 상세

기존 v0.2의 HAZARD/ENEMY/CORE, 단단한 Gate, 강한 공중 착지, 아래 루트, 140ms 단일 입력 버퍼는 유지했습니다.

## 연속 Run

stage.ts는 150초 / 4 Section / 17 authored chunk를 정의합니다. EXIT_AFTER에는 각 패턴이 다음 블록으로 넘어가기 전에 필요한 최소 시간을 둡니다. CRASH_ROUTE는 경사로 복귀까지 7.3초를 확보합니다. 각 이벤트의 CORE/Gate 링크는 invocation namespace로 분리합니다. 랜덤 생성은 없습니다.

speedAt은 142 → 159.04의 네 목표 속도를 섹션 첫 4초 동안 선형으로 연결합니다. 기술 궤적과 시간은 바꾸지 않습니다. pacedSpec은 자동 달리기의 증가분을 스폰의 반응 lead에 반영합니다. 첫 가시의 긴 접근에는 3초, 다른 물체에는 기본 1초 budget을 사용합니다.

environment.ts의 palette는 3초 동안 RGB로 섞입니다. 도시 조명·공장 굴뚝·밤의 색과 배경, 전경·바닥이 섹션에 맞게 바뀝니다. React의 chapter 표시만 갱신하고 게임 상태를 reset하지 않습니다. 로딩 화면이나 중간 메뉴도 없습니다.

## 아트와 성능

assets.ts는 제공 PNG의 alpha bbox를 캔버스에 최대 384px로 캐시합니다. 원본 파일과 alpha를 보존합니다. 첫 준비가 끝나기 전 PLAY/Enter 시작을 막고, 재시작은 이미 읽은 에셋을 사용합니다. 이미지가 실패하면 기존 렌더링 fallback이 남아 있으나, 브라우저 검증에서 다섯 오브젝트 캐시가 모두 로드되어야 성공으로 판정합니다.

스프라이트를 적용한 가시는 104×56의 실제 충돌 크기로 맞췄습니다. 지상/공중 적은 타격 경로를, CORE는 역할별 활성화를 유지합니다. 제공 타이틀의 고정 UI를 분리하고 실제 버튼·로컬 기록을 올립니다. 전체 과정은 ASSETS.md에 기록했습니다.

## 패키지

npm test: 기존 물리·역할·버퍼 14개에, 패턴 exit window / 연속 속도 / 환경 혼합·반응 보정을 추가했습니다. npm run standalone은 이미지를 포함한 단일 HTML을 생성합니다. dist 이미지 URL뿐 아니라 상대 base의 new URL(file,import.meta.url)도 포장합니다.

모바일 가로의 동일 크기 프레임, 80px 좌우 2+2 버튼, safe-area, 균일 배율과 DPR을 유지합니다. 실제 장치 성능·오디오·네이티브 fullscreen/orientation API는 에뮬레이션으로 대체할 수 없으므로 별도 확인이 필요합니다.
