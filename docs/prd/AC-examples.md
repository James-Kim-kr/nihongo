# 수용 기준(Gherkin) 예시

## 학생 적응 학습
```
Feature: Adaptive practice after diagnostic
  Scenario: Remediate for low mastery
    Given 학생이 10문항 진단을 완료했다
    And 정답률이 40% 이하이다
    When 다음 학습 세션을 시작한다
    Then 하향 난이도와 핵심 개념 복습이 포함된다
    And 목표 개념에 대한 미니레슨이 제시된다
```

## 교사 과제 배포
```
Feature: Assignment publish
  Scenario: Class-wide assignment with rubric
    Given 교사가 반 A를 선택했다
    And 단원 B의 과제를 구성했다
    When 과제를 배포한다
    Then 마감·배점·루브릭이 반영된다
    And 학생 앱에 알림이 전송된다
```

## AI 튜터 안전
```
Feature: Age-appropriate guardrails
  Scenario: Sensitive topic with elementary account
    Given 초등학생 계정으로 로그인했다
    When AI 튜터에게 민감 주제로 질문한다
    Then 연령 적합 응답 또는 우회 방지 메시지로 처리한다
    And 교사 대시보드에 로그가 익명화되어 기록된다
```

## 접근성
```
Feature: Screen reader compatibility
  Scenario: Quiz navigation with screen reader
    Given 스크린리더를 사용한다
    When 퀴즈를 탐색한다
    Then 모든 컨트롤에 대체 텍스트가 제공된다
    And 포커스 순서가 시각 순서와 일치한다
```

## 개인정보 삭제(GDPR)
```
Feature: Data deletion request
  Scenario: Erasure within the retention window
    Given 삭제 요청이 접수된 지 24시간 이내이다
    When 데이터 삭제를 실행한다
    Then 30일 이내 모든 PII를 영구 삭제·익명화한다
    And 운영 로그에서도 PII가 분리된다
```

