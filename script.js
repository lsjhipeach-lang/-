/* Sapporo Trip Control Tower
   Data model: schedules, places, reservations, expenses, checklist, activity.
   localStorage is the persistence adapter; replace storage methods with a remote
   adapter (Supabase/Firebase) for cross-device authenticated collaboration. */

const DEFAULT_TRIP_DATES = [
  { date: '2026-10-22', label: 'DAY 1', short: '10.22', weekday: '목', theme: '도착 · 스스키노' },
  { date: '2026-10-23', label: 'DAY 2', short: '10.23', weekday: '금', theme: '삿포로의 가을' },
  { date: '2026-10-24', label: 'DAY 3', short: '10.24', weekday: '토', theme: '조잔케이' },
  { date: '2026-10-25', label: 'DAY 4', short: '10.25', weekday: '일', theme: '오타루 · 운하의 밤' },
  { date: '2026-10-26', label: 'DAY 5', short: '10.26', weekday: '월', theme: '시장 · 귀국' }
];
let TRIP_DATES = [...DEFAULT_TRIP_DATES];

const parseDate = value => new Date(`${value}T00:00:00`);
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const shiftDate = (value,days) => {const date=parseDate(value);date.setDate(date.getDate()+days);return dateKey(date)};
const inTripRange = value => value>=state.tripStart&&value<=state.tripEnd;
function buildTripDates(start,end){
  const themes=DEFAULT_TRIP_DATES.map(day=>day.theme), dates=[];
  for(let cursor=parseDate(start),last=parseDate(end),index=0;cursor<=last;cursor.setDate(cursor.getDate()+1),index++){
    dates.push({date:dateKey(cursor),label:`DAY ${index+1}`,short:`${String(cursor.getMonth()+1).padStart(2,'0')}.${String(cursor.getDate()).padStart(2,'0')}`,weekday:new Intl.DateTimeFormat('ko-KR',{weekday:'short'}).format(cursor).replace('요일',''),theme:themes[index]||(cursor.getTime()===last.getTime()?'여행 마무리':'자유 일정')});
  }
  return dates;
}

const MEMBERS = ['이승재', '윤지원'];
const MASTER = '이승재';
const PREVIEW_MODE = new URLSearchParams(location.search).get('preview') === '1';
const SUPABASE_URL = 'https://rwmkfgnjsjfbipeybqqk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__P7HGi9sReXExdeGLnO9rQ_iLtYeQSH';
const TRIP_ID = 'sapporo-2026';
const STORAGE_KEY = 'sapporo-trip-v3';
const BACKUP_KEY = 'sapporo-trip-v3-last-good';
const HISTORY_KEY = 'sapporo-trip-v3-history';
const MAX_LOCAL_BACKUPS = 12;
const supabaseClient = PREVIEW_MODE ? null : window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let signedInUser = null;
let remoteChannel = null;
let deferredInstallPrompt = null;
let otpSendPending = false;
let otpVerifyPending = false;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEVELOPMENT_HOSTS = new Set(['localhost','127.0.0.1','[::1]']);
const isDevelopment = location.protocol === 'file:' || DEVELOPMENT_HOSTS.has(location.hostname);
function logSupabaseAuthError(context,error){
  if(!isDevelopment)return;
  console.error(context,{message:error?.message,status:error?.status,code:error?.code});
}
const CAT = {
  tour: { label: '🍁 단풍/관광', color: '#799858' }, food: { label: '🍣 식사', color: '#dc8738' },
  drink: { label: '🍶 술', color: '#8d4451' }, cafe: { label: '☕ 카페', color: '#ad7654' },
  move: { label: '🚃 이동', color: '#557e8c' }, shop: { label: '🛍 쇼핑', color: '#49798a' },
  hotel: { label: '🏨 숙소', color: '#6d6593' }, flight: { label: '✈️ 항공', color: '#4b7188' }
};

const initialData = {
  version: 4,
  tripStart: '2026-10-22',
  tripEnd: '2026-10-26',
  currentMember: '이승재',
  exchangeRate: 9.3,
  savedPlaces: [],
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

let recoveredStorageNotice = '';
let state = loadState();
let activeDay;
syncTripDates();
let activeFoodPriority = 'all';
let activeFoliageArea = '전체';
let activeFoliageStatus = '전체 상태';
let activeDrinkCategory = '전체';
let activeMapCategory = '전체';
let activeExpenseFilters = {month:'all',member:'all',scope:'all',category:'all'};
let pendingMapsImports = [];
let editing = null;
let mainMap, susukinoMap, mapMarkers = [], drinkMapMarkers = [];
const openChecklistGroups = new Set(['의류 · 방한']);

function validStoredState(value){return value&&typeof value==='object'&&Array.isArray(value.schedules)&&Array.isArray(value.expenses)&&Array.isArray(value.reservations)}
function readStoredJson(key){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
function persistLocalState(next,{keepPrevious=true}={}){
  if(PREVIEW_MODE||!validStoredState(next))return;
  const previous=readStoredJson(STORAGE_KEY);
  if(keepPrevious&&validStoredState(previous)&&JSON.stringify(previous)!==JSON.stringify(next)){
    const history=readStoredJson(HISTORY_KEY),items=Array.isArray(history)?history:[];
    items.unshift({savedAt:new Date().toISOString(),data:previous});
    localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,MAX_LOCAL_BACKUPS)));
  }
  localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  localStorage.setItem(BACKUP_KEY,JSON.stringify(next));
}

function loadState(){
  if(PREVIEW_MODE)return structuredClone(initialData);
  try {
    let saved = readStoredJson(STORAGE_KEY);
    if(!validStoredState(saved)){
      const lastGood=readStoredJson(BACKUP_KEY),history=readStoredJson(HISTORY_KEY);
      saved=validStoredState(lastGood)?lastGood:Array.isArray(history)&&validStoredState(history[0]?.data)?history[0].data:null;
      if(saved){persistLocalState(saved,{keepPrevious:false});recoveredStorageNotice='기기 복구본에서 여행 데이터를 되살렸어요.'}
    }
    if(!saved) return structuredClone(initialData);
    if(saved.version === initialData.version){
      saved.tripStart=saved.tripStart||initialData.tripStart;
      saved.tripEnd=saved.tripEnd||initialData.tripEnd;
      saved.exchangeRate=Number(saved.exchangeRate||localStorage.getItem('sapporo-rate'))||initialData.exchangeRate;
      const reservationLinks={r2:'s2',r3:'s3',r4:'s9',r5:'s10'};
      saved.reservations?.forEach(r=>{if(!r.scheduleId&&reservationLinks[r.id])r.scheduleId=reservationLinks[r.id]});
      saved.expenses?.forEach(e=>{e.scope=e.scope||'common';e.owner=e.scope==='personal'?(e.owner||e.payer):'';e.inputCurrency=e.inputCurrency||'JPY';e.inputAmount=Number(e.inputAmount??e.amount);e.participants=e.scope==='personal'?[e.owner]:[...MEMBERS]});
      saved.savedPlaces=Array.isArray(saved.savedPlaces)?saved.savedPlaces:[];
      persistLocalState(saved,{keepPrevious:false});return saved;
    }
    const migrated = structuredClone(initialData);
    ['schedules','foliage','food','drinks','savedPlaces','checklist'].forEach(key=>{ if(Array.isArray(saved[key])) migrated[key]=saved[key] });
    const memberMap={'김도윤':'이승재','박준호':'이승재','이서연':'윤지원','최유진':'윤지원','이승재':'이승재','윤지원':'윤지원'};
    const reservationLinks={r2:'s2',r3:'s3',r4:'s9',r5:'s10'};
    if(Array.isArray(saved.reservations)) migrated.reservations=saved.reservations.map(r=>({...r,scheduleId:r.scheduleId||reservationLinks[r.id]||'',people:MEMBERS.length,booker:memberMap[r.booker]||MASTER}));
    if(Array.isArray(saved.expenses)) migrated.expenses=saved.expenses.map((e,index)=>{const payer=memberMap[e.payer]||MEMBERS[index%MEMBERS.length],scope=e.scope||'common',owner=scope==='personal'?(memberMap[e.owner]||payer):'';return {...e,payer,owner,scope,inputCurrency:e.inputCurrency||'JPY',inputAmount:Number(e.inputAmount??e.amount),participants:scope==='personal'?[owner]:[...MEMBERS]}});
    if(Array.isArray(saved.activity)) migrated.activity=saved.activity.map(a=>({...a,member:memberMap[a.member]||MASTER}));
    migrated.exchangeRate=Number(saved.exchangeRate||localStorage.getItem('sapporo-rate'))||initialData.exchangeRate;
    migrated.tripStart=saved.tripStart||initialData.tripStart;
    migrated.tripEnd=saved.tripEnd||initialData.tripEnd;
    persistLocalState(migrated);return migrated;
  }
  catch { return structuredClone(initialData); }
}
function syncTripDates(){
  state.tripStart=state.tripStart||initialData.tripStart;
  state.tripEnd=state.tripEnd||initialData.tripEnd;
  TRIP_DATES=buildTripDates(state.tripStart,state.tripEnd);
  if(!TRIP_DATES.some(day=>day.date===activeDay))activeDay=TRIP_DATES[0]?.date||state.tripStart;
}
async function saveState(action){
  if(action){ state.activity.unshift({member:state.currentMember,action,time:'방금 전'}); state.activity=state.activity.slice(0,20); }
  state.updatedAt=new Date().toISOString();
  persistLocalState(state);
  const syncText=document.querySelector('#syncText');
  syncText.textContent=PREVIEW_MODE?'미리보기 · 새로고침 시 초기화':signedInUser?'서버 저장 중…':'이 기기에 저장됨';
  if(signedInUser&&supabaseClient){
    const {error}=await supabaseClient.from('trip_states').upsert({trip_id:TRIP_ID,data:state,updated_at:new Date().toISOString()});
    syncText.textContent=error?'서버 저장 실패 · 기기에는 저장됨':'서버에 저장됨';
    if(error) console.error('Supabase save failed:',error);
  }
  try { channel.postMessage({type:'state',state}); } catch {}
}
const channel = !PREVIEW_MODE&&'BroadcastChannel' in window ? new BroadcastChannel('sapporo-trip-sync') : {postMessage(){}};
if(channel.addEventListener) channel.addEventListener('message',e=>{if(e.data?.type==='state'){state=e.data.state;renderAll();toast('다른 탭의 변경사항을 반영했어요.')}});

async function loadRemoteState(){
  if(!signedInUser||!supabaseClient)return;
  document.querySelector('#syncText').textContent='서버 데이터 확인 중…';
  const {data,error}=await supabaseClient.from('trip_states').select('data,updated_at').eq('trip_id',TRIP_ID).maybeSingle();
  if(error){document.querySelector('#syncText').textContent='서버 연결 실패 · 기기 데이터 사용 중';console.error(error);return}
  if(data?.data){
    const localTime=Date.parse(state.updatedAt||0)||0,remoteTime=Date.parse(data.data.updatedAt||data.updated_at||0)||0;
    if(localTime>remoteTime+1000){await saveState('기기의 최신 데이터를 서버에 복구했어요');document.querySelector('#syncText').textContent='기기 최신 데이터를 서버에 저장함';return}
    persistLocalState(data.data);state=data.data;renderAll();document.querySelector('#syncText').textContent='서버 백업과 동기화됨';toast('서버에 보관된 여행 데이터를 불러왔어요.');
  }
  else await saveState('기존 기기 데이터를 서버로 가져왔어요');
}
function subscribeRemote(){
  if(!supabaseClient||remoteChannel)return;
  remoteChannel=supabaseClient.channel('trip-state-live').on('postgres_changes',{event:'*',schema:'public',table:'trip_states',filter:`trip_id=eq.${TRIP_ID}`},payload=>{
    if(payload.new?.data){const incomingTime=Date.parse(payload.new.data.updatedAt||payload.new.updated_at||0)||0,currentTime=Date.parse(state.updatedAt||0)||0;if(incomingTime>=currentTime){persistLocalState(payload.new.data);state=payload.new.data;renderAll();document.querySelector('#syncText').textContent='서버 변경사항 반영됨'}}
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
  const label=document.querySelector('#authButtonLabel'),meta=document.querySelector('#authButtonMeta'),signOut=document.querySelector('#signOutButton'),loginFields=document.querySelector('#authLoginFields'),sessionInfo=document.querySelector('#authSessionInfo');
  if(PREVIEW_MODE){label.textContent='서버 로그인';meta.textContent='미리보기에서는 서버 연결이 차단됩니다';signOut.hidden=true;loginFields.hidden=false;sessionInfo.hidden=true;document.querySelector('#syncText').textContent='미리보기 · 서버 저장 안 함';return}
  label.textContent=signedInUser?'로그인 계정':'서버 로그인';
  meta.textContent=signedInUser?signedInUser.email:'여러 기기에서 여행 데이터 동기화하기';
  signOut.hidden=!signedInUser;
  loginFields.hidden=Boolean(signedInUser);
  sessionInfo.hidden=!signedInUser;
  document.querySelector('#authSessionEmail').textContent=signedInUser?.email||'';
  if(!signedInUser)document.querySelector('#syncText').textContent='이 기기에 저장됨';
}
function setOtpStep(open){
  const step=document.querySelector('#otpStep'),email=document.querySelector('#authEmail'),send=document.querySelector('#sendOtpButton');
  step.hidden=!open;email.readOnly=open;send.textContent=open?'인증번호 다시 받기':'인증번호 받기';
  if(open)setTimeout(()=>document.querySelector('#authOtp').focus(),50);
}
const yen = n => `¥${Math.round(Number(n)||0).toLocaleString('ko-KR')}`;
const won = (n,rate=state.exchangeRate) => `₩${Math.round((Number(n)||0)*(Number(rate)||initialData.exchangeRate)).toLocaleString('ko-KR')}`;
const expenseJPY = (expense,rate=state.exchangeRate) => expense.inputCurrency==='KRW' ? Number(expense.inputAmount||0)/(Number(rate)||initialData.exchangeRate) : Number(expense.inputAmount??expense.amount??0);
const uid = p => p + Date.now().toString(36);
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}

let menuScrollY=0;
function setMobileMenuOpen(open){
  const sidebar=document.querySelector('#sidebar');
  const shouldOpen=open&&matchMedia('(max-width: 767px)').matches;
  if(shouldOpen&&!document.body.classList.contains('menu-open')){
    menuScrollY=window.scrollY;
    document.body.style.top=`-${menuScrollY}px`;
    document.documentElement.classList.add('menu-open');
    document.body.classList.add('menu-open');
  }else if(!shouldOpen&&document.body.classList.contains('menu-open')){
    document.documentElement.classList.remove('menu-open');
    document.body.classList.remove('menu-open');
    document.body.style.top='';
    window.scrollTo(0,menuScrollY);
  }
  sidebar.classList.toggle('open',shouldOpen);
  document.querySelector('#menuButton').setAttribute('aria-expanded',String(shouldOpen));
}

function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const names={home:['TRIP OVERVIEW','여행 대시보드'],schedule:['DAY BY DAY','날짜별 일정'],foliage:['AUTUMN WATCH','단풍 스팟'],food:['FOOD SHORTLIST','맛집 DB'],drinks:['NIGHT ROUTES','술 대시보드'],map:['ALL PLACES','통합 지도'],budget:['TRIP WALLET','경비'],booking:['RESERVATION BOARD','예약 관리'],checklist:['READY TO GO','출발 전 체크리스트']};
  document.querySelector('#pageEyebrow').textContent=names[page][0]; document.querySelector('#pageTitle').textContent=names[page][1];
  setMobileMenuOpen(false); window.scrollTo({top:0,behavior:'smooth'});
  document.querySelector('#mobileNow').classList.toggle('visible',page==='home'&&matchMedia('(max-width: 767px)').matches);
  if(page==='map') setTimeout(()=>{initMainMap();mainMap?.invalidateSize()},80);
  if(page==='drinks') setTimeout(()=>{initSusukinoMap();susukinoMap?.invalidateSize()},80);
}

function syncResponsiveUI(){
  const mobile=matchMedia('(max-width: 767px)').matches;
  const sidebar=document.querySelector('#sidebar');
  setMobileMenuOpen(mobile&&sidebar.classList.contains('open'));
  document.querySelector('#mobileNow').classList.toggle('visible',mobile&&document.querySelector('#page-home').classList.contains('active'));
  requestAnimationFrame(()=>{mainMap?.invalidateSize();susukinoMap?.invalidateSize()});
}

function renderStats(){
  const tripSchedules=state.schedules.filter(s=>inTripRange(s.date)),tripReservations=state.reservations.filter(r=>inTripRange(r.date));
  const confirmed=tripSchedules.filter(s=>!['조사 필요','확인 필요'].includes(s.reservation)).length;
  const need=tripReservations.filter(r=>r.status!=='취소').length, done=tripReservations.filter(r=>r.status==='예약 완료').length;
  const planned=tripSchedules.reduce((a,b)=>a+(Number(b.cost)||0),0)*MEMBERS.length;
  const spent=state.expenses.reduce((a,b)=>a+expenseJPY(b),0);
  const todo=state.checklist.filter(c=>!c.done).length;
  const today=new Date();today.setHours(0,0,0,0);const start=parseDate(state.tripStart),end=parseDate(state.tripEnd);
  const days=Math.ceil((start-today)/86400000), duration=TRIP_DATES.length, period=duration===1?'1일':`${duration-1}박 ${duration}일`;
  const stats=[['D-DAY',days>0?`D-${days}`:today<=end?'여행 중':'여행 완료'],['여행 기간',period],['확정 일정',`${confirmed}<em>개</em>`],['예약 필요',`${need}<em>곳</em>`],['예약 완료',`${done}<em>곳</em>`],['예상 총 여행비',`${won(planned)}<em>${yen(planned)} · ${MEMBERS.length}인</em>`],['현재 경비',`${won(spent)}<em>${yen(spent)}</em>`],['출발 전 할 일',`${todo}<em>개</em>`]];
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
  const summary=[['오늘의 핵심 일정',day.theme],['총 예상 이동',`${move}분`],['1인 예상 비용',`${won(cost)} · ${yen(cost)}`],['예상 도보량',move>120?'12,000보+':'8,000~10,000보'],['저녁 음주 지역',drink.includes('오타루')?'오타루':'스스키노'],['숙소 복귀','23:40 전후']];
  document.querySelector('#daySummary').innerHTML=summary.map(s=>`<div class="summary-cell"><small>${s[0]}</small><b>${s[1]}</b></div>`).join('');
  document.querySelector('#scheduleBoard').innerHTML=items.map(s=>`<article class="schedule-row" draggable="true" data-id="${s.id}" data-edit-schedule="${s.id}"><span class="drag-handle">⠿</span><div class="schedule-time"><b>${s.time}</b><small>${s.end}</small></div><i class="category-bar ${s.category}"></i><div class="schedule-main"><b>${esc(s.place)}</b><small>${esc(s.description)}</small></div><div class="schedule-meta"><small>${CAT[s.category]?.label}</small><b>${s.transport} · ${s.duration}분</b></div><span class="tag ${s.reservation==='예약 완료'?'done':s.reservation.includes('필요')?'need':''}">${s.reservation}</span><button class="icon-button" type="button" aria-label="${esc(s.place)} 일정 수정">›</button></article>`).join('')||'<p class="empty-state">일정이 없어요. 새 일정을 추가해보세요.</p>';
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
  document.querySelector('#foodDatabase').innerHTML=`<div class="db-row header"><span>가게 / 대표 메뉴</span><span>지역</span><span>가격대</span><span>방문일</span><span>우선순위</span><span>별점</span><span>투표</span><span></span></div>`+list.map(p=>`<div class="db-row"><div class="db-name"><b>${esc(p.name)}</b><small>${esc(p.menu)} · ${esc(p.hours)}</small></div><span>${esc(p.area)}</span><span>${esc(p.price)}</span><span>${esc(p.visit)}</span><label class="food-priority-control"><i class="priority-dot ${p.priority}"></i><select data-food-priority="${p.id}" aria-label="${esc(p.name)} 우선순위"><option value="must" ${p.priority==='must'?'selected':''}>무조건 가기</option><option value="maybe" ${p.priority==='maybe'?'selected':''}>시간 되면</option><option value="candidate" ${p.priority==='candidate'?'selected':''}>후보</option></select></label><span class="stars">${'★'.repeat(p.stars)}${'☆'.repeat(5-p.stars)}</span><button class="vote-button ${p.voted?'voted':''}" data-vote="food:${p.id}">👍 ${p.votes}</button><button class="icon-button" data-edit-place="food:${p.id}">›</button></div>`).join('');
}
function renderDrinkRoutes(){
  const nightDate=index=>{const day=TRIP_DATES[index]||TRIP_DATES.at(-1);if(!day)return '날짜 미정';return `${new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(parseDate(day.date)).toUpperCase()} · ${day.short}`};
  const routes=[
    {night:nightDate(0),name:'도착의 밤',plan:'PLAN A',stops:[['18:30','징기스칸 후보'],['20:20','사케 바'],['22:15','위스키 바'],['23:40','숙소']]},
    {night:nightDate(1),name:'스스키노 딥다이브',plan:'PLAN A',stops:[['18:30','해산물 저녁'],['20:30','이자카야'],['22:15','칵테일 바'],['00:00','숙소']]},
    {night:nightDate(2),name:'온천 뒤 한 잔',plan:'PLAN B',stops:[['19:00','야키토리'],['21:00','크래프트 맥주'],['22:45','라멘/숙소']]}
  ];
  document.querySelector('#drinkRoutes').innerHTML=routes.slice(0,Math.min(3,TRIP_DATES.length)).map(r=>`<article class="route-card"><div class="route-card-head"><div><small>${r.night}</small><b> ${r.name}</b></div><span>${r.plan}</span></div><div class="night-stops">${r.stops.map((s,i)=>`<div class="night-stop"><small>${i?`${i}차`:'저녁'} · ${s[0]}</small><b>${s[1]}</b><em>${i<r.stops.length-1?'도보 5~15분':'복귀'}</em></div>`).join('')}</div></article>`).join('');
}
function renderDrinks(){
  renderDrinkRoutes(); const cats=['전체',...new Set(state.drinks.map(d=>d.category))];
  document.querySelector('#drinkFilters').innerHTML=cats.map(c=>`<button class="${c===activeDrinkCategory?'active':''}" data-drink-category="${c}">${c}</button>`).join('');
  const list=state.drinks.filter(d=>activeDrinkCategory==='전체'||d.category===activeDrinkCategory);
  document.querySelector('#drinkCards').innerHTML=list.map(d=>`<article class="drink-card"><div class="drink-card-head"><div><h3>${esc(d.name)}</h3><p>${esc(d.area)} · ${esc(d.mood)}</p></div><button class="vote-button ${d.voted?'voted':''}" data-vote="drink:${d.id}">👍 ${d.votes}</button></div><div class="detail-pairs"><div><small>주력 술</small><b>${esc(d.alcohol)}</b></div><div><small>추천 차수</small><b>${esc(d.stage)}</b></div><div><small>영업시간 / L.O.</small><b>${esc(d.hours)} / ${esc(d.lastOrder)}</b></div><div><small>예약 / 흡연</small><b>${esc(d.reservable)} / ${esc(d.smoking)}</b></div></div><p>${esc(d.note)}</p><div class="drink-card-actions"><a class="secondary" href="${d.map}" target="_blank" rel="noopener">지도 ↗</a><button class="secondary" data-edit-place="drink:${d.id}">상세·수정</button></div></article>`).join('');
}
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const char=text[i],next=text[i+1];if(char==='"'&&quoted&&next==='"'){cell+='"';i++}else if(char==='"'){quoted=!quoted}else if(char===','&&!quoted){row.push(cell);cell=''}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')i++;row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell=''}else cell+=char}
  row.push(cell);if(row.some(value=>value.trim()))rows.push(row);if(rows.length<2)return[];
  const headers=rows.shift().map(header=>header.trim().toLowerCase());
  return rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,(values[index]||'').trim()])));
}
function takeoutValue(record,names){for(const name of names){const key=Object.keys(record).find(item=>item.toLowerCase()===name);if(key&&record[key]!==undefined)return String(record[key])}return''}
function classifyImportedPlace(place){
  const text=`${place.name} ${place.note} ${place.sourceList}`.toLowerCase();
  if(/bar|pub|izakaya|brew|whisk|cocktail|sake|wine|beer|술|주점|바|이자카야|居酒屋|バー|酒/.test(text))return'drink';
  if(/cafe|coffee|dessert|bakery|카페|커피|디저트|베이커리|喫茶|珈琲/.test(text))return'cafe';
  if(/restaurant|ramen|sushi|curry|food|grill|dining|맛집|식당|라멘|스시|카레|징기스칸|食堂|料理|寿司|ラーメン/.test(text))return'food';
  if(/hotel|hostel|resort|ryokan|숙소|호텔|료칸|旅館/.test(text))return'hotel';
  if(/shop|mall|market|store|쇼핑|시장|백화점|商店|市場/.test(text))return'shop';
  if(/station|airport|terminal|역|공항|駅|空港/.test(text))return'move';
  return'tour';
}
function detectHokkaidoRegion(place){
  const lat=Number(place.lat),lng=Number(place.lng);if(Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=41.3&&lat<=45.7&&lng>=139.3&&lng<=146.2)return'hokkaido';
  const text=`${place.name} ${place.note} ${place.address} ${place.sourceList}`.toLowerCase();
  if(/hokkaido|北海道|홋카이도|삿포로|sapporo|札幌|오타루|otaru|小樽|하코다테|hakodate|函館|아사히카와|asahikawa|旭川|후라노|furano|富良野|비에이|biei|美瑛|노보리베츠|noboribetsu|登別|조잔케이|jozankei|定山渓|쿠시로|kushiro|釧路|오비히로|obihiro|帯広|치토세|chitose|千歳|니세코|niseko|ニセコ/.test(text))return'hokkaido';
  if(/tokyo|東京|도쿄|osaka|大阪|오사카|kyoto|京都|교토|fukuoka|福岡|후쿠오카|nagoya|名古屋|나고야|okinawa|沖縄|오키나와|yokohama|横浜|요코하마/.test(text))return'outside';
  return'unknown';
}
function normalizeTakeoutRecord(record,sourceList){
  const name=takeoutValue(record,['title','name','place name','장소명'])||'이름 확인 필요',url=takeoutValue(record,['url','google maps url','link','지도 링크']),note=takeoutValue(record,['note','comment','description','메모']),address=takeoutValue(record,['address','formatted address','주소']),rawLat=takeoutValue(record,['latitude','lat','위도']),rawLng=takeoutValue(record,['longitude','lng','lon','경도']),urlCoordinates=url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)||url.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?)[,%2C]+(-?\d+(?:\.\d+)?)/i),lat=rawLat||urlCoordinates?.[1],lng=rawLng||urlCoordinates?.[2];
  const place={id:uid('gm'),name,url:url||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,note,address,lat:lat?Number(lat):null,lng:lng?Number(lng):null,sourceList,category:'tour',region:'unknown',selected:false};place.category=classifyImportedPlace(place);place.region=detectHokkaidoRegion(place);place.selected=place.region==='hokkaido';return place;
}
function flattenTakeoutJson(value,sourceList,result=[]){if(Array.isArray(value))value.forEach(item=>flattenTakeoutJson(item,sourceList,result));else if(value&&typeof value==='object'){if(takeoutValue(value,['title','name','place name'])||takeoutValue(value,['url','google maps url','link']))result.push(normalizeTakeoutRecord(value,sourceList));else Object.values(value).forEach(item=>flattenTakeoutJson(item,sourceList,result))}return result}
async function parseTakeoutFiles(files){
  const parsed=[];for(const file of files){const text=await file.text(),sourceList=file.name.replace(/\.(csv|json)$/i,'');try{if(file.name.toLowerCase().endsWith('.json'))parsed.push(...flattenTakeoutJson(JSON.parse(text),sourceList));else parsed.push(...parseCsv(text).map(record=>normalizeTakeoutRecord(record,sourceList)))}catch(error){console.warn(`Takeout parse failed: ${file.name}`,error)}}
  const seen=new Set();return parsed.filter(place=>{const key=(place.url||place.name).toLowerCase().replace(/[?#].*$/,'');if(seen.has(key))return false;seen.add(key);return true});
}
function renderMapsImportReview(){
  const counts={hokkaido:pendingMapsImports.filter(item=>item.region==='hokkaido').length,outside:pendingMapsImports.filter(item=>item.region==='outside').length,unknown:pendingMapsImports.filter(item=>item.region==='unknown').length},selected=pendingMapsImports.filter(item=>item.selected).length;
  document.querySelector('#mapsImportSummary').innerHTML=`<b>홋카이도 ${counts.hokkaido}개</b><span>타지역 제외 ${counts.outside}개 · 지역 확인 필요 ${counts.unknown}개 · 선택 ${selected}개</span>`;
  document.querySelector('#mapsImportList').innerHTML=pendingMapsImports.map((place,index)=>`<article class="maps-import-row ${place.region}"><input type="checkbox" data-import-select="${index}" ${place.selected?'checked':''} ${place.region!=='hokkaido'?'disabled':''}><div><b>${esc(place.name)}</b><small>${esc(place.address||place.sourceList)} · ${place.region==='hokkaido'?'홋카이도':place.region==='outside'?'타지역 제외':'지역 확인 필요'}</small></div><select data-import-category="${index}">${['food','drink','cafe','hotel','shop','tour','move'].map(category=>`<option value="${category}" ${place.category===category?'selected':''}>${CAT[category]?.label||category}</option>`).join('')}</select><a href="${place.url}" target="_blank" rel="noopener" aria-label="Google Maps에서 확인">↗</a></article>`).join('')||'<p class="empty-state">읽을 수 있는 장소가 없습니다. CSV 또는 JSON 내용을 확인해주세요.</p>';
  document.querySelector('#confirmMapsImport').disabled=!selected;
  document.querySelector('#verifyMapsRegions').disabled=!counts.unknown;
}
function categoryFromGoogleTypes(types=[]){const values=new Set(types);if([...values].some(type=>['bar','pub','night_club','liquor_store'].includes(type)))return'drink';if([...values].some(type=>['cafe','coffee_shop','bakery','dessert_shop'].includes(type)))return'cafe';if([...values].some(type=>['restaurant','meal_takeaway','ramen_restaurant','sushi_restaurant'].includes(type)))return'food';if([...values].some(type=>['hotel','lodging','resort_hotel'].includes(type)))return'hotel';if([...values].some(type=>['store','shopping_mall','market'].includes(type)))return'shop';if([...values].some(type=>['airport','train_station','transit_station','bus_station'].includes(type)))return'move';return'tour'}
async function verifyImportedRegions(){
  const candidates=pendingMapsImports.filter(place=>place.region==='unknown');if(!candidates.length)return;
  if(!signedInUser){document.querySelector('#mapsImportDialog').close();document.querySelector('#authDialog').showModal();toast('지역 자동 확인은 기존 서버 로그인이 필요해요.');return}
  const button=document.querySelector('#verifyMapsRegions');button.disabled=true;button.textContent='지역 확인 중…';let apiCalls=0,cached=0,monthlyUsed=0;
  try{for(let offset=0;offset<candidates.length;offset+=20){const batch=candidates.slice(offset,offset+20),{data,error}=await supabaseClient.functions.invoke('places-enrich',{body:{places:batch.map(place=>({name:place.name,address:place.address}))}});if(error)throw error;apiCalls+=data?.usage?.apiCalls||0;cached+=data?.usage?.cached||0;monthlyUsed=data?.usage?.monthlyUsed??monthlyUsed;(data?.results||[]).forEach((result,index)=>{if(!result)return;const place=batch[index];place.name=result.displayName?.text||place.name;place.address=result.formattedAddress||place.address;place.lat=result.location?.latitude??place.lat;place.lng=result.location?.longitude??place.lng;place.url=result.googleMapsUri||place.url;place.category=categoryFromGoogleTypes(result.types||[]);place.region=detectHokkaidoRegion(place);place.selected=place.region==='hokkaido'})}document.querySelector('#mapsApiUsage').textContent=`Places API 월 사용량 · ${monthlyUsed} / 500회`;renderMapsImportReview();toast(`지역 확인 완료 · API ${apiCalls}회 · 캐시 ${cached}회`)}catch(error){console.error(error);toast(error?.context?.status===429?'월 500회 안전 한도에 도달했어요.':'지역 확인 서버를 아직 사용할 수 없어요.')}finally{button.textContent='홋카이도 지역 자동 확인';button.disabled=!pendingMapsImports.some(place=>place.region==='unknown')}}
function stableMapPoint(id){const hash=String(id).split('').reduce((a,c)=>a+c.charCodeAt(0),0);return {lat:43.061+((hash%17)-8)*.00055,lng:141.354+((hash%19)-9)*.00065}}
function importGoogleMapsPlaces(){
  const chosen=pendingMapsImports.filter(place=>place.selected&&place.region==='hokkaido'),existingKeys=new Set([...state.food,...state.drinks,...(state.savedPlaces||[])].flatMap(place=>[place.map||place.url,place.name].filter(Boolean).map(value=>String(value).toLowerCase().replace(/[?#].*$/,''))));let added=0,duplicates=0;
  chosen.forEach(place=>{const keys=[place.url,place.name].map(value=>String(value||'').toLowerCase().replace(/[?#].*$/,''));if(keys.some(key=>key&&existingKeys.has(key))){duplicates++;return}keys.forEach(key=>key&&existingKeys.add(key));
    if(place.category==='food')state.food.push({id:place.id,type:'food',name:place.name,menu:place.note||'메뉴 확인 필요',category:'Google Maps 가져오기',area:place.address||'홋카이도',price:'확인 필요',hours:'확인 필요',closed:'확인 필요',reservable:'확인 필요',reserved:false,wait:'확인 필요',rating:'확인 필요',review:`Google Maps · ${place.sourceList}`,map:place.url,booking:'',visit:'미정',priority:'candidate',stars:3,votes:0,memo:place.note||'Takeout에서 가져옴'});
    else if(place.category==='drink')state.drinks.push({id:place.id,type:'drink',name:place.name,area:place.address||'홋카이도',mood:'확인 필요',alcohol:'확인 필요',menu:place.note||'메뉴 확인 필요',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',crowd:'확인 필요',map:place.url,booking:'',priority:3,stage:'후보',category:'Google Maps 가져오기',votes:0,...(place.lat&&place.lng?{lat:place.lat,lng:place.lng}:stableMapPoint(place.id)),note:`${place.sourceList}에서 가져옴`});
    else state.savedPlaces.push({id:place.id,name:place.name,category:place.category,area:place.address||'홋카이도',address:place.address,map:place.url,url:place.url,lat:place.lat,lng:place.lng,note:place.note||'Takeout에서 가져옴',sourceList:place.sourceList,status:'정보 확인 필요'});added++});
  if(added){saveState(`Google Maps에서 홋카이도 장소 ${added}개를 가져왔어요`);renderAll()}document.querySelector('#mapsImportDialog').close();toast(`${added}개 추가${duplicates?` · 중복 ${duplicates}개 제외`:''}`);return {added,duplicates};
}
function allMapPlaces(){return [...state.foliage.map(f=>({...f,category:'tour',description:f.note})),...state.food.map(f=>({...f,category:'food',...(!f.lat?stableMapPoint(f.id):{}),description:f.menu})),...state.drinks.map(f=>({...f,category:'drink',description:`${f.alcohol} · ${f.stage}`})),...(state.savedPlaces||[]).map(p=>({...p,...(!p.lat?stableMapPoint(p.id):{}),description:p.note||p.sourceList}))]}
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
  const stats=[['총 경비',won(total),`${yen(total)} · 공동+개인`],['공동 경비',won(commonTotal),`${yen(commonTotal)} · 1인 ${won(commonShare)} (${yen(commonShare)})`],['개인 경비',won(personalTotal),`${yen(personalTotal)} · 개인별 아래 표시`],['1인당 평균',won(average),`${yen(average)} · 전체 경비 기준`]];
  document.querySelector('#budgetStats').innerHTML=stats.map(s=>`<div class="budget-stat"><small>${s[0]}</small><b>${s[1]}</b><em>${s[2]}</em></div>`).join('');
  const categoryColors=['#b94d2f','#d79538','#426f63','#6d6593','#8d4451','#557e8c','#799858','#ad7654'],categoryTotals=[...new Set(state.expenses.map(e=>e.category))].map((category,index)=>{const amount=state.expenses.filter(e=>e.category===category).reduce((sum,e)=>sum+expenseJPY(e),0);return {category,amount,color:categoryColors[index%categoryColors.length]}}).sort((a,b)=>b.amount-a.amount),chartTotal=categoryTotals.reduce((sum,item)=>sum+item.amount,0);
  let cursor=0;const stops=categoryTotals.map(item=>{const start=cursor,end=cursor+(chartTotal?item.amount/chartTotal*100:0);cursor=end;return `${item.color} ${start}% ${end}%`}).join(',');
  document.querySelector('#expenseChart').innerHTML=chartTotal?`<div class="expense-donut" role="img" aria-label="카테고리별 지출 비중" style="--expense-segments:${stops}"><div><b>${won(chartTotal)}</b><small>전체 사용금액</small></div></div><div class="expense-chart-legend">${categoryTotals.map(item=>`<div><i style="background:${item.color}"></i><span><b>${esc(item.category)}</b><small>${won(item.amount)}</small></span><strong>${(item.amount/chartTotal*100).toFixed(1).replace('.0','')}%</strong></div>`).join('')}</div>`:'<p class="empty-state">지출을 추가하면 카테고리 비중이 표시됩니다.</p>';
  const months=[...new Set(state.expenses.map(e=>e.date.slice(0,7)))].sort(),categories=[...new Set(state.expenses.map(e=>e.category))].sort();
  document.querySelector('#expenseFilters').innerHTML=`<label><span>기간</span><select data-expense-filter="month"><option value="all">전체 기간</option>${months.map(month=>`<option value="${month}" ${activeExpenseFilters.month===month?'selected':''}>${month.replace('-', '년 ')}월</option>`).join('')}</select></label><label><span>결제자</span><select data-expense-filter="member"><option value="all">전체 결제자</option>${MEMBERS.map(member=>`<option ${activeExpenseFilters.member===member?'selected':''}>${member}</option>`).join('')}</select></label><label><span>구분</span><select data-expense-filter="scope"><option value="all">전체 구분</option><option value="common" ${activeExpenseFilters.scope==='common'?'selected':''}>공동</option><option value="personal" ${activeExpenseFilters.scope==='personal'?'selected':''}>개인</option></select></label><label><span>카테고리</span><select data-expense-filter="category"><option value="all">전체 카테고리</option>${categories.map(category=>`<option ${activeExpenseFilters.category===category?'selected':''}>${esc(category)}</option>`).join('')}</select></label>`;
  const filteredExpenses=state.expenses.filter(e=>(activeExpenseFilters.month==='all'||e.date.startsWith(activeExpenseFilters.month))&&(activeExpenseFilters.member==='all'||e.payer===activeExpenseFilters.member)&&(activeExpenseFilters.scope==='all'||e.scope===activeExpenseFilters.scope)&&(activeExpenseFilters.category==='all'||e.category===activeExpenseFilters.category)),filteredTotal=filteredExpenses.reduce((sum,e)=>sum+expenseJPY(e),0);
  document.querySelector('#expenseResultSummary').innerHTML=`<span><b>${filteredExpenses.length}</b>건</span><span>합계 <b>${won(filteredTotal)}</b> · ${yen(filteredTotal)}</span>`;
  document.querySelector('#expenseList').innerHTML=filteredExpenses.map(e=>{const amount=expenseJPY(e),individualShared=e.paymentMode==='individual_shared';return `<div class="expense-row" tabindex="0" role="button" aria-label="${esc(e.description)} 지출 수정" data-edit-expense="${e.id}"><small>${e.date.slice(5)}</small><div><b>${esc(e.description)}</b><small>${e.category} · 결제 ${e.payer}${individualShared?' · 같이 사용/각자 결제':e.scope==='personal'?` · 사용 ${e.owner}`:' · 공동'}</small></div><div class="amount"><b>${won(amount)}</b><small>${yen(amount)}${e.inputCurrency==='KRW'?' · 원화 입력':''}</small></div><span class="expense-scope ${e.scope}">${individualShared?'각자':e.scope==='personal'?'개인':'공동'}</span><span class="tag ${e.settled?'done':'need'}">${individualShared?'정산 없음':e.settled?'정산 완료':'미정산'}</span></div>`}).join('')||'<p class="empty-state expense-filter-empty">조건에 맞는 지출이 없습니다.</p>';
  const paid=Object.fromEntries(MEMBERS.map(m=>[m,state.expenses.filter(e=>e.payer===m).reduce((a,e)=>a+expenseJPY(e),0)]));
  const personalByMember=Object.fromEntries(MEMBERS.map(m=>[m,personal.filter(e=>e.owner===m).reduce((a,e)=>a+expenseJPY(e),0)]));
  document.querySelector('#settlement').innerHTML=MEMBERS.map((m,i)=>{const burden=commonShare+personalByMember[m],diff=paid[m]-burden;return `<div class="settle-person expanded"><span class="avatar" style="background:${['#b94d2f','#b38a35'][i]}">${m[0]}</span><div><b>${m}${m===MASTER?' <em class="master-badge">MASTER</em>':''}</b><small>공동 부담 ${won(commonShare)} + 개인 ${won(personalByMember[m])}</small><em class="member-total">총 부담 ${won(burden)} · ${yen(burden)}</em></div><div class="settle-result"><strong class="${diff>=0?'receive':'send'}">${diff>=0?'받을 돈':'보낼 돈'} ${won(Math.abs(diff))}</strong><small>${yen(Math.abs(diff))} · 총 결제 ${won(paid[m])}</small></div></div>`}).join('')+`<div class="settle-transfer"><b>계산 기준</b><p>개인별 총 부담은 공동 경비 1/2과 본인 개인 경비의 합입니다. 실제 결제액과 비교해 받을·보낼 돈을 계산합니다.</p></div>`;
}
function renderBookings(){
  const statuses=['조사 필요','예약 예정','예약 요청','예약 완료','취소'];
  document.querySelector('#bookingBoard').innerHTML=statuses.map(status=>{const list=state.reservations.filter(r=>r.status===status);return `<section class="booking-column"><div class="booking-column-head"><b>${status}</b><span>${list.length}</span></div>${list.map(r=>`<article class="booking-card"><div class="booking-card-head"><h4>${esc(r.place)}</h4><div><button class="icon-button" type="button" data-edit-booking="${r.id}" aria-label="${esc(r.place)} 예약 수정">✎</button><button class="icon-button booking-delete" type="button" data-delete-booking="${r.id}" aria-label="${esc(r.place)} 예약 삭제">×</button></div></div><p>◷ ${r.date.slice(5)} · ${esc(r.time)} · ${r.people}명</p><p>예약자 ${esc(r.booker)} · ${esc(r.method)}</p><p>취소 기한 ${esc(r.deadline)}</p><select data-booking-status="${r.id}">${statuses.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></article>`).join('')}</section>`}).join('');
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
function renderTripPeriod(){
  const duration=TRIP_DATES.length,period=duration===1?'1일':`${duration-1}박 ${duration}일`,format=new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'short',day:'numeric'});
  document.querySelector('#tripStart').value=state.tripStart;document.querySelector('#tripEnd').value=state.tripEnd;
  document.querySelector('#tripPeriodSummary').textContent=`${period} · ${format.format(parseDate(state.tripStart))} ~ ${format.format(parseDate(state.tripEnd))}`;
  document.querySelector('#timelineTitle').textContent=`${period} 한눈에 보기`;
  document.querySelector('#brandTripDates').textContent=`${state.tripStart.replaceAll('-','.')} — ${state.tripEnd.replaceAll('-','.')}`;
  const firstNight=document.querySelector('#firstNightDate'),first=TRIP_DATES[0];if(firstNight&&first)firstNight.textContent=`${new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(parseDate(first.date)).toUpperCase()} · ${first.short}`;
  document.title=`SAPPORO / ${period}`;
}
function renderAll(){syncTripDates();document.querySelector('#exchangeRate').value=state.exchangeRate;renderTripPeriod();renderStats();renderTimeline();renderHomeChecklist();renderSchedule();renderFoliage();renderFood();renderDrinks();renderMapFilters();renderBudget();renderBookings();renderChecklist();renderActivity();document.querySelector('#currentMemberName').textContent=state.currentMember;document.querySelector('#memberAvatar').textContent=state.currentMember[0]||'이';document.querySelector('#currentMemberRole').textContent=state.currentMember===MASTER?'마스터 · 온라인':'편집 가능 · 온라인';if(mainMap)initMainMap();if(susukinoMap)initSusukinoMap();queueMicrotask(runConsistencyChecks)}

const scheduleFields=[['time','시간','time'],['end','종료','time'],['place','장소','text','wide'],['category','카테고리','select'],['description','한 줄 설명','text','wide'],['duration','예상 체류시간(분)','number'],['nextTravel','다음 장소 이동시간(분)','number'],['transport','이동방법','text'],['cost','예상 비용(JPY)','number'],['reservation','예약 여부','select'],['reservationTime','예약 시간','time'],['map','Google Maps 링크','url','wide'],['official','공식/예약 링크','url','wide'],['memo','메모','textarea','wide']];
function parseSmartDate(value){
  const raw=String(value||'').trim().replace(/[년.\/]/g,'-').replace(/월/g,'-').replace(/일/g,'').replace(/\s+/g,'');
  let year,month,day,match;
  if((match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){[,year,month,day]=match}
  else if((match=raw.match(/^(\d{1,2})-(\d{1,2})$/))){year=state.tripStart.slice(0,4);[,month,day]=match}
  else if((match=raw.match(/^(\d{4})$/))){year=state.tripStart.slice(0,4);month=match[1].slice(0,2);day=match[1].slice(2)}
  else if((match=raw.match(/^(\d{1,2})$/))){const tripDay=TRIP_DATES.find(item=>Number(item.date.slice(8))===Number(match[1]));if(tripDay)return tripDay.date;year=state.tripStart.slice(0,4);month=activeDay.slice(5,7);day=match[1]}
  else return '';
  const normalized=`${year}-${String(Number(month)).padStart(2,'0')}-${String(Number(day)).padStart(2,'0')}`,date=parseDate(normalized);
  return Number.isNaN(date.getTime())||dateKey(date)!==normalized?'':normalized;
}
function parseSmartTime(value){
  let raw=String(value||'').trim().toLowerCase().replace(/\s+/g,''),period='';
  if(raw.includes('오후')||raw.includes('pm'))period='pm';if(raw.includes('오전')||raw.includes('am'))period='am';
  raw=raw.replace(/오전|오후|am|pm|시|분/g,'');let hour,minute=0,match;
  if((match=raw.match(/^(\d{1,2}):(\d{1,2})$/))){hour=Number(match[1]);minute=Number(match[2])}
  else if(/^\d{3,4}$/.test(raw)){hour=Number(raw.slice(0,-2));minute=Number(raw.slice(-2))}
  else if(/^\d{1,2}$/.test(raw)){hour=Number(raw)}else return '';
  if(period==='pm'&&hour<12)hour+=12;if(period==='am'&&hour===12)hour=0;
  return hour>=0&&hour<24&&minute>=0&&minute<60?`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`:'';
}
const smartDateInput=(name,value,required=true)=>`<input type="text" inputmode="numeric" data-smart-date name="${name}" value="${esc(value||'')}" placeholder="10/23, 1023" ${required?'required':''}>`;
const smartTimeInput=(name,value,required=false)=>`<input type="text" inputmode="numeric" data-smart-time name="${name}" value="${esc(value||'')}" placeholder="오후7, 1930, 9:30" ${required?'required':''}>`;
function normalizeSmartInput(input,notify=false){const parser=input.matches('[data-smart-date]')?parseSmartDate:parseSmartTime,normalized=parser(input.value);if(!input.value&&!input.required){input.setCustomValidity('');return true}if(normalized){input.value=normalized;input.setCustomValidity('');return true}input.setCustomValidity(input.matches('[data-smart-date]')?'날짜를 10/23 또는 1023처럼 입력해주세요.':'시간을 오후7, 1930 또는 9:30처럼 입력해주세요.');if(notify)input.reportValidity();return false}
function scheduleSourceOptions(){
  return [
    ...state.food.map(item=>({label:`맛집 · ${item.name} · ${item.area}`,item,category:'food',description:[item.menu,item.hours].filter(Boolean).join(' · '),duration:90,transport:'확인 필요',reservation:String(item.reservable).includes('불가')?'불필요':'확인 필요',memo:item.memo||item.review||''})),
    ...state.drinks.map(item=>({label:`술 · ${item.name} · ${item.area}`,item,category:'drink',description:[item.menu,item.alcohol].filter(Boolean).join(' · '),duration:120,transport:'도보',reservation:String(item.reservable).includes('불가')?'불필요':'확인 필요',memo:item.note||''})),
    ...state.foliage.map(item=>({label:`단풍 · ${item.name} · ${item.area}`,item,category:'tour',description:item.note||item.fit||'',duration:Number.parseInt(item.duration)||90,transport:item.transport||'확인 필요',reservation:'불필요',memo:[item.season,item.status,item.weather].filter(Boolean).join(' · ')})),
    ...(state.savedPlaces||[]).map(item=>({label:`${CAT[item.category]?.label||'장소'} · ${item.name} · ${item.area||item.address||'홋카이도'}`,item,category:item.category||'tour',description:item.note||item.sourceList||'',duration:90,transport:'확인 필요',reservation:'확인 필요',memo:item.sourceList?`Google Maps · ${item.sourceList}`:''}))
  ];
}
function openScheduleEditor(id){
  const item=id?state.schedules.find(s=>s.id===id):{id:uid('s'),date:activeDay,time:'12:00',end:'13:00',place:'',category:'tour',description:'',duration:60,nextTravel:0,transport:'도보',cost:0,reservation:'확인 필요',reservationTime:'',map:'',official:'',memo:''};
  const sources=scheduleSourceOptions();
  editing={type:'schedule',id:item.id,isNew:!id};document.querySelector('#modalEyebrow').textContent=item.date;document.querySelector('#modalTitle').textContent=id?'일정 수정':'새 일정 추가';document.querySelector('#deleteItem').style.visibility=id?'visible':'hidden';
  document.querySelector('#editorFields').innerHTML=`<div class="field wide dashboard-source-picker"><span>대시보드 정보 불러오기</span><div class="source-filter-chips"><button type="button" class="active" data-source-filter="all">전체</button><button type="button" data-source-filter="food">맛집</button><button type="button" data-source-filter="drink">술</button><button type="button" data-source-filter="tour">단풍·관광</button><button type="button" data-source-filter="other">기타</button></div><input id="scheduleSourceSearch" placeholder="장소명, 지역, 메뉴 검색" autocomplete="off"><div class="schedule-source-results" id="scheduleSourceResults" role="listbox"></div><small>검색 후 방향키 ↑↓와 Enter로 선택할 수 있어요.</small></div><label class="field"><span>날짜</span>${smartDateInput('date',item.date)}</label>`+scheduleFields.map(([key,label,type,wide])=>{if(type==='select'){const opts=key==='category'?Object.entries(CAT).map(([v,c])=>`<option value="${v}" ${v===item[key]?'selected':''}>${c.label}</option>`).join(''):['조사 필요','확인 필요','예약 예정','예약 요청','예약 완료','불필요'].map(v=>`<option ${v===item[key]?'selected':''}>${v}</option>`).join('');return `<label class="field ${wide||''}"><span>${label}</span><select name="${key}">${opts}</select></label>`}const control=type==='textarea'?`<textarea name="${key}">${esc(item[key])}</textarea>`:type==='time'?smartTimeInput(key,item[key],['time','end'].includes(key)):`<input type="${type}" name="${key}" value="${esc(item[key])}">`;return `<label class="field ${wide||''}"><span>${label}</span>${control}</label>`}).join('');
  const form=document.querySelector('#editorForm'),sourceSearch=document.querySelector('#scheduleSourceSearch'),results=document.querySelector('#scheduleSourceResults');let sourceFilter='all',activeResult=0,visibleSources=[];
  const sourceType=source=>source.category==='food'?'food':source.category==='drink'?'drink':source.category==='tour'?'tour':'other';
  const fillFromSource=source=>{if(!source)return;const sourceItem=source.item,fields={place:sourceItem.name,category:source.category,description:source.description,duration:source.duration,nextTravel:15,transport:source.transport,cost:0,reservation:source.reservation,map:sourceItem.map||'',official:sourceItem.official||sourceItem.booking||'',memo:source.memo};Object.entries(fields).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value??''});sourceSearch.value=sourceItem.name;results.innerHTML='';toast(`${sourceItem.name} 정보를 일정에 불러왔어요.`)};
  const renderSourceResults=()=>{const terms=sourceSearch.value.trim().toLowerCase().split(/\s+/).filter(Boolean);visibleSources=sources.filter(source=>(sourceFilter==='all'||sourceType(source)===sourceFilter)&&terms.every(term=>source.label.toLowerCase().includes(term))).slice(0,7);activeResult=Math.min(activeResult,Math.max(visibleSources.length-1,0));results.innerHTML=visibleSources.map((source,index)=>`<button type="button" role="option" class="${index===activeResult?'active':''}" data-source-result="${index}"><b>${esc(source.item.name)}</b><small>${esc([source.label.split(' · ')[0],source.item.area||source.item.address||'홋카이도'].join(' · '))}</small></button>`).join('')||(sourceSearch.value?'<p>검색 결과가 없습니다.</p>':'<p>검색어를 입력하거나 종류를 선택하세요.</p>')};
  sourceSearch.addEventListener('input',()=>{activeResult=0;renderSourceResults()});sourceSearch.addEventListener('focus',renderSourceResults);sourceSearch.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();activeResult=Math.max(0,Math.min(visibleSources.length-1,activeResult+(event.key==='ArrowDown'?1:-1)));renderSourceResults()}else if(event.key==='Enter'&&visibleSources.length){event.preventDefault();fillFromSource(visibleSources[activeResult])}else if(event.key==='Escape'){results.innerHTML=''}});
  document.querySelectorAll('[data-source-filter]').forEach(button=>button.addEventListener('click',()=>{sourceFilter=button.dataset.sourceFilter;document.querySelectorAll('[data-source-filter]').forEach(filterButton=>filterButton.classList.toggle('active',filterButton===button));activeResult=0;renderSourceResults();sourceSearch.focus()}));results.addEventListener('click',event=>{const button=event.target.closest('[data-source-result]');if(button)fillFromSource(visibleSources[Number(button.dataset.sourceResult)])});
  document.querySelector('#editorDialog').showModal();
}
function openPlaceEditor(kind,id){
  const collection=kind==='food'?state.food:state.drinks,item=id?collection.find(x=>x.id===id):kind==='food'?{id:uid('p'),name:'',menu:'',category:'이자카야',area:'',price:'확인 필요',hours:'확인 필요',priority:'candidate',visit:'미정',map:'',memo:'',votes:0,stars:3}:{id:uid('d'),name:'',area:'스스키노',mood:'',alcohol:'',menu:'',category:'이자카야',price:'확인 필요',hours:'확인 필요',lastOrder:'확인 필요',reservable:'확인 필요',smoking:'확인 필요',stage:'1차',map:'',priority:3,votes:0,lat:43.0556,lng:141.3533,note:''};
  editing={type:kind,id:item.id,isNew:!id};document.querySelector('#modalEyebrow').textContent=kind==='food'?'FOOD PLACE':'DRINK PLACE';document.querySelector('#modalTitle').textContent=`${id?'후보 수정':'새 후보 추가'}`;document.querySelector('#deleteItem').style.visibility=id?'visible':'hidden';
  const keys=kind==='food'?[['name','가게명'],['menu','대표 메뉴'],['category','카테고리'],['area','지역'],['price','가격대'],['hours','영업시간'],['visit','방문 예정일'],['priority','우선순위'],['map','Google Maps'],['memo','메모']]:[['name','이름'],['area','지역'],['mood','분위기'],['alcohol','주력 술'],['menu','대표 메뉴'],['category','카테고리'],['price','가격대'],['hours','영업시간'],['lastOrder','Last Order'],['reservable','예약 가능 여부'],['smoking','흡연 여부'],['stage','추천 차수'],['map','Google Maps'],['note','메모']];
  document.querySelector('#editorFields').innerHTML=keys.map(([k,l])=>`<label class="field ${['name','map','memo','note'].includes(k)?'wide':''}"><span>${l}</span>${k==='priority'?`<select name="priority"><option value="must" ${item.priority==='must'?'selected':''}>무조건 가기</option><option value="maybe" ${item.priority==='maybe'?'selected':''}>시간 되면</option><option value="candidate" ${item.priority==='candidate'?'selected':''}>후보</option></select>`:`<input name="${k}" value="${esc(item[k])}">`}</label>`).join('');document.querySelector('#editorDialog').showModal();
}
function openExpenseEditor(id){
  const item=id?state.expenses.find(e=>e.id===id):{id:uid('e'),date:new Date().toISOString().slice(0,10),payer:state.currentMember,owner:state.currentMember,scope:'common',inputCurrency:'JPY',inputAmount:0,amount:0,category:'식비',description:'',participants:[...MEMBERS],settled:false};
  const currency=item.inputCurrency||'JPY',inputAmount=Number(item.inputAmount??item.amount??0),scope=item.scope||'common';
  editing={type:'expense',id:item.id,isNew:!id,item};document.querySelector('#modalEyebrow').textContent=id?'EDIT EXPENSE':'NEW EXPENSE';document.querySelector('#modalTitle').textContent=id?'지출 수정':'지출 추가';document.querySelector('#deleteItem').style.visibility=id?'visible':'hidden';
  document.querySelector('#editorFields').innerHTML=`<label class="field"><span>지출 구분</span><select name="scope" id="expenseScope"><option value="common" ${scope==='common'?'selected':''}>공동 지출 · 한 명이 결제</option><option value="personal" ${scope==='personal'?'selected':''}>개인 지출</option>${!id?'<option value="individual_shared">같이 사용 · 각자 결제</option>':''}</select></label><label class="field"><span>날짜</span>${smartDateInput('date',item.date)}</label><label class="field" id="expensePayerField"><span>결제자</span><select name="payer">${MEMBERS.map(m=>`<option ${m===item.payer?'selected':''}>${m}</option>`).join('')}</select></label><label class="field" id="expenseOwnerField"><span>개인 지출 대상</span><select name="owner">${MEMBERS.map(m=>`<option ${m===(item.owner||item.payer)?'selected':''}>${m}</option>`).join('')}</select></label><label class="field"><span>입력 통화</span><select name="inputCurrency" id="expenseCurrency"><option value="JPY" ${currency==='JPY'?'selected':''}>JPY · 엔화</option><option value="KRW" ${currency==='KRW'?'selected':''}>KRW · 원화</option></select></label><label class="field"><span id="expenseAmountLabel">금액</span><input type="number" min="0" step="1" name="inputAmount" id="expenseInputAmount" value="${inputAmount}" required></label><div class="expense-preview wide" id="expenseConversionPreview"></div><label class="field"><span>카테고리</span><select name="category">${['항공','숙소','교통','식비','술','관광','쇼핑','기타'].map(c=>`<option ${c===item.category?'selected':''}>${c}</option>`).join('')}</select></label><label class="field" id="expenseSettledField"><span>정산 상태</span><select name="settled"><option value="false" ${!item.settled?'selected':''}>미정산</option><option value="true" ${item.settled?'selected':''}>정산 완료</option></select></label><label class="field wide"><span>설명</span><input name="description" value="${esc(item.description)}" required placeholder="예: 공항버스 (각자 티머니)"></label>`;
  updateExpenseForm();document.querySelector('#editorDialog').showModal();
}
function updateExpenseForm(){
  if(editing?.type!=='expense')return;const form=document.querySelector('#editorForm'),scope=form.elements.scope?.value,currency=form.elements.inputCurrency?.value,raw=Number(form.elements.inputAmount?.value)||0,rate=Number(state.exchangeRate)||initialData.exchangeRate;
  const split=scope==='individual_shared';document.querySelector('#expenseOwnerField').hidden=scope!=='personal';document.querySelector('#expensePayerField').hidden=split;document.querySelector('#expenseSettledField').hidden=split;document.querySelector('#expenseAmountLabel').textContent=split?'1인 금액':'금액';const jpy=currency==='KRW'?raw/rate:raw,krw=currency==='KRW'?raw:raw*rate;
  document.querySelector('#expenseConversionPreview').innerHTML=split?`<small>${MEMBERS.length}명이 각자 결제 · 정산금 없음</small><b>1인 ₩${Math.round(krw).toLocaleString('ko-KR')} <span>·</span> 전체 ₩${Math.round(krw*MEMBERS.length).toLocaleString('ko-KR')}</b>`:`<small>환율 ¥1 = ₩${rate}</small><b>₩${Math.round(krw).toLocaleString('ko-KR')} <span>≈</span> ${yen(jpy)}</b>`;
}
function openBookingEditor(id){
  const item=id?state.reservations.find(r=>r.id===id):{id:uid('r'),scheduleId:'',place:'',date:activeDay,time:'18:30',people:MEMBERS.length,booker:state.currentMember,method:'확인 필요',number:'',link:'',deadline:'확인 필요',note:'',status:'조사 필요'};
  if(!item)return;
  const linkedSchedule=state.schedules.find(s=>s.id===item.scheduleId),scheduleLabel=linkedSchedule?`${linkedSchedule.date.slice(5)} ${linkedSchedule.time} · ${linkedSchedule.place}`:'';
  editing={type:'booking',id:item.id,isNew:!id,item};document.querySelector('#modalEyebrow').textContent=id?'EDIT RESERVATION':'NEW RESERVATION';document.querySelector('#modalTitle').textContent=id?'예약 수정':'예약 추가';document.querySelector('#deleteItem').style.visibility=id?'visible':'hidden';
  document.querySelector('#editorFields').innerHTML=`<label class="field wide"><span>장소</span><input name="place" value="${esc(item.place)}" required></label><label class="field wide schedule-picker"><span>연결할 일정</span><input name="scheduleSearch" list="scheduleOptions" value="${esc(scheduleLabel)}" placeholder="날짜, 시간 또는 장소로 검색" autocomplete="off"><input type="hidden" name="scheduleId" value="${esc(item.scheduleId||'')}"><datalist id="scheduleOptions">${state.schedules.map(s=>`<option value="${esc(`${s.date.slice(5)} ${s.time} · ${s.place}`)}"></option>`).join('')}</datalist><small>일정 이름이나 날짜를 입력해 빠르게 찾을 수 있어요. 비워두면 연결하지 않습니다.</small></label><label class="field"><span>날짜</span>${smartDateInput('date',item.date)}</label><label class="field"><span>시간</span>${smartTimeInput('time',item.time,true)}</label><label class="field"><span>인원</span><input type="number" name="people" value="${item.people}"></label><label class="field"><span>예약자</span><select name="booker">${MEMBERS.map(m=>`<option ${m===item.booker?'selected':''}>${m}</option>`).join('')}</select></label><label class="field"><span>예약 방법</span><input name="method" value="${esc(item.method)}"></label><label class="field"><span>상태</span><select name="status">${['조사 필요','예약 예정','예약 요청','예약 완료','취소'].map(s=>`<option ${s===item.status?'selected':''}>${s}</option>`).join('')}</select></label><label class="field"><span>예약번호</span><input name="number" value="${esc(item.number)}"></label><label class="field"><span>취소 가능 기한</span><input name="deadline" value="${esc(item.deadline)}"></label><label class="field wide"><span>예약 링크</span><input type="url" name="link" value="${esc(item.link)}"></label><label class="field wide"><span>메모</span><textarea name="note">${esc(item.note)}</textarea></label>`;
  const form=document.querySelector('#editorForm'),search=form.elements.scheduleSearch,hidden=form.elements.scheduleId;
  search.addEventListener('input',()=>{const match=state.schedules.find(s=>`${s.date.slice(5)} ${s.time} · ${s.place}`===search.value);hidden.value=match?.id||''});
  document.querySelector('#editorDialog').showModal();
}

document.addEventListener('click',e=>{
  const pageBtn=e.target.closest('[data-page],[data-page-link]');if(pageBtn){navigate(pageBtn.dataset.page||pageBtn.dataset.pageLink);return}
  if(e.target.closest('#menuButton')){setMobileMenuOpen(!document.querySelector('#sidebar').classList.contains('open'));return}
  if(e.target.closest('#sidebarBackdrop')){setMobileMenuOpen(false);return}
  if(e.target.closest('#settingsButton')){setMobileMenuOpen(false);document.querySelector('#settingsDialog').showModal();return}
  if(e.target.closest('#shareButton')){document.querySelector('#settingsDialog').close();document.querySelector('#shareUrl').value=location.href;document.querySelector('#shareDialog').showModal();return}
  if(e.target.closest('#mapsImportButton')){document.querySelector('#settingsDialog').close();if(!pendingMapsImports.length)document.querySelector('#mapsImportFile').value='';renderMapsImportReview();document.querySelector('#mapsImportDialog').showModal();return}
  if(e.target.closest('#verifyMapsRegions')){verifyImportedRegions();return}
  if(e.target.closest('#confirmMapsImport')){importGoogleMapsPlaces();return}
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
  const editBooking=e.target.closest('[data-edit-booking]');if(editBooking){openBookingEditor(editBooking.dataset.editBooking);return}
  const deleteBooking=e.target.closest('[data-delete-booking]');if(deleteBooking){const item=state.reservations.find(r=>r.id===deleteBooking.dataset.deleteBooking);if(item&&confirm(`${item.place} 예약을 삭제할까요?`)){state.reservations=state.reservations.filter(r=>r.id!==item.id);saveState(`${item.place} 예약 항목을 삭제했어요`);renderAll();toast('예약을 삭제했어요.')}return}
  const editPlace=e.target.closest('[data-edit-place]');if(editPlace){const [kind,id]=editPlace.dataset.editPlace.split(':');openPlaceEditor(kind,id);return}
  const vote=e.target.closest('[data-vote]');if(vote){const [kind,id]=vote.dataset.vote.split(':'),item=(kind==='food'?state.food:state.drinks).find(x=>x.id===id);item.voted=!item.voted;item.votes+=item.voted?1:-1;saveState(`${item.name}에 ${item.voted?'투표했어요':'투표를 취소했어요'}`);renderAll();toast(item.voted?'한 표를 보탰어요 👍':'투표를 취소했어요.');return}
  const drink=e.target.closest('[data-drink-category]');if(drink){activeDrinkCategory=drink.dataset.drinkCategory;renderDrinks();return}
  const mapCat=e.target.closest('[data-map-category]');if(mapCat){activeMapCategory=mapCat.dataset.mapCategory;renderMapFilters();initMainMap();return}
  const addMap=e.target.closest('[data-add-map]');if(addMap){const p=allMapPlaces().find(x=>x.id===addMap.dataset.addMap);if(p){state.schedules.push({id:uid('s'),date:activeDay,time:'12:00',end:'13:30',place:p.name,category:p.category==='drink'?'drink':p.category==='food'?'food':'tour',description:p.description||p.note||'',duration:90,nextTravel:15,transport:'확인 필요',cost:0,reservation:'확인 필요',reservationTime:'',map:p.map||'',official:p.official||'',memo:'지도에서 추가됨'});saveState(`${p.name}을 일정에 추가했어요`);renderAll();toast('현재 선택된 날짜에 추가했어요.')}return}
  if(e.target.closest('#addExpense')){openExpenseEditor();return}
  const expense=e.target.closest('[data-edit-expense]');if(expense){openExpenseEditor(expense.dataset.editExpense);return}
  if(e.target.closest('#resetExpenseFilters')){activeExpenseFilters={month:'all',member:'all',scope:'all',category:'all'};renderBudget();return}
  const importSelect=e.target.closest('[data-import-select]');if(importSelect){pendingMapsImports[Number(importSelect.dataset.importSelect)].selected=importSelect.checked;renderMapsImportReview();return}
  if(e.target.closest('#addChecklist')){const text=prompt('새 할 일을 입력하세요.');if(text){state.checklist.push({id:uid('c'),category:'기타',text,due:'날짜 미정',done:false,urgent:false});saveState(`${text} 할 일을 추가했어요`);renderAll()}return}
  if(e.target.closest('#copyLink')){navigator.clipboard?.writeText(location.href);toast('공유 링크를 복사했어요.');return}
  if(e.target.closest('#routeMode')){toast('지도에서 출발지와 도착지를 차례로 선택하세요. (경로 API 연결 필요)');return}
});
document.addEventListener('keydown',e=>{
  if(!['Enter',' '].includes(e.key)||!e.target.matches('.expense-row[data-edit-expense]'))return;
  e.preventDefault();e.target.click();
});
document.addEventListener('blur',e=>{if(e.target.matches('[data-smart-date],[data-smart-time]'))normalizeSmartInput(e.target,true)},true);
document.addEventListener('input',e=>{if(e.target.matches('[data-smart-date],[data-smart-time]'))e.target.setCustomValidity('');if(e.target.id==='exchangeRate'){state.exchangeRate=Math.max(0,Number(e.target.value)||0);renderStats();renderBudget();document.querySelector('#exchangeUpdated').textContent='입력 중'}if(e.target.id==='expenseInputAmount')updateExpenseForm()});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-booking-status]')){const r=state.reservations.find(x=>x.id===e.target.dataset.bookingStatus);r.status=e.target.value;syncReservationToSchedule(r);saveState(`${r.place} 예약 상태를 ${r.status}(으)로 변경했어요`);renderAll();toast('예약 상태와 연결 일정을 동기화했어요.');}
  if(e.target.id==='exchangeRate'){state.exchangeRate=Math.max(0,Number(e.target.value)||initialData.exchangeRate);if(!PREVIEW_MODE)localStorage.setItem('sapporo-rate',state.exchangeRate);document.querySelector('#exchangeUpdated').textContent='방금';saveState(`공통 환율을 ¥1 = ₩${state.exchangeRate}(으)로 변경했어요`);renderAll();toast('메인 대시보드와 경비에 환율을 반영했어요.')}
  if(e.target.id==='expenseScope'||e.target.id==='expenseCurrency')updateExpenseForm();
  if(e.target.matches('[data-expense-filter]')){activeExpenseFilters[e.target.dataset.expenseFilter]=e.target.value;renderBudget();}
  if(e.target.matches('[data-import-category]')){pendingMapsImports[Number(e.target.dataset.importCategory)].category=e.target.value;}
  if(e.target.matches('[data-food-priority]')){const place=state.food.find(item=>item.id===e.target.dataset.foodPriority),label=e.target.options[e.target.selectedIndex].text;if(place){place.priority=e.target.value;saveState(`${place.name} 우선순위를 변경했어요`);renderAll();toast(`${place.name} · ${label}`)}}
  if(e.target.id==='globalFoliageStatus'){activeFoliageStatus=e.target.value;renderFoliage();}
  if(e.target.matches('[data-foliage-status]')){const place=state.foliage.find(f=>f.id===e.target.dataset.foliageStatus);place.status=e.target.value;saveState(`${place.name} 단풍 상태를 ${place.status}(으)로 변경했어요`);renderAll();toast('단풍 카드와 지도 상세에 상태를 반영했어요.');}
});
document.querySelector('#foodSearch').addEventListener('input',renderFood);
document.querySelector('#mapsImportFile').addEventListener('change',async e=>{const files=[...e.target.files];document.querySelector('#mapsImportSummary').textContent='파일을 분석하고 있어요…';pendingMapsImports=await parseTakeoutFiles(files);renderMapsImportReview();});
document.querySelector('#tripPeriodForm').addEventListener('submit',e=>{
  e.preventDefault();const smartInputs=[...e.currentTarget.querySelectorAll('[data-smart-date],[data-smart-time]')];if(!smartInputs.every(input=>normalizeSmartInput(input,true)))return;const start=e.currentTarget.tripStart.value,end=e.currentTarget.tripEnd.value;
  if(!start||!end)return toast('시작일과 종료일을 모두 입력해주세요.');
  const duration=Math.floor((parseDate(end)-parseDate(start))/86400000)+1;
  if(duration<1)return toast('종료일은 시작일보다 빠를 수 없어요.');
  if(duration>31)return toast('여행 기간은 최대 31일까지 입력할 수 있어요.');
  const oldStart=state.tripStart,oldEnd=state.tripEnd,offset=Math.round((parseDate(start)-parseDate(oldStart))/86400000);
  if(offset){state.schedules.filter(item=>item.date>=oldStart&&item.date<=oldEnd).forEach(item=>item.date=shiftDate(item.date,offset));state.reservations.filter(item=>item.date>=oldStart&&item.date<=oldEnd).forEach(item=>item.date=shiftDate(item.date,offset))}
  state.tripStart=start;state.tripEnd=end;activeDay=start;saveState(`여행 기간을 ${start} ~ ${end}(으)로 변경했어요`);renderAll();toast('여행 기간과 일정 날짜를 업데이트했어요.');
});
document.querySelector('#editorForm').addEventListener('submit',e=>{
  e.preventDefault();const smartInputs=[...e.currentTarget.querySelectorAll('[data-smart-date],[data-smart-time]')];if(!smartInputs.every(input=>normalizeSmartInput(input,true)))return;const fd=new FormData(e.currentTarget),values=Object.fromEntries(fd.entries());
  if(editing.type==='schedule'){const item=editing.isNew?{id:editing.id}:state.schedules.find(x=>x.id===editing.id);Object.assign(item,values,{duration:Number(values.duration),nextTravel:Number(values.nextTravel),cost:Number(values.cost)});if(editing.isNew)state.schedules.push(item);syncScheduleToReservation(item);saveState(`${item.place||'새 일정'}을 ${editing.isNew?'추가':'수정'}했어요`)}
  else if(editing.type==='food'||editing.type==='drink'){const arr=editing.type==='food'?state.food:state.drinks,item=editing.isNew?{id:editing.id,type:editing.type,votes:0,voted:false,stars:3,priority:editing.type==='food'?'candidate':3,lat:43.0556,lng:141.3533}:arr.find(x=>x.id===editing.id);Object.assign(item,values);if(editing.isNew)arr.push(item);saveState(`${item.name||'후보'}을 ${editing.isNew?'추가':'수정'}했어요`)}
  else if(editing.type==='expense'){const inputAmount=Number(values.inputAmount)||0;if(values.scope==='individual_shared'&&editing.isNew){MEMBERS.forEach(member=>state.expenses.push({...values,id:uid('e'),scope:'personal',paymentMode:'individual_shared',payer:member,owner:member,inputAmount,inputCurrency:values.inputCurrency,amount:values.inputCurrency==='KRW'?inputAmount/state.exchangeRate:inputAmount,settled:true,participants:[member]}));saveState(`각자 결제 지출 ${values.description||''}을 ${MEMBERS.length}명에게 추가했어요`)}else{const scope=values.scope==='personal'?'personal':'common',owner=scope==='personal'?values.owner:'';const item={...editing.item,...values,scope,owner,inputAmount,inputCurrency:values.inputCurrency,amount:values.inputCurrency==='KRW'?inputAmount/state.exchangeRate:inputAmount,settled:values.settled==='true',participants:scope==='personal'?[owner]:[...MEMBERS]};if(editing.isNew)state.expenses.push(item);else Object.assign(state.expenses.find(e=>e.id===editing.id),item);saveState(`${scope==='personal'?'개인':'공동'} 지출 ${item.description||''}을 ${editing.isNew?'추가':'수정'}했어요`)}}
  else if(editing.type==='booking'){const item={...editing.item,...values,people:Number(values.people)};delete item.scheduleSearch;if(editing.isNew)state.reservations.push(item);else Object.assign(state.reservations.find(r=>r.id===editing.id),item);syncReservationToSchedule(item);saveState(`${item.place} 예약 항목을 ${editing.isNew?'추가':'수정'}했어요`)}
  document.querySelector('#editorDialog').close();renderAll();toast('변경사항을 저장했어요.');
});
document.querySelector('#deleteItem').addEventListener('click',()=>{if(!editing||editing.isNew)return; if(!confirm('이 항목을 삭제할까요?'))return;const arr=editing.type==='schedule'?state.schedules:editing.type==='food'?state.food:editing.type==='drink'?state.drinks:editing.type==='expense'?state.expenses:state.reservations;if(editing.type==='schedule')state.reservations.filter(r=>r.scheduleId===editing.id).forEach(r=>r.scheduleId='');const idx=arr.findIndex(x=>x.id===editing.id);if(idx>=0)arr.splice(idx,1);saveState('항목을 삭제했어요');document.querySelector('#editorDialog').close();renderAll();toast('삭제했어요.');});
document.querySelectorAll('[data-close-editor]').forEach(button=>button.addEventListener('click',()=>document.querySelector('#editorDialog').close()));
document.querySelector('#memberButton').addEventListener('click',()=>{const i=MEMBERS.indexOf(state.currentMember);state.currentMember=MEMBERS[(i+1)%MEMBERS.length];saveState();renderAll();toast(`${state.currentMember} 님으로 전환했어요.`)});
document.querySelector('#previewButton').addEventListener('click',()=>{
  document.querySelector('#settingsDialog').close();
  if(PREVIEW_MODE)return toast('현재 안전한 미리보기 모드로 실행 중이에요.');
  window.open('mobile-preview.html','_blank','noopener');
});
document.querySelector('#authButton').addEventListener('click',()=>{document.querySelector('#settingsDialog').close();document.querySelector('#authDialog').showModal()});
document.querySelector('#closeAuth').addEventListener('click',()=>document.querySelector('#authDialog').close());
document.querySelector('#authForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(PREVIEW_MODE)return toast('미리보기에서는 로그인 이메일을 전송하지 않아요.');
  const email=document.querySelector('#authEmail').value.trim();
  if(!EMAIL_PATTERN.test(email))return toast('올바른 이메일 주소를 입력해 주세요.');
  if(!supabaseClient)return toast('로그인 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  if(otpSendPending)return;
  const button=document.querySelector('#sendOtpButton');
  otpSendPending=true;button.disabled=true;button.textContent='전송 중…';
  try{
    const {error}=await supabaseClient.auth.signInWithOtp({email});
    if(error){
      logSupabaseAuthError('Supabase OTP send error',error);
      toast('인증번호를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setOtpStep(true);toast('이메일로 인증번호를 보냈어요.');
  }catch(error){
    logSupabaseAuthError('Supabase OTP send exception',error);
    toast('인증번호를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }finally{
    otpSendPending=false;button.disabled=false;
    button.textContent=document.querySelector('#otpStep').hidden?'인증번호 받기':'인증번호 다시 받기';
  }
});
document.querySelector('#authOtp').addEventListener('input',event=>{event.target.value=event.target.value.replace(/\D/g,'').slice(0,10)});
document.querySelector('#verifyOtpButton').addEventListener('click',async()=>{
  if(PREVIEW_MODE)return toast('미리보기에서는 인증번호를 확인하지 않아요.');
  const email=document.querySelector('#authEmail').value.trim(),token=document.querySelector('#authOtp').value.trim(),button=document.querySelector('#verifyOtpButton');
  if(!EMAIL_PATTERN.test(email)||!/^[0-9]{6,10}$/.test(token))return toast('이메일과 6~10자리 인증번호를 확인해 주세요.');
  if(!supabaseClient)return toast('로그인 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  if(otpVerifyPending)return;
  otpVerifyPending=true;button.disabled=true;button.textContent='확인 중…';
  try{
    const {data,error}=await supabaseClient.auth.verifyOtp({email,token,type:'email'});
    if(error){
      logSupabaseAuthError('Supabase OTP verify error',error);
      toast('인증번호를 확인하지 못했습니다. 번호를 확인하고 다시 시도해 주세요.');
      return;
    }
    signedInUser=data.user;updateAuthUI();document.querySelector('#authDialog').close();setOtpStep(false);document.querySelector('#authOtp').value='';toast('서버 로그인과 데이터 연결이 완료됐어요.');
  }catch(error){
    logSupabaseAuthError('Supabase OTP verify exception',error);
    toast('인증번호를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }finally{
    otpVerifyPending=false;button.disabled=false;button.textContent='인증번호 확인';
  }
});
document.querySelector('#signOutButton').addEventListener('click',async()=>{
  if(PREVIEW_MODE)return;
  await supabaseClient.auth.signOut();
  signedInUser=null;
  if(remoteChannel){await supabaseClient.removeChannel(remoteChannel);remoteChannel=null}
  setOtpStep(false);document.querySelector('#authOtp').value='';document.querySelector('#authEmail').value='';updateAuthUI();document.querySelector('#authDialog').close();toast('서버에서 로그아웃했어요.');
});

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  document.querySelector('#installButtonMeta').textContent='이 기기에 설치할 수 있습니다';
});
document.querySelector('#installButton').addEventListener('click',async()=>{
  document.querySelector('#settingsDialog').close();
  if(!deferredInstallPrompt)return toast('브라우저 메뉴에서 홈 화면에 추가를 선택해 주세요.');
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  document.querySelector('#installButtonMeta').textContent='홈 화면에서 앱처럼 실행하기';
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  document.querySelector('#installButtonLabel').textContent='앱 설치됨';
  document.querySelector('#installButtonMeta').textContent='현재 기기에 설치되어 있습니다';
  toast('삿포로 여행 앱을 설치했어요.');
});
let responsiveTimer;
window.addEventListener('resize',()=>{clearTimeout(responsiveTimer);responsiveTimer=setTimeout(syncResponsiveUI,100)},{passive:true});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('#sidebar').classList.contains('open'))setMobileMenuOpen(false)});
if(!PREVIEW_MODE&&'serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js?v=13').catch(error=>console.warn('서비스 워커 등록 실패:',error)));
}

renderAll();
syncResponsiveUI();
if(PREVIEW_MODE){document.body.dataset.previewMode='true';updateAuthUI()}
initializeSupabase();
if(recoveredStorageNotice)setTimeout(()=>toast(recoveredStorageNotice),700);

const FEATURE_GUIDE_HIDE_KEY='sapporo-feature-guide-hidden-date';
const localDateKey=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`};
const featureGuideDialog=document.querySelector('#featureGuideDialog');
const closeFeatureGuide=()=>{if(featureGuideDialog.open)featureGuideDialog.close()};
document.querySelector('#closeFeatureGuide').addEventListener('click',closeFeatureGuide);
document.querySelector('#confirmFeatureGuide').addEventListener('click',closeFeatureGuide);
document.querySelector('#hideFeatureGuideToday').addEventListener('click',()=>{localStorage.setItem(FEATURE_GUIDE_HIDE_KEY,localDateKey());closeFeatureGuide();toast('오늘은 기능 안내를 표시하지 않아요.')});
window.addEventListener('load',()=>{if(localStorage.getItem(FEATURE_GUIDE_HIDE_KEY)!==localDateKey()&&!featureGuideDialog.open)setTimeout(()=>featureGuideDialog.showModal(),180)});
