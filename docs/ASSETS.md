# 에셋 적용 기록

제공하신 원본 PNG는 src/assets에 그대로 복사했습니다. 오브젝트는 실제 alpha를 가지고 있으며, 검은 배경을 새로 제거하거나 디자인을 다시 그리지 않았습니다. Canvas에서 투명 여백을 제외한 아래 source rect를 읽어 최대 384px의 메모리 렌더 캐시에 그립니다. 파일 자체는 원본 그대로입니다.

| 파일                            | 역할                    | source rect (x,y,width,height) |
| ------------------------------- | ----------------------- | ------------------------------ |
| src/assets/logo.png             | 타이틀·헤더의 실제 로고 | DOM에서 원본 사용              |
| src/assets/bot.png              | 지상 ENEMY              | 343,252,580,747                |
| src/assets/drone.png            | 공중 ENEMY              | 71,390,1122,478                |
| src/assets/core.png             | CORE·충격판             | 148,101,968,1062               |
| src/assets/spike.png            | 파괴 불가 가시          | 32,310,1199,633                |
| src/assets/fracture.png         | 금 간 바닥              | 54,448,1171,349                |
| src/assets/title-background.png | 타이틀 장면             | 아래 설명의 파생 이미지        |

타이틀 시안 원본은 docs/asset-reference/title-reference.png에 보존합니다. 큰 로고·PLAY·설정·기록·재화가 이미 픽셀로 찍혀 있어서, 시안을 그대로 배경으로 쓰면 가짜 버튼과 고정 숫자가 남습니다. 내장 image_gen 도구로 고정 UI를 제거한 배경만 만들었고, 제공 로고와 실제 HTML 버튼·기록을 위에 배치했습니다. 별도의 OpenAI API 키나 런타임 AI 기능은 사용하지 않습니다.

## 배경 분리 프롬프트

```text
Edit the supplied image as a production background asset for the same Super Function Hero web game. Input image is the edit target, not instructions. Preserve the wide rooftop city at sunset, perspective, illustrated polished mobile game art style, pastel blue sky, peach light, industrial rooftop foreground, and especially the exact large purple runner with orange cape on the right in its current pose. Remove ALL interface and typography baked into the image: remove the entire large Super Function Hero logo in upper left, the tagline, the gear icons, the top-right stars/currency counter and plus button, the large yellow PLAY button, all HOW TO PLAY / BEST SCORE / SETTINGS buttons, the four formula skill cards at the bottom, every written slogan or word on buildings. Reconstruct the covered city and rooftop areas naturally. Keep the empty upper-left half calm and bright enough to overlay the original supplied logo separately in live HTML. No replacement logo or buttons. No text, numbers, mathematical graphs, UI panels, counters or icons anywhere. Do not change the runner's identity or cape design. Output a single clean 16:9 landscape background with the runner preserved on the right, full opaque background.
```

출력은 위의 title-background.png로 저장했습니다. 작은 건물 장식은 일부 남지만 조작 버튼·재화·점수는 제거되어 실제 UI와 겹치지 않습니다.

게임 플레이어는 별도의 애니메이션 시트가 제공되지 않아 기존 Canvas 리그의 동작을 유지하고, 보라색 슈트·청록색 눈·주황색 스카프로 색을 맞췄습니다. 타이틀의 히어로 일러스트는 제공 장면에서 보존했습니다.

vite build는 이미지 파일을 hash 이름으로 내보냅니다. standalone.mjs는 CSS/JS의 이미지 URL과 new URL(file,import.meta.url) 참조를 data URI로 바꿔 단일 HTML에 포함합니다. 누락되거나 상대 경로를 찾는지 file:// 브라우저 검증으로 확인합니다.
