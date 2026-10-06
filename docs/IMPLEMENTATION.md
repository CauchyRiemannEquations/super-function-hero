# Super Function Hero · 현재 구현

React + TypeScript + Vite + Canvas. 캐릭터 이동은 requestAnimationFrame의 120Hz 고정 스텝으로 계산하고, 실제 좌표를 trail에 기록합니다.

## 오브젝트와 충돌

`objects.ts`에 WorldObject.role(hazard/enemy/core), kind, 실제 AABB 또는 경로 표적, link, open/dead를 둡니다. 단단한 위험물은 확장한 AABB와 이동 구간을 검사해 빠른 기술이 통과하지 못하게 합니다. Gate는 CORE와 namespace:link로 연결합니다. 닫힌 Gate는 플레이어 x를 벽 앞에 제한합니다. 충돌은 피격 무적 1.1초를 적용하며, 계속 막혀 있으면 다시 HP를 잃습니다.

적은 optional입니다. 일반 몸 접촉과 미타격은 HP 손실을 주지 않으며, 실제 공격 경로가 닿으면 점수·콤보·PERFECT를 얻습니다. 일반 CORE는 공격 경로, 충격판·금 간 바닥은 공중 급강하 착지 조건을 검사합니다. 전체 11개 CORE를 활성화해야 Clear입니다.

## 급강하

기존 전진 220 / 0.5초에서 **전진 120 / 0.34초**로 줄여 빠른 하강과 제동 역할을 줬습니다. 개형은 normalized t²를 유지합니다. 수학 y축과 화면 y축의 부호 차이를 고려합니다.

급강하 시작 때 바닥보다 95 이상 높으면 강한 충격입니다. 직전 동작이 약한 지상 급강하라면 연타해도 강해지지 않습니다. 약한 지상 급강하는 기존 짧은 hop을 유지하며 지상 적 공격 범위 40, 강한 공중 급강하는 85의 착지 범위입니다. 일반 낙하는 중력 480으로 더 느리며, 급강하로 천장 전에 내려오는 플레이를 지원합니다.

## 아래 루트

CRASH CORE 착지 타격 시 바닥 기준이 348 → 448이 됩니다. 실제 중력 낙하와 수직 카메라로 이동하며 좌표를 순간 이동시키지 않습니다. 파괴된 위층 가장자리와 아래층 바닥을 그립니다. 4.5초 유지 후 0.8초 경사로로 복귀합니다. 아래에서 발동한 급강하는 해당 층의 바닥에 착지합니다.

## 패턴

`stage.ts`의 PATTERNS와 COURSE에 직접 설계한 이름 있는 블록, 내부 이벤트와 60초 연결 순서를 둡니다. 같은 패턴을 사용할 때도 invocation별 namespace로 CORE/Gate 링크를 분리합니다. 스폰은 각 이벤트의 현재 플레이어 위치와 해당 층 바닥을 기준으로 합니다. 랜덤 연결은 없습니다.

## 화면

TitleScreen은 역할 범례와 실제 Canvas 배경을 같은 프레임에서 보여줍니다. 가로 모드에서는 ready도 immersive를 유지하고, 숨긴 터치 컨트롤의 영역을 계속 측정해 시작 시 Canvas 크기와 배율이 유지됩니다. safe-area와 DPR, 균일 배율, resize 시 카메라 기준을 갱신합니다.

`npm test`는 기존 궤적·입력과 HAZARD 불파괴, ENEMY 타격, 강한 착지, 약한 연타 방지, Gate 링크, 이동 구간 충돌, 아래 루트 착지를 검사합니다. `npm run standalone`은 artifacts의 단일 HTML을 다시 생성합니다. 개발 모드에서만 FPS·좌표·hitbox·속도·무적·스폰 도구와 window.__curveGame을 제공합니다.
