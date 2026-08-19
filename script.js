/* Sapporo Trip Control Tower
   Data model: schedules, places, reservations, expenses, checklist, activity.
   localStorage is the persistence adapter; replace storage methods with a remote
   adapter (Supabase/Firebase) for cross-device authenticated collaboration. */

const TRIP_DATES = [
  { date: '2026-10-22', label: 'DAY 1', short: '10.22', weekday: '목', theme: '도착 · 스스키노' },
  { date: '2026-10-23', label: 'DAY 2', short: '10.23', weekday: '금', theme: '삿포로의 가을' },
  { date: '2026-10-24', label: 'DAY 3', short: '10.24', weekday: '토', theme: '조잔케이' },
  { date: '2026-10-25', label: 'DAY 4', short: '10.25', weekday: '일', theme: '오타루 · 운하의 밤' },
  { date: '2026-10-26', label: 'DAY 5', short: '10.26', weekday: '월', theme: '시장 · 귀국' }
];

const MEMBERS = ['이승재', '윤지원'];
const MASTER = '이승재';
const SUPABASE_URL = 'https://rwmkfgnjsjfbipeybqqk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__P7HGi9sReXExdeGLnO9rQ_iLtYeQSH';
const TRIP_ID = 'sapporo-2026';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let signedInUser = null;
let remoteChannel = null;
let deferredInstallPrompt = null;
const CAT = {
  tour: { label: '🍁 단풍/관광', color: '#799858' }, food: { label: '🍣 식사', color: '#dc8738' },
  drink: { label: '🍶 술', color: '#8d4451' }, cafe: { label: '☕ 카페', color: '#ad7654' },
  move: { label: '🚃 이동', color: '#557e8c' }, shop: { label: '🛍 쇼핑', color: '#49798a' },
  hotel: { label: '🏨 숙소', color: '#6d6593' }, flight: { label: '✈️ 항공', color: '#4b7188' }
};

const initialData = {
  version: 4,
  currentMember: '이승재',
  exchangeRate: 9.3,
  schedules: [
    { id:'s1',date:'2026-10-22',time:'14:00',end:'15:30',place:'신치토세 공항 → 삿포로',category:'move',description:'입국 후 JR로 삿포로역 이동',duration:90,nextTravel:10,transport:'JR 쾌속 에어포트',cost:1150,reservation:'확인 필요',reservationTime:'',map:'https://maps.google.com/?q=New+Chitose+Airport',official:'https://www.jrhokkaido.co.jp/global/',memo:'2026 운임·시간표 출발 전 확인'},
    { id:'s2',date:'2026-10-22',time:'16:00',end:'17:00',place:'숙소 체크인',category:'hotel',description:'짐 정리 후 잠깐 휴식',duration:60,nextTravel:15,transport:'도보',cost:0,reservation:'예약 예정',reservationTime:'',map:'https://maps.google.com/?q=Sapporo+Station',official:'',memo:'숙소 확정 후 주소 입력'},
    { id:'s3',date:'2026-10-22',time:'18:30',end:'20:00',place:'스스키노 저녁 후보',category:'food',description:'징기스칸 또는 해산물, 투표 후 확정',duration:90,nextTravel:8,transport:'도보',cost:5000,reservation:'조사 필요',reservationTime:'18:30',map:'https://maps.google.com/?q=Susukino+Sapporo',official:'',memo:'예약 실패 시 Plan B'},
    { id:'s4',date:'2026-10-22',time:'20:20',end:'22:00',place:'스스키노 1차',category:'drink',description:'사케와 홋카이도 안주',duration:100,nextTravel:7,transport:'도보',cost:4000,reservation:'조사 필요',reservationTime:'',map:'https://maps.google.com/?q=Susukino+Sapporo',official:'',memo:'업장 후보 투표 중'},
    { id:'s5',date:'2026-10-22',time:'22:15',end:'23:40',place:'바 2차',category:'drink',description:'일본 위스키 또는 칵테일',duration:85,nextTravel:15,transport:'도보',cost:3500,reservation:'불필요',reservationTime:'',map:'https://maps.google.com/?q=Susukino+Sapporo',official:'',memo:'체력에 따라 생략 가능'},
    { id:'s6',date:'2026-10-23',time:'09:30',end:'11:00',place:'홋카이도대학 은행나무길',category:'tour',description:'시내에서 만나는 캠퍼스 단풍',duration:90,nextTravel:15,transport:'도보',cost:0,reservation:'불필요',reservationTime:'',map:'https://maps.google.com/?q=Hokkaido+University+Ginkgo+Avenue',official:'https://www.hokudai.ac.jp/',memo:'2026 단풍 상태 확인 필요'},
    { id:'s7',date:'2026-10-23',time:'11:40',end:'13:00',place:'수프카레 후보',category:'food',description:'점심 피크 전후 유연하게',duration:80,nextTravel:20,transport:'지하철+도보',cost:1800,reservation:'확인 필요',reservationTime:'',map:'https://maps.google.com/?q=Soup+Curry+Sapporo',official:'',memo:'후보 투표 후 확정'},
    { id:'s8',date:'2026-10-23',time:'14:00',end:'16:00',place:'나카지마공원',category:'tour',description:'연못과 단풍, 여유로운 산책',duration:120,nextTravel:15,transport:'지하철',cost:0,reservation:'불필요',reservationTime:'',map:'https://maps.google.com/?q=Nakajima+Park+Sapporo',official:'https://www.sapporo.travel/en/spot/facility/nakajima_park/',memo:'우천 시 카페/박물관으로 전환'},
    { id:'s9',date:'2026-10-23',time:'18:30',end:'23:30',place:'스스키노 금요일 밤',category:'drink',description:'저녁 → 사케 → 바, Plan A/B',duration:300,nextTravel:15,transport:'도보',cost:11000,reservation:'예약 예정',reservationTime:'18:30',map:'https://maps.google.com/?q=Susukino+Sapporo',official:'',memo:'금요일이라 1차 예약 권장'},
    { id:'s10',date:'2026-10-24',time:'08:30',end:'10:00',place:'삿포로 → 조잔케이',category:'move',description:'버스 운행·예약 방식 확인 필요',duration:90,nextTravel:10,transport:'직행/노선버스',cost:1300,reservation:'확인 필요',reservationTime:'',map:'https://maps.google.com/?q=Jozankei+Onsen',official:'https://jozankei.jp/en/access/',memo:'2026 가을 특별버스 일정 확인'},
    { id:'s11',date:'2026-10-24',time:'10:15',end:'13:00',place:'조잔케이 온천가',category:'tour',description:'후타미 현수교와 계곡 산책',duration:165,nextTravel:10,transport:'도보',cost:0,reservation:'불필요',reservationTime:'',map:'https://maps.google.com/?q=Futami+Suspension+Bridge+Jozankei',official:'https://jozankei.jp/en/about/seasons/autumn/',memo:'평년보다 늦은 단풍이 남아 있을 가능성, 현장 확인'},
    { id:'s12',date:'2026-10-24',time:'13:00',end:'16:30',place:'온천 · 늦은 점심',category:'tour',description:'단풍 후 노천탕과 휴식',duration:210,nextTravel:90,transport:'도보',cost:3000,reservation:'확인 필요',reservationTime:'',map:'https://maps.google.com/?q=Jozankei+Onsen',official:'https://jozankei.jp/en/',memo:'당일 입욕 운영시간 확인'},
    { id:'s13',date:'2026-10-24',time:'19:00',end:'23:00',place:'삿포로 토요일 밤',category:'drink',description:'야키토리 + 크래프트 맥주',duration:240,nextTravel:15,transport:'도보',cost:8500,reservation:'조사 필요',reservationTime:'',map:'https://maps.google.com/?q=Susukino+Sapporo',official:'',memo:'귀환 시간 따라 시작 조정'},
    { id:'s14',date:'2026-10-25',time:'09:30',end:'10:20',place:'삿포로 → 오타루',category:'move',description:'JR 이동, 오전은 느긋하게',duration:50,nextTravel:10,transport:'JR',cost:800,reservation:'불필요',reservationTime:'',map:'https://maps.google.com/?q=Otaru+Station',official:'https://www.jrhokkaido.co.jp/global/',memo:'2026 운임 확인 필요'},
    { id:'s15',date:'2026-10-25',time:'10:40',end:'13:30',place:'오타루 운하 · 구시가지',category:'tour',description:'운하와 오래된 건물 사이 산책',duration:170,nextTravel:10,transport:'도보',cost:0,reservation:'불필요',reservationTime:'',map:'https://maps.google.com/?q=Otaru+Canal',official:'https://www.visit-otaru-en.info/',memo:'일몰 시간 확인'},
    { id:'s16',date:'2026-10-25',time:'13:40',end:'15:10',place:'오타루 스시 후보',category:'food',description:'점심 시간을 늦춰 대기 분산',duration:90,nextTravel:15,transport:'도보',cost:4500,reservation:'확인 필요',reservationTime:'',map:'https://maps.google.com/?q=Otaru+Sushi',official:'',memo:'후보 확정 전'},
    { id:'s17',date:'2026-10-25',time:'16:30',end:'19:00',place:'오타루 카페 · 야경',category:'cafe',description:'해질녘 운하, 서두르지 않는 저녁',duration:150,nextTravel:50,transport:'도보',cost:1500,reservation:'불필요',reservationTime:'',map:'https://maps.google.com/?q=Otaru+Canal',official:'https://www.visit-otaru-en.info/',memo:'날씨 따라 삿포로 조기 복귀'},
    { id:'s18',date:'2026-10-26',time:'08:30',end:'10:00',place:'니조시장',category:'food',description:'마지막 카이센동 아침',duration:90,nextTravel:20,transport:'도보',cost:2500,reservation:'확인 필요',reservationTime:'',map:'https://maps.google.com/?q=Nijo+Market+Sapporo',official:'https://www.sapporo.travel/en/spot/facility/nijo_market/',memo:'가게별 영업일 확인'},
    { id:'s19',date:'2026-10-26',time:'10:30',end:'12:00',place:'다누키코지 쇼핑',category:'shop',description:'기념품과 마지막 산책',duration:90,nextTravel:70,transport:'도보',cost:10000,reservation:'불필요',reservationTime:'',map:'https://maps.google.com/?q=Tanukikoji+Shopping+Street',official:'https://tanukikoji.or.jp/',memo:'공항 이동 시간 우선'},
    { id:'s20',date:'2026-10-26',time:'13:00',end:'14:20',place:'삿포로 → 신치토세 공항',category:'move',description:'여유 있게 공항 이동',duration:80,nextTravel:0,transport:'JR',cost:1150,reservation:'확인 필요',reservationTime:'',map:'https://maps.google.com/?q=New+Chitose+Airport',official:'https://www.jrhokkaido.co.jp/global/',memo:'항공편 확정 후 시간 조정'},
    { id:'s21',date:'2026-10-26',time:'16:30',end:'19:30',place:'귀국 항공편',category:'flight',description:'편명·시간 확인 필요',duration:180,nextTravel:0,transport:'항공',cost:0,reservation:'예약 예정',reservationTime:'',map:'https://maps.google.com/?q=New+Chitose+Airport',official:'https://www.new-chitose-airport.jp/en/',memo:'항공권 확정 후 입력'}
  ],
  foliage: [
    {id:'f1',name:'홋카이도대학 은행나무길',area:'삿포로 시내',travel:'삿포로역에서 도보 약 15분',transport:'도보',season:'평년 10월 하순~11월 초',fit:'높음 · 예상',visit:'오전 09:00 전후',duration:'1~1.5시간',fee:'무료',weather:'비·강풍 영향',status:'확인 필요',lat:43.0735,lng:141.3414,map:'https://maps.google.com/?q=Hokkaido+University+Ginkgo+Avenue',official:'https://www.hokudai.ac.jp/',note:'2026 절정 여부는 출발 직전 확인'},
    {id:'f2',name:'나카지마공원',area:'삿포로 시내',travel:'스스키노에서 지하철 약 10분',transport:'지하철 난보쿠선',season:'평년 10월 중순~11월 초',fit:'높음 · 예상',visit:'오후 14:00 전후',duration:'1.5~2시간',fee:'무료',weather:'우천 시 산책 불편',status:'확인 필요',lat:43.0445,lng:141.3546,map:'https://maps.google.com/?q=Nakajima+Park+Sapporo',official:'https://www.sapporo.travel/en/spot/facility/nakajima_park/',note:'연못 반영은 맑고 바람 적을 때 좋음'},
    {id:'f3',name:'마루야마공원',area:'삿포로 시내',travel:'오도리에서 지하철 약 15분',transport:'지하철 도자이선',season:'평년 10월 중순~하순',fit:'중상 · 예상',visit:'오전~낮',duration:'1.5~2시간',fee:'무료',weather:'산책로 낙엽·우천 영향',status:'확인 필요',lat:43.0554,lng:141.3148,map:'https://maps.google.com/?q=Maruyama+Park+Sapporo',official:'https://www.sapporo.travel/en/spot/facility/maruyama_park/',note:'홋카이도 신궁과 묶기 좋음'},
    {id:'f4',name:'조잔케이 온천 · 후타미 현수교',area:'조잔케이',travel:'삿포로 중심에서 버스 약 70~90분',transport:'직행/노선버스',season:'평년 10월 상~중순',fit:'변동 큼 · 예상',visit:'오전 10:00 전후',duration:'3~5시간',fee:'산책 무료',weather:'강우·강풍 시 산책 영향 큼',status:'확인 필요',lat:42.9669,lng:141.1648,map:'https://maps.google.com/?q=Futami+Suspension+Bridge+Jozankei',official:'https://jozankei.jp/en/about/seasons/autumn/',note:'10/24는 낙엽 진행 가능성. 계곡 고도별 차이 확인'},
    {id:'f5',name:'오타루 운하 · 구시가지',area:'오타루',travel:'삿포로역에서 JR 약 35~50분',transport:'JR + 도보',season:'평년 10월 중~하순',fit:'중간 · 예상',visit:'오전~해질녘',duration:'4~6시간',fee:'무료',weather:'해풍·비 영향',status:'확인 필요',lat:43.1986,lng:140.9947,map:'https://maps.google.com/?q=Otaru+Canal',official:'https://www.visit-otaru-en.info/',note:'단풍 단독보다 운하·음식과 결합'},
    {id:'f6',name:'히라오카 수목센터',area:'삿포로 근교',travel:'삿포로 중심에서 대중교통 약 45~60분',transport:'지하철/버스',season:'평년 10월 중~하순',fit:'높음 · 예상',visit:'오전',duration:'1.5~2시간',fee:'확인 필요',weather:'휴원·개방시간 영향',status:'확인 필요',lat:43.0044,lng:141.4577,map:'https://maps.google.com/?q=Hiraoka+Greenery+Center',official:'https://www.sapporo-park.or.jp/jyugei/',note:'공식 개장일·단풍 상태 확인 후 선택'}
  ],
  food: [
    {id:'p1',type:'food',name:'니조시장',menu:'카이센동 · 해산물',category:'카이센동',area:'오도리 동쪽',price:'¥2,000~',hours:'점포별 상이 · 확인 필요',closed:'점포별 상이',reservable:'점포별 확인',reserved:false,wait:'오전에도 혼잡 가능',rating:'확인 필요',review:'삿포로 공식 관광 가이드 등재 시장',map:'https://maps.google.com/?q=Nijo+Market+Sapporo',booking:'',visit:'10/26',priority:'must',stars:5,votes:3,memo:'개별 점포를 추후 확정'},
    {id:'p2',type:'food',name:'삿포로 수프카레 후보',menu:'수프카레',category:'수프카레',area:'삿포로 중심',price:'확인 필요',hours:'확인 필요',closed:'확인 필요',reservable:'확인 필요',reserved:false,wait:'확인 필요',rating:'확인 필요',review:'멤버 추천 후보 입력 대기',map:'https://maps.google.com/?q=Soup+Curry+Sapporo',booking:'',visit:'10/23',priority:'must',stars:4,votes:4,memo:'실제 업장 투표 후 교체'},
    {id:'p3',type:'food',name:'오타루 스시 후보',menu:'스시',category:'스시',area:'오타루',price:'확인 필요',hours:'확인 필요',closed:'확인 필요',reservable:'확인 필요',reserved:false,wait:'주말 혼잡 예상 · 확인 필요',rating:'확인 필요',review:'공식 관광 정보에서 업장 후보 조사 예정',map:'https://maps.google.com/?q=Otaru+Sushi',booking:'',visit:'10/25',priority:'must',stars:5,votes:2,memo:'존재·영업시간 검증 후 업장 확정'},
    {id:'p4',type:'food',name:'징기스칸 후보',menu:'양고기 구이',category:'징기스칸',area:'스스키노',price:'확인 필요',hours:'확인 필요',closed:'확인 필요',reservable:'확인 필요',reserved:false,wait:'목·금 저녁 확인 필요',rating:'확인 필요',review:'후보 수집 중',map:'https://maps.google.com/?q=Jingisukan+Susukino',booking:'',visit:'10/22',priority:'maybe',stars:4,votes:3,memo:'흡연 여부도 확인'},
    {id:'p5',type:'food',name:'삿포로 라멘 후보',menu:'미소 라멘',category:'라멘',area:'스스키노',price:'확인 필요',hours:'확인 필요',closed:'확인 필요',reservable:'대체로 불가 · 업장 확인',reserved:false,wait:'심야 혼잡 확인 필요',rating:'확인 필요',review:'야식 후보',map:'https://maps.google.com/?q=Ramen+Susukino',booking:'',visit:'미정',priority:'candidate',stars:3,votes:1,memo:'3차 후 체력 남으면'},
    {id:'p6',type:'food',name:'삿포로 카페 후보',menu:'커피 · 디저트',category:'카페',area:'오도리',price:'확인 필요',hours:'확인 필요',closed:'확인 필요',reservable:'확인 필요',reserved:false,wait:'확인 필요',rating:'확인 필요',review:'우천 대체 동선',map:'https://maps.google.com/?q=Cafe+Odori+Sapporo',booking:'',visit:'10/23',priority:'candidate',stars:3,votes:0,memo:'멤버 추천 입력 대기'}
  ],
  drinks: [
    {id:'d1',type:'drink',name:'스스키노 이자카야 후보 A',area:'스스키노',mood:'활기찬 로컬 이자카야',alcohol:'사케 · 생맥주',menu:'해산물 안주',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',crowd:'금·토 혼잡 예상',map:'https://maps.google.com/?q=Izakaya+Susukino',booking:'',priority:5,stage:'1차',category:'이자카야',votes:4,lat:43.0558,lng:141.3532,note:'실제 업장 검증 후 이름 교체'},
    {id:'d2',type:'drink',name:'사케 바 후보',area:'스스키노',mood:'대화하기 좋은 차분한 바',alcohol:'홋카이도 사케',menu:'사케 페어링',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',crowd:'좌석 적을 수 있음',map:'https://maps.google.com/?q=Sake+Bar+Susukino',booking:'',priority:5,stage:'2차',category:'사케',votes:3,lat:43.0568,lng:141.3518,note:'금요일 방문 후보'},
    {id:'d3',type:'drink',name:'일본 위스키 바 후보',area:'스스키노',mood:'조용한 백바',alcohol:'일본 위스키',menu:'위스키 · 칵테일',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',crowd:'심야 혼잡 확인',map:'https://maps.google.com/?q=Whisky+Bar+Susukino',booking:'',priority:4,stage:'2차',category:'일본 위스키',votes:4,lat:43.0548,lng:141.3522,note:'업장 확정 전 일반 검색 링크'},
    {id:'d4',type:'drink',name:'크래프트 맥주 후보',area:'다누키코지',mood:'캐주얼 탭룸',alcohol:'홋카이도 크래프트 맥주',menu:'탭 맥주 · 스낵',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',crowd:'확인 필요',map:'https://maps.google.com/?q=Craft+Beer+Sapporo',booking:'',priority:4,stage:'1차/2차',category:'크래프트 맥주',votes:2,lat:43.0575,lng:141.3501,note:'토요일 후보'},
    {id:'d5',type:'drink',name:'심야 칵테일 바 후보',area:'스스키노',mood:'어두운 클래식 바',alcohol:'칵테일',menu:'시그니처 칵테일',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',crowd:'확인 필요',map:'https://maps.google.com/?q=Cocktail+Bar+Susukino',booking:'',priority:3,stage:'3차',category:'칵테일 바',votes:1,lat:43.0551,lng:141.3550,note:'숙소 복귀 동선 내에서 선택'},
    {id:'d6',type:'drink',name:'야키토리 + 술 후보',area:'삿포로역~스스키노',mood:'로컬 선술집',alcohol:'사와 · 사케',menu:'야키토리',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',crowd:'토요일 혼잡 확인',map:'https://maps.google.com/?q=Yakitori+Sapporo',booking:'',priority:4,stage:'저녁/1차',category:'야키토리 + 술',votes:3,lat:43.0601,lng:141.3531,note:'실제 업장 후보 추가 필요'}
  ],
  reservations: [
    {id:'r1',scheduleId:'',place:'항공편',date:'2026-10-22',time:'확인 필요',people:2,booker:'이승재',method:'항공사',number:'',link:'',deadline:'확인 필요',note:'편명·시간 입력',status:'예약 예정'},
    {id:'r2',scheduleId:'s2',place:'삿포로 숙소',date:'2026-10-22',time:'15:00',people:2,booker:'윤지원',method:'예약 사이트',number:'',link:'',deadline:'확인 필요',note:'스스키노/오도리 접근성 우선',status:'예약 예정'},
    {id:'r3',scheduleId:'s3',place:'첫날 저녁',date:'2026-10-22',time:'18:30',people:2,booker:'이승재',method:'전화/웹',number:'',link:'',deadline:'10/15 권장',note:'징기스칸 또는 해산물',status:'조사 필요'},
    {id:'r4',scheduleId:'s9',place:'금요일 저녁',date:'2026-10-23',time:'18:30',people:2,booker:'윤지원',method:'확인 필요',number:'',link:'',deadline:'10/16 권장',note:'금요일 필수 예약 권장',status:'예약 요청'},
    {id:'r5',scheduleId:'s10',place:'조잔케이 이동/온천',date:'2026-10-24',time:'08:30',people:2,booker:'이승재',method:'공식 사이트 확인',number:'',link:'https://jozankei.jp/en/',deadline:'확인 필요',note:'2026 버스·당일 입욕 확인',status:'조사 필요'}
  ],
  expenses: [
    {id:'e1',date:'2026-08-18',payer:'이승재',owner:'',scope:'common',inputCurrency:'JPY',inputAmount:120000,amount:120000,category:'항공',description:'항공권 예약금',participants:MEMBERS,settled:false},
    {id:'e2',date:'2026-08-19',payer:'윤지원',owner:'',scope:'common',inputCurrency:'JPY',inputAmount:80000,amount:80000,category:'숙소',description:'숙소 예약금',participants:MEMBERS,settled:false},
    {id:'e3',date:'2026-08-19',payer:'이승재',owner:'',scope:'common',inputCurrency:'JPY',inputAmount:12000,amount:12000,category:'기타',description:'공동 준비비',participants:MEMBERS,settled:true}
  ],
  checklist: [
    {id:'c1',category:'항공 · 입국',text:'여권 유효기간과 영문 이름 확인',due:'예약 전',done:false,urgent:true},
    {id:'c2',category:'항공 · 입국',text:'왕복 항공권·편명·수하물 규정 저장',due:'예약 후 바로',done:false,urgent:false},
    {id:'c3',category:'항공 · 입국',text:'Visit Japan Web 입국심사·세관 정보 등록',due:'출발 3일 전',done:false,urgent:true,source:'https://www.digital.go.jp/en/policies/visit_japan_web',sourceLabel:'일본 디지털청'},
    {id:'c4',category:'항공 · 입국',text:'Visit Japan Web QR을 화면 캡처·오프라인 저장',due:'출발 전날',done:false,urgent:true,source:'https://www.vjw.digital.go.jp/',sourceLabel:'공식 VJW'},
    {id:'c5',category:'항공 · 입국',text:'숙소 영문 주소·전화번호 저장',due:'예약 후 바로',done:false,urgent:false},
    {id:'c6',category:'항공 · 입국',text:'여행자보험 가입증명서·긴급 연락처 저장',due:'출발 7일 전',done:false,urgent:false},
    {id:'c7',category:'예약 · 교통',text:'삿포로 숙소 예약 확정 및 주소 공유',due:'8월 내',done:false,urgent:false},
    {id:'c8',category:'예약 · 교통',text:'10/23 금요일 저녁 업장 예약',due:'10/9까지',done:false,urgent:false},
    {id:'c9',category:'예약 · 교통',text:'조잔케이 2026 가을 버스·당일 온천 확인',due:'출발 14일 전',done:false,urgent:false},
    {id:'c10',category:'예약 · 교통',text:'교통 IC카드 또는 모바일 교통수단 준비',due:'출발 3일 전',done:false,urgent:false},
    {id:'c11',category:'예약 · 교통',text:'Google Maps 삿포로·오타루 오프라인 지도 저장',due:'출발 3일 전',done:false,urgent:false},
    {id:'c12',category:'결제 · 통신',text:'JPY/KRW 환율 확인 후 엔화 현금 준비',due:'출발 10일 전',done:false,urgent:false},
    {id:'c13',category:'결제 · 통신',text:'해외결제 카드 2장과 분산 보관 지갑 준비',due:'출발 전날',done:false,urgent:false},
    {id:'c14',category:'결제 · 통신',text:'eSIM 구매·설치 후 활성화 방법 캡처',due:'출발 3일 전',done:false,urgent:false},
    {id:'c15',category:'결제 · 통신',text:'숙소·항공·보험 바우처 오프라인 저장',due:'출발 전날',done:false,urgent:false},
    {id:'c16',category:'의류 · 방한',text:'방풍·생활방수 가능한 겨울 재킷',due:'짐 싸기',done:false,urgent:true,source:'https://faq.japan-travel.jnto.go.jp/en/guide/autumn-guide/',sourceLabel:'JNTO 가을 안내'},
    {id:'c17',category:'의류 · 방한',text:'긴팔 이너와 니트/플리스 등 겹쳐 입을 상의',due:'짐 싸기',done:false,urgent:false},
    {id:'c18',category:'의류 · 방한',text:'긴바지·여분 양말·속옷 5일분',due:'짐 싸기',done:false,urgent:false},
    {id:'c19',category:'의류 · 방한',text:'오래 걸어도 편한 방수 운동화',due:'짐 싸기',done:false,urgent:true},
    {id:'c20',category:'의류 · 방한',text:'접이식 우산 또는 가벼운 우비',due:'짐 싸기',done:false,urgent:false},
    {id:'c21',category:'의류 · 방한',text:'얇은 장갑·목도리·비니 선택 준비',due:'출발 3일 전 기온 확인 후',done:false,urgent:false},
    {id:'c22',category:'세면 · 의약',text:'칫솔·세안·기초화장품·개인 위생용품',due:'짐 싸기',done:false,urgent:false},
    {id:'c23',category:'세면 · 의약',text:'처방약은 원래 포장 그대로, 여행 기간 필요량만 준비',due:'출발 7일 전',done:false,urgent:true,source:'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iyakuhin/kojinyunyu/topics/tp010401-1_00001.html',sourceLabel:'일본 후생노동성'},
    {id:'c24',category:'세면 · 의약',text:'처방전 사본·영문 약품명 또는 의사 소견서 확인',due:'출발 7일 전',done:false,urgent:true,source:'https://www.customs.go.jp/english/summary/passenger.htm',sourceLabel:'일본 세관'},
    {id:'c25',category:'세면 · 의약',text:'진통제·소화제·밴드·마스크 등 소형 구급품',due:'짐 싸기',done:false,urgent:false},
    {id:'c26',category:'세면 · 의약',text:'반입 제한 의약품·육류·식물류가 없는지 확인',due:'출발 7일 전',done:false,urgent:true,source:'https://www.customs.go.jp/english/summary/passenger.htm',sourceLabel:'일본 세관'},
    {id:'c27',category:'전자기기',text:'휴대폰·충전 케이블·충전기',due:'출발 전날',done:false,urgent:false},
    {id:'c28',category:'전자기기',text:'A타입 플러그 어댑터와 100V 지원 여부 확인',due:'짐 싸기',done:false,urgent:false},
    {id:'c29',category:'전자기기',text:'보조배터리는 단락 방지 후 위탁수하물 제외',due:'짐 싸기',done:false,urgent:true},
    {id:'c30',category:'전자기기',text:'카메라·메모리카드·여분 배터리 선택 준비',due:'짐 싸기',done:false,urgent:false},
    {id:'c31',category:'가방 · 편의',text:'캐리어 네임택·잠금장치·수하물 저울',due:'짐 싸기',done:false,urgent:false},
    {id:'c32',category:'가방 · 편의',text:'작은 데이백·에코백·지퍼백·동전지갑',due:'짐 싸기',done:false,urgent:false},
    {id:'c33',category:'가방 · 편의',text:'휴지·물티슈·텀블러·핫팩 선택 준비',due:'짐 싸기',done:false,urgent:false},
    {id:'c34',category:'출발 직전 확인',text:'삿포로·조잔케이·오타루 일기예보 확인',due:'출발 7일 전부터 매일',done:false,urgent:true},
    {id:'c35',category:'출발 직전 확인',text:'방문 예정 지역 실제 단풍 상태 확인',due:'출발 7일 전부터 매일',done:false,urgent:true},
    {id:'c36',category:'출발 직전 확인',text:'예약 업장 영업시간·휴무·Last Order 재확인',due:'출발 3일 전',done:false,urgent:true},
    {id:'c37',category:'출발 직전 확인',text:'항공사 수하물 무게·액체·보조배터리 규정 재확인',due:'출발 전날',done:false,urgent:true}
  ],
  activity: [
    {member:'이승재',action:'여행 대시보드를 만들었어요',time:'방금 전'},
    {member:'윤지원',action:'숙소 후보를 업데이트했어요',time:'1시간 전'},
    {member:'이승재',action:'술집 후보에 투표했어요',time:'어제'}
  ]
};

let state = loadState();
let activeDay = TRIP_DATES[0].date;
let activeFoodPriority = 'all';
let activeFoliageArea = '전체';
let activeFoliageStatus = '전체 상태';
let activeDrinkCategory = '전체';
let activeMapCategory = '전체';
let editing = null;
let mainMap, susukinoMap, mapMarkers = [], drinkMapMarkers = [];
const openChecklistGroups = new Set(['의류 · 방한']);

function loadState(){
  try {
    const saved = JSON.parse(localStorage.getItem('sapporo-trip-v3'));
    if(!saved) return structuredClone(initialData);
    if(saved.version === initialData.version){
      saved.exchangeRate=Number(saved.exchangeRate||localStorage.getItem('sapporo-rate'))||initialData.exchangeRate;
      const reservationLinks={r2:'s2',r3:'s3',r4:'s9',r5:'s10'};
      saved.reservations?.forEach(r=>{if(!r.scheduleId&&reservationLinks[r.id])r.scheduleId=reservationLinks[r.id]});
      saved.expenses?.forEach(e=>{e.scope=e.scope||'common';e.owner=e.scope==='personal'?(e.owner||e.payer):'';e.inputCurrency=e.inputCurrency||'JPY';e.inputAmount=Number(e.inputAmount??e.amount);e.participants=e.scope==='personal'?[e.owner]:[...MEMBERS]});
      return saved;
    }
    const migrated = structuredClone(initialData);
    ['schedules','foliage','food','drinks'].forEach(key=>{ if(Array.isArray(saved[key])) migrated[key]=saved[key] });
    const memberMap={'김도윤':'이승재','박준호':'이승재','이서연':'윤지원','최유진':'윤지원','이승재':'이승재','윤지원':'윤지원'};
    const reservationLinks={r2:'s2',r3:'s3',r4:'s9',r5:'s10'};
    if(Array.isArray(saved.reservations)) migrated.reservations=saved.reservations.map(r=>({...r,scheduleId:r.scheduleId||reservationLinks[r.id]||'',people:MEMBERS.length,booker:memberMap[r.booker]||MASTER}));
    if(Array.isArray(saved.expenses)) migrated.expenses=saved.expenses.map((e,index)=>{const payer=memberMap[e.payer]||MEMBERS[index%MEMBERS.length],scope=e.scope||'common',owner=scope==='personal'?(memberMap[e.owner]||payer):'';return {...e,payer,owner,scope,inputCurrency:e.inputCurrency||'JPY',inputAmount:Number(e.inputAmount??e.amount),participants:scope==='personal'?[owner]:[...MEMBERS]}});
    if(Array.isArray(saved.activity)) migrated.activity=saved.activity.map(a=>({...a,member:memberMap[a.member]||MASTER}));
    migrated.exchangeRate=Number(saved.exchangeRate||localStorage.getItem('sapporo-rate'))||initialData.exchangeRate;
    return migrated;
  }
  catch { return structuredClone(initialData); }
}
async function saveState(action){
  if(action){ state.activity.unshift({member:state.currentMember,action,time:'방금 전'}); state.activity=state.activity.slice(0,20); }
  localStorage.setItem('sapporo-trip-v3', JSON.stringify(state));
  const syncText=document.querySelector('#syncText');
  syncText.textContent=signedInUser?'서버 저장 중…':'이 기기에 저장됨';
  if(signedInUser&&supabaseClient){
    const {error}=await supabaseClient.from('trip_states').upsert({trip_id:TRIP_ID,data:state,updated_at:new Date().toISOString()});
    syncText.textContent=error?'서버 저장 실패 · 기기에는 저장됨':'서버에 저장됨';
    if(error) console.error('Supabase save failed:',error);
  }
  try { channel.postMessage({type:'state',state}); } catch {}
}
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('sapporo-trip-sync') : {postMessage(){}};
if(channel.addEventListener) channel.addEventListener('message',e=>{if(e.data?.type==='state'){state=e.data.state;renderAll();toast('다른 탭의 변경사항을 반영했어요.')}});

async function loadRemoteState(){
  if(!signedInUser||!supabaseClient)return;
  document.querySelector('#syncText').textContent='서버 데이터 확인 중…';
  const {data,error}=await supabaseClient.from('trip_states').select('data').eq('trip_id',TRIP_ID).maybeSingle();
  if(error){document.querySelector('#syncText').textContent='서버 연결 실패 · 기기 데이터 사용 중';console.error(error);return}
  if(data?.data){state=data.data;localStorage.setItem('sapporo-trip-v3',JSON.stringify(state));renderAll();document.querySelector('#syncText').textContent='서버와 동기화됨'}
  else await saveState('기존 기기 데이터를 서버로 가져왔어요');
}
function subscribeRemote(){
  if(!supabaseClient||remoteChannel)return;
  remoteChannel=supabaseClient.channel('trip-state-live').on('postgres_changes',{event:'*',schema:'public',table:'trip_states',filter:`trip_id=eq.${TRIP_ID}`},payload=>{
    if(payload.new?.data){state=payload.new.data;localStorage.setItem('sapporo-trip-v3',JSON.stringify(state));renderAll();document.querySelector('#syncText').textContent='서버 변경사항 반영됨'}
  }).subscribe();
}
async function initializeSupabase(){
  if(!supabaseClient)return;
  const {data:{session}}=await supabaseClient.auth.getSession();
  signedInUser=session?.user||null;
  updateAuthUI();
  if(signedInUser){await loadRemoteState();subscribeRemote()}
  supabaseClient.auth.onAuthStateChange((_event,newSession)=>{
    signedInUser=newSession?.user||null;updateAuthUI();
    if(signedInUser){setTimeout(async()=>{await loadRemoteState();subscribeRemote()},0)}
  });
}
function updateAuthUI(){
  const button=document.querySelector('#authButton'),signOut=document.querySelector('#signOutButton');
  button.textContent=signedInUser?`☁  ${signedInUser.email}`:'☁  서버 로그인';
  signOut.hidden=!signedInUser;
  if(!signedInUser)document.querySelector('#syncText').textContent='이 기기에 저장됨';
}
const yen = n => `¥${Math.round(Number(n)||0).toLocaleString('ko-KR')}`;
const won = (n,rate=state.exchangeRate) => `₩${Math.round((Number(n)||0)*(Number(rate)||initialData.exchangeRate)).toLocaleString('ko-KR')}`;
const expenseJPY = (expense,rate=state.exchangeRate) => expense.inputCurrency==='KRW' ? Number(expense.inputAmount||0)/(Number(rate)||initialData.exchangeRate) : Number(expense.inputAmount??expense.amount??0);
const uid = p => p + Date.now().toString(36);
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}

function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const names={home:['TRIP OVERVIEW','여행 대시보드'],schedule:['DAY BY DAY','날짜별 일정'],foliage:['AUTUMN WATCH','단풍 스팟'],food:['FOOD SHORTLIST','맛집 DB'],drinks:['NIGHT ROUTES','술 대시보드'],map:['ALL PLACES','통합 지도'],budget:['TRIP WALLET','경비'],booking:['RESERVATION BOARD','예약 관리'],checklist:['READY TO GO','출발 전 체크리스트']};
  document.querySelector('#pageEyebrow').textContent=names[page][0]; document.querySelector('#pageTitle').textContent=names[page][1];
  document.querySelector('#sidebar').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'});
  document.querySelector('#mobileNow').style.display=page==='home'&&innerWidth<=760?'grid':'none';
  if(page==='map') setTimeout(()=>{initMainMap();mainMap?.invalidateSize()},80);
  if(page==='drinks') setTimeout(()=>{initSusukinoMap();susukinoMap?.invalidateSize()},80);
}

function renderStats(){
  const confirmed=state.schedules.filter(s=>!['조사 필요','확인 필요'].includes(s.reservation)).length;
  const need=state.reservations.filter(r=>r.status!=='취소').length, done=state.reservations.filter(r=>r.status==='예약 완료').length;
  const planned=state.schedules.reduce((a,b)=>a+(Number(b.cost)||0),0)*MEMBERS.length;
  const spent=state.expenses.reduce((a,b)=>a+expenseJPY(b),0);
  const todo=state.checklist.filter(c=>!c.done).length;
  const days=Math.ceil((new Date('2026-10-22T00:00:00+09:00')-new Date())/86400000);
  const rate=Number(state.exchangeRate)||initialData.exchangeRate;
  const stats=[['D-DAY',days>0?`D-${days}`:'여행 중'],['여행 기간','4박 5일'],['확정 일정',`${confirmed}<em>개</em>`],['예약 필요',`${need}<em>곳</em>`],['예약 완료',`${done}<em>곳</em>`],['예상 총 여행비',`${yen(planned)}<em>/ ${MEMBERS.length}인</em>`],['현재 경비',`${yen(spent)}<em>₩${Math.round(spent*rate).toLocaleString()}</em>`],['출발 전 할 일',`${todo}<em>개</em>`]];
  document.querySelector('#stats').innerHTML=stats.map((s,i)=>`<div class="stat-card ${i===0?'accent':''}"><small>${s[0]}</small><b>${s[1]}</b></div>`).join('');
}
function renderTimeline(){
  document.querySelector('#masterTimeline').innerHTML=TRIP_DATES.map(day=>{
    const events=state.schedules.filter(s=>s.date===day.date).slice(0,5);
    return `<div class="timeline-day"><div class="timeline-date"><div><b>${day.label}</b><span> · ${day.weekday}</span></div><b>${day.short}</b></div>${events.map(s=>`<div class="timeline-event" data-edit-schedule="${s.id}"><span>${s.time}</span><i class="${s.category}"></i><div><b>${esc(s.place)}</b><small>${CAT[s.category]?.label||s.category}</small></div></div>`).join('')}</div>`
  }).join('');
  const route=['18:30 · 저녁 후보','20:20 · 사케 1차','22:15 · 위스키 바','23:40 · 숙소'];
  document.querySelector('#nightRoute').innerHTML=route.map((r,i)=>`<div class="route-stop"><i>${i+1}</i><b>${r.split(' · ')[1]}</b><small>${r.split(' · ')[0]}</small></div>`).join('');
}
function renderHomeChecklist(){
  const list=state.checklist.filter(c=>!c.done).slice(0,4);
  document.querySelector('#homeChecklist').innerHTML=list.map(c=>`<div class="action-item"><input type="checkbox" data-check="${c.id}"><label>${esc(c.text)}</label><small>${esc(c.due)}</small></div>`).join('');
  document.querySelector('#checkProgress').textContent=`${state.checklist.filter(c=>c.done).length}/${state.checklist.length}`;
}
function renderDayTabs(){document.querySelector('#dayTabs').innerHTML=TRIP_DATES.map(d=>`<button class="day-tab ${d.date===activeDay?'active':''}" data-day="${d.date}"><b>${d.label} · ${d.short}</b><small>${d.weekday} · ${d.theme}</small></button>`).join('')}
function dayData(){return state.schedules.filter(s=>s.date===activeDay).sort((a,b)=>a.time.localeCompare(b.time))}
function renderSchedule(){
  renderDayTabs(); const items=dayData(); const day=TRIP_DATES.find(d=>d.date===activeDay);
  const move=items.reduce((a,b)=>a+(Number(b.nextTravel)||0),0), cost=items.reduce((a,b)=>a+(Number(b.cost)||0),0);
  const drink=items.find(s=>s.category==='drink')?.place||'미정';
  const summary=[['오늘의 핵심 일정',day.theme],['총 예상 이동',`${move}분`],['1인 예상 비용',yen(cost)],['예상 도보량',move>120?'12,000보+':'8,000~10,000보'],['저녁 음주 지역',drink.includes('오타루')?'오타루':'스스키노'],['숙소 복귀','23:40 전후']];
  document.querySelector('#daySummary').innerHTML=summary.map(s=>`<div class="summary-cell"><small>${s[0]}</small><b>${s[1]}</b></div>`).join('');
  document.querySelector('#scheduleBoard').innerHTML=items.map(s=>`<article class="schedule-row" draggable="true" data-id="${s.id}" data-edit-schedule="${s.id}"><span class="drag-handle">⠿</span><div class="schedule-time"><b>${s.time}</b><small>${s.end}</small></div><i class="category-bar ${s.category}"></i><div class="schedule-main"><b>${esc(s.place)}</b><small>${esc(s.description)}</small></div><div class="schedule-meta"><small>${CAT[s.category]?.label}</small><b>${s.transport} · ${s.duration}분</b></div><span class="tag ${s.reservation==='예약 완료'?'done':s.reservation.includes('필요')?'need':''}">${s.reservation}</span><button class="icon-button">›</button></article>`).join('')||'<p class="empty-state">일정이 없어요. 새 일정을 추가해보세요.</p>';
  bindDrag();
}
function bindDrag(){let dragged;document.querySelectorAll('.schedule-row').forEach(row=>{row.addEventListener('dragstart',()=>{dragged=row;row.style.opacity='.45'});row.addEventListener('dragend',()=>row.style.opacity='');row.addEventListener('dragover',e=>{e.preventDefault();if(row!==dragged){const board=row.parentNode;const rect=row.getBoundingClientRect();board.insertBefore(dragged,e.clientY<rect.top+rect.height/2?row:row.nextSibling)}});row.addEventListener('drop',e=>{e.preventDefault();const ids=[...document.querySelectorAll('.schedule-row')].map(x=>x.dataset.id);ids.forEach((id,i)=>{const s=state.schedules.find(x=>x.id===id);if(s)s.time=`${String(8+Math.floor(i*1.5)).padStart(2,'0')}:${i%2?'30':'00'}`});saveState('일정 순서를 변경했어요');renderAll();toast('일정 순서와 마스터 타임라인을 갱신했어요.');})})}

function renderFoliage(){
  const areas=['전체',...new Set(state.foliage.map(f=>f.area))];
  document.querySelector('#foliageFilters').innerHTML=areas.map(a=>`<button class="${a===activeFoliageArea?'active':''}" data-foliage-area="${a}">${a}</button>`).join('');
  const list=state.foliage.filter(f=>(activeFoliageArea==='전체'||f.area===activeFoliageArea)&&(activeFoliageStatus==='전체 상태'||f.status===activeFoliageStatus));
  const statuses=['확인 필요','아직 이름','물들기 시작','절정 근접','절정','낙엽 진행'];
  document.querySelector('#foliageGrid').innerHTML=list.map((f,i)=>`<article class="foliage-card"><div class="foliage-photo" style="filter:hue-rotate(${i*4}deg)"><span class="certainty">예상 정보</span><span class="foliage-score">${f.fit.split(' · ')[0]}</span></div><div class="foliage-body"><h3>${esc(f.name)}</h3><p>${esc(f.area)} · ${esc(f.travel)}</p><div class="detail-pairs"><div><small>평년 단풍 시기</small><b>${esc(f.season)}</b></div><div><small>2026 현장 상태</small><select class="inline-status" data-foliage-status="${f.id}">${statuses.map(status=>`<option ${status===f.status?'selected':''}>${status}</option>`).join('')}</select></div><div><small>추천 시간 · 체류</small><b>${esc(f.visit)} · ${esc(f.duration)}</b></div><div><small>이동 · 입장료</small><b>${esc(f.transport)} · ${esc(f.fee)}</b></div><div><small>날씨 영향</small><b>${esc(f.weather)}</b></div><div><small>비고</small><b>${esc(f.note)}</b></div></div><div class="foliage-actions"><a href="${f.map}" target="_blank" rel="noopener">지도 열기 ↗</a><a href="${f.official}" target="_blank" rel="noopener">공식 정보 ↗</a><button data-add-foliage="${f.id}">일정에 추가</button></div></div></article>`).join('')||'<p class="empty-state">선택한 상태의 장소가 없습니다.</p>';
}
function renderFood(){
  const q=document.querySelector('#foodSearch')?.value?.toLowerCase()||'';
  const list=state.food.filter(p=>(activeFoodPriority==='all'||p.priority===activeFoodPriority)&&[p.name,p.area,p.menu,p.category].join(' ').toLowerCase().includes(q));
  document.querySelector('#foodDatabase').innerHTML=`<div class="db-row header"><span>가게 / 대표 메뉴</span><span>지역</span><span>가격대</span><span>방문일</span><span>우선순위</span><span>별점</span><span>투표</span><span></span></div>`+list.map(p=>`<div class="db-row"><div class="db-name"><b>${esc(p.name)}</b><small>${esc(p.menu)} · ${esc(p.hours)}</small></div><span>${esc(p.area)}</span><span>${esc(p.price)}</span><span>${esc(p.visit)}</span><span><i class="priority-dot ${p.priority}"></i>${{must:'무조건',maybe:'시간 되면',candidate:'후보'}[p.priority]}</span><span class="stars">${'★'.repeat(p.stars)}${'☆'.repeat(5-p.stars)}</span><button class="vote-button ${p.voted?'voted':''}" data-vote="food:${p.id}">👍 ${p.votes}</button><button class="icon-button" data-edit-place="food:${p.id}">›</button></div>`).join('');
}
function renderDrinkRoutes(){
  const routes=[
    {night:'THU · 10.22',name:'도착의 밤',plan:'PLAN A',stops:[['18:30','징기스칸 후보'],['20:20','사케 바'],['22:15','위스키 바'],['23:40','숙소']]},
    {night:'FRI · 10.23',name:'스스키노 딥다이브',plan:'PLAN A',stops:[['18:30','해산물 저녁'],['20:30','이자카야'],['22:15','칵테일 바'],['00:00','숙소']]},
    {night:'SAT · 10.24',name:'온천 뒤 한 잔',plan:'PLAN B',stops:[['19:00','야키토리'],['21:00','크래프트 맥주'],['22:45','라멘/숙소']]}
  ];
  document.querySelector('#drinkRoutes').innerHTML=routes.map(r=>`<article class="route-card"><div class="route-card-head"><div><small>${r.night}</small><b> ${r.name}</b></div><span>${r.plan}</span></div><div class="night-stops">${r.stops.map((s,i)=>`<div class="night-stop"><small>${i?`${i}차`:'저녁'} · ${s[0]}</small><b>${s[1]}</b><em>${i<r.stops.length-1?'도보 5~15분':'복귀'}</em></div>`).join('')}</div></article>`).join('');
}
function renderDrinks(){
  renderDrinkRoutes(); const cats=['전체',...new Set(state.drinks.map(d=>d.category))];
  document.querySelector('#drinkFilters').innerHTML=cats.map(c=>`<button class="${c===activeDrinkCategory?'active':''}" data-drink-category="${c}">${c}</button>`).join('');
  const list=state.drinks.filter(d=>activeDrinkCategory==='전체'||d.category===activeDrinkCategory);
  document.querySelector('#drinkCards').innerHTML=list.map(d=>`<article class="drink-card"><div class="drink-card-head"><div><h3>${esc(d.name)}</h3><p>${esc(d.area)} · ${esc(d.mood)}</p></div><button class="vote-button ${d.voted?'voted':''}" data-vote="drink:${d.id}">👍 ${d.votes}</button></div><div class="detail-pairs"><div><small>주력 술</small><b>${esc(d.alcohol)}</b></div><div><small>추천 차수</small><b>${esc(d.stage)}</b></div><div><small>영업시간 / L.O.</small><b>${esc(d.hours)} / ${esc(d.lastOrder)}</b></div><div><small>예약 / 흡연</small><b>${esc(d.reservable)} / ${esc(d.smoking)}</b></div></div><p>${esc(d.note)}</p><div class="drink-card-actions"><a class="secondary" href="${d.map}" target="_blank" rel="noopener">지도 ↗</a><button class="secondary" data-edit-place="drink:${d.id}">상세·수정</button></div></article>`).join('');
}
function stableMapPoint(id){const hash=String(id).split('').reduce((a,c)=>a+c.charCodeAt(0),0);return {lat:43.061+((hash%17)-8)*.00055,lng:141.354+((hash%19)-9)*.00065}}
function allMapPlaces(){return [...state.foliage.map(f=>({...f,category:'tour',description:f.note})),...state.food.map(f=>({...f,category:'food',...(!f.lat?stableMapPoint(f.id):{}),description:f.menu})),...state.drinks.map(f=>({...f,category:'drink',description:`${f.alcohol} · ${f.stage}`}))]}
function markerIcon(cat){return L.divIcon({className:'',html:`<div class="map-pin ${cat}"><i></i></div>`,iconSize:[22,22],iconAnchor:[11,22]})}
function initMainMap(){
  if(!window.L)return; if(!mainMap){mainMap=L.map('mainMap',{zoomControl:true}).setView([43.0618,141.3545],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(mainMap)}
  mapMarkers.forEach(m=>m.remove());mapMarkers=[];
  allMapPlaces().filter(p=>activeMapCategory==='전체'||p.category===activeMapCategory).forEach(p=>{const marker=L.marker([p.lat,p.lng],{icon:markerIcon(p.category)}).addTo(mainMap).on('click',()=>renderMapDetail(p));mapMarkers.push(marker)});
}
function renderMapFilters(){const cats=['전체','tour','food','drink','cafe','hotel','shop'];document.querySelector('#mapFilters').innerHTML=cats.map(c=>`<button class="${c===activeMapCategory?'active':''}" data-map-category="${c}">${c==='전체'?'전체':CAT[c]?.label||c}</button>`).join('')}
function renderMapDetail(p){document.querySelector('#mapDetail').innerHTML=`<p class="eyebrow">${CAT[p.category]?.label||p.area}</p><h2>${esc(p.name)}</h2><p>${esc(p.description||p.note)}</p><div class="detail-pairs"><div><small>지역</small><b>${esc(p.area)}</b></div><div><small>상태</small><b>${esc(p.status||p.priority||'확인 필요')}</b></div></div><a href="${p.map}" class="primary full-button" target="_blank" rel="noopener">Google Maps 열기 ↗</a><button class="secondary full-button" style="margin-top:8px" data-add-map="${p.id}">일정에 추가</button>`}
function initSusukinoMap(){if(!window.L)return;if(!susukinoMap){susukinoMap=L.map('susukinoMap',{zoomControl:false,attributionControl:false}).setView([43.0556,141.3533],16);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(susukinoMap)}drinkMapMarkers.forEach(m=>m.remove());drinkMapMarkers=state.drinks.map(d=>L.marker([d.lat,d.lng],{icon:markerIcon('drink')}).addTo(susukinoMap).bindPopup(`<b>${esc(d.name)}</b><br>${esc(d.stage)} · 👍 ${d.votes}`))}

function renderBudget(){
  const rate=Number(state.exchangeRate)||initialData.exchangeRate;
  const common=state.expenses.filter(e=>e.scope!=='personal'),personal=state.expenses.filter(e=>e.scope==='personal');
  const commonTotal=common.reduce((a,e)=>a+expenseJPY(e),0),personalTotal=personal.reduce((a,e)=>a+expenseJPY(e),0),total=commonTotal+personalTotal;
  const average=total/MEMBERS.length,commonShare=commonTotal/MEMBERS.length;
  const stats=[['총 경비',yen(total),`${won(total)} · 공동+개인`],['공동 경비',yen(commonTotal),`${won(commonTotal)} · 1인 ${yen(commonShare)}`],['개인 경비',yen(personalTotal),`${won(personalTotal)} · 개인별 아래 표시`],['1인당 평균',yen(average),`${won(average)} · 전체 경비 기준`]];
  document.querySelector('#budgetStats').innerHTML=stats.map(s=>`<div class="budget-stat"><small>${s[0]}</small><b>${s[1]}</b><em>${s[2]}</em></div>`).join('');
  const filters=[['전체','all'],['공동','common'],['개인','personal'],...new Set(state.expenses.map(e=>e.category))].map(item=>Array.isArray(item)?item:[item,item]);
  document.querySelector('#expenseFilters').innerHTML=filters.map(([label,value],i)=>`<button class="${i===0?'active':''}" data-expense-filter="${value}">${label}</button>`).join('');
  document.querySelector('#expenseList').innerHTML=state.expenses.map(e=>{const amount=expenseJPY(e);return `<div class="expense-row" data-edit-expense="${e.id}" data-expense-scope="${e.scope}" data-expense-category="${e.category}"><small>${e.date.slice(5)}</small><div><b>${esc(e.description)}</b><small>${e.category} · 결제 ${e.payer}${e.scope==='personal'?` · 사용 ${e.owner}`:' · 공동'}</small></div><div class="amount"><b>${yen(amount)}</b><small>${won(amount)}${e.inputCurrency==='KRW'?' · 원화 입력':''}</small></div><span class="expense-scope ${e.scope}">${e.scope==='personal'?'개인':'공동'}</span><span class="tag ${e.settled?'done':'need'}">${e.settled?'정산 완료':'미정산'}</span></div>`}).join('')||'<p class="empty-state">등록된 지출이 없습니다.</p>';
  const paid=Object.fromEntries(MEMBERS.map(m=>[m,state.expenses.filter(e=>e.payer===m).reduce((a,e)=>a+expenseJPY(e),0)]));
  const personalByMember=Object.fromEntries(MEMBERS.map(m=>[m,personal.filter(e=>e.owner===m).reduce((a,e)=>a+expenseJPY(e),0)]));
  document.querySelector('#settlement').innerHTML=MEMBERS.map((m,i)=>{const burden=commonShare+personalByMember[m],diff=paid[m]-burden;return `<div class="settle-person expanded"><span class="avatar" style="background:${['#b94d2f','#b38a35'][i]}">${m[0]}</span><div><b>${m}${m===MASTER?' <em class="master-badge">MASTER</em>':''}</b><small>공동 부담 ${yen(commonShare)} + 개인 ${yen(personalByMember[m])}</small><em class="member-total">총 부담 ${yen(burden)} · ${won(burden)}</em></div><div class="settle-result"><strong class="${diff>=0?'receive':'send'}">${diff>=0?'받을 돈':'보낼 돈'} ${yen(Math.abs(diff))}</strong><small>${won(Math.abs(diff))} · 총 결제 ${yen(paid[m])}</small></div></div>`}).join('')+`<div class="settle-transfer"><b>계산 기준</b><p>개인별 총 부담은 공동 경비 1/2과 본인 개인 경비의 합입니다. 실제 결제액과 비교해 받을·보낼 돈을 계산합니다.</p></div>`;
}
function renderBookings(){
  const statuses=['조사 필요','예약 예정','예약 요청','예약 완료','취소'];
  document.querySelector('#bookingBoard').innerHTML=statuses.map(status=>{const list=state.reservations.filter(r=>r.status===status);return `<section class="booking-column"><div class="booking-column-head"><b>${status}</b><span>${list.length}</span></div>${list.map(r=>`<article class="booking-card"><h4>${esc(r.place)}</h4><p>◷ ${r.date.slice(5)} · ${esc(r.time)} · ${r.people}명</p><p>예약자 ${esc(r.booker)} · ${esc(r.method)}</p><p>취소 기한 ${esc(r.deadline)}</p><select data-booking-status="${r.id}">${statuses.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></article>`).join('')}</section>`}).join('');
}
function syncReservationToSchedule(reservation){
  if(!reservation.scheduleId)return;
  const schedule=state.schedules.find(s=>s.id===reservation.scheduleId);if(!schedule)return;
  schedule.reservation=reservation.status==='취소'?'확인 필요':reservation.status;
  schedule.reservationTime=reservation.time||schedule.reservationTime;
}
function syncScheduleToReservation(schedule){
  const reservation=state.reservations.find(r=>r.scheduleId===schedule.id);if(!reservation)return;
  const statusMap={'예약 완료':'예약 완료','예약 요청':'예약 요청','예약 예정':'예약 예정','조사 필요':'조사 필요','확인 필요':'조사 필요'};
  if(statusMap[schedule.reservation])reservation.status=statusMap[schedule.reservation];
  if(schedule.reservationTime)reservation.time=schedule.reservationTime;
}
function renderChecklist(){
  const done=state.checklist.filter(c=>c.done).length,p=Math.round(done/state.checklist.length*100)||0;
  document.querySelector('#checkPercent').textContent=`${p}%`;document.querySelector('#progressBar').style.width=`${p}%`;document.querySelector('#checkMessage').textContent=p===100?'여행 준비 완료!':`${state.checklist.length-done}개 항목이 남아 있어요.`;
  const groups=[...new Set(state.checklist.map(c=>c.category))];document.querySelector('#checklistGroups').innerHTML=groups.map(g=>{const items=state.checklist.filter(c=>c.category===g),completed=items.filter(c=>c.done).length,open=openChecklistGroups.has(g);return `<details class="check-group" data-check-group="${g}" ${open?'open':''}><summary><span><i>›</i><b>${g}</b><small>${completed}/${items.length} 완료</small></span><em>${items.length}</em></summary><div class="check-group-body">${items.map(c=>`<div class="check-row ${c.urgent?'urgent':''}"><input type="checkbox" data-check="${c.id}" ${c.done?'checked':''}><label class="${c.done?'done':''}">${esc(c.text)}<small>${c.urgent?'⚠ 중요 · ':''}${esc(c.due)}${c.source?` · <a href="${c.source}" target="_blank" rel="noopener">${esc(c.sourceLabel||'공식 안내')} ↗</a>`:''}</small></label></div>`).join('')}</div></details>`}).join('');
  document.querySelectorAll('[data-check-group]').forEach(group=>group.addEventListener('toggle',()=>group.open?openChecklistGroups.add(group.dataset.checkGroup):openChecklistGroups.delete(group.dataset.checkGroup)));
}
function renderActivity(){document.querySelector('#activityList').innerHTML=state.activity.map((a,i)=>`<div class="activity-row"><span class="avatar">${a.member[0]}</span><div><b>${esc(a.action)}</b><small>${esc(a.member)}</small></div><time>${esc(a.time)}</time></div>`).join('')}
function runConsistencyChecks(){
  const total=state.expenses.reduce((sum,item)=>sum+expenseJPY(item),0),done=state.checklist.filter(item=>item.done).length;
  const tests={
    mainExpenseYen:document.querySelector('#stats').textContent.includes(yen(total)),
    mainExpenseKrw:document.querySelector('#stats').textContent.includes(won(total)),
    budgetExpenseYen:document.querySelector('#budgetStats').textContent.includes(yen(total)),
    budgetExpenseKrw:document.querySelector('#budgetStats').textContent.includes(won(total)),
    checklistSummary:document.querySelector('#checkProgress').textContent===`${done}/${state.checklist.length}`,
    bookingBoard:document.querySelectorAll('.booking-card').length===state.reservations.length,
    reservationLinks:state.reservations.every(r=>!r.scheduleId||state.schedules.some(s=>s.id===r.scheduleId)),
    expenseMembers:state.expenses.every(e=>MEMBERS.includes(e.payer)&&e.participants.every(p=>MEMBERS.includes(p))&&(e.scope!=='personal'||MEMBERS.includes(e.owner))),
    expenseCurrencies:state.expenses.every(e=>['JPY','KRW'].includes(e.inputCurrency)&&Number.isFinite(Number(e.inputAmount))&&['common','personal'].includes(e.scope)),
    uniqueScheduleIds:new Set(state.schedules.map(s=>s.id)).size===state.schedules.length,
    foliageStates:state.foliage.every(f=>['확인 필요','아직 이름','물들기 시작','절정 근접','절정','낙엽 진행'].includes(f.status))
  };
  const passed=Object.values(tests).every(Boolean);document.body.dataset.syncStatus=passed?'passed':'failed';window.tripSyncReport={passed,tests,checkedAt:new Date().toISOString()};window.getTripDiagnostics=()=>({state:structuredClone(state),report:structuredClone(window.tripSyncReport),drinkMarkerPopups:drinkMapMarkers.map(marker=>marker.getPopup()?.getContent()||'')});return window.tripSyncReport;
}
function renderAll(){document.querySelector('#exchangeRate').value=state.exchangeRate;renderStats();renderTimeline();renderHomeChecklist();renderSchedule();renderFoliage();renderFood();renderDrinks();renderMapFilters();renderBudget();renderBookings();renderChecklist();renderActivity();document.querySelector('#currentMemberName').textContent=state.currentMember;document.querySelector('#currentMemberRole').textContent=state.currentMember===MASTER?'마스터 · 온라인':'편집 가능 · 온라인';if(mainMap)initMainMap();if(susukinoMap)initSusukinoMap();queueMicrotask(runConsistencyChecks)}

const scheduleFields=[['time','시간','time'],['end','종료','time'],['place','장소','text','wide'],['category','카테고리','select'],['description','한 줄 설명','text','wide'],['duration','예상 체류시간(분)','number'],['nextTravel','다음 장소 이동시간(분)','number'],['transport','이동방법','text'],['cost','예상 비용(JPY)','number'],['reservation','예약 여부','select'],['reservationTime','예약 시간','time'],['map','Google Maps 링크','url','wide'],['official','공식/예약 링크','url','wide'],['memo','메모','textarea','wide']];
function openScheduleEditor(id){
  const item=id?state.schedules.find(s=>s.id===id):{id:uid('s'),date:activeDay,time:'12:00',end:'13:00',place:'',category:'tour',description:'',duration:60,nextTravel:0,transport:'도보',cost:0,reservation:'확인 필요',reservationTime:'',map:'',official:'',memo:''};
  editing={type:'schedule',id:item.id,isNew:!id};document.querySelector('#modalEyebrow').textContent=item.date;document.querySelector('#modalTitle').textContent=id?'일정 수정':'새 일정 추가';document.querySelector('#deleteItem').style.visibility=id?'visible':'hidden';
  document.querySelector('#editorFields').innerHTML=`<label class="field"><span>날짜</span><select name="date">${TRIP_DATES.map(d=>`<option value="${d.date}" ${d.date===item.date?'selected':''}>${d.short} ${d.weekday}</option>`).join('')}</select></label>`+scheduleFields.map(([key,label,type,wide])=>{if(type==='select'){const opts=key==='category'?Object.entries(CAT).map(([v,c])=>`<option value="${v}" ${v===item[key]?'selected':''}>${c.label}</option>`).join(''):['조사 필요','확인 필요','예약 예정','예약 요청','예약 완료','불필요'].map(v=>`<option ${v===item[key]?'selected':''}>${v}</option>`).join('');return `<label class="field ${wide||''}"><span>${label}</span><select name="${key}">${opts}</select></label>`}return `<label class="field ${wide||''}"><span>${label}</span>${type==='textarea'?`<textarea name="${key}">${esc(item[key])}</textarea>`:`<input type="${type}" name="${key}" value="${esc(item[key])}">`}</label>`}).join('');
  document.querySelector('#editorDialog').showModal();
}
function openPlaceEditor(kind,id){
  const collection=kind==='food'?state.food:state.drinks,item=id?collection.find(x=>x.id===id):kind==='food'?{id:uid('p'),name:'',menu:'',category:'이자카야',area:'',price:'확인 필요',hours:'확인 필요',priority:'candidate',visit:'미정',map:'',memo:'',votes:0,stars:3}:{id:uid('d'),name:'',area:'스스키노',mood:'',alcohol:'',menu:'',category:'이자카야',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',stage:'1차',map:'',priority:3,votes:0,lat:43.0556,lng:141.3533,note:''};
  editing={type:kind,id:item.id,isNew:!id};document.querySelector('#modalEyebrow').textContent=kind==='food'?'FOOD PLACE':'DRINK PLACE';document.querySelector('#modalTitle').textContent=`${id?'후보 수정':'새 후보 추가'}`;document.querySelector('#deleteItem').style.visibility=id?'visible':'hidden';
  const keys=kind==='food'?[['name','가게명'],['menu','대표 메뉴'],['category','카테고리'],['area','지역'],['price','가격대'],['hours','영업시간'],['visit','방문 예정일'],['map','Google Maps'],['memo','메모']]:[['name','이름'],['area','지역'],['mood','분위기'],['alcohol','주력 술'],['menu','대표 메뉴'],['category','카테고리'],['price','가격대'],['hours','영업시간'],['lastOrder','Last Order'],['reservable','예약 가능 여부'],['smoking','흡연 여부'],['stage','추천 차수'],['map','Google Maps'],['note','메모']];
  document.querySelector('#editorFields').innerHTML=keys.map(([k,l])=>`<label class="field ${['name','map','memo','note'].includes(k)?'wide':''}"><span>${l}</span><input name="${k}" value="${esc(item[k])}"></label>`).join('');document.querySelector('#editorDialog').showModal();
}
function openExpenseEditor(id){
  const item=id?state.expenses.find(e=>e.id===id):{id:uid('e'),date:new Date().toISOString().slice(0,10),payer:state.currentMember,owner:state.currentMember,scope:'common',inputCurrency:'JPY',inputAmount:0,amount:0,category:'식비',description:'',participants:[...MEMBERS],settled:false};
  const currency=item.inputCurrency||'JPY',inputAmount=Number(item.inputAmount??item.amount??0),scope=item.scope||'common';
  editing={type:'expense',id:item.id,isNew:!id,item};document.querySelector('#modalEyebrow').textContent=id?'EDIT EXPENSE':'NEW EXPENSE';document.querySelector('#modalTitle').textContent=id?'지출 수정':'지출 추가';document.querySelector('#deleteItem').style.visibility=id?'visible':'hidden';
  document.querySelector('#editorFields').innerHTML=`<label class="field"><span>지출 구분</span><select name="scope" id="expenseScope"><option value="common" ${scope==='common'?'selected':''}>공동 지출</option><option value="personal" ${scope==='personal'?'selected':''}>개인 지출</option></select></label><label class="field"><span>날짜</span><input type="date" name="date" value="${item.date}"></label><label class="field"><span>결제자</span><select name="payer">${MEMBERS.map(m=>`<option ${m===item.payer?'selected':''}>${m}</option>`).join('')}</select></label><label class="field" id="expenseOwnerField"><span>개인 지출 대상</span><select name="owner">${MEMBERS.map(m=>`<option ${m===(item.owner||item.payer)?'selected':''}>${m}</option>`).join('')}</select></label><label class="field"><span>입력 통화</span><select name="inputCurrency" id="expenseCurrency"><option value="JPY" ${currency==='JPY'?'selected':''}>JPY · 엔화</option><option value="KRW" ${currency==='KRW'?'selected':''}>KRW · 원화</option></select></label><label class="field"><span>금액</span><input type="number" min="0" step="1" name="inputAmount" id="expenseInputAmount" value="${inputAmount}" required></label><div class="expense-preview wide" id="expenseConversionPreview"></div><label class="field"><span>카테고리</span><select name="category">${['항공','숙소','교통','식비','술','관광','쇼핑','기타'].map(c=>`<option ${c===item.category?'selected':''}>${c}</option>`).join('')}</select></label><label class="field"><span>정산 상태</span><select name="settled"><option value="false" ${!item.settled?'selected':''}>미정산</option><option value="true" ${item.settled?'selected':''}>정산 완료</option></select></label><label class="field wide"><span>설명</span><input name="description" value="${esc(item.description)}" required></label>`;
  updateExpenseForm();document.querySelector('#editorDialog').showModal();
}
function updateExpenseForm(){
  if(editing?.type!=='expense')return;const form=document.querySelector('#editorForm'),scope=form.elements.scope?.value,currency=form.elements.inputCurrency?.value,raw=Number(form.elements.inputAmount?.value)||0,rate=Number(state.exchangeRate)||initialData.exchangeRate;
  document.querySelector('#expenseOwnerField').hidden=scope!=='personal';const jpy=currency==='KRW'?raw/rate:raw,krw=currency==='KRW'?raw:raw*rate;
  document.querySelector('#expenseConversionPreview').innerHTML=`<small>환율 ¥1 = ₩${rate}</small><b>${yen(jpy)} <span>≈</span> ₩${Math.round(krw).toLocaleString('ko-KR')}</b>`;
}
function openBookingEditor(){
  const item={id:uid('r'),place:'',date:activeDay,time:'18:30',people:MEMBERS.length,booker:state.currentMember,method:'확인 필요',number:'',link:'',deadline:'확인 필요',note:'',status:'조사 필요'};
  editing={type:'booking',id:item.id,isNew:true,item};document.querySelector('#modalEyebrow').textContent='NEW RESERVATION';document.querySelector('#modalTitle').textContent='예약 추가';document.querySelector('#deleteItem').style.visibility='hidden';
  document.querySelector('#editorFields').innerHTML=`<label class="field wide"><span>장소</span><input name="place" required></label><label class="field wide"><span>연결할 일정</span><select name="scheduleId"><option value="">연결 안 함</option>${state.schedules.map(s=>`<option value="${s.id}">${s.date.slice(5)} ${s.time} · ${esc(s.place)}</option>`).join('')}</select></label><label class="field"><span>날짜</span><input type="date" name="date" value="${item.date}"></label><label class="field"><span>시간</span><input type="time" name="time" value="${item.time}"></label><label class="field"><span>인원</span><input type="number" name="people" value="${MEMBERS.length}"></label><label class="field"><span>예약자</span><select name="booker">${MEMBERS.map(m=>`<option ${m===state.currentMember?'selected':''}>${m}</option>`).join('')}</select></label><label class="field"><span>예약 방법</span><input name="method" value="확인 필요"></label><label class="field"><span>상태</span><select name="status">${['조사 필요','예약 예정','예약 요청','예약 완료','취소'].map(s=>`<option>${s}</option>`).join('')}</select></label><label class="field"><span>예약번호</span><input name="number"></label><label class="field"><span>취소 가능 기한</span><input name="deadline" value="확인 필요"></label><label class="field wide"><span>예약 링크</span><input type="url" name="link"></label><label class="field wide"><span>메모</span><textarea name="note"></textarea></label>`;
  document.querySelector('#editorDialog').showModal();
}

document.addEventListener('click',e=>{
  const pageBtn=e.target.closest('[data-page],[data-page-link]');if(pageBtn){navigate(pageBtn.dataset.page||pageBtn.dataset.pageLink);return}
  if(e.target.closest('#menuButton')){document.querySelector('#sidebar').classList.toggle('open');return}
  if(e.target.closest('#shareButton')){document.querySelector('#shareUrl').value=location.href;document.querySelector('#shareDialog').showModal();return}
  if(e.target.closest('#activityButton')){renderActivity();document.querySelector('#activityDialog').showModal();return}
  if(e.target.closest('#quickAdd')||e.target.closest('[data-action="add-schedule"]')){openScheduleEditor();return}
  const sch=e.target.closest('[data-edit-schedule]');if(sch){openScheduleEditor(sch.dataset.editSchedule);return}
  const day=e.target.closest('[data-day]');if(day){activeDay=day.dataset.day;renderSchedule();return}
  const check=e.target.closest('[data-check]');if(check){const c=state.checklist.find(x=>x.id===check.dataset.check);c.done=check.checked;saveState(`${c.text} 항목을 ${c.done?'완료':'미완료'}로 변경했어요`);renderAll();return}
  const fol=e.target.closest('[data-foliage-area]');if(fol){activeFoliageArea=fol.dataset.foliageArea;renderFoliage();return}
  const addFol=e.target.closest('[data-add-foliage]');if(addFol){const f=state.foliage.find(x=>x.id===addFol.dataset.addFoliage);const s={id:uid('s'),date:activeDay,time:'10:00',end:'12:00',place:f.name,category:'tour',description:f.note,duration:120,nextTravel:20,transport:f.transport,cost:0,reservation:'불필요',reservationTime:'',map:f.map,official:f.official,memo:'단풍 상태 출발 전 확인'};state.schedules.push(s);saveState(`${f.name}을 일정에 추가했어요`);toast('현재 선택된 날짜에 추가했어요.');renderAll();return}
  const priority=e.target.closest('#foodPriority button');if(priority){activeFoodPriority=priority.dataset.value;document.querySelectorAll('#foodPriority button').forEach(b=>b.classList.toggle('active',b===priority));renderFood();return}
  const addPlace=e.target.closest('[data-action="add-place"]');if(addPlace){openPlaceEditor(addPlace.dataset.type);return}
  if(e.target.closest('[data-action="add-booking"]')){openBookingEditor();return}
  const editPlace=e.target.closest('[data-edit-place]');if(editPlace){const [kind,id]=editPlace.dataset.editPlace.split(':');openPlaceEditor(kind,id);return}
  const vote=e.target.closest('[data-vote]');if(vote){const [kind,id]=vote.dataset.vote.split(':'),item=(kind==='food'?state.food:state.drinks).find(x=>x.id===id);item.voted=!item.voted;item.votes+=item.voted?1:-1;saveState(`${item.name}에 ${item.voted?'투표했어요':'투표를 취소했어요'}`);renderAll();toast(item.voted?'한 표를 보탰어요 👍':'투표를 취소했어요.');return}
  const drink=e.target.closest('[data-drink-category]');if(drink){activeDrinkCategory=drink.dataset.drinkCategory;renderDrinks();return}
  const mapCat=e.target.closest('[data-map-category]');if(mapCat){activeMapCategory=mapCat.dataset.mapCategory;renderMapFilters();initMainMap();return}
  const addMap=e.target.closest('[data-add-map]');if(addMap){const p=allMapPlaces().find(x=>x.id===addMap.dataset.addMap);if(p){state.schedules.push({id:uid('s'),date:activeDay,time:'12:00',end:'13:30',place:p.name,category:p.category==='drink'?'drink':p.category==='food'?'food':'tour',description:p.description||p.note||'',duration:90,nextTravel:15,transport:'확인 필요',cost:0,reservation:'확인 필요',reservationTime:'',map:p.map||'',official:p.official||'',memo:'지도에서 추가됨'});saveState(`${p.name}을 일정에 추가했어요`);renderAll();toast('현재 선택된 날짜에 추가했어요.')}return}
  if(e.target.closest('#addExpense')){openExpenseEditor();return}
  const expense=e.target.closest('[data-edit-expense]');if(expense){openExpenseEditor(expense.dataset.editExpense);return}
  const expenseFilter=e.target.closest('[data-expense-filter]');if(expenseFilter){document.querySelectorAll('[data-expense-filter]').forEach(button=>button.classList.toggle('active',button===expenseFilter));const value=expenseFilter.dataset.expenseFilter;document.querySelectorAll('[data-edit-expense]').forEach(row=>row.hidden=!(value==='all'||row.dataset.expenseScope===value||row.dataset.expenseCategory===value));return}
  if(e.target.closest('#addChecklist')){const text=prompt('새 할 일을 입력하세요.');if(text){state.checklist.push({id:uid('c'),category:'기타',text,due:'날짜 미정',done:false,urgent:false});saveState(`${text} 할 일을 추가했어요`);renderAll()}return}
  if(e.target.closest('#copyLink')){navigator.clipboard?.writeText(location.href);toast('공유 링크를 복사했어요.');return}
  if(e.target.closest('#routeMode')){toast('지도에서 출발지와 도착지를 차례로 선택하세요. (경로 API 연결 필요)');return}
});
document.addEventListener('input',e=>{if(e.target.id==='exchangeRate'){state.exchangeRate=Math.max(0,Number(e.target.value)||0);renderStats();renderBudget();document.querySelector('#exchangeUpdated').textContent='입력 중'}if(e.target.id==='expenseInputAmount')updateExpenseForm()});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-booking-status]')){const r=state.reservations.find(x=>x.id===e.target.dataset.bookingStatus);r.status=e.target.value;syncReservationToSchedule(r);saveState(`${r.place} 예약 상태를 ${r.status}(으)로 변경했어요`);renderAll();toast('예약 상태와 연결 일정을 동기화했어요.');}
  if(e.target.id==='exchangeRate'){state.exchangeRate=Math.max(0,Number(e.target.value)||initialData.exchangeRate);localStorage.setItem('sapporo-rate',state.exchangeRate);document.querySelector('#exchangeUpdated').textContent='방금';saveState(`공통 환율을 ¥1 = ₩${state.exchangeRate}(으)로 변경했어요`);renderAll();toast('메인 대시보드와 경비에 환율을 반영했어요.')}
  if(e.target.id==='expenseScope'||e.target.id==='expenseCurrency')updateExpenseForm();
  if(e.target.id==='globalFoliageStatus'){activeFoliageStatus=e.target.value;renderFoliage();}
  if(e.target.matches('[data-foliage-status]')){const place=state.foliage.find(f=>f.id===e.target.dataset.foliageStatus);place.status=e.target.value;saveState(`${place.name} 단풍 상태를 ${place.status}(으)로 변경했어요`);renderAll();toast('단풍 카드와 지도 상세에 상태를 반영했어요.');}
});
document.querySelector('#foodSearch').addEventListener('input',renderFood);
document.querySelector('#editorForm').addEventListener('submit',e=>{
  e.preventDefault();const fd=new FormData(e.currentTarget),values=Object.fromEntries(fd.entries());
  if(editing.type==='schedule'){const item=editing.isNew?{id:editing.id}:state.schedules.find(x=>x.id===editing.id);Object.assign(item,values,{duration:Number(values.duration),nextTravel:Number(values.nextTravel),cost:Number(values.cost)});if(editing.isNew)state.schedules.push(item);syncScheduleToReservation(item);saveState(`${item.place||'새 일정'}을 ${editing.isNew?'추가':'수정'}했어요`)}
  else if(editing.type==='food'||editing.type==='drink'){const arr=editing.type==='food'?state.food:state.drinks,item=editing.isNew?{id:editing.id,type:editing.type,votes:0,voted:false,stars:3,priority:editing.type==='food'?'candidate':3,lat:43.0556,lng:141.3533}:arr.find(x=>x.id===editing.id);Object.assign(item,values);if(editing.isNew)arr.push(item);saveState(`${item.name||'후보'}을 ${editing.isNew?'추가':'수정'}했어요`)}
  else if(editing.type==='expense'){const inputAmount=Number(values.inputAmount)||0,scope=values.scope==='personal'?'personal':'common',owner=scope==='personal'?values.owner:'';const item={...editing.item,...values,scope,owner,inputAmount,inputCurrency:values.inputCurrency,amount:values.inputCurrency==='KRW'?inputAmount/state.exchangeRate:inputAmount,settled:values.settled==='true',participants:scope==='personal'?[owner]:[...MEMBERS]};if(editing.isNew)state.expenses.push(item);else Object.assign(state.expenses.find(e=>e.id===editing.id),item);saveState(`${scope==='personal'?'개인':'공동'} 지출 ${item.description||''}을 ${editing.isNew?'추가':'수정'}했어요`)}
  else if(editing.type==='booking'){const item={...editing.item,...values,people:Number(values.people)};state.reservations.push(item);syncReservationToSchedule(item);saveState(`${item.place} 예약 항목을 추가했어요`)}
  document.querySelector('#editorDialog').close();renderAll();toast('변경사항을 저장했어요.');
});
document.querySelector('#deleteItem').addEventListener('click',()=>{if(!editing||editing.isNew)return; if(!confirm('이 항목을 삭제할까요?'))return;const arr=editing.type==='schedule'?state.schedules:editing.type==='food'?state.food:editing.type==='drink'?state.drinks:editing.type==='expense'?state.expenses:state.reservations;if(editing.type==='schedule')state.reservations.filter(r=>r.scheduleId===editing.id).forEach(r=>r.scheduleId='');const idx=arr.findIndex(x=>x.id===editing.id);if(idx>=0)arr.splice(idx,1);saveState('항목을 삭제했어요');document.querySelector('#editorDialog').close();renderAll();toast('삭제했어요.');});
document.querySelector('#memberButton').addEventListener('click',()=>{const i=MEMBERS.indexOf(state.currentMember);state.currentMember=MEMBERS[(i+1)%MEMBERS.length];saveState();renderAll();toast(`${state.currentMember} 님으로 전환했어요.`)});
document.querySelector('#authButton').addEventListener('click',()=>document.querySelector('#authDialog').showModal());
document.querySelector('#closeAuth').addEventListener('click',()=>document.querySelector('#authDialog').close());
document.querySelector('#authForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=document.querySelector('#authEmail').value.trim();
  const {error}=await supabaseClient.auth.signInWithOtp({email,options:{emailRedirectTo:location.href.split('#')[0]}});
  if(error){toast(`로그인 링크 전송 실패: ${error.message}`);return}
  document.querySelector('#authDialog').close();toast('이메일로 로그인 링크를 보냈어요.');
});
document.querySelector('#signOutButton').addEventListener('click',async()=>{
  await supabaseClient.auth.signOut();
  signedInUser=null;
  if(remoteChannel){await supabaseClient.removeChannel(remoteChannel);remoteChannel=null}
  updateAuthUI();document.querySelector('#authDialog').close();toast('서버에서 로그아웃했어요.');
});

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  document.querySelector('#installButton').hidden=false;
});
document.querySelector('#installButton').addEventListener('click',async()=>{
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  document.querySelector('#installButton').hidden=true;
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  document.querySelector('#installButton').hidden=true;
  toast('삿포로 여행 앱을 설치했어요.');
});
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(error=>console.warn('서비스 워커 등록 실패:',error)));
}

renderAll();
initializeSupabase();
