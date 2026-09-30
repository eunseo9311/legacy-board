# Legacy Academy 총동문회 게시판

동문회 카카오톡 대화방과 함께 쓰는 게시판입니다. 게시판은 세 가지입니다.

- 기도 제목
- 일상 알림: 축하, 결혼, 출산, 입원, 장례 소식
- 좋은 말씀

로그인 없이 이름만 적고 글과 댓글을 올립니다. 글마다 "카카오톡으로 나누기" 단추가 있습니다.

## 파일

- `index.html`: 화면 전체
- `store.js`: 저장소(Firebase Firestore, 프로젝트 `legacy-academy-board`). 주소 끝에 `?demo`를 붙이면 그 휴대폰에만 저장하는 체험 모드가 됩니다.
- `firestore.indexes.json`, `firebase.json`: Firestore 설정
- `firestore.rules`: 보안 규칙. 관리자 번호의 지문이 들어 있어 저장소에 올리지 않습니다.

## 지우기

- 글쓴이는 글을 올린 휴대폰에서 "이 글 지우기"를 누르면 됩니다.
- 관리자는 주소 끝에 `#/admin`을 붙여 들어가 관리자 번호를 넣으면 모든 글과 댓글을 지울 수 있습니다.

## 규칙 올리기

```
firebase deploy --only firestore --account eunseosong4916@gmail.com
```
